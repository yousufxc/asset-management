"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { numeralOnly } from "./numeralOnly";
import AnimateOnScroll from "@/app/components/AnimateOnScroll";
import { GRAMS_PER_UNIT } from "@/lib/core/units";
import type { WeightUnit } from "@/lib/types";

const UNIT_LABEL: Record<string, string> = {
  gram: "gram",
  kg: "kg",
  troy_oz: "troy oz",
  tola: "tola",
};

const today = new Date().toLocaleDateString("en-CA");

export default function CommodityForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [unit, setUnit] = useState("");
  const [metalType, setMetalType] = useState("");
  const [spotPrices, setSpotPrices] = useState<Record<string, number>>({});
  const [spotLoading, setSpotLoading] = useState(false);

  useEffect(() => {
    if (!metalType || metalType === "" || metalType === "other") return;
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
  }, [metalType]);

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

    const metal = String(fd.get("metal_type") ?? "");
    const weightUnit = String(fd.get("weight_unit") ?? "") as WeightUnit;
    const gramsPerUnit = GRAMS_PER_UNIT[weightUnit] ?? 1;
    const spotPerGram = spotPrices[metal] ?? 0;
    const manualPrice = numOrNull("current_price_per_unit_aed_manual");
    const computedCurrentPrice =
      metal !== "other"
        ? Math.round(spotPerGram * gramsPerUnit * 100) / 100
        : manualPrice ?? 0;

    const payload = {
      metal_type: metal,
      weight: Number(fd.get("weight") ?? 0),
      weight_unit: weightUnit,
      current_price_per_unit_aed: computedCurrentPrice,
      bought_price_per_unit_aed: numOrNull("bought_price_per_unit_aed"),
      target_sell_price_per_unit_aed: numOrNull("target_sell_price_per_unit_aed"),
      purchase_date: strOrNull("purchase_date"),
      current_price_date: today,
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
    setUnit("");
    setMetalType("");
    setSpotPrices({});
    setIsOpen(false);
    router.refresh();
  }

  const perUnit = unit ? UNIT_LABEL[unit] ?? unit : "unit";

  if (!isOpen) {
    return (
      <div style={{ marginBottom: 18, display: "flex", justifyContent: "flex-end" }}>
        <button type="button" style={{ marginTop: 0 }} onClick={() => setIsOpen(true)}>
          + Add Commodity
        </button>
      </div>
    );
  }

  return (
    <AnimateOnScroll><form onSubmit={onSubmit} className="card">
      <h3 style={{ marginTop: 0 }}>Add commodity</h3>
      <div className="row">
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Type *</label>
          <select
            name="metal_type"
            value={metalType}
            onChange={(e) => setMetalType(e.target.value)}
          >
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
          <input
            name="weight"
            type="number"
            step="any"
            required
            defaultValue={1}
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
          <label>Price when bought (AED per {perUnit}) *</label>
          <input
            name="bought_price_per_unit_aed"
            type="number"
            step="0.01"
            required
            placeholder="Enter the price per unit when bought here"
            onKeyDown={numeralOnly}
          />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Current price (AED per {perUnit})</label>
          {metalType && metalType !== "other" ? (
            spotLoading ? (
              <div style={{ padding: "6px 0", color: "var(--muted)" }}>Loading spot price...</div>
            ) : spotPrices[metalType] ? (
              <div style={{ padding: "6px 0", fontWeight: 600 }}>
                {((spotPrices[metalType]! * (GRAMS_PER_UNIT[unit as WeightUnit] ?? 1))).toFixed(2)}
                <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 6 }}>
                  (live spot)
                </span>
              </div>
            ) : (
              <div style={{ padding: "6px 0", color: "var(--bad)" }}>Spot price unavailable</div>
            )
          ) : (
            <div style={{ padding: "6px 0", color: "var(--muted)" }}>
              {metalType === "other" ? "Enter manually below" : "Select a metal type first"}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Target sell price (AED per {perUnit})</label>
          <input
            name="target_sell_price_per_unit_aed"
            type="number"
            step="0.01"
            placeholder="Price at which to sell"
            onKeyDown={numeralOnly}
          />
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Date of purchase *</label>
          <input name="purchase_date" type="date" max={today} required />
        </div>
        {metalType === "other" && (
          <div style={{ flex: 1, minWidth: 180 }}>
            <label>Current price (AED per {perUnit})</label>
            <input
              name="current_price_per_unit_aed_manual"
              type="number"
              step="0.01"
              placeholder="Enter current price here"
              onKeyDown={numeralOnly}
            />
          </div>
        )}
      </div>
      <label>Notes</label>
      <textarea name="notes" rows={2} placeholder="Optional notes about this holding" />
      {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
      <button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Add commodity"}
      </button>
    </form></AnimateOnScroll>
  );
}
