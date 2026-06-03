import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

// Load the `node:sqlite` builtin via runtime require so bundlers (Vitest/Vite,
// Next) don't try to pre-resolve this newer specifier. Type stays compile-time.
import type { DatabaseSync as DatabaseSyncT } from "node:sqlite";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

/**
 * Read/write SQLite connection (singleton), using Node's BUILT-IN `node:sqlite`.
 *
 * Why node:sqlite (not better-sqlite3): it ships with Node, needs no native
 * compilation, and can't break on a Node upgrade — fewer moving parts is a
 * safety feature for this project. Same SQLite engine underneath, so SQL
 * semantics and data integrity are unchanged.
 *
 * - WAL mode: better durability/concurrency for a local single-process app.
 * - foreign_keys ON: enforce referential integrity (installments -> property).
 * - Schema applied idempotently (CREATE TABLE IF NOT EXISTS) on first open.
 *
 * This is the ONLY module that opens a writable handle. The chatbot must use
 * lib/db/readonly.ts instead (rule 2.5).
 */

const DB_PATH = process.env.PORTFOLIO_DB_PATH ?? join(process.cwd(), "data", "portfolio.db");
const SCHEMA_PATH = join(process.cwd(), "lib", "db", "schema.sql");

let _db: DatabaseSyncT | null = null;

export function getDb(): DatabaseSyncT {
  if (_db) return _db;

  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");

  // schema.sql is the SINGLE source of truth (applied idempotently via
  // CREATE TABLE/VIEW IF NOT EXISTS). Schema changes use `npm run db:reset` — no
  // ad-hoc migrations in Phase 1 (documented decision; one definition per
  // table/view, no drift).
  const schema = readFileSync(SCHEMA_PATH, "utf8");
  db.exec(schema);

  _db = db;
  return _db;
}

/** Close the singleton (used by scripts/tests). */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
