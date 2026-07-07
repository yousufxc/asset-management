import { NextResponse } from "next/server";

interface MetalPrice {
  metal: string;
  pricePerGramAed: number | null;
}

const METAL_MAP: Record<string, string> = {
  gold: "gold",
  silver: "silver",
  platinum: "platinum",
  palladium: "palladium",
};

async function fetchMetalPrices(): Promise<MetalPrice[]> {
  const res = await fetch("https://api.metals.live/v1/spot", {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];

  const data = (await res.json()) as Array<{ currency: string; metal: string; price: number }>;
  const results: MetalPrice[] = [];

  for (const entry of data) {
    const metal = METAL_MAP[entry.metal.toLowerCase()];
    if (metal && entry.currency === "USD") {
      const pricePerOzUsd = entry.price;
      const pricePerGramUsd = pricePerOzUsd / 31.1035;
      const aedPerUsd = 3.673;
      const pricePerGramAed = Math.round(pricePerGramUsd * aedPerUsd * 100) / 100;
      results.push({ metal, pricePerGramAed });
    }
  }

  return results;
}

export async function GET() {
  try {
    const prices = await fetchMetalPrices();
    return NextResponse.json({ prices });
  } catch {
    return NextResponse.json({ prices: [], error: "Market data temporarily unavailable" }, { status: 200 });
  }
}
