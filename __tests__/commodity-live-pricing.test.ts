import { describe, it, expect } from "vitest";
import { applyLiveSpotPrices } from "@/lib/core/commodity-analytics";
import type { Commodity } from "@/lib/types";

function commodity(over: Partial<Commodity>): Commodity {
  return {
    id: 1,
    metal_type: "gold",
    weight: 100,
    weight_unit: "gram",
    current_price_per_unit_fils: 20_000, // stored snapshot
    bought_price_per_unit_fils: 15_000,
    target_sell_price_per_unit_fils: null,
    purchase_date: "2026-01-01",
    current_price_date: "2026-01-01",
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("applyLiveSpotPrices", () => {
  it("overrides the current price from live spot for a priced metal", () => {
    // gold at 300 AED/gram, held in grams -> 30,000 fils/gram (live), replacing the 20,000 snapshot.
    const [r] = applyLiveSpotPrices([commodity({ metal_type: "gold", weight_unit: "gram" })], { gold: 300 });
    expect(r!.source).toBe("live");
    expect(r!.livePriceFils).toBe(30_000);
    expect(r!.commodity.current_price_per_unit_fils).toBe(30_000);
  });

  it("converts to the holding's weight unit (kg)", () => {
    // 300 AED/gram × 1000 = 300,000 AED/kg -> 30,000,000 fils/kg.
    const [r] = applyLiveSpotPrices([commodity({ metal_type: "gold", weight_unit: "kg" })], { gold: 300 });
    expect(r!.commodity.current_price_per_unit_fils).toBe(30_000_000);
  });

  it("falls back to the stored price for metal type 'other'", () => {
    const [r] = applyLiveSpotPrices([commodity({ metal_type: "other" })], { gold: 300 });
    expect(r!.source).toBe("stored");
    expect(r!.livePriceFils).toBeNull();
    expect(r!.commodity.current_price_per_unit_fils).toBe(20_000);
  });

  it("falls back to stored when the metal has no spot entry", () => {
    const [r] = applyLiveSpotPrices([commodity({ metal_type: "silver" })], { gold: 300 });
    expect(r!.source).toBe("stored");
    expect(r!.commodity.current_price_per_unit_fils).toBe(20_000);
  });

  it("falls back to stored when spot is zero, negative, or non-finite (bad feed)", () => {
    for (const bad of [0, -5, NaN]) {
      const [r] = applyLiveSpotPrices([commodity({ metal_type: "gold" })], { gold: bad });
      expect(r!.source).toBe("stored");
      expect(r!.commodity.current_price_per_unit_fils).toBe(20_000);
    }
  });

  it("does not mutate the input commodity", () => {
    const input = commodity({ metal_type: "gold", weight_unit: "gram" });
    applyLiveSpotPrices([input], { gold: 300 });
    expect(input.current_price_per_unit_fils).toBe(20_000);
  });

  it("prices a mixed portfolio independently", () => {
    const out = applyLiveSpotPrices(
      [
        commodity({ id: 1, metal_type: "gold", weight_unit: "gram" }),
        commodity({ id: 2, metal_type: "other" }),
      ],
      { gold: 300 },
    );
    expect(out[0]!.source).toBe("live");
    expect(out[1]!.source).toBe("stored");
  });
});
