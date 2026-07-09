import { describe, it, expect } from "vitest";
import { commodityTotalFils, spotPricePerUnitFils } from "@/lib/core/valuation";

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

describe("spotPricePerUnitFils (AED/gram spot -> fils per weight_unit)", () => {
  it("gram: price per gram is the spot itself", () => {
    // 300 AED/gram -> 30,000 fils/gram.
    expect(spotPricePerUnitFils(300, "gram")).toBe(30_000);
  });

  it("kg: multiplies by 1000 grams", () => {
    // 300 AED/gram × 1000 = 300,000 AED/kg -> 30,000,000 fils/kg.
    expect(spotPricePerUnitFils(300, "kg")).toBe(30_000_000);
  });

  it("troy_oz: multiplies by 31.1034768 grams and rounds to nearest fil", () => {
    // 3.5 AED/gram × 31.1034768 = 108.8621688 AED/oz -> round(10886.21688) = 10886 fils.
    expect(spotPricePerUnitFils(3.5, "troy_oz")).toBe(10_886);
  });

  it("tola: multiplies by 11.6638038 grams and rounds", () => {
    // 300 × 11.6638038 = 3499.14114 AED/tola -> round(349914.114) = 349914 fils.
    expect(spotPricePerUnitFils(300, "tola")).toBe(349_914);
  });

  it("throws on non-finite spot", () => {
    expect(() => spotPricePerUnitFils(NaN, "gram")).toThrow();
  });
});
