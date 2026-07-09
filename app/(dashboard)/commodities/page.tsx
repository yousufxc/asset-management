import CommodityContent from "./CommodityContent";
import { listCommodities } from "@/lib/db/queries";
import type { Commodity } from "@/lib/types";
import { fetchSpotPrices, toSpotMap, type SpotPrice } from "@/lib/integrations/metals";
import { applyLiveSpotPrices } from "@/lib/core/commodity-analytics";

export const dynamic = "force-dynamic";

export default async function CommoditiesPage({
  searchParams,
}: {
  searchParams: Promise<{ selected?: string }>;
}) {
  const params = await searchParams;
  const commoditiesRaw = listCommodities();
  const stored = JSON.parse(JSON.stringify(commoditiesRaw)) as Commodity[];

  // ── Live spot re-pricing (read time) ──────────────────────────────────
  // The holdings table + charts show live spot; a failed feed degrades to the
  // stored snapshot (see applyLiveSpotPrices). The edit panel keeps the STORED
  // commodity so its save-to-DB / date-stamp logic is unaffected.
  const spot = stored.length > 0
    ? await fetchSpotPrices()
    : { prices: [] as SpotPrice[], asOf: new Date().toISOString() };
  const spotMap = toSpotMap(spot);
  const livePriced = applyLiveSpotPrices(stored, spotMap);
  const pricedCommodities = livePriced.map((x) => x.commodity);
  const priceSourceById: Record<number, "live" | "stored"> = {};
  for (const x of livePriced) priceSourceById[x.commodity.id] = x.source;
  const anyLive = livePriced.some((x) => x.source === "live");
  // Preformat the as-of label server-side — CommodityContent is a client
  // component, so a raw Date.toLocaleString there would risk a hydration mismatch.
  const spotAsOfLabel = anyLive
    ? new Date(spot.asOf).toLocaleString("en-AE", { dateStyle: "medium", timeStyle: "short" })
    : null;

  const selectedId = params.selected ? Number(params.selected) : null;
  const selectedIndex = selectedId != null ? stored.findIndex((c) => c.id === selectedId) : -1;
  const selectedCommodity = selectedIndex >= 0 ? stored[selectedIndex]! : null; // stored, for editing
  const selectedLivePriceFils = selectedIndex >= 0 ? livePriced[selectedIndex]!.livePriceFils : null;

  return (
    <CommodityContent
      commodities={pricedCommodities}
      selectedCommodity={selectedCommodity}
      selectedLivePriceFils={selectedLivePriceFils}
      spotAsOf={spotAsOfLabel}
      spotPrices={spot.prices}
      priceSourceById={priceSourceById}
    />
  );
}
