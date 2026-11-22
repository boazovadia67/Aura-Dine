import { prisma } from "./db";
import { HEBREW_WEEKDAYS } from "./time";

export async function listActiveRestaurants() {
  return prisma.restaurant.findMany({
    where: { active: true },
    include: { weeklyHours: { orderBy: { weekday: "asc" } } },
    orderBy: { name: "asc" },
  });
}

export async function getActiveRestaurant(slug: string) {
  return prisma.restaurant.findFirst({
    where: { slug, active: true },
    include: { weeklyHours: { orderBy: { weekday: "asc" } } },
  });
}

/** Weekly hours as display rows, merging consecutive days with identical hours. */
export function hoursRows(weekly: { weekday: number; closed: boolean; open: string; close: string }[]) {
  const label = (h: { closed: boolean; open: string; close: string }) => (h.closed ? "סגור" : `${h.open}–${h.close}`);
  const rows: { days: string; hours: string }[] = [];
  let start = 0;
  for (let i = 1; i <= weekly.length; i++) {
    if (i === weekly.length || label(weekly[i]) !== label(weekly[start])) {
      const a = HEBREW_WEEKDAYS[weekly[start].weekday];
      const b = HEBREW_WEEKDAYS[weekly[i - 1].weekday];
      rows.push({ days: a === b ? a : `${a}–${b}`, hours: label(weekly[start]) });
      start = i;
    }
  }
  return rows;
}
