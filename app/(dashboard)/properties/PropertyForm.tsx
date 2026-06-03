"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PropertyOption {
  id: number;
  name: string;
  subcategory: string;
}

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

function PaymentScheduleFields({ properties }: { properties: PropertyOption[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (properties.length === 0) {
    return (
      <>
        <h4>Add payment schedule</h4>
        <p className="muted">Save the property first, then you can attach its installment schedule here.</p>
      </>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const strOrNull = (k: string) => {
      const v = fd.get(k);
      return v === "" || v === null ? null : String(v);
    };

    const payload = {
      property_id: Number(fd.get("property_id")),
      due_date: String(fd.get("due_date") ?? ""),
      amount_aed: Number(fd.get("amount_aed")),
      milestone_label: strOrNull("milestone_label"),
      status: String(fd.get("status") ?? "upcoming"),
      source: "manual",
    };

    const res = await fetch("/api/installments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(
        data?.error
          ? JSON.stringify(data.error) +
              (data.issues ? " " + JSON.stringify(data.issues.fieldErrors) : "")
          : "Save failed",
      );
      return;
    }
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  const offPlanProperties = properties.filter((p) => p.subcategory === "off_plan");

  if (offPlanProperties.length === 0) {
    return (
      <>
        <h4>Add payment schedule</h4>
        <p className="muted">No off-plan properties yet. Save an off-plan property first.</p>
      </>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <h4>Add payment schedule</h4>
      <div className="row">
        <div style={{ flex: 2, minWidth: 220 }}>
          <label>Property *</label>
          <select name="property_id" required defaultValue={offPlanProperties[0]?.id}>
            {offPlanProperties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label>Due date (DD/MM/YYYY) *</label>
          <input name="due_date" required placeholder="15/09/2026" />
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 150 }}>
          <label>Amount (AED) *</label>
          <input name="amount_aed" type="number" step="0.01" required />
        </div>
        <div style={{ flex: 2, minWidth: 220 }}>
          <label>Milestone</label>
          <input name="milestone_label" placeholder="20% on completion of foundation" />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label>Status</label>
          <select name="status" defaultValue="upcoming">
            <option value="upcoming">Upcoming</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
      </div>
      {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
      <button type="submit" disabled={saving}>{saving ? "Saving…" : "Add installment"}</button>
    </form>
  );
}

export default function PropertyForm({ properties }: { properties: PropertyOption[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isRental, setIsRental] = useState(false);
  const [subcategory, setSubcategory] = useState("off_plan");
  const [isOpen, setIsOpen] = useState(false);

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
        <label>Notes</label>
        <textarea name="notes" rows={2} />
        {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
        <button type="submit" disabled={saving}>{saving ? "Saving…" : "Add property"}</button>
      </form>

      {subcategory === "off_plan" && (
        <>
          <hr style={{ margin: "20px 0", borderColor: "var(--border)" }} />
          <PaymentScheduleFields properties={properties} />
        </>
      )}

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
