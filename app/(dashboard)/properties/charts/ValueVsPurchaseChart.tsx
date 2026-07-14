"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { Property } from "@/lib/types";
import { formatAed } from "@/lib/core/units";

const tooltipStyle = { backgroundColor: "#1f232c", border: "1px solid #2a2f3a", borderRadius: 8, padding: "10px 14px", fontSize: 13 };

interface Props { properties: Property[] }

export default function ValueVsPurchaseChart({ properties }: Props) {
  const data = useMemo(() => {
    return properties
      .filter((p) => p.purchase_price_fils !== null && p.current_value_fils !== null && p.purchase_price_fils > 0)
      .map((p) => ({
        name: p.name,
        purchase: p.purchase_price_fils!,
        current: p.current_value_fils!,
      }))
      .sort((a, b) => b.current - a.current);
  }, [properties]);

  if (data.length === 0) return <p className="muted">No purchase / value comparison data available.</p>;

  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 50)}>
      <BarChart data={data} layout="vertical" margin={{ left: 90, right: 20, top: 4, bottom: 4 }} barCategoryGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatAed(v).replace("AED ", "")} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={85} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const d = payload[0].payload;
            return (
              <div style={tooltipStyle}>
                <div style={{ color: "#9aa3b2", marginBottom: 2 }}>{d.name}</div>
                <div>Purchased: {formatAed(d.purchase)}</div>
                <div>Current: {formatAed(d.current)}</div>
              </div>
            );
          }}
          itemStyle={{ padding: 0 }}
        />
        <Bar dataKey="purchase" fill="#e74c3c" radius={[0, 0, 0, 0]} maxBarSize={14} />
        <Bar dataKey="current" fill="#38c172" radius={[0, 4, 4, 0]} maxBarSize={14} />
      </BarChart>
    </ResponsiveContainer>
  );
}
