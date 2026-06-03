import { describe, it, expect } from "vitest";
import { commodityTotalFils } from "@/lib/core/valuation";

describe("commodityTotalFils (hand-checked math)", () => {
  it("values a holding from amount × price-per-unit", () => {
    // 100 grams at 250 AED/gram = 25,000 fils/gram.
    // total = round(100 * 25000) = 2,500,000 fils = AED 25,000.
    const r = commodityTotalFils({ weight: 100, pricePerUnitFils: 25000 });
    expect(r.totalFils).toBe(2_500_000);
    expect(r.weight).toBe(100);
    expect(r.pricePerUnitFils).toBe(25000);
  });

  it("works with any unit (price is per the same unit as weight)", () => {
    // 2 kg at AED 1,000,000/kg = 100,000,000 fils/kg.
    const r = commodityTotalFils({ weight: 2, pricePerUnitFils: 100_000_000 });
    expect(r.totalFils).toBe(200_000_000);
  });

  it("rounds fractional fils to the nearest integer", () => {
    // 1.005 troy_oz at 333 fils/oz = 334.665 -> round 335.
    const r = commodityTotalFils({ weight: 1.005, pricePerUnitFils: 333 });
    expect(r.totalFils).toBe(335);
  });
});
