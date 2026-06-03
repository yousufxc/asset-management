/**
 * REFERENCE server page. Reads via the thin query layer and renders the list
 * with a "show your work" expansion (rule 2.1) demonstrating value lineage.
 * DeepSeek: mirror this structure for /cash and /commodities.
 */

import PropertyForm from "./PropertyForm";
import { MarkPaidButton, DeleteButton } from "./InstallmentActions";
import { listProperties, listAllInstallments } from "@/lib/db/queries";
import { formatAed, formatIsoToUae } from "@/lib/core/units";
import { installmentStatus } from "@/lib/core/installments";

const TYPE_LABEL: Record<string, string> = {
  apartment: "Apartment",
  penthouse: "Penthouse",
  townhouse: "Townhouse",
  villa: "Villa",
};

// Always read fresh from SQLite (no static caching of financial data).
export const dynamic = "force-dynamic";

function daysSince(iso: string | null): string {
  if (!iso) return "never valued";
  const then = new Date(`${iso}T00:00:00Z`).getTime();
  const days = Math.floor((Date.now() - then) / 86_400_000);
  return `last valued ${days} day${days === 1 ? "" : "s"} ago`;
}

export default function PropertiesPage() {
  const properties = listProperties();
  const installments = listAllInstallments();
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <>
      <h2>Property</h2>
      <PropertyForm
        properties={properties.map((p) => ({ id: p.id, name: p.name, subcategory: p.subcategory }))}
      />

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Your properties ({properties.length})</h3>
        {properties.length === 0 ? (
          <p className="muted">No properties yet. Add one above.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Area</th>
                <th>Bought for</th>
                <th>Current value</th>
                <th>Valuation freshness</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => {
                const insts = installments.filter((i) => i.property_id === p.id);
                return (
                  <tr key={p.id}>
                    <td>
                      {p.name}
                      {insts.length > 0 && (
                        <details className="work">
                          <summary>{insts.length} installment(s) — show schedule</summary>
                          <div className="work-body">
                            {insts.map((i) => {
                              const live = installmentStatus(i, todayIso);
                              return (
                                <div key={i.id}>
                                  {formatIsoToUae(i.due_date)} — {formatAed(i.amount_fils)}{" "}
                                  <span className={`pill ${live}`}>{live}</span>
                                  {i.milestone_label ? ` · ${i.milestone_label}` : ""}
                                  {live !== "paid" && (
                                    <MarkPaidButton installmentId={i.id} />
                                  )}
                                  <DeleteButton installmentId={i.id} />
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      )}
                    </td>
                    <td>
                      {p.property_type ? `${TYPE_LABEL[p.property_type]} · ` : ""}
                      {p.subcategory === "off_plan" ? "Off-plan" : "Existing"}
                      {p.is_rental ? " · rental" : ""}
                    </td>
                    <td>{p.area ?? "—"}</td>
                    <td>{p.purchase_price_fils != null ? formatAed(p.purchase_price_fils) : "—"}</td>
                    <td>{p.current_value_fils != null ? formatAed(p.current_value_fils) : "—"}</td>
                    <td className="muted">{daysSince(p.valued_at)}</td>
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
