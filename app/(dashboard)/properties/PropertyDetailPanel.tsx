"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Property } from "@/lib/types";
import { filsToAed, formatIsoToUae, formatAed } from "@/lib/core/units";

const TYPE_LABEL: Record<string, string> = {
  apartment: "Apartment",
  penthouse: "Penthouse",
  townhouse: "Townhouse",
  villa: "Villa",
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

// Nil-safe default for DATE INPUTS: empty string for null (NOT the "—" used in
// the read-only view). Prevents "—" being submitted and rejected with a 400 when
// editing a property that has no valuation date / unset cheque dates.
function isoInputOrEmpty(iso: string | null): string {
  if (!iso) return "";
  try {
    return formatIsoToUae(iso);
  } catch {
    return iso;
  }
}

export default function PropertyDetailPanel({ property }: { property: Property }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editSubcategory, setEditSubcategory] = useState<string>(property.subcategory);
  const [editIsRental, setEditIsRental] = useState(!!property.is_rental);
  const [editCheques, setEditCheques] = useState<number>(property.rent_cheques_per_year ?? 1);

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

    const city = strOrNull("city");
    if (city !== (property.city ?? null)) payload.city = city;

    const area = strOrNull("area");
    if (area !== (property.area ?? null)) payload.area = area;

    const developer = strOrNull("developer");
    if (developer !== (property.developer ?? null)) payload.developer = developer;

    const sizeSqft = numOrNull("size_sqft");
    if (sizeSqft !== (property.size_sqft ?? null)) payload.size_sqft = sizeSqft;

    const purchasePrice = numOrNull("purchase_price_aed");
    const existingPurchase = property.purchase_price_fils != null ? filsToAed(property.purchase_price_fils) : null;
    if (purchasePrice !== existingPurchase) payload.purchase_price_aed = purchasePrice;

    const currentValue = numOrNull("current_value_aed");
    const existingValue = property.current_value_fils != null ? filsToAed(property.current_value_fils) : null;
    if (currentValue !== existingValue) payload.current_value_aed = currentValue;

    const valuedAt = strOrNull("valued_at");
    const existingValued = property.valued_at ? formatIsoDisplay(property.valued_at) : null;
    if (valuedAt !== existingValued) payload.valued_at = valuedAt;

    if (isRental !== !!property.is_rental) payload.is_rental = isRental;

    const annualRent = isRental ? numOrNull("annual_rent_aed") : null;
    const existingAnnual = property.annual_rent_fils != null ? filsToAed(property.annual_rent_fils) : null;
    if (annualRent !== existingAnnual) payload.annual_rent_aed = annualRent;

    const cheques = isRental ? numOrNull("rent_cheques_per_year") : null;
    if (cheques !== (property.rent_cheques_per_year ?? null)) payload.rent_cheques_per_year = cheques;

    for (const n of [1, 2, 3, 4] as const) {
      const key = `rent_date_${n}` as const;
      const dateVal = isRental ? strOrNull(key) : null;
      const existingDate = property[`rent_date_${n}`] ? formatIsoDisplay(property[`rent_date_${n}`]) : null;
      if (dateVal !== existingDate) payload[key] = dateVal;
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
        <span className="detail-label">Purchase price</span>
        <span>{formatAedValue(property.purchase_price_fils)}</span>
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
            <option value="off_plan">Off-plan</option>
            <option value="existing">Existing</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Property type</label>
          <select name="property_type" defaultValue={property.property_type ?? ""}>
            <option value="">(none)</option>
            <option value="apartment">Apartment</option>
            <option value="penthouse">Penthouse</option>
            <option value="townhouse">Townhouse</option>
            <option value="villa">Villa</option>
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
          <input name="size_sqft" type="number" step="any" defaultValue={property.size_sqft ?? ""} />
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Value when bought (AED)</label>
          <input name="purchase_price_aed" type="number" step="0.01" defaultValue={aedInputOrEmpty(property.purchase_price_fils)} placeholder="purchase price" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Current value (AED)</label>
          <input name="current_value_aed" type="number" step="0.01" defaultValue={aedInputOrEmpty(property.current_value_fils)} />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Valued on (DD/MM/YYYY)</label>
          <input name="valued_at" defaultValue={isoInputOrEmpty(property.valued_at)} placeholder="07/03/2026" />
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
                      <label>Cheque {i + 1} Deposit date (DD/MM/YYYY)</label>
                      <input name={`rent_date_${i + 1}`} defaultValue={isoInputOrEmpty(date)} placeholder="01/01/2027" />
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
      {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
      <div className="row" style={{ gap: 8 }}>
        <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
        <button
          type="button"
          onClick={handleCancel}
          style={{ marginTop: 14, background: "var(--panel-2)", color: "var(--muted)" }}
        >
          Cancel
        </button>
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
