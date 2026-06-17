"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { Property } from "@/lib/types";
import { formatAed } from "@/lib/core/units";

const COLORS: Record<string, string> = { apartment: "#f0a020", villa: "#38c172", townhouse: "#4f9cf9", penthouse: "#a855f7" };
const FALLBACK_COLORS = ["#f0a020", "#38c172", "#4f9cf9", "#a855f7", "#ec4899"];
const tooltipStyle = { backgroundColor: "#1f232c", border: "1px solid #2a2f3a", borderRadius: 8, padding: "10px 14px", fontSize: 13 };

const TYPE_LABEL: Record<string, string> = { apartment: "Apartment", villa: "Villa", townhouse: "Townhouse", penthouse: "Penthouse" };

interface Props { properties: Property[] }

export default function PortfolioCompositionChart({ properties }: Props) {
  const slices = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of properties) {
      if (p.current_value_fils === null || p.current_value_fils <= 0) continue;
      const key = p.property_type ?? "unspecified";
      map.set(key, (map.get(key) ?? 0) + p.current_value_fils);
    }
    if (map.size === 0) return [];
    const total = [...map.values()].reduce((a, b) => a + b, 0);
    return [...map.entries()].map(([type, fils]) => ({
      name: TYPE_LABEL[type] ?? (type === "unspecified" ? "Unspecified" : type),
      fils,
      pct: total > 0 ? (fils / total) * 100 : 0,
    }));
  }, [properties]);

  if (slices.length === 0) return <p className="muted">No property valuations available.</p>;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={slices} dataKey="fils" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2}>
          {slices.map((_, i) => (<Cell key={i} fill={FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const d = payload[0].payload;
            return (<div style={tooltipStyle}><div style={{ color: "#9aa3b2", marginBottom: 2 }}>{d.name}</div><div style={{ fontWeight: 600 }}>{formatAed(d.fils)}</div><div style={{ fontSize: 11, color: "#9aa3b2" }}>{d.pct.toFixed(1)}%</div></div>);
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
