"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Commodity } from "@/lib/types";
import { filsToAed, formatAed, formatIsoToUae } from "@/lib/core/units";
import { numeralOnly } from "./numeralOnly";

const METAL_LABEL: Record<string, string> = {
  gold: "Gold",
  silver: "Silver",
  platinum: "Platinum",
  palladium: "Palladium",
  other: "Other",
};

const UNIT_LABEL: Record<string, string> = {
  gram: "gram",
  kg: "kg",
  troy_oz: "troy oz",
  tola: "tola",
};

function aedInputOrEmpty(fils: number): string {
  return filsToAed(fils).toString();
}

function formatIsoDisplay(iso: string): string {
  try {
    return formatIsoToUae(iso);
  } catch {
    return iso;
  }
}

const today = new Date().toLocaleDateString("en-CA");

export default function CommodityDetailPanel({ commodity }: { commodity: Commodity }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [unit, setUnit] = useState<string>(commodity.weight_unit);
  const [hasCurrentPrice, setHasCurrentPrice] = useState(
    commodity.current_price_per_unit_fils > 0
  );

  const perUnit = UNIT_LABEL[commodity.weight_unit] ?? commodity.weight_unit;

  useEffect(() => {
    setUnit(commodity.weight_unit);
    setHasCurrentPrice(commodity.current_price_per_unit_fils > 0);
  }, [commodity]);

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

    const metalTypeVal = String(fd.get("metal_type") ?? "");
    if (metalTypeVal !== commodity.metal_type) payload.metal_type = metalTypeVal;

    const weightVal = numOrNull("weight");
    if (weightVal !== commodity.weight) payload.weight = weightVal;

    const weightUnitVal = String(fd.get("weight_unit") ?? "");
    if (weightUnitVal !== commodity.weight_unit) payload.weight_unit = weightUnitVal;

    // Empty current price means "not set" → 0 (the column's sentinel/default),
    // never null — sending null would fail Zod and block editing a commodity
    // that has no current price yet.
    const currentPriceVal = numOrNull("current_price_per_unit_aed") ?? 0;
    const existingCurrentPrice = filsToAed(commodity.current_price_per_unit_fils);
    if (currentPriceVal !== existingCurrentPrice) payload.current_price_per_unit_aed = currentPriceVal;

    const boughtPriceVal = numOrNull("bought_price_per_unit_aed");
    const existingBoughtPrice = filsToAed(commodity.bought_price_per_unit_fils);
    if (boughtPriceVal !== existingBoughtPrice) payload.bought_price_per_unit_aed = boughtPriceVal;

    const purchaseDateVal = strOrNull("purchase_date");
    if (purchaseDateVal !== commodity.purchase_date) payload.purchase_date = purchaseDateVal;

    const currentPriceDateVal = strOrNull("current_price_date");
    if (currentPriceDateVal !== (commodity.current_price_date ?? null)) payload.current_price_date = currentPriceDateVal;

    const notesVal = strOrNull("notes");
    if (notesVal !== (commodity.notes ?? null)) payload.notes = notesVal;

    if (Object.keys(payload).length === 0) {
      setSaving(false);
      setEditing(false);
      return;
    }

    const res = await fetch(`/api/commodities/${commodity.id}`, {
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
    setUnit(commodity.weight_unit);
    setHasCurrentPrice(commodity.current_price_per_unit_fils > 0);
  }

  const renderReadOnly = () => (
    <>
      <div className="detail-row">
        <span className="detail-label">Type</span>
        <span>{METAL_LABEL[commodity.metal_type] ?? commodity.metal_type}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Amount</span>
        <span>{commodity.weight} {commodity.weight_unit}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Price when bought</span>
        <span>{formatAed(commodity.bought_price_per_unit_fils)}/{perUnit}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Date of purchase</span>
        <span>{formatIsoDisplay(commodity.purchase_date)}</span>
      </div>
      {commodity.current_price_per_unit_fils > 0 ? (
        <>
          <div className="detail-row">
            <span className="detail-label">Current price</span>
            <span>{formatAed(commodity.current_price_per_unit_fils)}/{perUnit}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Date of current price</span>
            <span>
              {commodity.current_price_date
                ? formatIsoDisplay(commodity.current_price_date)
                : "—"}
            </span>
          </div>
        </>
      ) : (
        <div className="detail-row">
          <span className="detail-label">Current price</span>
          <span className="muted">Not set</span>
        </div>
      )}
      <div className="detail-row">
        <span className="detail-label">Created</span>
        <span className="muted">{formatIsoDisplay(commodity.created_at)}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Updated</span>
        <span className="muted">{formatIsoDisplay(commodity.updated_at)}</span>
      </div>
      {commodity.notes ? (
        <div className="detail-row">
          <span className="detail-label">Notes</span>
          <span style={{ whiteSpace: "pre-wrap" }}>{commodity.notes}</span>
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
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Type *</label>
          <select name="metal_type" defaultValue={commodity.metal_type}>
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
            <option value="platinum">Platinum</option>
            <option value="palladium">Palladium</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label>Amount *</label>
          <input
            name="weight"
            type="number"
            step="any"
            required
            defaultValue={commodity.weight}
            placeholder="Enter quantity amount here"
            onKeyDown={numeralOnly}
          />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label>Unit *</label>
          <select
            name="weight_unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="gram">Gram</option>
            <option value="kg">Kilogram</option>
            <option value="troy_oz">Troy ounce</option>
            <option value="tola">Tola</option>
          </select>
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Price when bought (AED per {UNIT_LABEL[unit] ?? unit}) *</label>
          <input
            name="bought_price_per_unit_aed"
            type="number"
            step="0.01"
            required
            defaultValue={aedInputOrEmpty(commodity.bought_price_per_unit_fils)}
            placeholder="Enter the price per unit when bought here"
            onKeyDown={numeralOnly}
          />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Current price (AED per {UNIT_LABEL[unit] ?? unit})</label>
          <input
            name="current_price_per_unit_aed"
            type="number"
            step="0.01"
            defaultValue={
              commodity.current_price_per_unit_fils > 0
                ? aedInputOrEmpty(commodity.current_price_per_unit_fils)
                : ""
            }
            placeholder="Enter current price here"
            onKeyDown={numeralOnly}
            onChange={(e) => setHasCurrentPrice(e.target.value !== "")}
          />
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Date of purchase *</label>
          <input
            name="purchase_date"
            type="date"
            max={today}
            required
            defaultValue={commodity.purchase_date}
          />
        </div>
        {hasCurrentPrice && (
          <div style={{ flex: 1, minWidth: 180 }}>
            <label>Date of current price *</label>
            <input
              name="current_price_date"
              type="date"
              max={today}
              required
              defaultValue={commodity.current_price_date ?? ""}
            />
          </div>
        )}
      </div>
      <label>Notes</label>
      <textarea
        name="notes"
        rows={3}
        defaultValue={commodity.notes ?? ""}
        placeholder="Optional notes about this holding"
      />
      {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
      <div className="row" style={{ gap: 8 }}>
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          style={{
            marginTop: 14,
            background: "var(--panel-2)",
            color: "var(--muted)",
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );

  const displayUnit = UNIT_LABEL[commodity.weight_unit] ?? commodity.weight_unit;

  return (
    <div className="card">
      <div className="detail-header">
        <h3 style={{ margin: 0 }}>
          {METAL_LABEL[commodity.metal_type] ?? commodity.metal_type}{" "}
          ({commodity.weight} {displayUnit})
        </h3>
        <button
          type="button"
          onClick={() => router.push("/commodities")}
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
            Edit Holding Info
          </button>
        </div>
      )}
    </div>
  );
}
