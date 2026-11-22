import "dotenv/config";
import { prisma } from "../src/lib/db";
import { PILOT_MANAGER_EMAIL, RUSSIAN_MANAGER_EMAIL, resetDatabase, seedPilot, seedRussian } from "./seed-data";

async function main() {
  await resetDatabase(prisma);
  const r = await seedPilot(prisma);
  console.log(`Seeded "${r.name}" (/r/${r.slug}). Manager login: ${PILOT_MANAGER_EMAIL} (password in prisma/seed-data.ts)`);
  const ru = await seedRussian(prisma);
  console.log(`Seeded "${ru.name}" (/r/${ru.slug}). Manager login: ${RUSSIAN_MANAGER_EMAIL} (password in prisma/seed-data.ts)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
