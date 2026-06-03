import CommodityForm from "./CommodityForm";
import { listCommodities } from "@/lib/db/queries";
import { formatAed, formatIsoToUae } from "@/lib/core/units";
import { commodityTotalFils } from "@/lib/core/valuation";

export const dynamic = "force-dynamic";

const METAL_LABEL: Record<string, string> = {
  gold: "Gold",
  silver: "Silver",
  platinum: "Platinum",
  palladium: "Palladium",
  other: "Other",
};

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
                <th>Type</th>
                <th>Amount</th>
                <th>Current price</th>
                <th>Current value</th>
                <th>Bought price</th>
                <th>Profit / loss</th>
                <th>Priced on</th>
              </tr>
            </thead>
            <tbody>
              {commodities.map((c) => {
                const value = commodityTotalFils({
                  weight: c.weight,
                  pricePerUnitFils: c.current_price_per_unit_fils,
                });
                const cost =
                  c.bought_price_per_unit_fils != null
                    ? commodityTotalFils({
                        weight: c.weight,
                        pricePerUnitFils: c.bought_price_per_unit_fils,
                      })
                    : null;
                const pl = cost ? value.totalFils - cost.totalFils : null;

                return (
                  <tr key={c.id}>
                    <td>{METAL_LABEL[c.metal_type] ?? c.metal_type}</td>
                    <td>
                      {c.weight} {c.weight_unit}
                    </td>
                    <td>
                      {formatAed(c.current_price_per_unit_fils)}/{c.weight_unit}
                    </td>
                    <td>
                      <details className="work">
                        <summary>{formatAed(value.totalFils)}</summary>
                        <div className="work-body">
                          <div>
                            Amount: {c.weight} {c.weight_unit}
                          </div>
                          <div>
                            Current price: {formatAed(c.current_price_per_unit_fils)} per{" "}
                            {c.weight_unit}
                          </div>
                          <hr />
                          <div>
                            <strong>Current value: {formatAed(value.totalFils)}</strong>{" "}
                            = {c.weight} × {formatAed(c.current_price_per_unit_fils)}
                          </div>
                        </div>
                      </details>
                    </td>
                    <td>
                      {c.bought_price_per_unit_fils != null
                        ? `${formatAed(c.bought_price_per_unit_fils)}/${c.weight_unit}`
                        : "—"}
                    </td>
                    <td>
                      {pl == null ? (
                        "—"
                      ) : (
                        <span style={{ color: pl >= 0 ? "var(--good)" : "var(--bad)" }}>
                          {pl >= 0 ? "+" : "−"}
                          {formatAed(Math.abs(pl))}
                        </span>
                      )}
                    </td>
                    <td className="muted">
                      {c.current_price_date ? formatIsoToUae(c.current_price_date) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
