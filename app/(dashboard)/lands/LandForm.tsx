"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { numeralOnly } from "./numeralOnly";
import AnimateOnScroll from "@/app/components/AnimateOnScroll";

const LAND_TYPE_LABEL: Record<string, string> = {
  residential: "Residential",
  commercial: "Commercial",
  agricultural: "Agricultural",
  industrial: "Industrial",
  mixed_use: "Mixed Use",
  other: "Other",
};

const today = new Date().toLocaleDateString("en-CA");

export default function LandForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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
      land_type: strOrNull("land_type"),
      city: strOrNull("city"),
      area: strOrNull("area"),
      size_sqft: numOrNull("size_sqft"),
      purchase_price_aed: numOrNull("purchase_price_aed"),
      current_value_aed: numOrNull("current_value_aed"),
      purchased_at: strOrNull("purchased_at"),
      valued_at: strOrNull("valued_at"),
      notes: strOrNull("notes"),
    };

    const res = await fetch("/api/lands", {
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
    setIsOpen(false);
    router.refresh();
  }

  if (!isOpen) {
    return (
      <div style={{ marginBottom: 18, display: "flex", justifyContent: "flex-end" }}>
        <button type="button" style={{ marginTop: 0 }} onClick={() => setIsOpen(true)}>
          + Add Land
        </button>
      </div>
    );
  }

  return (
    <AnimateOnScroll><div className="card">
      <h3 style={{ marginTop: 0 }}>Add land</h3>
      <form onSubmit={onSubmit}>
        <div className="row">
          <div style={{ flex: 2, minWidth: 200 }}>
            <label>Name *</label>
            <input
              name="name"
              type="text"
              required
              placeholder="e.g. Emirates Hills Plot 42"
            />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label>Type</label>
            <select name="land_type" defaultValue="">
              <option value="">Select</option>
              {Object.entries(LAND_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="row">
          <div style={{ flex: 1, minWidth: 160 }}>
            <label>City</label>
            <input name="city" type="text" placeholder="e.g. Dubai" />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label>Area</label>
            <input name="area" type="text" placeholder="e.g. Emirates Hills" />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label>Size (sqft)</label>
            <input
              name="size_sqft"
              type="number"
              step="any"
              placeholder="e.g. 5000"
              onKeyDown={numeralOnly}
            />
          </div>
        </div>
        <div className="row">
          <div style={{ flex: 1, minWidth: 180 }}>
            <label>Purchase price (AED)</label>
            <input
              name="purchase_price_aed"
              type="number"
              step="0.01"
              placeholder="Enter purchase price"
              onKeyDown={numeralOnly}
            />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label>Current value (AED)</label>
            <input
              name="current_value_aed"
              type="number"
              step="0.01"
              placeholder="Enter current value"
              onKeyDown={numeralOnly}
            />
          </div>
        </div>
        <div className="row">
          <div style={{ flex: 1, minWidth: 180 }}>
            <label>Date of purchase</label>
            <input name="purchased_at" type="date" max={today} />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label>Date of valuation</label>
            <input name="valued_at" type="date" max={today} />
          </div>
        </div>
        <label>Notes</label>
        <textarea name="notes" rows={2} placeholder="Optional notes about this land" />
        {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Add land"}
        </button>
      </form>

      <hr style={{ margin: "20px 0 12px", borderColor: "var(--border)" }} />
      <button
        type="button"
        onClick={() => setIsOpen(false)}
        style={{ marginTop: 0, background: "var(--panel-2)", color: "var(--muted)" }}
      >
        Close
      </button>
    </div></AnimateOnScroll>
  );
}
