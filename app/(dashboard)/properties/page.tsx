/**
 * REFERENCE server page. Reads via the thin query layer and renders the list
 * with a "show your work" expansion (rule 2.1) demonstrating value lineage.
 * DeepSeek: mirror this structure for /cash and /commodities.
 */

import PropertyContent from "./PropertyContent";
import { listProperties, listAllInstallments, listAllRentalDeposits, listAllRentalHistory, listAllMaintenance } from "@/lib/db/queries";
import type { Property } from "@/lib/types";

// Always read fresh from SQLite (no static caching of financial data).
export const dynamic = "force-dynamic";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ selected?: string }>;
}) {
  const params = await searchParams;
  const propertiesRaw = listProperties();
  const installmentsRaw = listAllInstallments();
  const depositsRaw = listAllRentalDeposits();
  const historyRaw = listAllRentalHistory();
  const maintenanceRaw = listAllMaintenance();
  const properties = JSON.parse(JSON.stringify(propertiesRaw));
  const installments = JSON.parse(JSON.stringify(installmentsRaw));
  const deposits = JSON.parse(JSON.stringify(depositsRaw));
  const history = JSON.parse(JSON.stringify(historyRaw));
  const maintenance = JSON.parse(JSON.stringify(maintenanceRaw));
  const selectedId = params.selected ? Number(params.selected) : null;
  const selectedProperty = selectedId
    ? (properties.find((p: Property) => p.id === selectedId) ?? null)
    : null;

  return (
    <PropertyContent
      properties={properties}
      installments={installments}
      deposits={deposits}
      history={history}
      maintenance={maintenance}
      selectedProperty={selectedProperty}
    />
  );
}
