import { describe, it, expect, afterAll } from "vitest";
import { rmSync } from "node:fs";

describe("ParsedScheduleSchema", () => {
  it("accepts a valid schedule with ISO dates", async () => {
    const { ParsedScheduleSchema } = await import("@/lib/ingest/validate");
    const result = ParsedScheduleSchema.safeParse({
      property_name: "Marina Tower",
      developer: "Emaar",
      installments: [
        { due_date: "2026-06-15", amount_aed: 75000, milestone_label: "20% foundation" },
        { due_date: "2026-12-01", amount_aed: 50000 },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.installments).toHaveLength(2);
    }
  });

  it("rejects empty installments array", async () => {
    const { ParsedScheduleSchema } = await import("@/lib/ingest/validate");
    const result = ParsedScheduleSchema.safeParse({
      installments: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing due_date", async () => {
    const { ParsedScheduleSchema } = await import("@/lib/ingest/validate");
    const result = ParsedScheduleSchema.safeParse({
      installments: [{ amount_aed: 100 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects UAE dates (must be ISO from Claude)", async () => {
    const { ParsedScheduleSchema } = await import("@/lib/ingest/validate");
    const result = ParsedScheduleSchema.safeParse({
      installments: [{ due_date: "15/06/2026", amount_aed: 100 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount_aed", async () => {
    const { ParsedScheduleSchema } = await import("@/lib/ingest/validate");
    const result = ParsedScheduleSchema.safeParse({
      installments: [{ due_date: "2026-06-15", amount_aed: -10 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("installmentExistsByKey (idempotency guard)", () => {
  afterAll(async () => {
    // Clean up test DB file to avoid leaking between test runs
    const testDbPath = process.env.PORTFOLIO_DB_PATH;
    if (testDbPath) {
      const { closeDb } = await import("@/lib/db/client");
      closeDb();
      try {
        rmSync(testDbPath);
      } catch {
        // ignore
      }
    }
  });

  it("returns false when no matching installment exists", async () => {
    const { installmentExistsByKey } = await import("@/lib/db/queries");
    // Fresh DB should have no installments matching this key
    expect(installmentExistsByKey(999, "2026-01-01", 10000)).toBe(false);
  });

  it("returns true after inserting an installment", async () => {
    const { getDb } = await import("@/lib/db/client");
    const { installmentExistsByKey } = await import("@/lib/db/queries");
    const db = getDb();

    const propResult = (db.prepare(
      "INSERT INTO properties (name, subcategory) VALUES (?, ?)"
    ).run("KeyTest Property", "off_plan") as unknown as { lastInsertRowid: number | bigint });

    const propId = Number(propResult.lastInsertRowid);

    (db.prepare(
      "INSERT INTO installments (property_id, due_date, amount_fils, status, source) VALUES (?, ?, ?, ?, ?)"
    ).run(propId, "2026-06-01", 5000000, "upcoming", "manual") as unknown as { lastInsertRowid: number | bigint });

    expect(installmentExistsByKey(propId, "2026-06-01", 5000000)).toBe(true);
    expect(installmentExistsByKey(propId, "2026-06-01", 5000001)).toBe(false);
    expect(installmentExistsByKey(propId, "2026-06-02", 5000000)).toBe(false);
  });
});
