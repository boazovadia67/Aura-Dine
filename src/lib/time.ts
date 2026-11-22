// Time helpers. All restaurant times are wall-clock times in Israel.
export const TZ = "Asia/Jerusalem";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function wallParts(at: Date) {
  const p: Record<string, string> = {};
  for (const { type, value } of partsFmt.formatToParts(at)) p[type] = value;
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour),
    mi: Number(p.minute),
    s: Number(p.second),
  };
}

/** Offset of Israel time from UTC at a given instant, in minutes (e.g. 120 or 180). */
function offsetMinutes(at: Date): number {
  const w = wallParts(at);
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

const pad = (n: number) => String(n).padStart(2, "0");

export interface LocalNow {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  minutes: number; // minutes since local midnight
  weekday: number; // 0 = Sunday
}

export function toLocal(at: Date): LocalNow {
  const w = wallParts(at);
  const date = `${w.y}-${pad(w.m)}-${pad(w.d)}`;
  return { date, time: `${pad(w.h)}:${pad(w.mi)}`, minutes: w.h * 60 + w.mi, weekday: weekdayOf(date) };
}

/** Convert a local Israel date + HH:MM to a UTC instant. */
export function zonedToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const mins = toMinutes(time);
  const guess = Date.UTC(y, m - 1, d, 0, 0) + mins * 60000;
  let off = offsetMinutes(new Date(guess));
  let result = guess - off * 60000;
  const off2 = offsetMinutes(new Date(result));
  if (off2 !== off) {
    off = off2;
    result = guess - off * 60000;
  }
  return new Date(result);
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-4]):[0-5]\d$/.test(time) && toMinutes(time) <= 1440;
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(from + "T00:00:00Z");
  const b = Date.parse(to + "T00:00:00Z");
  return Math.round((b - a) / 86400000);
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(mins: number): string {
  return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
}

export const HEBREW_WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

/** e.g. "יום שלישי, 24.11" */
export function hebrewDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `יום ${HEBREW_WEEKDAYS[weekdayOf(date)]}, ${d}.${m}`;
}
