"use client";

import { useEffect, useState } from "react";
import { GRAMS_PER_UNIT } from "@/lib/core/units";
import type { WeightUnit } from "@/lib/types";

interface SpotPrice {
  metal: string;
  pricePerGramAed: number;
}

interface Commodity {
  id: number;
  metal_type: string;
  weight: number;
  weight_unit: string;
  bought_price_per_unit_fils: number;
}

interface MoversData {
  spotPrices: SpotPrice[];
  commodities: Commodity[];
  loading: boolean;
  error: string | null;
}

const METAL_LABEL: Record<string, string> = {
  gold: "Gold",
  silver: "Silver",
  platinum: "Platinum",
  palladium: "Palladium",
};

function spotFilsPerWeightUnit(spotPrices: SpotPrice[], metal: string, unit: string): number {
  const p = spotPrices.find((s) => s.metal === metal);
  if (!p) return 0;
  const gramsPerUnit = GRAMS_PER_UNIT[unit as WeightUnit] ?? 1;
  return Math.round(p.pricePerGramAed * 100 * gramsPerUnit);
}

export default function MarketInsights() {
  const [data, setData] = useState<MoversData>({
    spotPrices: [],
    commodities: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/home/market-prices").then((r) => r.json()),
      fetch("/api/commodities").then((r) => r.json()),
    ])
      .then(([pricesData, commoditiesData]) => {
        setData({
          spotPrices: pricesData.prices ?? [],
          commodities: commoditiesData.commodities ?? [],
          loading: false,
          error: null,
        });
      })
      .catch(() => {
        setData((prev) => ({ ...prev, loading: false, error: "Failed to load market data" }));
      });
  }, []);

  if (data.loading) {
    return <div className="card"><p style={{ color: "var(--muted)" }}>Loading market insights...</p></div>;
  }

  if (data.error || data.spotPrices.length === 0) {
    return <div className="card"><p style={{ color: "var(--muted)" }}>Market data temporarily unavailable</p></div>;
  }

  const movers = data.commodities
    .filter((c) => c.metal_type !== "other")
    .map((c) => {
      const spotFilsPerUnit = spotFilsPerWeightUnit(data.spotPrices, c.metal_type, c.weight_unit);
      const boughtFils = c.bought_price_per_unit_fils * c.weight;
      const spotValue = spotFilsPerUnit * c.weight;
      const gainFils = spotValue - boughtFils;
      const gainPct = boughtFils > 0 ? (gainFils / boughtFils) * 100 : 0;
      return {
        metal: c.metal_type,
        label: METAL_LABEL[c.metal_type] ?? c.metal_type,
        spotFilsPerUnit,
        boughtFils,
        gainFils,
        gainPct,
      };
    })
    .sort((a, b) => b.gainPct - a.gainPct);

  const biggestGainer = movers.length > 0 ? movers[0] : null;
  const biggestLoser = movers.length > 1 ? movers[movers.length - 1] : null;

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>Key Insights</h3>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        {biggestGainer && biggestGainer.gainPct > 0 ? (
          <div style={{
            flex: 1, minWidth: 200, padding: "10px 12px",
            borderLeft: "3px solid var(--good)",
            backgroundColor: "rgba(56,193,114,0.06)", borderRadius: 6,
          }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Top gainer</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{biggestGainer.label}</div>
            <div style={{ color: "var(--good)", fontWeight: 600 }}>
              +{biggestGainer.gainPct.toFixed(1)}%
            </div>
          </div>
        ) : biggestGainer ? (
          <div style={{
            flex: 1, minWidth: 200, padding: "10px 12px",
            borderLeft: "3px solid var(--bad)",
            backgroundColor: "rgba(220,53,69,0.06)", borderRadius: 6,
          }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Best performer</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{biggestGainer.label}</div>
            <div style={{ color: "var(--bad)", fontWeight: 600 }}>
              {biggestGainer.gainPct.toFixed(1)}%
            </div>
          </div>
        ) : null}

        {biggestLoser && biggestLoser.gainPct < 0 && biggestLoser !== biggestGainer ? (
          <div style={{
            flex: 1, minWidth: 200, padding: "10px 12px",
            borderLeft: "3px solid var(--bad)",
            backgroundColor: "rgba(220,53,69,0.06)", borderRadius: 6,
          }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Biggest laggard</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{biggestLoser.label}</div>
            <div style={{ color: "var(--bad)", fontWeight: 600 }}>
              {biggestLoser.gainPct.toFixed(1)}%
            </div>
          </div>
        ) : null}

        <div style={{
          flex: 1, minWidth: 200, padding: "10px 12px",
          borderLeft: "3px solid var(--accent)",
          backgroundColor: "rgba(0,167,209,0.06)", borderRadius: 6,
        }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Holdings tracked</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{movers.length}</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>commodities with spot data</div>
        </div>
      </div>

      <details>
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Current spot prices</summary>
        <table style={{ width: "100%", marginTop: 8, fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Metal</th>
              <th style={{ textAlign: "right" }}>Spot (AED/g)</th>
            </tr>
          </thead>
          <tbody>
            {data.spotPrices.map((p) => (
              <tr key={p.metal}>
                <td>{METAL_LABEL[p.metal] ?? p.metal}</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>
                  AED {p.pricePerGramAed.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
