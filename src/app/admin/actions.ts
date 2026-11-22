"use server";
// Manager actions. Each one re-checks the session and scopes every write to the manager's restaurant (§18).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { login, logout, requestPasswordReset, requireManager, resetPassword } from "@/lib/auth";
import { cancelBooking, markNoShow } from "@/lib/booking/service";
import { isValidDate } from "@/lib/time";

export type FormState = { error?: string; ok?: string } | undefined;

const HHMM = z.string().regex(/^([01]\d|2[0-4]):[0-5]\d$/, "שעה בפורמט HH:MM");

// ---------- auth ----------

export async function loginAction(_s: FormState, fd: FormData): Promise<FormState> {
  const r = await login(String(fd.get("email") ?? ""), String(fd.get("password") ?? ""));
  if (!r.ok) return { error: r.error === "locked" ? "יותר מדי ניסיונות כושלים. נסו שוב בעוד 15 דקות." : "דוא״ל או סיסמה שגויים." };
  redirect("/admin");
}

export async function logoutAction() {
  await logout();
  redirect("/admin/login");
}

export async function requestResetAction(_s: FormState, fd: FormData): Promise<FormState> {
  await requestPasswordReset(String(fd.get("email") ?? ""));
  return { ok: "אם הכתובת רשומה במערכת, נשלח אליה קוד איפוס." };
}

export async function resetPasswordAction(_s: FormState, fd: FormData): Promise<FormState> {
  const r = await resetPassword(String(fd.get("email") ?? ""), String(fd.get("code") ?? ""), String(fd.get("password") ?? ""));
  if (r.ok) redirect("/admin/login?reset=1");
  const msg = {
    invalid: "הקוד שגוי.",
    expired: "פג תוקף הקוד. בקשו קוד חדש.",
    too_many_attempts: "יותר מדי ניסיונות. בקשו קוד חדש.",
    weak_password: "הסיסמה צריכה להכיל לפחות 8 תווים.",
  }[r.error];
  return { error: msg };
}

// ---------- bookings ----------

export async function cancelBookingAction(fd: FormData) {
  const m = await requireManager();
  await cancelBooking({ restaurantId: m.restaurantId, bookingId: String(fd.get("bookingId")), bySystem: true });
  revalidatePath("/admin");
}

export async function noShowAction(fd: FormData) {
  const m = await requireManager();
  await markNoShow(m.restaurantId, String(fd.get("bookingId")));
  revalidatePath("/admin");
}

// ---------- tables ----------

const TableForm = z.object({
  label: z.string().trim().min(1).max(20),
  seats: z.coerce.number().int().min(1).max(30),
  area: z.enum(["INSIDE", "OUTSIDE"]),
  locationNote: z.string().trim().max(60).default(""),
});

export async function addTableAction(_s: FormState, fd: FormData): Promise<FormState> {
  const m = await requireManager();
  const p = TableForm.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "בדקו את פרטי השולחן." };
  await prisma.table.create({ data: { ...p.data, restaurantId: m.restaurantId } });
  revalidatePath("/admin/tables");
  return { ok: "השולחן נוסף." };
}

export async function toggleTableAction(fd: FormData) {
  const m = await requireManager();
  const t = await prisma.table.findFirst({ where: { id: String(fd.get("tableId")), restaurantId: m.restaurantId } });
  if (t) await prisma.table.update({ where: { id: t.id }, data: { active: !t.active } });
  revalidatePath("/admin/tables");
}

// ---------- hours ----------

export async function saveWeeklyHoursAction(_s: FormState, fd: FormData): Promise<FormState> {
  const m = await requireManager();
  const rows = [];
  for (let d = 0; d < 7; d++) {
    const closed = fd.get(`closed_${d}`) === "on";
    const open = String(fd.get(`open_${d}`) ?? "");
    const close = String(fd.get(`close_${d}`) ?? "");
    if (!closed && (!HHMM.safeParse(open).success || !HHMM.safeParse(close).success)) return { error: "בדקו את השעות (HH:MM)." };
    rows.push({ weekday: d, closed, open: open || "12:00", close: close || "23:00" });
  }
  await prisma.$transaction(
    rows.map((r) =>
      prisma.weeklyHours.upsert({
        where: { restaurantId_weekday: { restaurantId: m.restaurantId, weekday: r.weekday } },
        update: r,
        create: { ...r, restaurantId: m.restaurantId },
      }),
    ),
  );
  revalidatePath("/admin/hours");
  return { ok: "שעות הפעילות נשמרו." };
}

export async function addExceptionAction(_s: FormState, fd: FormData): Promise<FormState> {
  const m = await requireManager();
  const date = String(fd.get("date") ?? "");
  const closed = fd.get("closed") === "on";
  const open = String(fd.get("open") ?? "");
  const close = String(fd.get("close") ?? "");
  const note = String(fd.get("note") ?? "").slice(0, 80);
  if (!isValidDate(date)) return { error: "בחרו תאריך." };
  if (!closed && (!HHMM.safeParse(open).success || !HHMM.safeParse(close).success)) return { error: "הזינו שעות פתיחה וסגירה או סמנו סגור." };
  const data = { closed, open: closed ? null : open, close: closed ? null : close, note };
  await prisma.hoursException.upsert({
    where: { restaurantId_date: { restaurantId: m.restaurantId, date } },
    update: data,
    create: { ...data, date, restaurantId: m.restaurantId },
  });
  revalidatePath("/admin/hours");
  return { ok: "החריג נשמר." };
}

export async function deleteExceptionAction(fd: FormData) {
  const m = await requireManager();
  await prisma.hoursException.deleteMany({ where: { id: String(fd.get("id")), restaurantId: m.restaurantId } });
  revalidatePath("/admin/hours");
}

// ---------- settings ----------

const SettingsForm = z.object({
  seatingMinutes: z.coerce.number().int().min(30).max(300),
  cancelCutoffMinutes: z.union([z.literal(""), z.coerce.number().int().min(0).max(10080)]),
  cancellationPolicyText: z.string().trim().max(300),
  personaStyle: z.enum(["warm", "formal", "casual"]),
  menuUrl: z.union([z.literal(""), z.url()]),
  parking: z.string().trim().max(300),
});

export async function saveSettingsAction(_s: FormState, fd: FormData): Promise<FormState> {
  const m = await requireManager();
  const p = SettingsForm.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "בדקו את הערכים בטופס." };
  const d = p.data;
  await prisma.restaurant.update({
    where: { id: m.restaurantId },
    data: {
      seatingMinutes: d.seatingMinutes,
      cancelCutoffMinutes: d.cancelCutoffMinutes === "" ? null : d.cancelCutoffMinutes,
      cancellationPolicyText: d.cancellationPolicyText,
      personaStyle: d.personaStyle,
      menuUrl: d.menuUrl || null,
      parking: d.parking,
      allowBookingWhenClosed: fd.get("allowBookingWhenClosed") === "on",
    },
  });
  revalidatePath("/admin/settings");
  return { ok: "ההגדרות נשמרו." };
}

// ---------- callbacks ----------

export async function markCallbackHandledAction(fd: FormData) {
  const m = await requireManager();
  await prisma.callbackRequest.updateMany({ where: { id: String(fd.get("id")), restaurantId: m.restaurantId }, data: { handled: true } });
  revalidatePath("/admin/messages");
}
