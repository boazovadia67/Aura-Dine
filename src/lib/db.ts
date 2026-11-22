import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makeClient() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

export const prisma = globalForPrisma.prisma ?? makeClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** True when an error is a unique-constraint violation (double booking race). */
export function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  return err?.code === "P2002" || /UNIQUE constraint failed/i.test(err?.message ?? "");
}
