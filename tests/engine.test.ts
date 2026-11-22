import { describe, expect, it } from "vitest";
import {
  candidateTables,
  isOpenAt,
  pickAlternatives,
  slotTimes,
  validateRequest,
  type BusyMap,
  type Rules,
  type TableInfo,
} from "@/lib/booking/engine";
import { zonedToUtc, toLocal } from "@/lib/time";

const rules: Rules = {
  seatingMinutes: 90,
  bookingDaysAhead: 14,
  allowBookingWhenClosed: false,
  weekly: {
    0: { closed: false, open: "12:00", close: "23:00" },
    1: { closed: false, open: "12:00", close: "23:00" },
    2: { closed: false, open: "12:00", close: "23:00" },
    3: { closed: false, open: "12:00", close: "23:00" },
    4: { closed: false, open: "18:00", close: "01:00" }, // past midnight
    5: { closed: true, open: "00:00", close: "00:00" },
    6: { closed: false, open: "19:00", close: "23:00" },
  },
  exceptions: { "2026-11-25": { closed: true, open: "00:00", close: "00:00" } },
};

// Monday 2026-11-23, 15:00 Israel time
const NOW = zonedToUtc("2026-11-23", "15:00");

describe("time helpers", () => {
  it("round-trips Israel local time", () => {
    const d = zonedToUtc("2026-11-23", "19:30");
    expect(d.toISOString()).toBe("2026-11-23T17:30:00.000Z"); // winter UTC+2
    expect(toLocal(d)).toMatchObject({ date: "2026-11-23", time: "19:30", weekday: 1 });
    expect(zonedToUtc("2026-07-01", "19:30").toISOString()).toBe("2026-07-01T16:30:00.000Z"); // summer UTC+3
  });
});

describe("slot grid", () => {
  it("runs every 30 minutes and stops at close minus seating", () => {
    const slots = slotTimes(rules, "2026-11-23");
    expect(slots[0]).toBe("12:00");
    expect(slots[1]).toBe("12:30");
    expect(slots.at(-1)).toBe("21:30");
  });
  it("is empty on a weekly closed day and on a closed exception date", () => {
    expect(slotTimes(rules, "2026-11-27")).toEqual([]); // Friday
    expect(slotTimes(rules, "2026-11-25")).toEqual([]); // exception
  });
  it("handles past-midnight closing", () => {
    const slots = slotTimes(rules, "2026-11-26"); // Thursday 18:00-01:00
    expect(slots.at(-1)).toBe("23:30");
  });
});

describe("validateRequest", () => {
  it("accepts a valid future slot", () => {
    expect(validateRequest(rules, NOW, "2026-11-23", "19:00")).toBeNull();
  });
  it("rejects past times today, off-grid times and times after last seating", () => {
    expect(validateRequest(rules, NOW, "2026-11-23", "13:00")).toBe("in_past");
    expect(validateRequest(rules, NOW, "2026-11-23", "19:15")).toBe("not_on_slot_grid");
    expect(validateRequest(rules, NOW, "2026-11-23", "22:00")).toBe("outside_hours");
  });
  it("enforces the 14-day window", () => {
    expect(validateRequest(rules, NOW, "2026-12-07", "19:00")).toBeNull(); // 14 days
    expect(validateRequest(rules, NOW, "2026-12-08", "19:00")).toBe("too_far_ahead");
  });
  it("rejects closed days", () => {
    expect(validateRequest(rules, NOW, "2026-11-25", "19:00")).toBe("closed_that_day");
  });
  it("refuses while the restaurant is closed right now (§11)", () => {
    const night = zonedToUtc("2026-11-23", "23:30");
    expect(isOpenAt(rules, night)).toBe(false);
    expect(validateRequest(rules, night, "2026-11-24", "19:00")).toBe("restaurant_closed_now");
    expect(validateRequest({ ...rules, allowBookingWhenClosed: true }, night, "2026-11-24", "19:00")).toBeNull();
  });
  it("treats Friday 00:30 as still open from Thursday night", () => {
    expect(isOpenAt(rules, zonedToUtc("2026-11-27", "00:30"))).toBe(true);
  });
});

describe("table choice", () => {
  const tables: TableInfo[] = [
    { id: "a", seats: 2, area: "INSIDE", label: "A" },
    { id: "b", seats: 4, area: "INSIDE", label: "B" },
    { id: "c", seats: 6, area: "INSIDE", label: "C" },
    { id: "p", seats: 4, area: "OUTSIDE", label: "P" },
  ];
  const start = zonedToUtc("2026-11-23", "19:00");

  it("picks the smallest single table that fits", () => {
    expect(candidateTables(tables, new Map(), 3, "INSIDE", start, 90)[0].id).toBe("b");
    expect(candidateTables(tables, new Map(), 3, "OUTSIDE", start, 90)[0].id).toBe("p");
    expect(candidateTables(tables, new Map(), 7, "ANY", start, 90)).toEqual([]);
  });
  it("skips tables with overlapping slots", () => {
    const busy: BusyMap = new Map([["b", new Set([zonedToUtc("2026-11-23", "20:00").getTime()])]]);
    expect(candidateTables(tables, busy, 3, "INSIDE", start, 90)[0].id).toBe("c");
    // 18:30 + 90 min ends at 20:00 – no overlap with a 20:00 slot
    expect(candidateTables(tables, busy, 3, "INSIDE", zonedToUtc("2026-11-23", "18:30"), 90)[0].id).toBe("b");
  });
});

describe("alternatives (§9.8)", () => {
  it("offers one earlier and one later when both exist", () => {
    expect(pickAlternatives(["18:00", "18:30", "20:30", "21:00"], "19:30")).toEqual(["18:30", "20:30"]);
  });
  it("offers the two nearest when only one side has options", () => {
    expect(pickAlternatives(["20:30", "21:00", "21:30"], "19:30")).toEqual(["20:30", "21:00"]);
    expect(pickAlternatives(["17:00", "18:00"], "19:30")).toEqual(["17:00", "18:00"]);
  });
  it("returns fewer when fewer exist", () => {
    expect(pickAlternatives(["21:00"], "19:30")).toEqual(["21:00"]);
    expect(pickAlternatives([], "19:30")).toEqual([]);
  });
});
