/**
 * Metals.dev spot-price integration (rule 2.4 permitted outbound call).
 * Phase 2 stub. Returns spot price in fils per gram of pure metal so it plugs
 * directly into lib/core/valuation.ts commodityValueFils().
 */

import type { MetalType } from "@/lib/types";

export async function getSpotFilsPerGram(_metal: MetalType): Promise<number> {
  throw new Error("getSpotFilsPerGram: not implemented (Phase 2)");
}
