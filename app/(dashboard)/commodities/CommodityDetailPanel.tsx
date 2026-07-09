"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Commodity } from "@/lib/types";
import { filsToAed, formatAed, formatIsoToUae, GRAMS_PER_UNIT } from "@/lib/core/units";
import { numeralOnly } from "./numeralOnly";
import AnimateOnScroll from "@/app/components/AnimateOnScroll";
import type { WeightUnit } from "@/lib/types";

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
  const [removing, setRemoving] = useState(false);
  const [unit, setUnit] = useState<string>(commodity.weight_unit);
  const [spotPrices, setSpotPrices] = useState<Record<string, number>>({});
  const [spotLoading, setSpotLoading] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const metal = commodity.metal_type;
    if (!metal || metal === "other") return;
    setSpotLoading(true);
    fetch("/api/home/market-prices")
      .then((r) => r.json())
      .then((data: { prices?: { metal: string; pricePerGramAed: number }[] }) => {
        const map: Record<string, number> = {};
        for (const p of data.prices ?? []) {
          map[p.metal] = p.pricePerGramAed;
        }
        setSpotPrices(map);
      })
      .catch(() => setSpotPrices({}))
      .finally(() => setSpotLoading(false));
  }, [editing, commodity.metal_type]);

  const perUnit = UNIT_LABEL[commodity.weight_unit] ?? commodity.weight_unit;

  useEffect(() => {
    setUnit(commodity.weight_unit);
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

    // Current price: auto-fetched from spot for precious metals, manual for "other"
    const currentUnit = (unit || commodity.weight_unit) as WeightUnit;
    const gramsPerUnit = GRAMS_PER_UNIT[currentUnit] ?? 1;
    const spotPerGram = spotPrices[commodity.metal_type] ?? 0;
    if (commodity.metal_type !== "other") {
      const newCurrentPrice = Math.round(spotPerGram * gramsPerUnit * 100) / 100;
      const existingCurrentPrice = filsToAed(commodity.current_price_per_unit_fils);
      if (newCurrentPrice !== existingCurrentPrice && newCurrentPrice > 0) {
        payload.current_price_per_unit_aed = newCurrentPrice;
      }
    } else {
      const manualPrice = numOrNull("current_price_per_unit_aed_manual");
      if (manualPrice !== null) {
        const existingCurrentPrice = filsToAed(commodity.current_price_per_unit_fils);
        if (manualPrice !== existingCurrentPrice) payload.current_price_per_unit_aed = manualPrice;
      }
    }

    const boughtPriceVal = numOrNull("bought_price_per_unit_aed");
    const existingBoughtPrice = filsToAed(commodity.bought_price_per_unit_fils);
    if (boughtPriceVal !== existingBoughtPrice) payload.bought_price_per_unit_aed = boughtPriceVal;

    const purchaseDateVal = strOrNull("purchase_date");
    if (purchaseDateVal !== commodity.purchase_date) payload.purchase_date = purchaseDateVal;

    const currentPriceDateVal = strOrNull("current_price_date");
    if (currentPriceDateVal !== (commodity.current_price_date ?? null)) payload.current_price_date = currentPriceDateVal;

    const notesVal = strOrNull("notes");
    if (notesVal !== (commodity.notes ?? null)) payload.notes = notesVal;

    const targetSellPriceVal = numOrNull("target_sell_price_per_unit_aed");
    const existingTargetSell = commodity.target_sell_price_per_unit_fils != null ? filsToAed(commodity.target_sell_price_per_unit_fils) : null;
    if (targetSellPriceVal !== existingTargetSell) payload.target_sell_price_per_unit_aed = targetSellPriceVal;

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
  }

  async function handleRemove() {
    if (!confirm("Remove this holding? This cannot be undone.")) return;
    setRemoving(true);
    const res = await fetch(`/api/commodities/${commodity.id}`, { method: "DELETE" });
    if (!res.ok) {
      setRemoving(false);
      setError("Failed to remove holding");
      return;
    }
    router.push("/commodities");
    router.refresh();
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
      {commodity.target_sell_price_per_unit_fils !== null && commodity.target_sell_price_per_unit_fils > 0 && (
        <div className="detail-row">
          <span className="detail-label">Target sell price</span>
          <span style={{
            fontWeight: 600,
            color: commodity.current_price_per_unit_fils >= commodity.target_sell_price_per_unit_fils ? "var(--good)" : "var(--text)",
          }}>
            {formatAed(commodity.target_sell_price_per_unit_fils)}/{perUnit}
            {commodity.current_price_per_unit_fils >= commodity.target_sell_price_per_unit_fils && (
              <span style={{ marginLeft: 8, fontSize: 12, color: "var(--good)" }}> Target reached</span>
            )}
          </span>
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
          {commodity.metal_type !== "other" ? (
            spotLoading ? (
              <div style={{ padding: "6px 0", color: "var(--muted)" }}>Loading spot price...</div>
            ) : spotPrices[commodity.metal_type] ? (
              <div style={{ padding: "6px 0", fontWeight: 600 }}>
                {((spotPrices[commodity.metal_type]! * (GRAMS_PER_UNIT[unit as WeightUnit] ?? 1))).toFixed(2)}
                <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 6 }}>(live spot)</span>
              </div>
            ) : (
              <div style={{ padding: "6px 0", color: "var(--bad)" }}>Spot price unavailable</div>
            )
          ) : (
            <input
              name="current_price_per_unit_aed_manual"
              type="number"
              step="0.01"
              defaultValue={
                commodity.current_price_per_unit_fils > 0
                  ? aedInputOrEmpty(commodity.current_price_per_unit_fils)
                  : ""
              }
              placeholder="Enter current price here"
              onKeyDown={numeralOnly}
            />
          )}
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Target sell price (AED per {UNIT_LABEL[unit] ?? unit})</label>
          <input
            name="target_sell_price_per_unit_aed"
            type="number"
            step="0.01"
            defaultValue={
              commodity.target_sell_price_per_unit_fils != null && commodity.target_sell_price_per_unit_fils > 0
                ? aedInputOrEmpty(commodity.target_sell_price_per_unit_fils)
                : ""
            }
            placeholder="Price at which to sell"
            onKeyDown={numeralOnly}
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
      </div>
      <label>Notes</label>
      <textarea
        name="notes"
        rows={3}
        defaultValue={commodity.notes ?? ""}
        placeholder="Optional notes about this holding"
      />
      {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
        <button
          type="button"
          onClick={handleRemove}
          disabled={removing}
          style={{ marginTop: 0, background: "var(--bad)", color: "#fff", fontSize: 12, padding: "6px 12px" }}
        >
          {removing ? "Removing…" : "Remove Holding"}
        </button>
        <div className="row" style={{ gap: 8 }}>
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
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

  const displayUnit = UNIT_LABEL[commodity.weight_unit] ?? commodity.weight_unit;

  return (
    <AnimateOnScroll><div className="card">
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
    </div></AnimateOnScroll>
  );
}
