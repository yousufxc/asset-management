import { describe, it, expect } from "vitest";
import { checkDoubleEntry } from "@/lib/core/ledger";

describe("checkDoubleEntry (rule 2.2: opening + credits - debits == closing)", () => {
  it("balances an exact statement (all fils)", () => {
    // opening 10,000.00 AED; +2,500.00 credit; -1,250.50 debit; closing 11,249.50
    const r = checkDoubleEntry({
      openingFils: 1_000_000,
      creditsFils: [250_000],
      debitsFils: [125_050],
      closingFils: 1_124_950,
    });
    expect(r.balanced).toBe(true);
    expect(r.deltaFils).toBe(0);
    expect(r.expectedClosingFils).toBe(1_124_950);
  });

  it("flags an unbalanced statement and reports the delta", () => {
    const r = checkDoubleEntry({
      openingFils: 1_000_000,
      creditsFils: [250_000],
      debitsFils: [125_050],
      closingFils: 1_124_900, // 50 fils short
    });
    expect(r.balanced).toBe(false);
    expect(r.deltaFils).toBe(-50);
  });

  it("respects an explicit tolerance", () => {
    const r = checkDoubleEntry(
      { openingFils: 0, creditsFils: [100], debitsFils: [], closingFils: 101 },
      1,
    );
    expect(r.balanced).toBe(true);
  });

  it("handles empty credit/debit lists", () => {
    const r = checkDoubleEntry({ openingFils: 500, creditsFils: [], debitsFils: [], closingFils: 500 });
    expect(r.balanced).toBe(true);
  });
});
