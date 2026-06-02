import { join } from "node:path";
import { createRequire } from "node:module";

import type { DatabaseSync as DatabaseSyncT } from "node:sqlite";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

/**
 * READ-ONLY SQLite handle for the Phase-3 conversational query feature (rule 2.5).
 *
 * Opened with `readOnly: true` so it is *physically* incapable of writing — even
 * a SQL string that slips past the validator cannot mutate data (verified: writes
 * raise ERR_SQLITE_ERROR). Defence in depth:
 *   1. readOnly handle (here)
 *   2. SELECT-only SQL validator (added in Phase 3)
 *   3. chatbot only ever queries the v_* sanitized VIEWS, never base tables
 *
 * Do NOT add write capability here or reuse lib/db/client.ts.
 */

const DB_PATH = process.env.PORTFOLIO_DB_PATH ?? join(process.cwd(), "data", "portfolio.db");

let _rodb: DatabaseSyncT | null = null;

export function getReadOnlyDb(): DatabaseSyncT {
  if (_rodb) return _rodb;
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  db.exec("PRAGMA query_only = ON");
  _rodb = db;
  return _rodb;
}

export function closeReadOnlyDb(): void {
  if (_rodb) {
    _rodb.close();
    _rodb = null;
  }
}
