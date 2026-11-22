// Manager authentication: email + password, signed session cookie, email OTP password reset (§13).
import "server-only";
import bcrypt from "bcryptjs";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";

const COOKIE = "aura_admin";
const SESSION_HOURS = 8;

// Placeholders until the open decision in §13.2 is made.
export const RESET_CODE_MINUTES = 15;
export const RESET_MAX_ATTEMPTS = 5;

// Simple in-memory login throttle (per email). Replace with a shared store when scaling out.
const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_MAX_FAILURES = 5;
const failures = new Map<string, { count: number; first: number }>();

let dummy: string | null = null;
function dummyHash() {
  dummy ??= bcrypt.hashSync("not-a-real-password", 10);
  return dummy;
}

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET is missing or too short");
  return new TextEncoder().encode(s);
}

export interface ManagerSession {
  managerId: string;
  restaurantId: string;
  email: string;
}

async function setSession(s: ManagerSession) {
  const token = await new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function getManager(): Promise<ManagerSession | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const s = payload as unknown as ManagerSession;
    // The account must still exist and still belong to the same restaurant.
    const m = await prisma.managerAccount.findUnique({ where: { id: s.managerId } });
    if (!m || m.restaurantId !== s.restaurantId) return null;
    return { managerId: m.id, restaurantId: m.restaurantId, email: m.email };
  } catch {
    return null;
  }
}

export async function requireManager(): Promise<ManagerSession> {
  const m = await getManager();
  if (!m) redirect("/admin/login");
  return m;
}

export async function logout() {
  (await cookies()).delete(COOKIE);
}

export type LoginResult = { ok: true } | { ok: false; error: "invalid" | "locked" };

export async function login(emailRaw: string, password: string): Promise<LoginResult> {
  const email = emailRaw.trim().toLowerCase();
  const f = failures.get(email);
  if (f && Date.now() - f.first < LOGIN_WINDOW_MS && f.count >= LOGIN_MAX_FAILURES) return { ok: false, error: "locked" };

  const m = await prisma.managerAccount.findUnique({ where: { email } });
  // Compare against a dummy hash for unknown emails so timing does not reveal which emails exist.
  const valid = await bcrypt.compare(password, m?.passwordHash ?? dummyHash());
  if (!m || !valid) {
    const cur = f && Date.now() - f.first < LOGIN_WINDOW_MS ? f : { count: 0, first: Date.now() };
    failures.set(email, { count: cur.count + 1, first: cur.first });
    return { ok: false, error: "invalid" };
  }
  failures.delete(email);
  await setSession({ managerId: m.id, restaurantId: m.restaurantId, email: m.email });
  return { ok: true };
}

function hashCode(code: string) {
  return createHmac("sha256", secret()).update(code).digest("hex");
}

/** Always behaves the same whether or not the email exists (no account enumeration). */
export async function requestPasswordReset(emailRaw: string) {
  const email = emailRaw.trim().toLowerCase();
  const m = await prisma.managerAccount.findUnique({ where: { email } });
  if (!m) return;
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.passwordResetCode.updateMany({ where: { managerId: m.id, usedAt: null }, data: { usedAt: new Date() } });
  await prisma.passwordResetCode.create({
    data: { managerId: m.id, codeHash: hashCode(code), expiresAt: new Date(Date.now() + RESET_CODE_MINUTES * 60_000) },
  });
  // Dev email provider: stored in EmailLog and printed to the server console.
  const body = `קוד האיפוס שלך ל-Aura Dine: ${code}. הקוד תקף ל-${RESET_CODE_MINUTES} דקות.`;
  await prisma.emailLog.create({ data: { to: email, subject: "איפוס סיסמה – Aura Dine", body } });
  console.log(`[Email mock] to ${email}: ${body}`);
}

export type ResetResult = { ok: true } | { ok: false; error: "invalid" | "expired" | "too_many_attempts" | "weak_password" };

export async function resetPassword(emailRaw: string, code: string, newPassword: string): Promise<ResetResult> {
  if (newPassword.length < 8) return { ok: false, error: "weak_password" };
  const email = emailRaw.trim().toLowerCase();
  const m = await prisma.managerAccount.findUnique({ where: { email } });
  if (!m) return { ok: false, error: "invalid" };
  const rec = await prisma.passwordResetCode.findFirst({
    where: { managerId: m.id, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!rec) return { ok: false, error: "invalid" };
  if (rec.expiresAt.getTime() < Date.now()) return { ok: false, error: "expired" };
  if (rec.attempts >= RESET_MAX_ATTEMPTS) return { ok: false, error: "too_many_attempts" };

  const a = Buffer.from(hashCode(code.trim()));
  const b = Buffer.from(rec.codeHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await prisma.passwordResetCode.update({ where: { id: rec.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: rec.attempts + 1 >= RESET_MAX_ATTEMPTS ? "too_many_attempts" : "invalid" };
  }
  await prisma.$transaction([
    prisma.managerAccount.update({ where: { id: m.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } }),
    prisma.passwordResetCode.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
  ]);
  return { ok: true };
}
