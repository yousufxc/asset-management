/**
 * PURE commodity analytics functions. No DB, no network, no mutations.
 */

import type { Commodity } from "@/lib/types";
import { toGrams } from "@/lib/core/units";
import { commodityTotalFils, spotPricePerUnitFils } from "@/lib/core/valuation";

/** A commodity re-priced against live spot, with lineage for show-your-work. */
export interface LivePricedCommodity {
  /** The commodity, with current_price_per_unit_fils overridden to live where available. */
  commodity: Commodity;
  /** "live" when the current price came from spot; "stored" when it fell back to the DB snapshot. */
  source: "live" | "stored";
  /** The live per-unit price in fils, or null when no spot was applied. */
  livePriceFils: number | null;
}

/**
 * Re-price commodities against live spot at READ TIME. For each holding whose
 * metal has a spot price (everything except "other"), the current price per
 * unit is recomputed from AED/gram spot; otherwise the stored snapshot is kept.
 *
 * Pure: takes a spot map (metal_type -> AED per gram), returns new objects and
 * never mutates the inputs. Missing/zero/non-finite spot falls back to stored,
 * so a failed price feed degrades gracefully to the last saved values.
 */
export function applyLiveSpotPrices(
  commodities: Commodity[],
  spotPerGramByMetal: Record<string, number>,
): LivePricedCommodity[] {
  return commodities.map((c) => {
    const spot = spotPerGramByMetal[c.metal_type];
    if (c.metal_type !== "other" && typeof spot === "number" && Number.isFinite(spot) && spot > 0) {
      const livePriceFils = spotPricePerUnitFils(spot, c.weight_unit);
      return {
        commodity: { ...c, current_price_per_unit_fils: livePriceFils },
        source: "live" as const,
        livePriceFils,
      };
    }
    return { commodity: c, source: "stored" as const, livePriceFils: null };
  });
}

export interface EnrichedCommodity {
  commodity: Commodity;
  costFils: number;
  valueFils: number;
  grams: number;
  hasCurrent: boolean;
  pl: number;
  plPct: number | null;
}

export function enrichCommodity(c: Commodity): EnrichedCommodity {
  const cost = commodityTotalFils({ weight: c.weight, pricePerUnitFils: c.bought_price_per_unit_fils });
  const value = commodityTotalFils({ weight: c.weight, pricePerUnitFils: c.current_price_per_unit_fils });
  const hasCurrent = c.current_price_per_unit_fils > 0;
  const pl = value.totalFils - cost.totalFils;
  const plPct = hasCurrent && cost.totalFils > 0 ? (pl / cost.totalFils) * 100 : null;
  const grams = toGrams(c.weight, c.weight_unit);
  return { commodity: c, costFils: cost.totalFils, valueFils: value.totalFils, grams, hasCurrent, pl, plPct };
}

export function enrichCommodities(commodities: Commodity[]): EnrichedCommodity[] {
  return commodities.map(enrichCommodity);
}

export interface MetalAggregate {
  metalType: string;
  totalValueFils: number;
  totalGrams: number;
  holdingCount: number;
}

/** Group enriched commodities by metal type, summing value and weight. */
export function groupByMetal(enriched: EnrichedCommodity[]): MetalAggregate[] {
  const map = new Map<string, { value: number; grams: number; count: number }>();
  for (const e of enriched) {
    const mt = e.commodity.metal_type;
    const entry = map.get(mt) ?? { value: 0, grams: 0, count: 0 };
    entry.value += e.valueFils;
    entry.grams += e.grams;
    entry.count += 1;
    map.set(mt, entry);
  }
  return [...map.entries()]
    .map(([metalType, v]) => ({
      metalType,
      totalValueFils: v.value,
      totalGrams: v.grams,
      holdingCount: v.count,
    }))
    .sort((a, b) => b.totalValueFils - a.totalValueFils);
}

/**
 * Returns true when the commodity's current price has reached or exceeded
 * the user's target sell price — indicating it's time to sell.
 */
export function shouldSellAlert(c: Commodity): boolean {
  if (c.target_sell_price_per_unit_fils === null || c.target_sell_price_per_unit_fils <= 0) return false;
  if (c.current_price_per_unit_fils <= 0) return false;
  return c.current_price_per_unit_fils >= c.target_sell_price_per_unit_fils;
}
