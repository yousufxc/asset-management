"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { EnrichedCommodity } from "@/lib/core/commodity-analytics";
import { formatAed } from "@/lib/core/units";

const tooltipStyle = { backgroundColor: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", fontSize: 13 };

export default function CommodityPLByHoldingChart({ enriched }: { enriched: EnrichedCommodity[] }) {
  const withCurrent = enriched.filter((e) => e.hasCurrent).sort((a, b) => b.pl - a.pl);
  if (withCurrent.length === 0) return <p className="muted">No holdings with current price to compare.</p>;

  const data = withCurrent.map((e) => ({
    name: `${e.commodity.metal_type.charAt(0).toUpperCase()}${e.commodity.metal_type.slice(1)} ${e.commodity.id}`,
    pl: Math.round(e.pl / 100),
    color: e.pl >= 0 ? "var(--good)" : "var(--bad)",
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
          return <div style={tooltipStyle}><div style={{ color: "var(--muted)", marginBottom: 2 }}>{d.name}</div><div style={{ fontWeight: 600, color: d.pl >= 0 ? "var(--good)" : "var(--bad)" }}>{d.pl >= 0 ? "+" : ""}{formatAed(d.pl * 100)}</div></div>;
        }} />
        <Bar dataKey="pl" radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
