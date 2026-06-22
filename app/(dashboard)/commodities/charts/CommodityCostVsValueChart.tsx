"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { EnrichedCommodity } from "@/lib/core/commodity-analytics";
import { formatAed } from "@/lib/core/units";

const tooltipStyle = { backgroundColor: "#1f232c", border: "1px solid #2a2f3a", borderRadius: 8, padding: "10px 14px", fontSize: 13 };

export default function CommodityCostVsValueChart({ enriched }: { enriched: EnrichedCommodity[] }) {
  const withCurrent = enriched.filter((e) => e.hasCurrent);
  if (withCurrent.length === 0) return <p className="muted">No holdings with current price to compare.</p>;

  const data = withCurrent.map((e) => ({
    name: `${e.commodity.metal_type.charAt(0).toUpperCase()}${e.commodity.metal_type.slice(1)} ${e.commodity.id}`,
    cost: Math.round(e.costFils / 100),
    value: Math.round(e.valueFils / 100),
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ left: 80, right: 20, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis type="number" tickFormatter={(v: number) => formatAed(v * 100)} stroke="var(--muted)" fontSize={11} />
        <YAxis type="category" dataKey="name" stroke="var(--muted)" fontSize={11} width={75} />
        <Tooltip content={({ active, payload }) => {
          if (!active || !payload?.[0]) return null;
          const d = payload[0].payload;
          return <div style={tooltipStyle}><div style={{ color: "#9aa3b2", marginBottom: 2 }}>{d.name}</div><div style={{ fontSize: 12 }}>Cost: {formatAed(d.cost * 100)}</div><div style={{ fontSize: 12 }}>Value: {formatAed(d.value * 100)}</div></div>;
        }} />
        <Bar dataKey="cost" fill="#aeb0b5" name="Cost" radius={[0, 4, 4, 0]} />
        <Bar dataKey="value" fill="#f0a020" name="Value" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
