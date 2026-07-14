/**
 * PURE valuation math. No DB, no network.
 *
 * Implemented now:
 *   - commodityTotalFils: total holding value from amount (weight) × manual
 *     price-per-unit. Manual entry only — no live spot, no purity (owner
 *     decision 2026-06-04).
 *
 * Phase-2 stub:
 *   - liquidationValueFils: net realisable value of an asset after costs/haircut.
 *
 * Every exported function returns integer fils and is paired with a
 * "show your work" lineage object so the UI can satisfy rule 2.1.
 */

import { GRAMS_PER_UNIT, aedToFils } from "@/lib/core/units";
import type { WeightUnit } from "@/lib/types";

export interface CommodityValueInput {
  /** The amount held, in weight_unit (e.g. 100 grams). */
  weight: number;
  /** Manual price for ONE weight_unit, in integer fils. */
  pricePerUnitFils: number;
}

export interface CommodityValue {
  totalFils: number;
  // show-your-work lineage:
  weight: number;
  pricePerUnitFils: number;
}

/**
 * total = round( weight × price_per_unit_fils )
 * The price is per the SAME unit the weight is expressed in (per gram if grams,
 * per troy_oz if troy_oz, etc.), so no unit conversion is required.
 */
export function commodityTotalFils(input: CommodityValueInput): CommodityValue {
  return {
    totalFils: Math.round(input.weight * input.pricePerUnitFils),
    weight: input.weight,
    pricePerUnitFils: input.pricePerUnitFils,
  };
}

/**
 * Convert a live spot price expressed in AED per gram into the per-weight-unit
 * price in integer fils — matching how commodity current prices are stored
 * (price for ONE weight_unit, in fils).
 *
 *   pricePerUnitFils = round( (AED/gram × grams_per_unit) × 100 )
 *
 * e.g. gold at 300 AED/gram, held in kg → 300 × 1000 = 300,000 AED/kg → 30,000,000 fils.
 */
export function spotPricePerUnitFils(pricePerGramAed: number, weightUnit: WeightUnit): number {
  if (!Number.isFinite(pricePerGramAed)) {
    throw new Error(`spotPricePerUnitFils: not a finite number: ${pricePerGramAed}`);
  }
  return aedToFils(pricePerGramAed * GRAMS_PER_UNIT[weightUnit]);
}

// ---------------------------------------------------------------------------
// PHASE 2 STUBS — signatures only. Do not ship without unit tests.
// ---------------------------------------------------------------------------

export interface LiquidationInput {
  grossValueFils: number;
  /** Fractional haircut 0..1 (e.g. 0.02 = 2% selling cost). */
  haircutFraction?: number;
}

export function liquidationValueFils(): number {
  throw new Error("liquidationValueFils: not implemented (Phase 2)");
}
