import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }));

import { prisma } from "@/lib/db";
import { RESET_MAX_ATTEMPTS, login, requestPasswordReset, resetPassword } from "@/lib/auth";
import { PILOT_MANAGER_EMAIL, PILOT_MANAGER_PASSWORD, resetDatabase, seedPilot } from "../prisma/seed-data";

async function lastCode() {
  const mail = await prisma.emailLog.findFirstOrThrow({ orderBy: { sentAt: "desc" } });
  return mail.body.match(/\d{6}/)![0];
}

beforeEach(async () => {
  await resetDatabase(prisma);
  await seedPilot(prisma);
});

describe("manager login", () => {
  it("accepts the right password and rejects a wrong one", async () => {
    expect(await login(PILOT_MANAGER_EMAIL, PILOT_MANAGER_PASSWORD)).toEqual({ ok: true });
    expect(await login(PILOT_MANAGER_EMAIL, "wrong")).toEqual({ ok: false, error: "invalid" });
    expect(await login("nobody@x.test", "wrong")).toEqual({ ok: false, error: "invalid" });
  });

  it("locks an email after repeated failures", async () => {
    for (let i = 0; i < 5; i++) await login("locked@x.test", "bad");
    expect(await login("locked@x.test", "bad")).toEqual({ ok: false, error: "locked" });
  });
});

describe("password reset (§13.2)", () => {
  it("resets with the emailed code and invalidates it after use", async () => {
    await requestPasswordReset(PILOT_MANAGER_EMAIL);
    const code = await lastCode();
    expect(await resetPassword(PILOT_MANAGER_EMAIL, code, "NewPassword123")).toEqual({ ok: true });
    const m = await prisma.managerAccount.findUniqueOrThrow({ where: { email: PILOT_MANAGER_EMAIL } });
    expect(await bcrypt.compare("NewPassword123", m.passwordHash)).toBe(true);
    expect((await resetPassword(PILOT_MANAGER_EMAIL, code, "Another12345")).ok).toBe(false);
  });

  it("limits attempts", async () => {
    await requestPasswordReset(PILOT_MANAGER_EMAIL);
    const code = await lastCode();
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < RESET_MAX_ATTEMPTS; i++) await resetPassword(PILOT_MANAGER_EMAIL, wrong, "NewPassword123");
    expect(await resetPassword(PILOT_MANAGER_EMAIL, code, "NewPassword123")).toEqual({ ok: false, error: "too_many_attempts" });
  });

  it("rejects expired codes", async () => {
    await requestPasswordReset(PILOT_MANAGER_EMAIL);
    const code = await lastCode();
    await prisma.passwordResetCode.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await resetPassword(PILOT_MANAGER_EMAIL, code, "NewPassword123")).toEqual({ ok: false, error: "expired" });
  });

  it("does not reveal whether an email exists", async () => {
    await requestPasswordReset("nobody@x.test");
    expect(await prisma.emailLog.count()).toBe(0);
  });
});
