import CommodityForm from "./CommodityForm";
import { listCommodities } from "@/lib/db/queries";
import { formatAed, formatIsoToUae } from "@/lib/core/units";

const METAL_LABEL: Record<string, string> = {
  gold: "Gold",
  silver: "Silver",
  platinum: "Platinum",
  palladium: "Palladium",
  other: "Other",
};
const FORM_LABEL: Record<string, string> = {
  bar: "Bar",
  coin: "Coin",
  jewelry: "Jewelry",
  other: "Other",
};

export const dynamic = "force-dynamic";

function daysSince(iso: string | null): string {
  if (!iso) return "never valued";
  const then = new Date(`${iso}T00:00:00Z`).getTime();
  const days = Math.floor((Date.now() - then) / 86_400_000);
  return `last valued ${days} day${days === 1 ? "" : "s"} ago`;
}

export default function CommoditiesPage() {
  const commodities = listCommodities();

  return (
    <>
      <h2>Commodities</h2>
      <CommodityForm />

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Holdings ({commodities.length})</h3>
        {commodities.length === 0 ? (
          <p className="muted">No commodities yet. Add one above.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Metal</th>
                <th>Weight</th>
                <th>Purity (%)</th>
                <th>Qty</th>
                <th>Storage</th>
                <th>Manual value</th>
                <th>Valuation freshness</th>
              </tr>
            </thead>
            <tbody>
              {commodities.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.name}
                    {c.notes && (
                      <details className="work">
                        <summary>Notes</summary>
                        <div className="work-body">{c.notes}</div>
                      </details>
                    )}
                    <details className="work">
                      <summary>Show weight breakdown</summary>
                      <div className="work-body">
                        <div>Weight: {c.weight} {c.weight_unit}</div>
                        <div>Purity fraction: {c.purity_fraction}</div>
                        <div>Quantity: {c.quantity}</div>
                        {c.acquisition_price_fils != null && (
                          <div>
                            Acquisition price: {formatAed(c.acquisition_price_fils)}
                          </div>
                        )}
                      </div>
                    </details>
                  </td>
                  <td>{METAL_LABEL[c.metal_type] ?? c.metal_type}</td>
                  <td>
                    {c.weight} {c.weight_unit}
                  </td>
                  <td>{(c.purity_fraction * 100).toFixed(1)}%</td>
                  <td>{c.quantity}</td>
                  <td>{c.storage_location ?? "—"}</td>
                  <td>
                    {c.manual_value_fils != null
                      ? formatAed(c.manual_value_fils)
                      : "—"}
                  </td>
                  <td className="muted">{daysSince(c.valued_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
