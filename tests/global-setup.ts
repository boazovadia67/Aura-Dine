import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

// Fresh throwaway SQLite file for every test run.
export default function setup() {
  for (const f of ["test.db", "test.db-journal", "test.db-wal", "test.db-shm"]) rmSync(f, { force: true });
  execSync("npx prisma db push", { env: { ...process.env, DATABASE_URL: "file:./test.db" }, stdio: "ignore" });
}
