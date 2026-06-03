"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const UNIT_LABEL: Record<string, string> = {
  gram: "gram",
  kg: "kg",
  troy_oz: "troy oz",
  tola: "tola",
};

export default function CommodityForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [unit, setUnit] = useState("");

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
      metal_type: String(fd.get("metal_type") ?? ""),
      weight: Number(fd.get("weight") ?? 0),
      weight_unit: String(fd.get("weight_unit") ?? ""),
      current_price_per_unit_aed: numOrNull("current_price_per_unit_aed") ?? 0,
      bought_price_per_unit_aed: numOrNull("bought_price_per_unit_aed"),
      purchase_date: strOrNull("purchase_date"),
      current_price_date: strOrNull("current_price_date"),
    };

    const res = await fetch("/api/commodities", {
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
    setUnit("");
    router.refresh();
  }

  const perUnit = unit ? UNIT_LABEL[unit] ?? unit : "unit";

  return (
    <form onSubmit={onSubmit} className="card">
      <h3 style={{ marginTop: 0 }}>Add commodity</h3>
      <div className="row">
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Type *</label>
          <select name="metal_type" defaultValue="">
            <option value="">Select</option>
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
            <option value="platinum">Platinum</option>
            <option value="palladium">Palladium</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label>Amount *</label>
          <input name="weight" type="number" step="any" required defaultValue={1} />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label>Unit *</label>
          <select
            name="weight_unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="">Select</option>
            <option value="gram">Gram</option>
            <option value="kg">Kilogram</option>
            <option value="troy_oz">Troy ounce</option>
            <option value="tola">Tola</option>
          </select>
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Current price (AED per {perUnit}) *</label>
          <input name="current_price_per_unit_aed" type="number" step="0.01" required />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Price when bought (AED per {perUnit})</label>
          <input name="bought_price_per_unit_aed" type="number" step="0.01" />
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Date of purchase</label>
          <input name="purchase_date" type="date" />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Date of current price</label>
          <input name="current_price_date" type="date" />
        </div>
      </div>
      {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
      <button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Add commodity"}
      </button>
    </form>
  );
}
