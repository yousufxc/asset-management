import { getDb } from "@/lib/db/client";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import type { Property, CashAccount, Commodity, Installment } from "@/lib/types";

const DEFAULTS: Record<string, string> = {
  runwayHorizonDays: "90",
};

export function getSetting(key: string): string {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  if (row) return row.value;
  if (key in DEFAULTS) {
    setSetting(key, DEFAULTS[key]!);
    return DEFAULTS[key]!;
  }
  throw new Error(`Unknown setting key: ${key}`);
}

export function getSettingInt(key: string): number {
  const raw = getSetting(key);
  const n = parseInt(raw, 10);
  if (isNaN(n)) throw new Error(`Setting "${key}" is not an integer: ${raw}`);
  return n;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
}

export function getAllSettings(): Record<string, string> {
  const db = getDb();
  const rows = db
    .prepare("SELECT key, value FROM settings ORDER BY key")
    .all() as { key: string; value: string }[];
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (!(k in result)) result[k] = v;
  }
  return result;
}

export interface AllDataExport {
  exportedAt: string;
  properties: Property[];
  cashAccounts: CashAccount[];
  commodities: Commodity[];
  installments: Installment[];
  settings: Record<string, string>;
}

export function getAllData(): AllDataExport {
  const db = getDb();
  return {
    exportedAt: new Date().toISOString(),
    properties: db
      .prepare("SELECT * FROM properties ORDER BY id")
      .all() as unknown as Property[],
    cashAccounts: db
      .prepare("SELECT * FROM cash_accounts ORDER BY id")
      .all() as unknown as CashAccount[],
    commodities: db
      .prepare("SELECT * FROM commodities ORDER BY id")
      .all() as unknown as Commodity[],
    installments: db
      .prepare("SELECT * FROM installments ORDER BY id")
      .all() as unknown as Installment[],
    settings: getAllSettings(),
  };
}

export function exportToDisk(): string {
  const data = getAllData();
  const dataDir = dirname(
    process.env.PORTFOLIO_DB_PATH ?? join(process.cwd(), "data", "portfolio.db"),
  );
  const dir = join(dataDir, "backups");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(dir, `backup-${ts}.json`);
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
  return path;
}

const DATA_TABLES = [
  "installments",
  "transactions",
  "statements",
  "properties",
  "cash_accounts",
  "commodities",
];

export function resetAllData(): void {
  const db = getDb();
  db.exec("PRAGMA foreign_keys = OFF");
  for (const table of DATA_TABLES) {
    db.exec(`DELETE FROM ${table}`);
  }
  db.exec("PRAGMA foreign_keys = ON");
}

export function getTableCounts(): Record<string, number> {
  const db = getDb();
  const tables = ["properties", "cash_accounts", "commodities", "installments"];
  const result: Record<string, number> = {};
  for (const table of tables) {
    const row = db
      .prepare(`SELECT COUNT(*) AS cnt FROM ${table}`)
      .get() as { cnt: number };
    result[table] = row.cnt;
  }
  return result;
}
