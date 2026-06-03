"use client";

import { useRouter } from "next/navigation";
import type { Property, Installment } from "@/lib/types";
import { formatAed, formatIsoToUae } from "@/lib/core/units";
import { installmentStatus } from "@/lib/core/installments";
import PropertyForm from "./PropertyForm";
import PropertyDetailPanel from "./PropertyDetailPanel";
import { MarkPaidButton, DeleteButton } from "./InstallmentActions";

const TYPE_LABEL: Record<string, string> = {
  apartment: "Apartment",
  penthouse: "Penthouse",
  townhouse: "Townhouse",
  villa: "Villa",
};

function daysSince(iso: string | null): string {
  if (!iso) return "never valued";
  const then = new Date(`${iso}T00:00:00Z`).getTime();
  const days = Math.floor((Date.now() - then) / 86_400_000);
  return `last valued ${days} day${days === 1 ? "" : "s"} ago`;
}

export default function PropertyContent({
  properties,
  installments,
  selectedProperty,
}: {
  properties: Property[];
  installments: Installment[];
  selectedProperty: Property | null;
}) {
  const router = useRouter();
  const todayIso = new Date().toISOString().slice(0, 10);

  function handleSelect(id: number) {
    router.push(`/properties?selected=${id}`);
  }

  return (
    <>
      <h2>Property</h2>
      <PropertyForm />

      <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
        <div className="card" style={{ flex: selectedProperty ? 1 : undefined }}>
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
                  const isSelected = selectedProperty?.id === p.id;
                  return (
                    <tr
                      key={p.id}
                      className={isSelected ? "selected-row" : undefined}
                    >
                      <td>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handleSelect(p.id);
                          }}
                          className="property-link"
                        >
                          {p.name}
                        </a>
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

        {selectedProperty && (
          <div style={{ flex: 1, position: "sticky", top: 28 }}>
            <PropertyDetailPanel key={selectedProperty.id} property={selectedProperty} />
          </div>
        )}
      </div>
    </>
  );
}
