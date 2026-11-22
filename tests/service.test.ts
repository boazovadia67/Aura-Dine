import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  cancelBooking,
  checkAvailability,
  createBooking,
  findBookings,
  modifyBooking,
  normalizePhone,
  availabilityOverview,
} from "@/lib/booking/service";
import { zonedToUtc } from "@/lib/time";
import { resetDatabase, seedAsian, seedPilot } from "../prisma/seed-data";

// Monday 2026-11-23, 15:00 Israel time – restaurant open 12:00–23:00
const NOW = zonedToUtc("2026-11-23", "15:00");
let rid: string;

const base = () => ({
  restaurantId: rid,
  date: "2026-11-24",
  time: "19:00",
  partySize: 2,
  area: "INSIDE" as const,
  customerName: "דנה כהן",
  phone: "050-1234567",
  now: NOW,
});

beforeEach(async () => {
  await resetDatabase(prisma);
  rid = (await seedPilot(prisma)).id;
});

describe("phone normalisation", () => {
  it("accepts Israeli formats", () => {
    expect(normalizePhone("050-123-4567")).toBe("0501234567");
    expect(normalizePhone("+972 50 123 4567")).toBe("0501234567");
    expect(normalizePhone("12")).toBeNull();
  });
});

describe("createBooking", () => {
  it("saves the booking, reserves slots and sends an SMS", async () => {
    const r = await createBooking(base());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.booking).toMatchObject({ customerName: "דנה כהן", phone: "0501234567", time: "19:00", status: "CONFIRMED" });
    expect(await prisma.tableSlot.count({ where: { bookingId: r.booking.bookingId } })).toBe(3); // 90 min = 3 slots
    const sms = await prisma.smsLog.findMany({ where: { restaurantId: rid } });
    expect(sms).toHaveLength(1);
    expect(sms[0].kind).toBe("BOOKING_CONFIRMED");
    expect(sms[0].body).toContain(r.booking.code);
  });

  it("uses the smallest fitting table", async () => {
    const r = await createBooking({ ...base(), partySize: 3 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const b = await prisma.booking.findUniqueOrThrow({ where: { id: r.booking.bookingId }, include: { table: true } });
    expect(b.table.seats).toBe(4);
  });

  it("offers exactly two alternatives when the slot is full", async () => {
    // only one outside 2-seat and one outside 4-seat table
    expect((await createBooking({ ...base(), area: "OUTSIDE" })).ok).toBe(true);
    expect((await createBooking({ ...base(), area: "OUTSIDE", phone: "0521111111" })).ok).toBe(true);
    const r = await createBooking({ ...base(), area: "OUTSIDE", phone: "0532222222" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("unavailable");
    expect(r.alternatives).toEqual(["17:30", "20:30"]);
  });

  it("rejects groups larger than any single table", async () => {
    const r = await createBooking({ ...base(), partySize: 10 });
    expect(r).toMatchObject({ ok: false, reason: "party_too_large" });
  });

  it("never double-books a table under concurrent requests", async () => {
    // 8-seat T6 is the only table for 8 people
    const attempts = Array.from({ length: 10 }, (_, i) =>
      createBooking({ ...base(), partySize: 8, phone: `05000000${String(i).padStart(2, "0")}` }),
    );
    const results = await Promise.all(attempts);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await prisma.booking.count({ where: { status: "CONFIRMED" } })).toBe(1);
  });

  it("refuses while the restaurant is closed now (§11)", async () => {
    const r = await createBooking({ ...base(), now: zonedToUtc("2026-11-23", "23:45") });
    expect(r).toMatchObject({ ok: false, reason: "restaurant_closed_now" });
  });

  it("requires a valid phone and name", async () => {
    expect(await createBooking({ ...base(), phone: "123" })).toMatchObject({ ok: false, reason: "invalid_phone" });
    expect(await createBooking({ ...base(), customerName: " " })).toMatchObject({ ok: false, reason: "invalid_name" });
  });
});

describe("two restaurants", () => {
  it("keep availability independent and follow their own hours", async () => {
    const asian = await seedAsian(prisma);
    // fill the Italian 8-seat table, the Asian one must still be free at the same time
    expect((await createBooking({ ...base(), partySize: 8 })).ok).toBe(true);
    const other = await createBooking({ ...base(), restaurantId: asian.id, partySize: 8 });
    expect(other.ok).toBe(true);
    // Asian restaurant is closed on Saturday (2026-11-28), Italian is open
    expect(await checkAvailability({ ...base(), restaurantId: asian.id, date: "2026-11-28", now: zonedToUtc("2026-11-27", "13:00") }))
      .toMatchObject({ ok: false, reason: "closed_that_day" });
    expect((await checkAvailability({ ...base(), date: "2026-11-28", time: "20:00", now: zonedToUtc("2026-11-27", "13:00") })).ok).toBe(true);
  });
});

describe("modify and cancel", () => {
  it("finds, modifies and cancels a booking with SMS each time", async () => {
    const created = await createBooking(base());
    if (!created.ok) throw new Error("setup failed");

    const found = await findBookings({ restaurantId: rid, phone: "0501234567", customerName: "דנה", now: NOW });
    expect(found.ok && found.bookings).toHaveLength(1);
    expect(found.ok && found.bookings[0].nameMatches).toBe(true);

    const moved = await modifyBooking({ restaurantId: rid, bookingId: created.booking.bookingId, time: "20:30", now: NOW });
    expect(moved.ok && moved.booking.time).toBe("20:30");
    const slots = await prisma.tableSlot.findMany({ where: { bookingId: created.booking.bookingId }, orderBy: { slotStart: "asc" } });
    expect(slots[0].slotStart.getTime()).toBe(zonedToUtc("2026-11-24", "20:30").getTime());

    const cancelled = await cancelBooking({ restaurantId: rid, bookingId: created.booking.bookingId, now: NOW });
    expect(cancelled.ok && cancelled.booking.status).toBe("CANCELLED");
    expect(await prisma.tableSlot.count({ where: { bookingId: created.booking.bookingId } })).toBe(0);

    const kinds = (await prisma.smsLog.findMany({ orderBy: { sentAt: "asc" } })).map((s) => s.kind);
    expect(kinds).toEqual(["BOOKING_CONFIRMED", "BOOKING_UPDATED", "BOOKING_CANCELLED"]);
  });

  it("enforces the cancellation cut-off", async () => {
    const created = await createBooking({ ...base(), date: "2026-11-23", time: "16:00" });
    if (!created.ok) throw new Error("setup failed");
    const r = await cancelBooking({ restaurantId: rid, bookingId: created.booking.bookingId, now: NOW });
    expect(r).toMatchObject({ ok: false, reason: "past_cancellation_cutoff" });
  });

  it("frees the table after cancellation", async () => {
    const a = await createBooking({ ...base(), partySize: 8 });
    if (!a.ok) throw new Error("setup failed");
    expect((await checkAvailability({ ...base(), partySize: 8 })).ok).toBe(false);
    await cancelBooking({ restaurantId: rid, bookingId: a.booking.bookingId, now: NOW });
    expect((await checkAvailability({ ...base(), partySize: 8 })).ok).toBe(true);
  });

  it("does not leak bookings across restaurants (§18)", async () => {
    const created = await createBooking(base());
    if (!created.ok) throw new Error("setup failed");
    const r = await cancelBooking({ restaurantId: "other-restaurant", bookingId: created.booking.bookingId, now: NOW });
    expect(r).toMatchObject({ ok: false, reason: "not_found" });
  });
});

describe("availabilityOverview (restaurant page)", () => {
  it("lists free times per day, area and party size, and marks closed days", async () => {
    // both outside tables taken on Tuesday 19:00
    await createBooking({ ...base(), area: "OUTSIDE" });
    await createBooking({ ...base(), area: "OUTSIDE", phone: "0521111111" });
    await prisma.hoursException.create({ data: { restaurantId: rid, date: "2026-11-25", closed: true } });

    const o = await availabilityOverview(rid, { now: NOW });
    expect(o.days).toHaveLength(7);
    expect(o.partySizes).toEqual([2, 4, 6, 8]);
    expect(o.areas).toEqual({ INSIDE: true, OUTSIDE: true });
    expect(o.openNow).toBe(true);

    const today = o.days[0];
    expect(today.dayLabel).toBe("היום");
    expect(today.byParty[2].INSIDE[0]).toBe("15:30"); // nothing in the past
    expect(today.byParty[2].INSIDE.at(-1)).toBe("21:30");

    const tue = o.days[1];
    expect(tue.dayLabel).toBe("מחר");
    expect(tue.byParty[2].INSIDE).toContain("19:00");
    expect(tue.byParty[2].OUTSIDE).not.toContain("19:00");
    expect(tue.byParty[2].OUTSIDE).toContain("17:30");
    expect(tue.byParty[8].OUTSIDE).toEqual([]); // no 8-seat table outside

    expect(o.days[2]).toMatchObject({ date: "2026-11-25", closed: true, hours: null });
  });
});
