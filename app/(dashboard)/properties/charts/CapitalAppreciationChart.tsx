"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import type { Property } from "@/lib/types";
import { appreciationPct } from "@/lib/core/property-analytics";
import { formatAed } from "@/lib/core/units";

const tooltipStyle = { backgroundColor: "#1f232c", border: "1px solid #2a2f3a", borderRadius: 8, padding: "10px 14px", fontSize: 13 };

interface Props { properties: Property[] }

export default function CapitalAppreciationChart({ properties }: Props) {
  const data = useMemo(() => {
    return properties
      .map((p) => ({ name: p.name, pct: appreciationPct(p), purchase: p.purchase_price_fils, current: p.current_value_fils }))
      .filter((d) => d.pct !== null)
      .sort((a, b) => a.pct! - b.pct!);
  }, [properties]);

  if (data.length === 0) return <p className="muted">No appreciation data available (purchase prices and current values needed).</p>;

  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 34)}>
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
                <div style={{ fontWeight: 600 }}>{d.pct!.toFixed(1)}%</div>
                {d.purchase && d.current && (
                  <div style={{ color: "#9aa3b2", fontSize: 11, marginTop: 4 }}>
                    {formatAed(d.current)} − {formatAed(d.purchase)}
                  </div>
                )}
              </div>
            );
          }}
        />
        <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.pct! >= 0 ? "#38c172" : "#e74c3c"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
