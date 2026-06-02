/**
 * Dev helper: delete the local SQLite DB (+ WAL/SHM) and recreate it from
 * schema.sql. Destroys all data — local dev only. `npm run db:reset`.
 */
import { rmSync } from "node:fs";
import { join } from "node:path";
import { getDb, closeDb } from "@/lib/db/client";

const base = join(process.cwd(), "data", "portfolio.db");
for (const f of [base, `${base}-wal`, `${base}-shm`]) {
  rmSync(f, { force: true });
}
getDb(); // recreates from schema
closeDb();
console.log("Database reset and re-created from schema.sql");
