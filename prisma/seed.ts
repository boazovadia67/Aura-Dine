import "dotenv/config";
import { prisma } from "../src/lib/db";
import {
  ASIAN_MANAGER_EMAIL,
  BAVARIAN_MANAGER_EMAIL,
  PILOT_MANAGER_EMAIL,
  RUSSIAN_MANAGER_EMAIL,
  resetDatabase,
  seedAsian,
  seedBavarian,
  seedPilot,
  seedRussian,
} from "./seed-data";

async function main() {
  await resetDatabase(prisma);
  const seeded = [await seedPilot(prisma), await seedAsian(prisma), await seedRussian(prisma), await seedBavarian(prisma)];
  console.log(`Seeded ${seeded.map((r) => `"${r.name}" (/r/${r.slug})`).join(", ")}.`);
  console.log(
    `Manager logins: ${[PILOT_MANAGER_EMAIL, ASIAN_MANAGER_EMAIL, RUSSIAN_MANAGER_EMAIL, BAVARIAN_MANAGER_EMAIL].join(", ")} (password in prisma/seed-data.ts)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
