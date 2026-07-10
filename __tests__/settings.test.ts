/**
 * Settings tests: Zod validation + runway horizon wiring.
 * Pure core tests (runway with non-default horizon) + DB integration tests.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { computeRunway, checkLiquidityWarning } from "@/lib/core/runway";
import type { RunwayInput } from "@/lib/core/runway";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const asOf = "2026-06-01";

// ─── Pure core: runway with non-default horizon ─────────────────────────────

describe("computeRunway with non-default horizonDays", () => {
  it("30-day horizon catches shortfall that 90-day would miss", () => {
    const input: RunwayInput = {
      asOf,
      liquidCashFils: 500_000,
      liabilities: [
        { id: 1, label: "Payment at day 60", dueDate: "2026-07-31", amountFils: 1_000_000, kind: "installment" },
      ],
      horizonDays: 30,
    };
    // June 1 + 30 days = July 1. Payment on July 31 is beyond 30-day horizon.
    const result = computeRunway(input);
    expect(result.shortfallDate).toBe("2026-07-31");
    expect(result.daysUntilShortfall).toBe(60);
    expect(result.withinHorizon).toBe(false); // 60 > 30
  });

  it("365-day horizon catches all far-future shortfalls", () => {
    const input: RunwayInput = {
      asOf,
      liquidCashFils: 500_000,
      liabilities: [
        { id: 1, label: "Payment at day 200", dueDate: "2026-12-18", amountFils: 1_000_000, kind: "installment" },
      ],
      horizonDays: 365,
    };
    const result = computeRunway(input);
    expect(result.shortfallDate).toBe("2026-12-18");
    expect(result.daysUntilShortfall).toBe(200);
    expect(result.withinHorizon).toBe(true); // 200 <= 365
  });

  it("7-day horizon: same-day shortfall is within window", () => {
    const input: RunwayInput = {
      asOf,
      liquidCashFils: 100_000,
      liabilities: [
        { id: 1, label: "Urgent", dueDate: "2026-06-03", amountFils: 200_000, kind: "installment" },
      ],
      horizonDays: 7,
    };
    const result = computeRunway(input);
    expect(result.shortfallDate).toBe("2026-06-03");
    expect(result.daysUntilShortfall).toBe(2);
    expect(result.withinHorizon).toBe(true); // 2 <= 7
  });

  it("default horizon (undefined) uses 90 days", () => {
    const input: RunwayInput = {
      asOf,
      liquidCashFils: 500_000,
      liabilities: [
        { id: 1, label: "Payment at day 60", dueDate: "2026-07-31", amountFils: 1_000_000, kind: "installment" },
      ],
      // horizonDays omitted — should default to 90
    };
    const result = computeRunway(input);
    expect(result.shortfallDate).toBe("2026-07-31");
    expect(result.daysUntilShortfall).toBe(60);
    expect(result.withinHorizon).toBe(true); // 60 <= 90 (default)
  });
});

describe("checkLiquidityWarning with non-default horizonDays", () => {
  it("breached when shortfall is within the configured horizon", () => {
    const warning = checkLiquidityWarning({
      asOf,
      liquidCashFils: 500_000,
      liabilities: [
        { id: 1, label: "Payment", dueDate: "2026-07-01", amountFils: 1_000_000, kind: "installment" },
      ],
      horizonDays: 30,
    });
    // 30 days from June 1 is 30 days. Payment July 1 is 30 days out.
    expect(warning.breached).toBe(true); // 30 <= 30
    expect(warning.shortfallFils).toBe(500_000);
    expect(warning.daysUntil).toBe(30);
  });

  it("not breached when shortfall is beyond configured horizon", () => {
    const warning = checkLiquidityWarning({
      asOf,
      liquidCashFils: 500_000,
      liabilities: [
        { id: 1, label: "Far payment", dueDate: "2026-09-01", amountFils: 1_000_000, kind: "installment" },
      ],
      horizonDays: 30,
    });
    expect(warning.breached).toBe(false); // 92 > 30
    expect(warning.shortfallFils).toBe(500_000); // still computed
    expect(warning.daysUntil).toBe(92);
  });
});

// ─── DB integration: settings table read/write ──────────────────────────────

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "settings-test-"));
  process.env.PORTFOLIO_DB_PATH = join(tmpDir, "test.db");
});

afterAll(async () => {
  const { closeDb } = await import("@/lib/db/client");
  closeDb();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("settings DB operations", () => {
  it("getSetting returns default 90 for runwayHorizonDays on fresh DB", async () => {
    const { getSetting } = await import("@/lib/db/settings");
    expect(getSetting("runwayHorizonDays")).toBe("90");
  });

  it("getSettingInt returns 90 as number", async () => {
    const { getSettingInt } = await import("@/lib/db/settings");
    expect(getSettingInt("runwayHorizonDays")).toBe(90);
  });

  it("setSetting + getSetting round-trip", async () => {
    const { setSetting, getSetting } = await import("@/lib/db/settings");
    setSetting("runwayHorizonDays", "30");
    expect(getSetting("runwayHorizonDays")).toBe("30");
    setSetting("runwayHorizonDays", "90"); // restore default
  });

  it("getAllSettings returns all defaults on fresh DB", async () => {
    const { getAllSettings } = await import("@/lib/db/settings");
    const settings = getAllSettings();
    expect(settings.runwayHorizonDays).toBe("90");
  });

  it("getAllSettings reflects changes after setSetting", async () => {
    const { setSetting, getAllSettings } = await import("@/lib/db/settings");
    setSetting("runwayHorizonDays", "60");
    expect(getAllSettings().runwayHorizonDays).toBe("60");
    setSetting("runwayHorizonDays", "90"); // restore
  });

  it("getSetting throws for unknown keys", async () => {
    const { getSetting } = await import("@/lib/db/settings");
    expect(() => getSetting("nonexistent")).toThrow("Unknown setting key");
  });

  it("export contains all table keys", async () => {
    const { getAllData } = await import("@/lib/db/settings");
    const data = getAllData();
    expect(data).toHaveProperty("exportedAt");
    expect(data).toHaveProperty("properties");
    expect(data).toHaveProperty("cashAccounts");
    expect(data).toHaveProperty("commodities");
    expect(data).toHaveProperty("installments");
    expect(data).toHaveProperty("settings");
    expect(Array.isArray(data.properties)).toBe(true);
    expect(Array.isArray(data.cashAccounts)).toBe(true);
    expect(Array.isArray(data.commodities)).toBe(true);
    expect(Array.isArray(data.installments)).toBe(true);
  });

  it("exportToDisk writes a file", async () => {
    const { exportToDisk } = await import("@/lib/db/settings");
    const { existsSync, readFileSync } = await import("node:fs");
    const path = exportToDisk();
    expect(existsSync(path)).toBe(true);
    const content = JSON.parse(readFileSync(path, "utf8"));
    expect(content).toHaveProperty("exportedAt");
    expect(content).toHaveProperty("properties");
  });

  it("resetAllData clears data tables but settings survive (settings not in DATA_TABLES list)", async () => {
    const { resetAllData, getSetting, getTableCounts } = await import("@/lib/db/settings");
    resetAllData();
    const counts = getTableCounts();
    expect(counts.properties).toBe(0);
    expect(counts.cash_accounts).toBe(0);
    expect(counts.commodities).toBe(0);
    expect(counts.installments).toBe(0);
    // Settings should still be accessible after reset
    expect(getSetting("runwayHorizonDays")).toBe("90");
  });

  it("resetAllData preserves schema (can re-insert after wipe)", async () => {
    const { resetAllData } = await import("@/lib/db/settings");
    resetAllData();
    const q = await import("@/lib/db/queries");
    const prop = q.insertProperty({
      name: "After Reset",
      subcategory: "existing",
      size_unit: "sqft",
      is_rental: false,
    });
    expect(prop.id).toBeGreaterThan(0);
    expect(prop.name).toBe("After Reset");
  });
});
