"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Land } from "@/lib/types";
import { filsToAed, formatAed, formatIsoToUae } from "@/lib/core/units";
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

function aedInputOrEmpty(fils: number | null): string {
  return fils != null ? filsToAed(fils).toString() : "";
}

function formatIsoDisplay(iso: string | null): string {
  if (!iso) return "—";
  try {
    return formatIsoToUae(iso);
  } catch {
    return iso;
  }
}

const today = new Date().toLocaleDateString("en-CA");

export default function LandDetailPanel({ land }: { land: Land }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    setEditing(false);
    setError(null);
  }, [land]);

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

    const payload: Record<string, unknown> = {};

    const nameVal = String(fd.get("name") ?? "");
    if (nameVal !== land.name) payload.name = nameVal;

    const landTypeVal = strOrNull("land_type");
    if (landTypeVal !== (land.land_type ?? null)) payload.land_type = landTypeVal;

    const cityVal = strOrNull("city");
    if (cityVal !== (land.city ?? null)) payload.city = cityVal;

    const areaVal = strOrNull("area");
    if (areaVal !== (land.area ?? null)) payload.area = areaVal;

    const sizeVal = numOrNull("size_sqft");
    if (sizeVal !== (land.size_sqft ?? null)) payload.size_sqft = sizeVal;

    const priceVal = numOrNull("purchase_price_aed");
    if (priceVal !== (land.purchase_price_fils != null ? filsToAed(land.purchase_price_fils) : null)) {
      payload.purchase_price_aed = priceVal;
    }

    const valueVal = numOrNull("current_value_aed");
    if (valueVal !== (land.current_value_fils != null ? filsToAed(land.current_value_fils) : null)) {
      payload.current_value_aed = valueVal;
    }

    const purchasedVal = strOrNull("purchased_at");
    if (purchasedVal !== (land.purchased_at ?? null)) payload.purchased_at = purchasedVal;

    const valuedVal = strOrNull("valued_at");
    if (valuedVal !== (land.valued_at ?? null)) payload.valued_at = valuedVal;

    const notesVal = strOrNull("notes");
    if (notesVal !== (land.notes ?? null)) payload.notes = notesVal;

    if (Object.keys(payload).length === 0) {
      setSaving(false);
      setEditing(false);
      return;
    }

    const res = await fetch(`/api/lands/${land.id}`, {
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
  }

  async function handleRemove() {
    if (!confirm("Remove this land? This cannot be undone.")) return;
    setRemoving(true);
    const res = await fetch(`/api/lands/${land.id}`, { method: "DELETE" });
    if (!res.ok) {
      setRemoving(false);
      setError("Failed to remove land");
      return;
    }
    router.push("/lands");
    router.refresh();
  }

  const renderReadOnly = () => (
    <>
      <div className="detail-row">
        <span className="detail-label">Name</span>
        <span>{land.name}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Type</span>
        <span>{land.land_type ? (LAND_TYPE_LABEL[land.land_type] ?? land.land_type) : "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">City</span>
        <span>{land.city ?? "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Area</span>
        <span>{land.area ?? "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Size</span>
        <span>{land.size_sqft != null ? `${land.size_sqft.toLocaleString()} sqft` : "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Purchase price</span>
        <span>{land.purchase_price_fils != null ? formatAed(land.purchase_price_fils) : "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Current value</span>
        <span>{land.current_value_fils != null ? formatAed(land.current_value_fils) : "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Date of purchase</span>
        <span>{formatIsoDisplay(land.purchased_at)}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Date of valuation</span>
        <span>{formatIsoDisplay(land.valued_at)}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Created</span>
        <span className="muted">{formatIsoDisplay(land.created_at)}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Updated</span>
        <span className="muted">{formatIsoDisplay(land.updated_at)}</span>
      </div>
      {land.notes ? (
        <div className="detail-row">
          <span className="detail-label">Notes</span>
          <span style={{ whiteSpace: "pre-wrap" }}>{land.notes}</span>
        </div>
      ) : (
        <div className="detail-row">
          <span className="detail-label">Notes</span>
          <span className="muted">No notes added</span>
        </div>
      )}
    </>
  );

  const renderEditForm = () => (
    <form onSubmit={handleSave} className="detail-edit-form">
      <div className="row">
        <div style={{ flex: 2, minWidth: 200 }}>
          <label>Name *</label>
          <input
            name="name"
            type="text"
            required
            defaultValue={land.name}
            placeholder="e.g. Emirates Hills Plot 42"
          />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Type</label>
          <select name="land_type" defaultValue={land.land_type ?? ""}>
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
          <input name="city" type="text" defaultValue={land.city ?? ""} placeholder="e.g. Dubai" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Area</label>
          <input name="area" type="text" defaultValue={land.area ?? ""} placeholder="e.g. Emirates Hills" />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label>Size (sqft)</label>
          <input
            name="size_sqft"
            type="number"
            step="any"
            defaultValue={land.size_sqft ?? ""}
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
            defaultValue={aedInputOrEmpty(land.purchase_price_fils)}
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
            defaultValue={aedInputOrEmpty(land.current_value_fils)}
            placeholder="Enter current value"
            onKeyDown={numeralOnly}
          />
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Date of purchase</label>
          <input
            name="purchased_at"
            type="date"
            max={today}
            defaultValue={land.purchased_at ?? ""}
          />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Date of valuation</label>
          <input
            name="valued_at"
            type="date"
            max={today}
            defaultValue={land.valued_at ?? ""}
          />
        </div>
      </div>
      <label>Notes</label>
      <textarea
        name="notes"
        rows={3}
        defaultValue={land.notes ?? ""}
        placeholder="Optional notes about this land"
      />
      {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
        <button
          type="button"
          onClick={handleRemove}
          disabled={removing}
          style={{ marginTop: 0, background: "var(--bad)", color: "#fff", fontSize: 12, padding: "6px 12px" }}
        >
          {removing ? "Removing..." : "Remove Land"}
        </button>
        <div className="row" style={{ gap: 8 }}>
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            style={{
              marginTop: 0,
              background: "var(--panel-2)",
              color: "var(--muted)",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );

  return (
    <AnimateOnScroll><div className="card">
      <div className="detail-header">
        <h3 style={{ margin: 0 }}>{land.name}</h3>
        <button
          type="button"
          onClick={() => router.push("/lands")}
          style={{
            marginTop: 0,
            background: "transparent",
            color: "var(--muted)",
            padding: "4px 10px",
            fontSize: 18,
            fontWeight: 400,
            lineHeight: 1,
            flexShrink: 0,
          }}
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
            Edit Land Info
          </button>
        </div>
      )}
    </div></AnimateOnScroll>
  );
}
