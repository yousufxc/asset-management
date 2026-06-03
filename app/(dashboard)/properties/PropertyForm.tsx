"use client";

/**
 * REFERENCE client form (DeepSeek: mirror this shape for cash & commodities).
 * - AED entered as plain decimals; UAE dates as DD/MM/YYYY (server converts).
 * - Surfaces server validation errors instead of failing silently.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PropertyForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isRental, setIsRental] = useState(false);
  const [subcategory, setSubcategory] = useState("off_plan");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
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

    const payload = {
      name: String(fd.get("name") ?? ""),
      subcategory: String(fd.get("subcategory") ?? "off_plan"),
      property_type: strOrNull("property_type"),
      city: strOrNull("city"),
      area: strOrNull("area"),
      developer: strOrNull("developer"),
      size_sqft: numOrNull("size_sqft"),
      purchase_price_aed: numOrNull("purchase_price_aed"),
      current_value_aed: numOrNull("current_value_aed"),
      valued_at: strOrNull("valued_at"),
      is_rental: isRental,
      annual_rent_aed: isRental ? numOrNull("annual_rent_aed") : null,
      rent_cheques_per_year: isRental ? numOrNull("rent_cheques_per_year") : null,
      next_rent_date: isRental ? strOrNull("next_rent_date") : null,
      notes: strOrNull("notes"),
    };

    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ? JSON.stringify(data.error) + (data.issues ? " " + JSON.stringify(data.issues.fieldErrors) : "") : "Save failed");
      return;
    }
    (e.target as HTMLFormElement).reset();
    setIsRental(false);
    setSubcategory("off_plan");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <h3 style={{ marginTop: 0 }}>Add property</h3>
      <div className="row">
        <div style={{ flex: 2, minWidth: 220 }}>
          <label>Name *</label>
          <input name="name" required placeholder="Marina Tower 1204" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Existing / Off-plan *</label>
          <select
            name="subcategory"
            value={subcategory}
            onChange={(e) => {
              setSubcategory(e.target.value);
              if (e.target.value === "off_plan") setIsRental(false);
            }}
          >
            <option value="off_plan">Off-plan</option>
            <option value="existing">Existing</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Property type</label>
          <select name="property_type" defaultValue="apartment">
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
          <input name="city" placeholder="Dubai" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Area</label>
          <input name="area" placeholder="Dubai Marina" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Developer</label>
          <input name="developer" placeholder="Emaar" />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label>Size (sqft)</label>
          <input name="size_sqft" type="number" step="any" />
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Value when bought (AED)</label>
          <input name="purchase_price_aed" type="number" step="0.01" placeholder="purchase price" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Current value (AED)</label>
          <input name="current_value_aed" type="number" step="0.01" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Valued on (DD/MM/YYYY)</label>
          <input name="valued_at" placeholder="07/03/2026" />
        </div>
      </div>
      {subcategory === "existing" && (
        <>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              name="is_rental"
              type="checkbox"
              style={{ width: "auto" }}
              checked={isRental}
              onChange={(e) => setIsRental(e.target.checked)}
            />{" "}
            This property is rented out
          </label>
          {isRental && (
            <>
              <div className="row">
                <div style={{ maxWidth: 240 }}>
                  <label>Yearly rent (AED)</label>
                  <input name="annual_rent_aed" type="number" step="0.01" placeholder="annual rent" />
                </div>
                <div style={{ maxWidth: 200 }}>
                  <label>Cheques per year</label>
                  <select name="rent_cheques_per_year" defaultValue={1}>
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={4}>4</option>
                    <option value={12}>12</option>
                  </select>
                </div>
                <div style={{ maxWidth: 220 }}>
                  <label>Next rent date (DD/MM/YYYY)</label>
                  <input name="next_rent_date" placeholder="01/01/2027" />
                </div>
              </div>
            </>
          )}
        </>
      )}
      <label>Notes</label>
      <textarea name="notes" rows={2} />
      {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
      <button type="submit" disabled={saving}>{saving ? "Saving…" : "Add property"}</button>
    </form>
  );
}
