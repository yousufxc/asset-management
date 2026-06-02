/**
 * PURE valuation math. No DB, no network.
 *
 * Implemented now:
 *   - commodityValueFils: physical metal value from weight + purity + spot.
 *
 * Phase-2 stubs (DeepSeek to implement against these signatures, with tests):
 *   - liquidationValueFils: net realisable value of an asset after costs/haircut.
 *   - netWorthFils: total across all asset classes.
 *
 * Every exported function returns integer fils and is paired with a
 * "show your work" lineage object so the UI can satisfy rule 2.1.
 */

import { toGrams } from "@/lib/core/units";
import type { WeightUnit } from "@/lib/types";

export interface CommodityValuationInput {
  weight: number;
  weightUnit: WeightUnit;
  purityFraction: number; // 0..1
  /** Spot price in fils per GRAM of pure metal. */
  spotFilsPerGram: number;
  quantity?: number; // default 1
}

export interface CommodityValuation {
  valueFils: number;
  // show-your-work lineage:
  pureGrams: number;
  spotFilsPerGram: number;
  quantity: number;
}

/**
 * value = round( grams_pure * spot_fils_per_gram ) * quantity
 * where grams_pure = weight_in_grams * purity_fraction.
 */
export function commodityValueFils(input: CommodityValuationInput): CommodityValuation {
  const quantity = input.quantity ?? 1;
  const grams = toGrams(input.weight, input.weightUnit);
  const pureGrams = grams * input.purityFraction;
  const perUnitFils = Math.round(pureGrams * input.spotFilsPerGram);
  return {
    valueFils: perUnitFils * quantity,
    pureGrams,
    spotFilsPerGram: input.spotFilsPerGram,
    quantity,
  };
}

// ---------------------------------------------------------------------------
// PHASE 2 STUBS — signatures only. Do not ship without unit tests.
// ---------------------------------------------------------------------------

export interface LiquidationInput {
  grossValueFils: number;
  /** Fractional haircut 0..1 (e.g. 0.02 = 2% selling cost). */
  haircutFraction?: number;
}

export function liquidationValueFils(_input: LiquidationInput): number {
  throw new Error("liquidationValueFils: not implemented (Phase 2)");
}
