// Pure booking rules (spec §9). No database access here, so everything is unit-testable.
import {
  addDays,
  daysBetween,
  fromMinutes,
  isValidDate,
  isValidTime,
  toLocal,
  toMinutes,
  weekdayOf,
  zonedToUtc,
} from "../time";

export const SLOT_MINUTES = 30; // §9.5 – bookings open every 30 minutes
export type Area = "INSIDE" | "OUTSIDE";
export type AreaPref = Area | "ANY";

export interface DayHours {
  closed: boolean;
  open: string; // HH:MM
  close: string; // HH:MM; "24:00" or a time <= open means past midnight
}

export interface Rules {
  seatingMinutes: number;
  bookingDaysAhead: number;
  allowBookingWhenClosed: boolean;
  weekly: Record<number, DayHours>; // weekday 0..6
  exceptions: Record<string, DayHours>; // YYYY-MM-DD
}

export interface TableInfo {
  id: string;
  seats: number;
  area: Area;
  label: string;
}

/** tableId -> set of occupied slot start times (epoch ms). */
export type BusyMap = Map<string, Set<number>>;

export type RejectReason =
  | "invalid_date"
  | "invalid_time"
  | "in_past"
  | "too_far_ahead"
  | "closed_that_day"
  | "outside_hours"
  | "not_on_slot_grid"
  | "restaurant_closed_now"
  | "party_too_large";

/** Hours for a date: a date exception overrides the weekly schedule (§9.7). */
export function hoursFor(rules: Rules, date: string): DayHours | null {
  const h = rules.exceptions[date] ?? rules.weekly[weekdayOf(date)];
  if (!h || h.closed) return null;
  return h;
}

/** Opening span in minutes since local midnight of `date`. close may exceed 1440. */
function span(h: DayHours): [number, number] {
  const open = toMinutes(h.open);
  let close = toMinutes(h.close);
  if (close <= open) close += 1440;
  return [open, close];
}

/** All bookable start times for a date: every 30 min from opening until close − seating. */
export function slotTimes(rules: Rules, date: string): string[] {
  const h = hoursFor(rules, date);
  if (!h) return [];
  const [open, close] = span(h);
  const last = Math.min(close - rules.seatingMinutes, 1440 - SLOT_MINUTES);
  const first = Math.ceil(open / SLOT_MINUTES) * SLOT_MINUTES;
  const out: string[] = [];
  for (let t = first; t <= last; t += SLOT_MINUTES) out.push(fromMinutes(t));
  return out;
}

/** Is the restaurant open at this instant? Considers yesterday's past-midnight hours. */
export function isOpenAt(rules: Rules, now: Date): boolean {
  const local = toLocal(now);
  const today = hoursFor(rules, local.date);
  if (today) {
    const [o, c] = span(today);
    if (local.minutes >= o && local.minutes < c) return true;
  }
  const y = hoursFor(rules, addDays(local.date, -1));
  if (y) {
    const [, c] = span(y);
    if (c > 1440 && local.minutes < c - 1440) return true;
  }
  return false;
}

/** Validate a requested date/time against the window, hours and grid (§9.5–9.7, §11). */
export function validateRequest(
  rules: Rules,
  now: Date,
  date: string,
  time: string,
): RejectReason | null {
  if (!isValidDate(date)) return "invalid_date";
  if (!isValidTime(time)) return "invalid_time";
  if (!rules.allowBookingWhenClosed && !isOpenAt(rules, now)) return "restaurant_closed_now";
  const today = toLocal(now).date;
  const ahead = daysBetween(today, date);
  if (ahead < 0) return "in_past";
  if (ahead > rules.bookingDaysAhead) return "too_far_ahead";
  if (!hoursFor(rules, date)) return "closed_that_day";
  if (toMinutes(time) % SLOT_MINUTES !== 0) return "not_on_slot_grid";
  if (!slotTimes(rules, date).includes(time)) return "outside_hours";
  if (zonedToUtc(date, time).getTime() <= now.getTime()) return "in_past";
  return null;
}

/** Slot start times (epoch ms) a booking occupies: [start, start + seating). */
export function occupiedSlots(start: Date, seatingMinutes: number): number[] {
  const out: number[] = [];
  const s = start.getTime();
  for (let t = 0; t < seatingMinutes; t += SLOT_MINUTES) out.push(s + t * 60000);
  return out;
}

function tableFree(busy: BusyMap, tableId: string, slots: number[]): boolean {
  const b = busy.get(tableId);
  return !b || slots.every((s) => !b.has(s));
}

/**
 * Candidate tables for a request, best first: a single table only (§9.9),
 * enough seats, matching area, no overlap; smallest fitting table first.
 */
export function candidateTables(
  tables: TableInfo[],
  busy: BusyMap,
  partySize: number,
  area: AreaPref,
  start: Date,
  seatingMinutes: number,
): TableInfo[] {
  const slots = occupiedSlots(start, seatingMinutes);
  return tables
    .filter((t) => t.seats >= partySize && (area === "ANY" || t.area === area))
    .filter((t) => tableFree(busy, t.id, slots))
    .sort((a, b) => a.seats - b.seats || a.label.localeCompare(b.label));
}

export function maxTableSize(tables: TableInfo[], area: AreaPref): number {
  return Math.max(0, ...tables.filter((t) => area === "ANY" || t.area === area).map((t) => t.seats));
}

/** All start times on a date that still have a fitting table (future slots only). */
export function availableTimes(
  rules: Rules,
  now: Date,
  tables: TableInfo[],
  busy: BusyMap,
  date: string,
  partySize: number,
  area: AreaPref,
): string[] {
  return slotTimes(rules, date).filter((time) => {
    const start = zonedToUtc(date, time);
    if (start.getTime() <= now.getTime()) return false;
    return candidateTables(tables, busy, partySize, area, start, rules.seatingMinutes).length > 0;
  });
}

/**
 * Exactly two alternatives when possible (§9.8):
 * the nearest earlier and the nearest later time; if one side is empty, the two nearest overall.
 */
export function pickAlternatives(available: string[], requested: string): string[] {
  const r = toMinutes(requested);
  const others = available.filter((t) => t !== requested);
  const earlier = others.filter((t) => toMinutes(t) < r);
  const later = others.filter((t) => toMinutes(t) > r);
  if (earlier.length && later.length) return [earlier[earlier.length - 1], later[0]];
  return [...others]
    .sort((a, b) => Math.abs(toMinutes(a) - r) - Math.abs(toMinutes(b) - r) || toMinutes(a) - toMinutes(b))
    .slice(0, 2)
    .sort((a, b) => toMinutes(a) - toMinutes(b));
}
