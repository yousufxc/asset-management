"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PURITY_PRESETS: { label: string; value: string }[] = [
  { label: "24K (pure gold)", value: "24k" },
  { label: "22K", value: "22k" },
  { label: "21K", value: "21k" },
  { label: "18K", value: "18k" },
  { label: ".999 fine", value: "999" },
  { label: ".925 sterling", value: "925" },
  { label: "Custom…", value: "custom" },
];

const PRESET_FRACTIONS: Record<string, number> = {
  "24k": 1.0,
  "22k": 22 / 24,
  "21k": 21 / 24,
  "18k": 18 / 24,
  "999": 0.999,
  "925": 0.925,
};

export default function CommodityForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [purityPreset, setPurityPreset] = useState("24k");

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

    let purityFraction: number;
    if (purityPreset === "custom") {
      purityFraction = Number(fd.get("purity_fraction_custom") ?? 0);
    } else {
      purityFraction = PRESET_FRACTIONS[purityPreset] ?? 1.0;
    }

    const payload = {
      name: String(fd.get("name") ?? ""),
      metal_type: String(fd.get("metal_type") ?? "gold"),
      weight: Number(fd.get("weight") ?? 0),
      weight_unit: String(fd.get("weight_unit") ?? "gram"),
      purity_fraction: purityFraction,
      form: strOrNull("form"),
      quantity: Number(fd.get("quantity") ?? 1),
      storage_location: strOrNull("storage_location"),
      acquisition_price_aed: numOrNull("acquisition_price_aed"),
      manual_value_aed: numOrNull("manual_value_aed"),
      valued_at: strOrNull("valued_at"),
      notes: strOrNull("notes"),
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
    setPurityPreset("24k");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <h3 style={{ marginTop: 0 }}>Add commodity</h3>
      <div className="row">
        <div style={{ flex: 2, minWidth: 220 }}>
          <label>Name *</label>
          <input name="name" required placeholder="1kg PAMP gold bar" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Metal type *</label>
          <select name="metal_type" defaultValue="gold">
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
            <option value="platinum">Platinum</option>
            <option value="palladium">Palladium</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label>Weight *</label>
          <input name="weight" type="number" step="any" required defaultValue={1} />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label>Weight unit *</label>
          <select name="weight_unit" defaultValue="gram">
            <option value="gram">Gram</option>
            <option value="kg">Kilogram</option>
            <option value="troy_oz">Troy ounce</option>
            <option value="tola">Tola</option>
          </select>
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Purity</label>
          <select
            name="purity_preset"
            value={purityPreset}
            onChange={(e) => setPurityPreset(e.target.value)}
          >
            {PURITY_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        {purityPreset === "custom" && (
          <div style={{ flex: 1, minWidth: 140 }}>
            <label>Purity fraction (0–1]</label>
            <input
              name="purity_fraction_custom"
              type="number"
              step="0.0001"
              min="0.0001"
              max="1"
              defaultValue={0.999}
            />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Form</label>
          <select name="form" defaultValue="bar">
            <option value="bar">Bar</option>
            <option value="coin">Coin</option>
            <option value="jewelry">Jewelry</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 100 }}>
          <label>Quantity</label>
          <input name="quantity" type="number" min={1} defaultValue={1} />
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 200 }}>
          <label>Storage location</label>
          <input name="storage_location" placeholder="Home safe / bank vault" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Acquisition price (AED)</label>
          <input name="acquisition_price_aed" type="number" step="0.01" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Manual value (AED)</label>
          <input name="manual_value_aed" type="number" step="0.01" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Valued on (DD/MM/YYYY)</label>
          <input name="valued_at" placeholder="07/03/2026" />
        </div>
      </div>
      <label>Notes</label>
      <textarea name="notes" rows={2} />
      {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
      <button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Add commodity"}
      </button>
    </form>
  );
}
