"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

function RentalFields() {
  const [cheques, setCheques] = useState(1);

  function dateInput(n: number) {
    return (
      <div style={{ maxWidth: 220 }} key={n}>
        <label>Cheque {n} Deposit date (DD/MM/YYYY)</label>
        <input name={`rent_date_${n}`} placeholder="01/01/2027" />
      </div>
    );
  }

  return (
    <>
      <div className="row">
        <div style={{ maxWidth: 240 }}>
          <label>Yearly rent (AED)</label>
          <input name="annual_rent_aed" type="number" step="0.01" placeholder="annual rent" />
        </div>
        <div style={{ maxWidth: 200 }}>
          <label>Cheques per year</label>
          <select
            name="rent_cheques_per_year"
            value={cheques}
            onChange={(e) => setCheques(Number(e.target.value))}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={4}>4</option>
            <option value={12}>12</option>
          </select>
        </div>
      </div>
      {cheques === 12 ? (
        <div className="row">
          {dateInput(1)}
          <div style={{ maxWidth: 300, paddingTop: 28 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              The remaining 11 monthly dates are calculated automatically.
            </span>
          </div>
        </div>
      ) : (
        <div className="row">
          {Array.from({ length: cheques }, (_, i) => dateInput(i + 1))}
        </div>
      )}
    </>
  );
}

export default function PropertyForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isRental, setIsRental] = useState(false);
  const [subcategory, setSubcategory] = useState("off_plan");
  const [isOpen, setIsOpen] = useState(false);
  const [installments, setInstallments] = useState<{ key: number }[]>([]);
  const instKey = useRef(0);

  function addInstallment() {
    setInstallments((prev) => [...prev, { key: instKey.current++ }]);
  }

  function removeInstallment(key: number) {
    setInstallments((prev) => prev.filter((inst) => inst.key !== key));
  }

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

    const selectedSubcategory = String(fd.get("subcategory") ?? "off_plan");

    const payload = {
      name: String(fd.get("name") ?? ""),
      subcategory: selectedSubcategory,
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
      rent_date_1: isRental ? strOrNull("rent_date_1") : null,
      rent_date_2: isRental ? strOrNull("rent_date_2") : null,
      rent_date_3: isRental ? strOrNull("rent_date_3") : null,
      rent_date_4: isRental ? strOrNull("rent_date_4") : null,
      notes: strOrNull("notes"),
    };

    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setSaving(false);
      const data = await res.json().catch(() => ({}));
      setError(data?.error ? JSON.stringify(data.error) + (data.issues ? " " + JSON.stringify(data.issues.fieldErrors) : "") : "Save failed");
      return;
    }

    const { property } = await res.json();
    const propertyId = property.id;

    if (selectedSubcategory === "off_plan") {
      for (let i = 0; i < installments.length; i++) {
        const instPayload = {
          property_id: propertyId,
          due_date: String(fd.get(`inst_due_date_${i}`) ?? ""),
          amount_aed: Number(fd.get(`inst_amount_aed_${i}`)),
          milestone_label: strOrNull(`inst_milestone_${i}`),
          status: "upcoming",
          source: "manual",
        };

        await fetch("/api/installments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(instPayload),
        });
      }
    }

    setSaving(false);
    (e.target as HTMLFormElement).reset();
    setIsRental(false);
    setSubcategory("off_plan");
    setInstallments([]);
    router.refresh();
  }

  if (!isOpen) {
    return (
      <div style={{ marginBottom: 18 }}>
        <button type="button" style={{ marginTop: 0 }} onClick={() => setIsOpen(true)}>
          + Add Property
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <form onSubmit={onSubmit}>
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
            {isRental && <RentalFields />}
          </>
        )}

        {subcategory === "off_plan" && installments.length > 0 && (
          <>
            <h4 style={{ marginTop: 16, marginBottom: 0 }}>Payment schedule</h4>
            {installments.map((inst, i) => (
              <div className="row" key={inst.key} style={{ alignItems: "flex-end" }}>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label>Due date (DD/MM/YYYY) *</label>
                  <input name={`inst_due_date_${i}`} required placeholder="15/09/2026" />
                </div>
                <div style={{ flex: 1, minWidth: 130 }}>
                  <label>Amount (AED) *</label>
                  <input name={`inst_amount_aed_${i}`} type="number" step="0.01" required />
                </div>
                <div style={{ flex: 2, minWidth: 200 }}>
                  <label>Milestone</label>
                  <input name={`inst_milestone_${i}`} placeholder="20% on completion of foundation" />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => removeInstallment(inst.key)}
                    style={{ background: "transparent", color: "var(--muted)", padding: "9px 10px", marginTop: 0 }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {subcategory === "off_plan" && (
          <button type="button" onClick={addInstallment} style={{ background: "var(--panel-2)", color: "var(--text)", marginTop: 8 }}>
            + Add installment
          </button>
        )}

        <label>Notes</label>
        <textarea name="notes" rows={2} />
        {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
        <button type="submit" disabled={saving}>{saving ? "Saving…" : "Add property"}</button>
      </form>

      <hr style={{ margin: "20px 0 12px", borderColor: "var(--border)" }} />
      <button
        type="button"
        onClick={() => setIsOpen(false)}
        style={{ marginTop: 0, background: "var(--panel-2)", color: "var(--muted)" }}
      >
        Close
      </button>
    </div>
  );
}
