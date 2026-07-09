/**
 * Live precious-metal spot prices (network integration — §2.4 permits this).
 *
 * Source: gold-api.com for USD/oz spot, open.er-api.com for USD→AED FX.
 * Returns AED per gram per metal. A short in-memory TTL cache keeps the
 * dashboard (which prices commodities at read time) and the market ticker
 * from hammering the upstream APIs on every navigation/poll.
 *
 * This file is deliberately impure (it does network I/O). All math that
 * consumes these prices lives in lib/core and is unit-tested there.
 */

export interface SpotPrice {
  metal: string;
  pricePerGramAed: number;
}

export interface SpotPriceResult {
  prices: SpotPrice[];
  /** ISO timestamp of when these prices were fetched. */
  asOf: string;
  error?: string;
}

const METALS = [
  { symbol: "XAU", metal: "gold" },
  { symbol: "XAG", metal: "silver" },
  { symbol: "XPT", metal: "platinum" },
  { symbol: "XPD", metal: "palladium" },
];

const GRAMS_PER_TROY_OZ = 31.1035;
const FALLBACK_AED_PER_USD = 3.673; // AED is pegged to USD at ~3.6725

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes — fresh enough for spot, cheap enough for SSR
let cached: SpotPriceResult | null = null;

async function fetchAedPerUsd(): Promise<number> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return FALLBACK_AED_PER_USD;
    const data = (await res.json()) as { rates: { AED: number } };
    return data.rates?.AED ?? FALLBACK_AED_PER_USD;
  } catch {
    return FALLBACK_AED_PER_USD;
  }
}

async function fetchMetalPriceUsdPerOz(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.gold-api.com/price/${symbol}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { price: number };
    return typeof data.price === "number" ? data.price : null;
  } catch {
    return null;
  }
}

/**
 * Fetch live spot prices in AED per gram. Cached for CACHE_TTL_MS.
 * On total upstream failure returns an empty price list with an `error`
 * (callers should fall back to stored/manual values, never crash).
 */
export async function fetchSpotPrices(): Promise<SpotPriceResult> {
  if (cached && Date.now() - new Date(cached.asOf).getTime() < CACHE_TTL_MS) {
    return cached;
  }

  try {
    const [aedPerUsd, ...metalResults] = await Promise.all([
      fetchAedPerUsd(),
      ...METALS.map((m) => fetchMetalPriceUsdPerOz(m.symbol)),
    ]);

    const prices: SpotPrice[] = [];
    for (let i = 0; i < METALS.length; i++) {
      const priceUsdPerOz = metalResults[i];
      if (priceUsdPerOz == null) continue;
      const pricePerGramAed = Math.round((priceUsdPerOz / GRAMS_PER_TROY_OZ) * aedPerUsd * 100) / 100;
      prices.push({ metal: METALS[i]!.metal, pricePerGramAed });
    }

    const result: SpotPriceResult = {
      prices,
      asOf: new Date().toISOString(),
      ...(prices.length === 0 ? { error: "Market data temporarily unavailable" } : {}),
    };
    // Only cache a usable result — don't pin an empty failure for 2 minutes.
    if (prices.length > 0) cached = result;
    return result;
  } catch {
    return { prices: [], asOf: new Date().toISOString(), error: "Market data temporarily unavailable" };
  }
}

/** Convenience: spot prices keyed by metal_type -> AED per gram, for lib/core consumers. */
export function toSpotMap(result: SpotPriceResult): Record<string, number> {
  const map: Record<string, number> = {};
  for (const p of result.prices) map[p.metal] = p.pricePerGramAed;
  return map;
}
