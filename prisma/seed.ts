import "dotenv/config";
import { prisma } from "../src/lib/db";
import {
  ASIAN_MANAGER_EMAIL,
  PILOT_MANAGER_EMAIL,
  RUSSIAN_MANAGER_EMAIL,
  resetDatabase,
  seedAsian,
  seedPilot,
  seedRussian,
} from "./seed-data";

async function main() {
  await resetDatabase(prisma);
  const r = await seedPilot(prisma);
  const a = await seedAsian(prisma);
  const ru = await seedRussian(prisma);
  console.log(`Seeded "${r.name}" (/r/${r.slug}), "${a.name}" (/r/${a.slug}) and "${ru.name}" (/r/${ru.slug}).`);
  console.log(
    `Manager logins: ${PILOT_MANAGER_EMAIL}, ${ASIAN_MANAGER_EMAIL}, ${RUSSIAN_MANAGER_EMAIL} (password in prisma/seed-data.ts)`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
