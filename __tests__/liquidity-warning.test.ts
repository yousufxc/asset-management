import { describe, it, expect } from "vitest";
import { checkLiquidityWarning } from "@/lib/core/runway";
import type { RunwayInput } from "@/lib/core/runway";

const asOf = "2026-06-01";

describe("checkLiquidityWarning", () => {
  it("breached when shortfall within 90 days", () => {
    const input: RunwayInput = {
      asOf,
      liquidCashFils: 500_000,
      liabilities: [
        { id: 1, label: "Big payment", dueDate: "2026-07-01", amountFils: 1_000_000, kind: "installment" },
      ],
      horizonDays: 90,
    };
    const warn = checkLiquidityWarning(input);
    expect(warn.breached).toBe(true);
    expect(warn.shortfallFils).toBe(500_000);
    expect(warn.byDate).toBe("2026-07-01");
  });

  it("not breached when cash covers everything", () => {
    const input: RunwayInput = {
      asOf,
      liquidCashFils: 2_000_000,
      liabilities: [
        { id: 1, label: "Small payment", dueDate: "2026-07-01", amountFils: 500_000, kind: "installment" },
      ],
      horizonDays: 90,
    };
    const warn = checkLiquidityWarning(input);
    expect(warn.breached).toBe(false);
    expect(warn.shortfallFils).toBe(0);
    expect(warn.byDate).toBeNull();
  });

  it("not breached when empty liabilities", () => {
    const warn = checkLiquidityWarning({ asOf, liquidCashFils: 100_000, liabilities: [], horizonDays: 90 });
    expect(warn.breached).toBe(false);
  });
});
