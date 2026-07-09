import { NextResponse } from "next/server";
import { fetchSpotPrices } from "@/lib/integrations/metals";

// Spot-price feed shared with the dashboard's read-time commodity valuation.
// The fetch + FX + caching logic lives in lib/integrations/metals.ts.
export async function GET() {
  const result = await fetchSpotPrices();
  if (result.prices.length === 0) {
    return NextResponse.json(
      { prices: [], error: result.error ?? "Market data temporarily unavailable" },
      { status: 200 },
    );
  }
  return NextResponse.json({ prices: result.prices, asOf: result.asOf });
}
