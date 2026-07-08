import LandContent from "./LandContent";
import { listLands } from "@/lib/db/queries";
import type { Land } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LandsPage({
  searchParams,
}: {
  searchParams: Promise<{ selected?: string }>;
}) {
  const params = await searchParams;
  const landsRaw = listLands();
  const lands = JSON.parse(JSON.stringify(landsRaw)) as Land[];
  const selectedId = params.selected ? Number(params.selected) : null;
  const selectedLand = selectedId
    ? (lands.find((l) => l.id === selectedId) ?? null)
    : null;

  return (
    <LandContent
      lands={lands}
      selectedLand={selectedLand}
    />
  );
}
