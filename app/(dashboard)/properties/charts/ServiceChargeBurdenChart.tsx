"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import type { Property } from "@/lib/types";
import { serviceChargeBurdenPct } from "@/lib/core/property-analytics";

const tooltipStyle = { backgroundColor: "#1f232c", border: "1px solid #2a2f3a", borderRadius: 8, padding: "10px 14px", fontSize: 13 };

interface Props { properties: Property[] }

export default function ServiceChargeBurdenChart({ properties }: Props) {
  const data = useMemo(() => {
    return properties
      .filter((p) => p.subcategory !== "off_plan")
      .map((p) => ({ name: p.name, pct: serviceChargeBurdenPct(p) }))
      .filter((d) => d.pct !== null)
      .sort((a, b) => b.pct! - a.pct!);
  }, [properties]);

  if (data.length === 0) return <p className="muted">No service charge data available for rental properties.</p>;

  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ left: 90, right: 20, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} domain={[0, 100]} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={85} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const d = payload[0].payload;
            return (
              <div style={tooltipStyle}>
                <div style={{ color: "#9aa3b2", marginBottom: 2 }}>{d.name}</div>
                <div style={{ fontWeight: 600 }}>{d.pct!.toFixed(1)}%</div>
                <div style={{ fontSize: 11, color: "#9aa3b2" }}>Service charge ÷ gross rent</div>
              </div>
            );
          }}
        />
        <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.pct! > 50 ? "#e74c3c" : d.pct! > 25 ? "#f0a020" : "#38c172"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
