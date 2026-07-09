import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

// node:sqlite is a Node 22.5+ built-in. Vite/Vitest cannot resolve the
// node: protocol at build time, so we load it via createRequire (works in
// Node ESM). Next.js 15 externalises it via serverExternalPackages so HMR
// won't re-bundle and break the require.
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

  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");

  // schema.sql is the single source of truth for the DB shape. It holds
  // CREATE TABLE/VIEW/INDEX (IF NOT EXISTS) plus additive `ALTER TABLE ADD
  // COLUMN` statements that migrate pre-existing databases to newer columns
  // WITHOUT a destructive db:reset. We execute each statement individually and
  // swallow "duplicate column"/"already exists" errors, so both paths converge:
  // a fresh DB gets columns from CREATE TABLE (the ALTERs no-op), an existing DB
  // gets any missing columns from the ALTERs. Any other error is re-thrown.
  const schema = readFileSync(SCHEMA_PATH, "utf8");
  const statements = schema.split(";\n").map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    try {
      db.exec(stmt);
    } catch (e) {
      // ALTER TABLE ADD COLUMN fails when column already exists (fresh DB) — safe to ignore.
      // Other errors (syntax, constraint violations) are re-thrown.
      const msg = String(e);
      if (msg.includes("duplicate column name") || msg.includes("already exists")) continue;
      throw e;
    }
  }

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
