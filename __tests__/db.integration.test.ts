/**
 * DB-level integrity tests against an ISOLATED temp database.
 * Proves the schema + thin query layer enforce the non-negotiables (rule 2.2):
 *   - re-inserting the same transaction adds ZERO new rows (dedup)
 *   - AED input is stored as integer fils
 *   - UAE date input is stored as ISO
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "portfolio-test-"));
  process.env.PORTFOLIO_DB_PATH = join(tmpDir, "test.db");
});

afterAll(async () => {
  const { closeDb } = await import("@/lib/db/client");
  closeDb();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("property + installment write path", () => {
  it("stores AED as fils and UAE dates as ISO", async () => {
    const q = await import("@/lib/db/queries");
    const prop = q.insertProperty({
      name: "Marina Tower 1204",
      subcategory: "off_plan",
      size_unit: "sqft",
      current_value_aed: 2_500_000,
      is_rental: false,
    });
    expect(prop.current_value_fils).toBe(250_000_000);

    const inst = q.insertInstallment({
      property_id: prop.id,
      due_date: "07/03/2026",
      amount_aed: 180_000,
      status: "upcoming",
      source: "manual",
    });
    expect(inst.amount_fils).toBe(18_000_000);
    expect(inst.due_date).toBe("2026-03-07"); // DD/MM parsed correctly
  });
});

describe("transaction dedup at the DB level (rule 2.2)", () => {
  it("re-inserting the same transaction adds zero new rows", async () => {
    const q = await import("@/lib/db/queries");
    const txn = {
      account_id: null,
      statement_id: null,
      txn_date: "2026-03-07",
      description: "POS Purchase CARREFOUR",
      amount_fils: -15050,
    };
    expect(q.insertTransactionDeduped(txn)).toBe(true); // first time inserts
    expect(q.insertTransactionDeduped(txn)).toBe(false); // duplicate ignored
    expect(q.insertTransactionDeduped({ ...txn, description: "  POS   purchase carrefour " })).toBe(
      false,
    ); // cosmetic variant still a duplicate
  });
});
