import CommodityContent from "./CommodityContent";
import { listCommodities } from "@/lib/db/queries";
import type { Commodity } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CommoditiesPage({
  searchParams,
}: {
  searchParams: Promise<{ selected?: string }>;
}) {
  const params = await searchParams;
  const commoditiesRaw = listCommodities();
  const commodities = JSON.parse(JSON.stringify(commoditiesRaw)) as Commodity[];
  const selectedId = params.selected ? Number(params.selected) : null;
  const selectedCommodity = selectedId
    ? (commodities.find((c) => c.id === selectedId) ?? null)
    : null;

  return (
    <CommodityContent
      commodities={commodities}
      selectedCommodity={selectedCommodity}
    />
  );
}
