/**
 * PURE commodity analytics functions. No DB, no network, no mutations.
 */

import type { Commodity } from "@/lib/types";
import { toGrams } from "@/lib/core/units";
import { commodityTotalFils } from "@/lib/core/valuation";

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
