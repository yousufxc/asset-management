/**
 * Metals.dev spot price integration (permitted outbound call per rule 2.4).
 *
 * getSpotFilsPerGram(metalType) returns the current spot price in integer fils
 * per gram of pure metal, plus the fetch timestamp for staleness display.
 *
 * METALS_DEV_API_KEY must be set in .env.local — never committed.
 * This is in lib/integrations/ — NOT lib/core/ — because it makes network calls.
 * Core valuation functions take spot as a pure input.
 */

import type { MetalType } from "@/lib/types";

const METALS_DEV_KEY = process.env.METALS_DEV_API_KEY;

interface SpotResult {
  spotFilsPerGram: number; // integer fils per gram of pure metal
  fetchedAt: string; // ISO timestamp
}

// Metals.dev base URL for spot prices. Gold, silver, platinum, palladium.
const BASE_URL = "https://api.metals.dev/v1/latest";

// Map our metal_type to Metals.dev parameter names
const METAL_PARAM: Record<string, string> = {
  gold: "gold",
  silver: "silver",
  platinum: "platinum",
  palladium: "palladium",
};

// Metals.dev returns price per troy ounce in USD. Conversion factors:
const GRAMS_PER_TROY_OZ = 31.1034768;
// AED per USD (approximate — owner should update or use a direct AED endpoint if available)
const AED_PER_USD = 3.673;

export async function getSpotFilsPerGram(metalType: MetalType): Promise<SpotResult> {
  const param = METAL_PARAM[metalType];
  if (!param) {
    throw new Error(`getSpotFilsPerGram: unsupported metal type "${metalType}"`);
  }

  if (!METALS_DEV_KEY) {
    throw new Error("getSpotFilsPerGram: METALS_DEV_API_KEY not set in .env.local");
  }

  const url = `${BASE_URL}?api_key=${encodeURIComponent(METALS_DEV_KEY)}&currency=USD&unit=toz`;

  const fetchedAt = new Date().toISOString();

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Metals.dev API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as Record<string, unknown>;

  // Metals.dev returns { metals: { gold: number, silver: number, ... } }
  // price is in USD per troy ounce
  let metalsObj: Record<string, number> | undefined;
  if (data.metals && typeof data.metals === "object") {
    metalsObj = data.metals as Record<string, number>;
  } else {
    // Alternative: data[param] directly
    const val = data[param];
    if (typeof val === "number") {
      metalsObj = { [param]: val };
    }
  }

  if (!metalsObj || typeof metalsObj[param] !== "number") {
    throw new Error(`Metals.dev response missing price for ${param}`);
  }

  const usdPerTroyOz = metalsObj[param];
  // Convert: USD/troy_oz → AED/gram
  // 1 troy_oz = 31.1034768 grams
  // usdPerTroyOz * AED_PER_USD / GRAMS_PER_TROY_OZ = AED/gram
  const aedPerGram = (usdPerTroyOz * AED_PER_USD) / GRAMS_PER_TROY_OZ;
  // Convert AED/gram to fils/gram (1 AED = 100 fils)
  const spotFilsPerGram = Math.round(aedPerGram * 100);

  return { spotFilsPerGram, fetchedAt };
}
