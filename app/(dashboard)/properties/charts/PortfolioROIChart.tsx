"use client";

import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import type { Property, PropertyMaintenance } from "@/lib/types";
import { totalROIPct, annualizedROIPct } from "@/lib/core/property-analytics";

const tooltipStyle = { backgroundColor: "#1f232c", border: "1px solid #2a2f3a", borderRadius: 8, padding: "10px 14px", fontSize: 13 };

type ROIMode = "snapshot" | "annualized";

interface Props { properties: Property[]; maintenance: PropertyMaintenance[] }

export default function PortfolioROIChart({ properties, maintenance }: Props) {
  const [mode, setMode] = useState<ROIMode>("snapshot");
  const todayIso = new Date().toISOString().slice(0, 10);

  const maintByProperty = useMemo(() => {
    const map = new Map<number, PropertyMaintenance[]>();
    for (const m of maintenance) {
      const list = map.get(m.property_id) ?? [];
      list.push(m);
      map.set(m.property_id, list);
    }
    return map;
  }, [maintenance]);

  const data = useMemo(() => {
    return properties
      .map((p) => {
        const maint = maintByProperty.get(p.id) ?? [];
        const roi = mode === "snapshot" ? totalROIPct(p, maint) : annualizedROIPct(p, todayIso, maint);
        return { name: p.name, roi, purchaseFils: p.purchase_price_fils ?? 0 };
      })
      .filter((d) => d.roi !== null)
      .sort((a, b) => a.roi! - b.roi!);
  }, [properties, maintByProperty, mode, todayIso]);

  const singleProperty = properties.length === 1;
  const chartHeight = Math.max(120, data.length * 34);

  const aggregateROI = useMemo(() => {
    if (data.length === 0) return null;
    let weightedSum = 0;
    let totalPurchase = 0;
    for (const d of data) {
      if (d.purchaseFils > 0) {
        weightedSum += d.roi! * d.purchaseFils;
        totalPurchase += d.purchaseFils;
      }
    }
    return totalPurchase > 0 ? weightedSum / totalPurchase : null;
  }, [data]);

  const toggleBtn = (m: ROIMode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      title={m === "snapshot" ? "Total gain (appreciation + net rent) as % of purchase price" : "Time-weighted annualized return (CAGR + rental yield)"}
      style={{
        fontSize: 11,
        padding: "3px 10px",
        borderRadius: 4,
        border: "1px solid var(--border)",
        background: mode === m ? "var(--accent)" : "transparent",
        color: mode === m ? "#fff" : "var(--muted)",
        cursor: "pointer",
        marginLeft: 6,
        marginTop: 0,
      }}
    >
      {label}
    </button>
  );

  const emptyMessage = data.length === 0
    ? (singleProperty && mode === "annualized"
        ? "Purchase date required for annualized ROI."
        : "No ROI data available (purchase prices and current values needed).")
    : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        {toggleBtn("snapshot", "Snapshot")}
        {toggleBtn("annualized", "Annualized")}
      </div>
      {aggregateROI !== null && (
        <div className="kpi-total" style={{ marginBottom: 4 }}>
          {aggregateROI >= 0 ? "+" : ""}{aggregateROI.toFixed(1)}%
          <div className="muted" style={{ fontSize: 11, fontWeight: 400 }}>capital-weighted avg</div>
        </div>
      )}
      {emptyMessage ? (
        <p className="muted">{emptyMessage}</p>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={data} layout="vertical" margin={{ left: 90, right: 20, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={85} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const d = payload[0].payload;
                return (
                  <div style={tooltipStyle}>
                    <div style={{ color: "#9aa3b2", marginBottom: 2 }}>{d.name}</div>
                    <div style={{ fontWeight: 600 }}>{d.roi!.toFixed(1)}%</div>
                    <div style={{ color: "#9aa3b2", fontSize: 11, marginTop: 4 }}>
                      {mode === "snapshot" ? "Appreciation + net rent ÷ purchase" : "Annualized appreciation + yield"}
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="roi" radius={[0, 4, 4, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.roi! >= 0 ? "#38c172" : "#e74c3c"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
