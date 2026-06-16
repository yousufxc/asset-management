"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Property, Installment } from "@/lib/types";
import { filsToAed, formatIsoToUae, formatAed, parseDateToIso } from "@/lib/core/units";
import { numeralOnly } from "./numeralOnly";

const TYPE_LABEL: Record<string, string> = {
  apartment: "Apartment",
  penthouse: "Penthouse",
  townhouse: "Townhouse",
  villa: "Villa",
};

const BEDROOMS_LABEL: Record<string, string> = {
  Studio: "Studio",
  "1BR": "1BR",
  "2BR": "2BR",
  "3BR": "3BR",
  "4BR": "4BR",
  "5BR": "5BR",
  "+5BR": "+5BR",
};

function formatAedValue(fils: number | null): string {
  if (fils === null || fils === undefined) return "—";
  return formatAed(fils); // app-standard "AED 1,234.00"
}

function formatIsoDisplay(iso: string | null): string {
  if (!iso) return "—";
  try {
    return formatIsoToUae(iso);
  } catch {
    return iso;
  }
}

function aedInputOrEmpty(fils: number | null): string {
  if (fils === null || fils === undefined) return "";
  return filsToAed(fils).toString();
}


export default function PropertyDetailPanel({ property, installments }: { property: Property; installments: Installment[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [removing, setRemoving] = useState(false);

  const [editInsts, setEditInsts] = useState<Record<number, { due_date: string; amount_aed: string; milestone_label: string }>>({});

  useEffect(() => {
    if (editing && property.subcategory === "off_plan") {
      const map: Record<number, { due_date: string; amount_aed: string; milestone_label: string }> = {};
      for (const inst of installments) {
        map[inst.id] = {
          due_date: inst.due_date,
          amount_aed: inst.amount_fils != null ? filsToAed(inst.amount_fils).toString() : "",
          milestone_label: inst.milestone_label ?? "",
        };
      }
      setEditInsts(map);
    }
  }, [editing, property.subcategory]); // eslint-disable-line react-hooks/exhaustive-deps

  const [editSubcategory, setEditSubcategory] = useState<string>(property.subcategory);
  const [editIsRental, setEditIsRental] = useState(!!property.is_rental);
  const [editCheques, setEditCheques] = useState<number>(property.rent_cheques_per_year ?? 1);
  const today = new Date().toISOString().split("T")[0];

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const fd = new FormData(e.currentTarget);

    const numOrNull = (k: string) => {
      const v = fd.get(k);
      return v === "" || v === null ? null : Number(v);
    };
    const strOrNull = (k: string) => {
      const v = fd.get(k);
      return v === "" || v === null ? null : String(v);
    };

    const selectedSubcategory = String(fd.get("subcategory") ?? property.subcategory);
    const isRental = selectedSubcategory === "existing" && fd.get("is_rental") === "on";

    const payload: Record<string, unknown> = {};

    const nameVal = String(fd.get("name") ?? "");
    if (nameVal !== property.name) payload.name = nameVal;

    const subVal = selectedSubcategory;
    if (subVal !== property.subcategory) payload.subcategory = subVal;

    const ptype = strOrNull("property_type");
    if (ptype !== (property.property_type ?? null)) payload.property_type = ptype;

    const bedrooms = strOrNull("bedrooms");
    if (bedrooms !== (property.bedrooms ?? null)) payload.bedrooms = bedrooms;

    const city = strOrNull("city");
    if (city !== (property.city ?? null)) payload.city = city;

    const area = strOrNull("area");
    if (area !== (property.area ?? null)) payload.area = area;

    const developer = strOrNull("developer");
    if (developer !== (property.developer ?? null)) payload.developer = developer;

    const sizeSqft = numOrNull("size_sqft");
    if (sizeSqft !== (property.size_sqft ?? null)) payload.size_sqft = sizeSqft;

    const serviceCharge = numOrNull("annual_service_charge_aed");
    const existingCharge = property.annual_service_charge_fils != null ? filsToAed(property.annual_service_charge_fils) : null;
    if (serviceCharge !== existingCharge) payload.annual_service_charge_aed = serviceCharge;

    const purchasePrice = numOrNull("purchase_price_aed");
    const existingPurchase = property.purchase_price_fils != null ? filsToAed(property.purchase_price_fils) : null;
    if (purchasePrice !== existingPurchase) payload.purchase_price_aed = purchasePrice;

    const purchasedAt = strOrNull("purchased_at");
    if (purchasedAt !== (property.purchased_at ?? null)) payload.purchased_at = purchasedAt;

    const currentValue = numOrNull("current_value_aed");
    const existingValue = property.current_value_fils != null ? filsToAed(property.current_value_fils) : null;
    if (currentValue !== existingValue) payload.current_value_aed = currentValue;

    const valuedAt = strOrNull("valued_at");
    if (valuedAt !== (property.valued_at ?? null)) payload.valued_at = valuedAt;

    if (isRental !== !!property.is_rental) payload.is_rental = isRental;

    const annualRent = isRental ? numOrNull("annual_rent_aed") : null;
    const existingAnnual = property.annual_rent_fils != null ? filsToAed(property.annual_rent_fils) : null;
    if (annualRent !== existingAnnual) payload.annual_rent_aed = annualRent;

    const cheques = isRental ? numOrNull("rent_cheques_per_year") : null;
    if (cheques !== (property.rent_cheques_per_year ?? null)) payload.rent_cheques_per_year = cheques;

    for (const n of [1, 2, 3, 4] as const) {
      const key = `rent_date_${n}` as const;
      const dateVal = isRental ? strOrNull(key) : null;
      const existing = property[`rent_date_${n}` as keyof Property];
      if (dateVal !== (existing ?? null)) payload[key] = dateVal;
    }

    const notes = strOrNull("notes");
    if (notes !== (property.notes ?? null)) payload.notes = notes;

    if (Object.keys(payload).length === 0) {
      setSaving(false);
      setEditing(false);
      return;
    }

    const res = await fetch(`/api/properties/${property.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ? JSON.stringify(data.error) + (data.issues ? " " + JSON.stringify(data.issues.fieldErrors) : "") : "Save failed");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function handleRemove() {
    if (!confirm(`Remove "${property.name}"? This cannot be undone.`)) return;
    setRemoving(true);
    const res = await fetch(`/api/properties/${property.id}`, { method: "DELETE" });
    if (!res.ok) {
      setRemoving(false);
      setError("Failed to remove property");
      return;
    }
    router.push("/properties");
    router.refresh();
  }

  async function handleSaveInstalment(instId: number) {
    const data = editInsts[instId];
    if (!data) return;
    try {
      parseDateToIso(data.due_date);
    } catch {
      setError("Invalid date format for instalment.");
      return;
    }
    const amount = Number(data.amount_aed);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Invalid amount for instalment.");
      return;
    }
    const res = await fetch(`/api/installments/${instId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        due_date: data.due_date,
        amount_aed: amount,
        milestone_label: data.milestone_label || null,
      }),
    });
    if (!res.ok) {
      setError("Failed to save instalment.");
      return;
    }
    setError(null);
    router.refresh();
  }

  async function handleDeleteInstalment(instId: number) {
    if (!confirm("Delete this instalment?")) return;
    const res = await fetch(`/api/installments/${instId}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to delete instalment.");
      return;
    }
    router.refresh();
  }

  async function handleAddInstalment() {
    const res = await fetch("/api/installments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        property_id: property.id,
        due_date: new Date().toISOString().slice(0, 10),
        amount_aed: 0,
        status: "upcoming",
        source: "manual",
      }),
    });
    if (!res.ok) {
      setError("Failed to add instalment.");
      return;
    }
    router.refresh();
  }

  function handleCancel() {
    setEditing(false);
    setError(null);
    setEditSubcategory(property.subcategory);
    setEditIsRental(!!property.is_rental);
    setEditCheques(property.rent_cheques_per_year ?? 1);
  }

  const renderReadOnly = () => (
    <>
      <div className="detail-row">
        <span className="detail-label">Name</span>
        <span>{property.name}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Category</span>
        <span>{property.subcategory === "off_plan" ? "Off-plan" : "Existing"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Property type</span>
        <span>{property.property_type ? TYPE_LABEL[property.property_type] : "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label"># of Bedrooms</span>
        <span>{property.bedrooms ? BEDROOMS_LABEL[property.bedrooms] : "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">City</span>
        <span>{property.city ?? "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Area</span>
        <span>{property.area ?? "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Developer</span>
        <span>{property.developer ?? "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Size (sqft)</span>
        <span>{property.size_sqft ?? "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Annual Service Charge</span>
        <span>{formatAedValue(property.annual_service_charge_fils)}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Purchase price</span>
        <span>{formatAedValue(property.purchase_price_fils)}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Date of purchase</span>
        <span>{formatIsoDisplay(property.purchased_at)}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Current value</span>
        <span>{formatAedValue(property.current_value_fils)}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Valued on</span>
        <span>{formatIsoDisplay(property.valued_at)}</span>
      </div>
      {property.is_rental ? (
        <>
          <div className="detail-row">
            <span className="detail-label">Yearly rent</span>
            <span>{formatAedValue(property.annual_rent_fils)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Cheques per year</span>
            <span>{property.rent_cheques_per_year}</span>
          </div>
          {Array.from({ length: property.rent_cheques_per_year ?? 0 }, (_, i) => {
            const key = `rent_date_${i + 1}` as keyof Property;
            const date = property[key] as string | null;
            return (
              <div className="detail-row" key={i}>
                <span className="detail-label">Cheque {i + 1} date</span>
                <span>{formatIsoDisplay(date)}</span>
              </div>
            );
          })}
        </>
      ) : (
        <div className="detail-row">
          <span className="detail-label">Rental</span>
          <span>Not rented</span>
        </div>
      )}
      {property.notes && (
        <div className="detail-row">
          <span className="detail-label">Notes</span>
          <span style={{ whiteSpace: "pre-wrap" }}>{property.notes}</span>
        </div>
      )}
    </>
  );

  const renderEditForm = () => (
    <form onSubmit={handleSave} className="detail-edit-form">
      <div className="row">
        <div style={{ flex: 2, minWidth: 220 }}>
          <label>Name *</label>
          <input name="name" required defaultValue={property.name} />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Existing / Off-plan *</label>
          <select
            name="subcategory"
            value={editSubcategory}
            onChange={(e) => {
              setEditSubcategory(e.target.value);
              if (e.target.value === "off_plan") setEditIsRental(false);
            }}
          >
            <option value="">Select</option>
            <option value="off_plan">Off-plan</option>
            <option value="existing">Existing</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Property type</label>
          <select name="property_type" defaultValue={property.property_type ?? ""}>
            <option value="">Select</option>
            <option value="apartment">Apartment</option>
            <option value="penthouse">Penthouse</option>
            <option value="townhouse">Townhouse</option>
            <option value="villa">Villa</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label># of Bedrooms</label>
          <select name="bedrooms" defaultValue={property.bedrooms ?? ""}>
            <option value="">Select</option>
            <option value="Studio">Studio</option>
            <option value="1BR">1BR</option>
            <option value="2BR">2BR</option>
            <option value="3BR">3BR</option>
            <option value="4BR">4BR</option>
            <option value="5BR">5BR</option>
            <option value="+5BR">+5BR</option>
          </select>
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>City</label>
          <input name="city" defaultValue={property.city ?? ""} placeholder="Dubai" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Area</label>
          <input name="area" defaultValue={property.area ?? ""} placeholder="Dubai Marina" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Developer</label>
          <input name="developer" defaultValue={property.developer ?? ""} placeholder="Emaar" />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label>Size (sqft)</label>
          <input name="size_sqft" type="number" step="any" onKeyDown={numeralOnly} defaultValue={property.size_sqft ?? ""} placeholder="Enter size of property" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Annual Service Charge (AED)</label>
          <input name="annual_service_charge_aed" type="number" step="0.01" onKeyDown={numeralOnly} defaultValue={aedInputOrEmpty(property.annual_service_charge_fils)} placeholder="Enter annual service charge" />
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Value when bought (AED)</label>
          <input name="purchase_price_aed" type="number" step="0.01" onKeyDown={numeralOnly} defaultValue={aedInputOrEmpty(property.purchase_price_fils)} placeholder="purchase price" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Date of purchase</label>
          <input name="purchased_at" type="date" max={today} defaultValue={property.purchased_at ?? ""} />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Current value (AED)</label>
          <input name="current_value_aed" type="number" step="0.01" onKeyDown={numeralOnly} defaultValue={aedInputOrEmpty(property.current_value_fils)} placeholder="Enter current value of property" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Valued on</label>
          <input name="valued_at" type="date" max={today} defaultValue={property.valued_at ?? ""} />
        </div>
      </div>
      {editSubcategory === "existing" && (
        <>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              name="is_rental"
              type="checkbox"
              style={{ width: "auto" }}
              checked={editIsRental}
              onChange={(e) => setEditIsRental(e.target.checked)}
            />{" "}
            This property is rented out
          </label>
          {editIsRental && (
            <>
              <div className="row">
                <div style={{ maxWidth: 240 }}>
                  <label>Yearly rent (AED)</label>
                  <input name="annual_rent_aed" type="number" step="0.01" defaultValue={aedInputOrEmpty(property.annual_rent_fils)} placeholder="annual rent" />
                </div>
                <div style={{ maxWidth: 200 }}>
                  <label>Cheques per year</label>
                  <select
                    name="rent_cheques_per_year"
                    value={editCheques}
                    onChange={(e) => setEditCheques(Number(e.target.value))}
                  >
                    <option value="" disabled>Select</option>
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={4}>4</option>
                    <option value={12}>12</option>
                  </select>
                </div>
              </div>
              <div className="row">
                {Array.from({ length: editCheques }, (_, i) => {
                  const key = `rent_date_${i + 1}` as keyof Property;
                  const date = property[key] as string | null;
                  return (
                    <div style={{ maxWidth: 220 }} key={i}>
                      <label>Cheque {i + 1} Deposit date</label>
                      <input name={`rent_date_${i + 1}`} type="date" defaultValue={date ?? ""} />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
      <label>Notes</label>
      <textarea name="notes" rows={2} defaultValue={property.notes ?? ""} />
      {editSubcategory === "off_plan" && (
        <>
          <h4 style={{ marginTop: 16, marginBottom: 8 }}>Payment schedule</h4>
          {installments.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>No instalments yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {installments.map((inst) => {
                const ed = editInsts[inst.id] ?? { due_date: inst.due_date, amount_aed: inst.amount_fils != null ? filsToAed(inst.amount_fils).toString() : "", milestone_label: inst.milestone_label ?? "" };
                return (
                  <div key={inst.id} style={{ display: "flex", gap: 8, alignItems: "flex-end", padding: "6px 0", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
                    <div style={{ minWidth: 130 }}>
                      <label style={{ fontSize: 11, margin: "0 0 2px" }}>Due date</label>
                      <input
                        type="date"
                        value={ed.due_date}
                        onChange={(e) => setEditInsts((prev) => ({ ...prev, [inst.id]: { ...prev[inst.id] ?? ed, due_date: e.target.value } }))}
                        style={{ fontSize: 12, padding: "4px 6px" }}
                      />
                    </div>
                    <div style={{ minWidth: 110 }}>
                      <label style={{ fontSize: 11, margin: "0 0 2px" }}>Amount (AED)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={ed.amount_aed ?? ""}
                        onKeyDown={numeralOnly}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "" || /^\d+(\.\d*)?$/.test(val)) {
                            setEditInsts((prev) => ({ ...prev, [inst.id]: { ...prev[inst.id] ?? ed, amount_aed: val } }));
                          }
                        }}
                        style={{ fontSize: 12, padding: "4px 6px" }}
                      />
                    </div>
                    <div style={{ minWidth: 140, flex: 1 }}>
                      <label style={{ fontSize: 11, margin: "0 0 2px" }}>Milestone</label>
                      <input
                        type="text"
                        value={ed.milestone_label ?? ""}
                        onChange={(e) => setEditInsts((prev) => ({ ...prev, [inst.id]: { ...prev[inst.id] ?? ed, milestone_label: e.target.value } }))}
                        style={{ fontSize: 12, padding: "4px 6px" }}
                      />
                    </div>
                    <span className={`pill ${inst.status}`} style={{ alignSelf: "center", marginBottom: 0 }}>{inst.status}</span>
                    <button
                      type="button"
                      onClick={() => handleSaveInstalment(inst.id)}
                      style={{ marginTop: 0, fontSize: 11, padding: "4px 10px" }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteInstalment(inst.id)}
                      style={{ marginTop: 0, fontSize: 11, padding: "4px 10px", background: "var(--bad)", color: "#fff" }}
                    >
                      Del
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={handleAddInstalment}
            style={{ marginTop: 8, fontSize: 12, background: "var(--panel-2)", color: "var(--text)", padding: "6px 12px" }}
          >
            + Add instalment
          </button>
        </>
      )}
      {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
        <button
          type="button"
          onClick={handleRemove}
          disabled={removing}
          style={{ marginTop: 0, background: "var(--bad)", color: "#fff", fontSize: 12, padding: "6px 12px" }}
        >
          {removing ? "Removing…" : "Remove Property"}
        </button>
        <div className="row" style={{ gap: 8 }}>
          <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
          <button
            type="button"
            onClick={handleCancel}
            style={{ marginTop: 0, background: "var(--panel-2)", color: "var(--muted)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );

  return (
    <div className="card">
      <div className="detail-header">
        <h3 style={{ margin: 0 }}>{property.name}</h3>
        <button
          type="button"
          onClick={() => router.push("/properties")}
          style={{ marginTop: 0, background: "transparent", color: "var(--muted)", padding: "4px 10px", fontSize: 18, fontWeight: 400, lineHeight: 1, flexShrink: 0 }}
          title="Close"
        >
          ×
        </button>
      </div>
      {editing ? renderEditForm() : renderReadOnly()}
      {!editing && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{ marginTop: 0, fontSize: 13 }}
          >
            Edit Property Info
          </button>
        </div>
      )}
    </div>
  );
}
