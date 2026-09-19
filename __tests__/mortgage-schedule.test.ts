import { describe, it, expect } from "vitest";
import { generateMortgageSchedule } from "@/lib/core/mortgage-schedule";
import type { Mortgage } from "@/lib/types";

function mortgage(over: Partial<Mortgage> = {}): Mortgage {
  return {
    id: 1,
    property_id: 10,
    loan_amount_fils: 12_000_000, // AED 120,000
    interest_rate_pct: 0,
    rate_type: "fixed",
    loan_start_date: "2026-01-15",
    loan_term_months: 12,
    lender_name: "Test Bank",
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("generateMortgageSchedule", () => {
  it("generates one monthly payment per term month, first due 1 month after start", () => {
    const s = generateMortgageSchedule(mortgage({}), "2026-03-20");
    expect(s).toHaveLength(12);
    expect(s[0]!.dueDate).toBe("2026-02-15");
    expect(s[11]!.dueDate).toBe("2027-01-15");
  });

  it("zero-interest monthly amount is principal / term (hand-checked)", () => {
    // 12,000,000 fils / 12 months = 1,000,000 fils = AED 10,000.
    const s = generateMortgageSchedule(mortgage({}), "2026-03-20");
    for (const e of s) expect(e.amountFils).toBe(1_000_000);
  });

  it("uses the amortizing formula when interest > 0 (hand-checked from mortgage.test.ts)", () => {
    // 10,000,000 fils at 6% over 12 months = 860,664 fils/month.
    const s = generateMortgageSchedule(
      mortgage({ loan_amount_fils: 10_000_000, interest_rate_pct: 6 }),
      "2026-03-20",
    );
    expect(s[0]!.amountFils).toBe(860_664);
  });

  it("marks payments due before asOf as paid, the rest upcoming", () => {
    const s = generateMortgageSchedule(mortgage({}), "2026-03-20");
    // Due dates: Feb 15, Mar 15 are < Mar 20 -> paid; Apr 15 onwards -> upcoming.
    expect(s.filter((e) => e.status === "paid").map((e) => e.dueDate))
      .toEqual(["2026-02-15", "2026-03-15"]);
    expect(s.filter((e) => e.status === "upcoming")).toHaveLength(10);
  });

  it("clamps each payment to month-end (Jan 31 + 1 month = Feb 28)", () => {
    const s = generateMortgageSchedule(
      mortgage({ loan_start_date: "2026-01-31", loan_term_months: 3 }),
      "2026-03-20",
    );
    expect(s.map((e) => e.dueDate)).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("carries property id, lender, and stable unique keys", () => {
    const s = generateMortgageSchedule(mortgage({}), "2026-03-20");
    const keys = new Set(s.map((e) => e.key));
    expect(keys.size).toBe(12);
    for (const e of s) {
      expect(e.propertyId).toBe(10);
      expect(e.lenderName).toBe("Test Bank");
      expect(e.type).toBe("mortgage");
    }
  });
});
