import { describe, it, expect } from "vitest";
import { commodityValueFils } from "@/lib/core/valuation";

describe("commodityValueFils (hand-checked math)", () => {
  it("values a 1kg 24K gold bar at a known spot", () => {
    // spot = 250 AED/g pure = 25000 fils/g. 1000g * 1.0 purity = 1000g pure.
    // value = round(1000 * 25000) = 25,000,000 fils = AED 250,000.
    const r = commodityValueFils({
      weight: 1,
      weightUnit: "kg",
      purityFraction: 1,
      spotFilsPerGram: 25000,
    });
    expect(r.valueFils).toBe(25_000_000);
    expect(r.pureGrams).toBe(1000);
  });

  it("applies purity (22K) correctly", () => {
    // 100g at 22/24 purity, spot 25000 fils/g => 100*0.91666..*25000
    const r = commodityValueFils({
      weight: 100,
      weightUnit: "gram",
      purityFraction: 22 / 24,
      spotFilsPerGram: 25000,
    });
    // pure grams = 91.6667; * 25000 = 2,291,666.67 -> round 2,291,667
    expect(r.pureGrams).toBeCloseTo(91.6667, 3);
    expect(r.valueFils).toBe(2_291_667);
  });

  it("multiplies by quantity", () => {
    const r = commodityValueFils({
      weight: 1,
      weightUnit: "troy_oz",
      purityFraction: 0.999,
      spotFilsPerGram: 300, // silver-ish
      quantity: 10,
    });
    const perUnit = Math.round(31.1034768 * 0.999 * 300);
    expect(r.valueFils).toBe(perUnit * 10);
  });
});
