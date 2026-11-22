// Booking service: database operations on top of the pure engine.
// Every function takes restaurantId and scopes every query by it (§18).
import { randomInt } from "node:crypto";
import { prisma, isUniqueViolation } from "../db";
import { getSmsProvider } from "../sms/provider";
import {
  bookingCancelledSms,
  bookingConfirmedSms,
  bookingUpdatedSms,
  menuLinkSms,
} from "../sms/templates";
import { HEBREW_WEEKDAYS, addDays, hebrewDate, toLocal, weekdayOf, zonedToUtc } from "../time";
import {
  availableTimes,
  candidateTables,
  hoursFor,
  isOpenAt,
  maxTableSize,
  occupiedSlots,
  pickAlternatives,
  validateRequest,
  type AreaPref,
  type BusyMap,
  type DayHours,
  type RejectReason,
  type Rules,
  type TableInfo,
} from "./engine";

const MAX_RACE_RETRIES = 5;

export type Failure = {
  ok: false;
  reason: RejectReason | "unavailable" | "not_found" | "invalid_phone" | "invalid_name" | "past_cancellation_cutoff" | "invalid_party_size";
  alternatives?: string[];
  detail?: string;
};

export interface PublicBooking {
  bookingId: string;
  code: string;
  customerName: string;
  phone: string;
  date: string;
  dateHebrew: string;
  time: string;
  partySize: number;
  area: string;
  status: string;
}

// ---------- loading ----------

export async function loadRules(restaurantId: string): Promise<{ rules: Rules; restaurant: Awaited<ReturnType<typeof getRestaurant>> }> {
  const restaurant = await getRestaurant(restaurantId);
  const weekly: Record<number, DayHours> = {};
  for (const h of restaurant.weeklyHours) weekly[h.weekday] = { closed: h.closed, open: h.open, close: h.close };
  const exceptions: Record<string, DayHours> = {};
  for (const e of restaurant.hoursExceptions) {
    exceptions[e.date] = { closed: e.closed, open: e.open ?? "00:00", close: e.close ?? "00:00" };
  }
  return {
    restaurant,
    rules: {
      seatingMinutes: restaurant.seatingMinutes,
      bookingDaysAhead: restaurant.bookingDaysAhead,
      allowBookingWhenClosed: restaurant.allowBookingWhenClosed,
      weekly,
      exceptions,
    },
  };
}

async function getRestaurant(restaurantId: string) {
  return prisma.restaurant.findUniqueOrThrow({
    where: { id: restaurantId },
    include: { weeklyHours: true, hoursExceptions: true },
  });
}

async function loadTables(restaurantId: string): Promise<TableInfo[]> {
  const rows = await prisma.table.findMany({ where: { restaurantId, active: true } });
  return rows.map((t) => ({ id: t.id, seats: t.seats, area: t.area as TableInfo["area"], label: t.label }));
}

async function loadBusy(restaurantId: string, date: string, excludeBookingId?: string): Promise<BusyMap> {
  const dayStart = zonedToUtc(date, "00:00").getTime();
  const rows = await prisma.tableSlot.findMany({
    where: {
      table: { restaurantId },
      slotStart: { gte: new Date(dayStart - 12 * 3600_000), lt: new Date(dayStart + 36 * 3600_000) },
      ...(excludeBookingId ? { bookingId: { not: excludeBookingId } } : {}),
    },
    select: { tableId: true, slotStart: true },
  });
  const busy: BusyMap = new Map();
  for (const r of rows) {
    if (!busy.has(r.tableId)) busy.set(r.tableId, new Set());
    busy.get(r.tableId)!.add(r.slotStart.getTime());
  }
  return busy;
}

// ---------- helpers ----------

/** Normalise Israeli phone numbers to 0XXXXXXXXX. Returns null when invalid. */
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("972")) d = "0" + d.slice(3);
  if (!d.startsWith("0")) d = "0" + d;
  return /^0\d{8,9}$/.test(d) ? d : null;
}

function newCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[randomInt(chars.length)]).join("");
}

export function toPublic(b: {
  id: string; code: string; customerName: string; phone: string; date: string; time: string; partySize: number; area: string; status: string;
}): PublicBooking {
  return {
    bookingId: b.id, code: b.code, customerName: b.customerName, phone: b.phone, date: b.date,
    dateHebrew: hebrewDate(b.date), time: b.time, partySize: b.partySize, area: b.area, status: b.status,
  };
}

async function sendSmsSafe(restaurantId: string, phone: string, kind: Parameters<ReturnType<typeof getSmsProvider>["send"]>[0]["kind"], body: string) {
  try {
    await getSmsProvider().send({ restaurantId, phone, kind, body });
    return true;
  } catch (e) {
    console.error("SMS failed", e);
    return false;
  }
}

// ---------- availability ----------

export interface AvailabilityQuery {
  restaurantId: string;
  date: string;
  time: string;
  partySize: number;
  area: AreaPref;
  now?: Date;
  excludeBookingId?: string;
}

export type AvailabilityResult = { ok: true; available: true; date: string; time: string } | Failure;

export async function checkAvailability(q: AvailabilityQuery): Promise<AvailabilityResult> {
  const now = q.now ?? new Date();
  const { rules } = await loadRules(q.restaurantId);
  const tables = await loadTables(q.restaurantId);
  const max = maxTableSize(tables, q.area);
  if (!Number.isInteger(q.partySize) || q.partySize < 1) return { ok: false, reason: "invalid_party_size" };

  const reason = validateRequest(rules, now, q.date, q.time);
  if (reason === "restaurant_closed_now" || reason === "invalid_date" || reason === "invalid_time" ||
      reason === "too_far_ahead" || reason === "closed_that_day") {
    return { ok: false, reason };
  }
  if (q.partySize > max) {
    return { ok: false, reason: "party_too_large", detail: `השולחן הגדול ביותר${q.area === "ANY" ? "" : " באזור זה"} מתאים ל-${max} סועדים` };
  }
  const busy = await loadBusy(q.restaurantId, q.date, q.excludeBookingId);
  if (!reason) {
    const start = zonedToUtc(q.date, q.time);
    if (candidateTables(tables, busy, q.partySize, q.area, start, rules.seatingMinutes).length > 0) {
      return { ok: true, available: true, date: q.date, time: q.time };
    }
  }
  const avail = availableTimes(rules, now, tables, busy, q.date, q.partySize, q.area);
  return { ok: false, reason: reason ?? "unavailable", alternatives: pickAlternatives(avail, q.time) };
}

export async function dayAvailability(q: Omit<AvailabilityQuery, "time">): Promise<{ ok: true; times: string[] } | Failure> {
  const now = q.now ?? new Date();
  const { rules } = await loadRules(q.restaurantId);
  if (!rules.allowBookingWhenClosed && !isOpenAt(rules, now)) return { ok: false, reason: "restaurant_closed_now" };
  const tables = await loadTables(q.restaurantId);
  const busy = await loadBusy(q.restaurantId, q.date, q.excludeBookingId);
  return { ok: true, times: availableTimes(rules, now, tables, busy, q.date, q.partySize, q.area) };
}

// ---------- create ----------

export interface CreateInput extends AvailabilityQuery {
  customerName: string;
  phone: string;
  callSessionId?: string;
}

export type BookingResult = { ok: true; booking: PublicBooking; smsSent: boolean } | Failure;

export async function createBooking(input: CreateInput): Promise<BookingResult> {
  const now = input.now ?? new Date();
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, reason: "invalid_phone" };
  const customerName = input.customerName.trim();
  if (customerName.length < 2) return { ok: false, reason: "invalid_name" };

  const { rules, restaurant } = await loadRules(input.restaurantId);
  const tables = await loadTables(input.restaurantId);

  for (let attempt = 0; attempt < MAX_RACE_RETRIES; attempt++) {
    const check = await checkAvailability({ ...input, now });
    if (!check.ok) return check;

    const start = zonedToUtc(input.date, input.time);
    const end = new Date(start.getTime() + rules.seatingMinutes * 60000);
    const busy = await loadBusy(input.restaurantId, input.date);
    const [table] = candidateTables(tables, busy, input.partySize, input.area, start, rules.seatingMinutes);
    if (!table) continue;

    try {
      const booking = await prisma.$transaction(async (tx) => {
        const b = await tx.booking.create({
          data: {
            code: newCode(),
            restaurantId: input.restaurantId,
            tableId: table.id,
            customerName,
            phone,
            partySize: input.partySize,
            area: table.area,
            date: input.date,
            time: input.time,
            startAt: start,
            endAt: end,
            callSessionId: input.callSessionId,
          },
        });
        await tx.tableSlot.createMany({
          data: occupiedSlots(start, rules.seatingMinutes).map((s) => ({ tableId: table.id, slotStart: new Date(s), bookingId: b.id })),
        });
        return b;
      });
      const smsSent = await sendSmsSafe(input.restaurantId, phone, "BOOKING_CONFIRMED", bookingConfirmedSms(restaurant.name, booking));
      return { ok: true, booking: toPublic(booking), smsSent };
    } catch (e) {
      if (isUniqueViolation(e)) continue; // lost a race for this table – try again with fresh data
      throw e;
    }
  }
  const final = await checkAvailability({ ...input, now });
  return final.ok ? { ok: false, reason: "unavailable", alternatives: [] } : final;
}

// ---------- find ----------

function nameMatches(stored: string, given: string): boolean {
  const norm = (s: string) => s.replace(/[^\p{L}\s]/gu, "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const a = norm(stored);
  const b = norm(given);
  return b.some((t) => a.includes(t));
}

/** Upcoming confirmed bookings for a phone number (verification for §10.2/§10.3). */
export async function findBookings(q: { restaurantId: string; phone: string; customerName?: string; now?: Date }) {
  const now = q.now ?? new Date();
  const phone = normalizePhone(q.phone);
  if (!phone) return { ok: false as const, reason: "invalid_phone" as const };
  const rows = await prisma.booking.findMany({
    where: { restaurantId: q.restaurantId, phone, status: "CONFIRMED", startAt: { gt: now } },
    orderBy: { startAt: "asc" },
  });
  return {
    ok: true as const,
    bookings: rows.map((b) => ({ ...toPublic(b), nameMatches: q.customerName ? nameMatches(b.customerName, q.customerName) : null })),
  };
}

async function getOwnBooking(restaurantId: string, bookingId: string, now: Date) {
  const b = await prisma.booking.findFirst({ where: { id: bookingId, restaurantId } });
  if (!b || b.status !== "CONFIRMED" || b.startAt.getTime() <= now.getTime()) return null;
  return b;
}

// ---------- modify ----------

export interface ModifyInput {
  restaurantId: string;
  bookingId: string;
  date?: string;
  time?: string;
  partySize?: number;
  area?: AreaPref;
  now?: Date;
}

export async function modifyBooking(input: ModifyInput): Promise<BookingResult> {
  const now = input.now ?? new Date();
  const existing = await getOwnBooking(input.restaurantId, input.bookingId, now);
  if (!existing) return { ok: false, reason: "not_found" };

  const date = input.date ?? existing.date;
  const time = input.time ?? existing.time;
  const partySize = input.partySize ?? existing.partySize;
  const area = input.area ?? (existing.area as AreaPref);

  const { rules, restaurant } = await loadRules(input.restaurantId);
  const tables = await loadTables(input.restaurantId);

  for (let attempt = 0; attempt < MAX_RACE_RETRIES; attempt++) {
    const check = await checkAvailability({ restaurantId: input.restaurantId, date, time, partySize, area, now, excludeBookingId: existing.id });
    if (!check.ok) return check;

    const start = zonedToUtc(date, time);
    const end = new Date(start.getTime() + rules.seatingMinutes * 60000);
    const busy = await loadBusy(input.restaurantId, date, existing.id);
    const candidates = candidateTables(tables, busy, partySize, area, start, rules.seatingMinutes);
    const table = candidates.find((t) => t.id === existing.tableId) ?? candidates[0];
    if (!table) continue;

    try {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.tableSlot.deleteMany({ where: { bookingId: existing.id } });
        await tx.tableSlot.createMany({
          data: occupiedSlots(start, rules.seatingMinutes).map((s) => ({ tableId: table.id, slotStart: new Date(s), bookingId: existing.id })),
        });
        return tx.booking.update({
          where: { id: existing.id },
          data: { date, time, partySize, area: table.area, tableId: table.id, startAt: start, endAt: end },
        });
      });
      const smsSent = await sendSmsSafe(input.restaurantId, updated.phone, "BOOKING_UPDATED", bookingUpdatedSms(restaurant.name, updated));
      return { ok: true, booking: toPublic(updated), smsSent };
    } catch (e) {
      if (isUniqueViolation(e)) continue;
      throw e;
    }
  }
  return { ok: false, reason: "unavailable", alternatives: [] };
}

// ---------- cancel ----------

export async function cancelBooking(input: { restaurantId: string; bookingId: string; now?: Date; bySystem?: boolean }): Promise<BookingResult> {
  const now = input.now ?? new Date();
  const existing = await getOwnBooking(input.restaurantId, input.bookingId, now);
  if (!existing) return { ok: false, reason: "not_found" };
  const { restaurant } = await loadRules(input.restaurantId);

  if (!input.bySystem && restaurant.cancelCutoffMinutes != null) {
    const minutesLeft = (existing.startAt.getTime() - now.getTime()) / 60000;
    if (minutesLeft < restaurant.cancelCutoffMinutes) {
      return { ok: false, reason: "past_cancellation_cutoff", detail: restaurant.cancellationPolicyText };
    }
  }
  const updated = await prisma.$transaction(async (tx) => {
    await tx.tableSlot.deleteMany({ where: { bookingId: existing.id } });
    return tx.booking.update({ where: { id: existing.id }, data: { status: "CANCELLED" } });
  });
  const smsSent = await sendSmsSafe(input.restaurantId, updated.phone, "BOOKING_CANCELLED", bookingCancelledSms(restaurant.name, updated));
  return { ok: true, booking: toPublic(updated), smsSent };
}

/** Manual no-show marking by restaurant staff (§10.4). Never automatic. */
export async function markNoShow(restaurantId: string, bookingId: string) {
  const b = await prisma.booking.findFirst({ where: { id: bookingId, restaurantId, status: "CONFIRMED" } });
  if (!b) return { ok: false as const, reason: "not_found" as const };
  await prisma.booking.update({ where: { id: b.id }, data: { status: "NO_SHOW" } });
  return { ok: true as const };
}

// ---------- other agent actions ----------

export async function requestCallback(input: { restaurantId: string; name: string; phone: string; reason: string }) {
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false as const, reason: "invalid_phone" as const };
  const row = await prisma.callbackRequest.create({
    data: { restaurantId: input.restaurantId, name: input.name.trim(), phone, reason: input.reason },
  });
  return { ok: true as const, callbackId: row.id };
}

export async function sendMenuLink(input: { restaurantId: string; phone: string }) {
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false as const, reason: "invalid_phone" as const };
  const { restaurant } = await loadRules(input.restaurantId);
  if (!restaurant.menuUrl) return { ok: false as const, reason: "no_menu_url" as const };
  const sent = await sendSmsSafe(input.restaurantId, phone, "MENU_LINK", menuLinkSms(restaurant.name, restaurant.menuUrl));
  return { ok: sent };
}

export async function restaurantInfo(restaurantId: string, now = new Date()) {
  const { rules, restaurant } = await loadRules(restaurantId);
  const local = toLocal(now);
  const weekly = [0, 1, 2, 3, 4, 5, 6].map((d) => {
    const h = rules.weekly[d];
    return { weekday: d, hours: !h || h.closed ? "סגור" : `${h.open}–${h.close}` };
  });
  const upcomingExceptions = Object.entries(rules.exceptions)
    .filter(([date]) => date >= local.date)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 5)
    .map(([date, h]) => ({ date, hours: h.closed ? "סגור" : `${h.open}–${h.close}` }));
  return {
    name: restaurant.name,
    address: restaurant.address,
    parking: restaurant.parking,
    cuisine: restaurant.cuisine,
    kosher: restaurant.kosher,
    openNow: isOpenAt(rules, now),
    weeklyHours: weekly,
    upcomingExceptions,
    seatingMinutes: rules.seatingMinutes,
    bookingDaysAhead: rules.bookingDaysAhead,
    cancellationPolicy: restaurant.cancellationPolicyText || "אין מגבלת ביטול",
    hasMenuLink: Boolean(restaurant.menuUrl),
  };
}

// ---------- public availability overview (restaurant page) ----------

export interface DayAvailability {
  date: string; // YYYY-MM-DD
  dayLabel: string; // "היום" / "מחר" / weekday
  dateLabel: string; // "24.11"
  closed: boolean;
  hours: string | null; // "12:00–23:00"
  /** partySize -> free start times per area */
  byParty: Record<number, { INSIDE: string[]; OUTSIDE: string[] }>;
}

export interface AvailabilityOverview {
  openNow: boolean;
  areas: { INSIDE: boolean; OUTSIDE: boolean };
  partySizes: number[];
  seatingMinutes: number;
  days: DayAvailability[];
}

/**
 * Free start times for the next few days, per area and party size, computed from the same
 * rules and table slots the booking engine uses. Read-only; safe to show publicly.
 */
export async function availabilityOverview(
  restaurantId: string,
  opts: { days?: number; now?: Date } = {},
): Promise<AvailabilityOverview> {
  const now = opts.now ?? new Date();
  const { rules } = await loadRules(restaurantId);
  const tables = await loadTables(restaurantId);
  const days = Math.min(opts.days ?? 7, rules.bookingDaysAhead + 1);
  const biggest = Math.max(0, ...tables.map((t) => t.seats));
  const partySizes = [2, 4, 6, 8].filter((p) => p <= biggest);
  const today = toLocal(now).date;

  const out: DayAvailability[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const [, m, d] = date.split("-").map(Number);
    const base = {
      date,
      dayLabel: i === 0 ? "היום" : i === 1 ? "מחר" : HEBREW_WEEKDAYS[weekdayOf(date)],
      dateLabel: `${d}.${m}`,
    };
    const h = hoursFor(rules, date);
    if (!h) {
      out.push({ ...base, closed: true, hours: null, byParty: {} });
      continue;
    }
    const busy = await loadBusy(restaurantId, date);
    const byParty: DayAvailability["byParty"] = {};
    for (const p of partySizes) {
      byParty[p] = {
        INSIDE: availableTimes(rules, now, tables, busy, date, p, "INSIDE"),
        OUTSIDE: availableTimes(rules, now, tables, busy, date, p, "OUTSIDE"),
      };
    }
    out.push({ ...base, closed: false, hours: `${h.open}–${h.close}`, byParty });
  }

  return {
    openNow: isOpenAt(rules, now),
    areas: { INSIDE: tables.some((t) => t.area === "INSIDE"), OUTSIDE: tables.some((t) => t.area === "OUTSIDE") },
    partySizes,
    seatingMinutes: rules.seatingMinutes,
    days: out,
  };
}
