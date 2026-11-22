// Pilot restaurant used by `npm run db:seed` and by the test suite.
import bcrypt from "bcryptjs";
import type { PrismaClient } from "../src/generated/prisma/client";

// Dev/test-only manager credentials for the pilot restaurant.
export const PILOT_MANAGER_EMAIL = "manager@aura-trattoria.test";
export const PILOT_MANAGER_PASSWORD = "AuraDemo2026!";

export const PILOT_TABLES = [
  { label: "T1", seats: 2, area: "INSIDE", locationNote: "ליד החלון" },
  { label: "T2", seats: 2, area: "INSIDE", locationNote: "" },
  { label: "T3", seats: 4, area: "INSIDE", locationNote: "ליד החלון" },
  { label: "T4", seats: 4, area: "INSIDE", locationNote: "" },
  { label: "T5", seats: 6, area: "INSIDE", locationNote: "פינה שקטה" },
  { label: "T6", seats: 8, area: "INSIDE", locationNote: "שולחן משפחתי" },
  { label: "P1", seats: 2, area: "OUTSIDE", locationNote: "מרפסת" },
  { label: "P2", seats: 4, area: "OUTSIDE", locationNote: "מרפסת" },
];

// weekday 0 = Sunday
export const PILOT_HOURS = [
  { weekday: 0, closed: false, open: "12:00", close: "23:00" },
  { weekday: 1, closed: false, open: "12:00", close: "23:00" },
  { weekday: 2, closed: false, open: "12:00", close: "23:00" },
  { weekday: 3, closed: false, open: "12:00", close: "23:00" },
  { weekday: 4, closed: false, open: "12:00", close: "23:30" },
  { weekday: 5, closed: false, open: "11:00", close: "16:00" },
  { weekday: 6, closed: false, open: "19:00", close: "23:30" },
];

export async function resetDatabase(prisma: PrismaClient) {
  await prisma.tableSlot.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.callbackRequest.deleteMany();
  await prisma.callSession.deleteMany();
  await prisma.smsLog.deleteMany();
  await prisma.passwordResetCode.deleteMany();
  await prisma.managerAccount.deleteMany();
  await prisma.emailLog.deleteMany();
  await prisma.hoursException.deleteMany();
  await prisma.weeklyHours.deleteMany();
  await prisma.table.deleteMany();
  await prisma.restaurant.deleteMany();
}

export async function seedPilot(prisma: PrismaClient) {
  const restaurant = await prisma.restaurant.create({
    data: {
      slug: "aura-trattoria",
      name: "Trattoria Aura",
      imageUrl: "/restaurants/aura-trattoria.jpg",
      cuisine: "איטלקי",
      city: "תל אביב",
      kosher: "לא כשר",
      address: "רחוב נחלת בנימין 42, תל אביב",
      parking: "חניון ציבורי בגרוזנברג 5, כשתי דקות הליכה. אין חניה פרטית למסעדה.",
      phone: "03-5550000",
      menuUrl: "https://example.com/aura-trattoria/menu",
      seatingMinutes: 90,
      bookingDaysAhead: 14,
      cancelCutoffMinutes: 120,
      cancellationPolicyText: "ניתן לבטל או לשנות הזמנה עד שעתיים לפני מועד ההגעה.",
      personaStyle: "warm",
      tables: { create: PILOT_TABLES },
      weeklyHours: { create: PILOT_HOURS },
    },
  });
  await prisma.managerAccount.create({
    data: {
      restaurantId: restaurant.id,
      email: PILOT_MANAGER_EMAIL,
      passwordHash: await bcrypt.hash(PILOT_MANAGER_PASSWORD, 10),
    },
  });
  return restaurant;
}

// Second restaurant: Asian, kosher, closed on Saturday.
export const ASIAN_MANAGER_EMAIL = "manager@lotus-asian-kitchen.test";

export const ASIAN_TABLES = [
  { label: "A1", seats: 2, area: "INSIDE", locationNote: "ליד הבר" },
  { label: "A2", seats: 2, area: "INSIDE", locationNote: "" },
  { label: "A3", seats: 4, area: "INSIDE", locationNote: "ליד החלון" },
  { label: "A4", seats: 4, area: "INSIDE", locationNote: "" },
  { label: "A5", seats: 6, area: "INSIDE", locationNote: "שולחן עגול" },
  { label: "A6", seats: 8, area: "INSIDE", locationNote: "שולחן משפחתי" },
  { label: "O1", seats: 4, area: "OUTSIDE", locationNote: "חצר" },
  { label: "O2", seats: 6, area: "OUTSIDE", locationNote: "חצר" },
];

export const ASIAN_HOURS = [
  { weekday: 0, closed: false, open: "12:00", close: "23:00" },
  { weekday: 1, closed: false, open: "12:00", close: "23:00" },
  { weekday: 2, closed: false, open: "12:00", close: "23:00" },
  { weekday: 3, closed: false, open: "12:00", close: "23:00" },
  { weekday: 4, closed: false, open: "12:00", close: "23:00" },
  { weekday: 5, closed: false, open: "11:00", close: "15:00" },
  { weekday: 6, closed: true, open: "12:00", close: "23:00" },
];

export async function seedAsian(prisma: PrismaClient) {
  const restaurant = await prisma.restaurant.create({
    data: {
      slug: "lotus-asian-kitchen",
      name: "Lotus Asian Kitchen",
      imageUrl: "/restaurants/lotus-asian-kitchen.jpg",
      cuisine: "אסייתי",
      city: "ירושלים",
      kosher: "כשר",
      address: "רחוב יפו 100, ירושלים",
      parking: "חניון בנייני האומה, כחמש דקות הליכה. אפשר גם להגיע ברכבת הקלה.",
      phone: "02-5550000",
      menuUrl: "https://example.com/lotus-asian-kitchen/menu",
      seatingMinutes: 90,
      bookingDaysAhead: 14,
      cancelCutoffMinutes: 120,
      cancellationPolicyText: "ניתן לבטל או לשנות הזמנה עד שעתיים לפני מועד ההגעה.",
      personaStyle: "warm",
      tables: { create: ASIAN_TABLES },
      weeklyHours: { create: ASIAN_HOURS },
    },
  });
  await prisma.managerAccount.create({
    data: {
      restaurantId: restaurant.id,
      email: ASIAN_MANAGER_EMAIL,
      passwordHash: await bcrypt.hash(PILOT_MANAGER_PASSWORD, 10),
    },
  });
  return restaurant;
}
