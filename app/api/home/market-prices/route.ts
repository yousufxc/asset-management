import { NextResponse } from "next/server";

interface MetalPrice {
  metal: string;
  pricePerGramAed: number;
}

const METALS = [
  { symbol: "XAU", metal: "gold" },
  { symbol: "XAG", metal: "silver" },
  { symbol: "XPT", metal: "platinum" },
  { symbol: "XPD", metal: "palladium" },
];

async function fetchAedPerUsd(): Promise<number> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return 3.673;
    const data = (await res.json()) as { rates: { AED: number } };
    return data.rates.AED;
  } catch {
    return 3.673;
  }
}

async function fetchMetalPrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.gold-api.com/price/${symbol}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { price: number };
    return data.price;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const [aedPerUsd, ...metalResults] = await Promise.all([
      fetchAedPerUsd(),
      ...METALS.map((m) => fetchMetalPrice(m.symbol)),
    ]);

    const prices: MetalPrice[] = [];
    for (let i = 0; i < METALS.length; i++) {
      const priceUsdPerOz = metalResults[i];
      if (priceUsdPerOz == null) continue;
      const pricePerGramAed = Math.round((priceUsdPerOz / 31.1035) * aedPerUsd * 100) / 100;
      prices.push({ metal: METALS[i]!.metal, pricePerGramAed });
    }

    if (prices.length === 0) {
      return NextResponse.json({ prices: [], error: "Market data temporarily unavailable" }, { status: 200 });
    }

    return NextResponse.json({ prices });
  } catch {
    return NextResponse.json({ prices: [], error: "Market data temporarily unavailable" }, { status: 200 });
  }
}
