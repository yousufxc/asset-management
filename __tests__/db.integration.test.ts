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

describe("property maintenance", () => {
  it("inserts, reads, updates, and deletes a maintenance entry", async () => {
    const q = await import("@/lib/db/queries");

    const prop = q.insertProperty({
      name: "Test Property",
      subcategory: "existing",
      size_unit: "sqft",
      is_rental: false,
    });

    const entry = q.insertPropertyMaintenance({
      property_id: prop.id,
      amount_aed: 500,
      maintenance_date: "2025-06-15",
      notes: "Plumbing repair",
    });
    expect(entry.amount_fils).toBe(50_000);
    expect(entry.maintenance_date).toBe("2025-06-15");
    expect(entry.notes).toBe("Plumbing repair");

    const list = q.listMaintenanceForProperty(prop.id);
    expect(list).toHaveLength(1);
    expect(list[0]!.amount_fils).toBe(50_000);

    const updated = q.updatePropertyMaintenance(entry.id, { amount_aed: 750 });
    expect(updated!.amount_fils).toBe(75_000);

    const total = q.totalMaintenanceForPropertyFils(prop.id);
    expect(total).toBe(75_000);

    q.deletePropertyMaintenance(entry.id);
    expect(q.listMaintenanceForProperty(prop.id)).toHaveLength(0);
  });

  it("cascade deletes maintenance when property is removed", async () => {
    const q = await import("@/lib/db/queries");

    const prop = q.insertProperty({
      name: "Cascade Test",
      subcategory: "existing",
      size_unit: "sqft",
      is_rental: false,
    });

    q.insertPropertyMaintenance({
      property_id: prop.id,
      amount_aed: 100,
      maintenance_date: "2025-01-01",
    });

    q.deleteProperty(prop.id);
    const all = q.listAllMaintenance();
    expect(all.filter((m) => m.property_id === prop.id)).toHaveLength(0);
  });

  it("includes maintenance in the backup export and clears it on reset", async () => {
    const q = await import("@/lib/db/queries");
    const { getAllData, resetAllData } = await import("@/lib/db/settings");

    const prop = q.insertProperty({
      name: "Backup Test",
      subcategory: "existing",
      size_unit: "sqft",
      is_rental: false,
    });
    q.insertPropertyMaintenance({
      property_id: prop.id,
      amount_aed: 1_200,
      maintenance_date: "2025-04-10",
      notes: "Repaint",
    });

    // Backup must carry the maintenance row (else it is lost on backup/restore).
    const backup = getAllData();
    const mine = backup.maintenance.filter((m) => m.property_id === prop.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.amount_fils).toBe(120_000);
    expect(mine[0]!.maintenance_date).toBe("2025-04-10");

    // Reset must clear property_maintenance too (foreign_keys are OFF during
    // reset, so the cascade from properties does not fire — the table must be
    // wiped explicitly or maintenance rows are orphaned).
    resetAllData();
    expect(q.listAllMaintenance()).toHaveLength(0);
  });
});
