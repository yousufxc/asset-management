"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { EnrichedCommodity } from "@/lib/core/commodity-analytics";
import { formatAed } from "@/lib/core/units";

const tooltipStyle = { backgroundColor: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", fontSize: 13 };

export default function CommodityROIChart({ enriched }: { enriched: EnrichedCommodity[] }) {
  const withROI = enriched.filter((e) => e.hasCurrent && e.plPct !== null).sort((a, b) => (b.plPct ?? 0) - (a.plPct ?? 0));
  if (withROI.length === 0) return <p className="muted">No holdings with current price to compare.</p>;

  const data = withROI.map((e) => ({
    name: `${e.commodity.metal_type.charAt(0).toUpperCase()}${e.commodity.metal_type.slice(1)} ${e.commodity.id}`,
    plPct: (e.plPct ?? 0),
    color: (e.plPct ?? 0) >= 0 ? "var(--good)" : "var(--bad)",
    pl: e.pl,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ left: 80, right: 20, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis type="number" tickFormatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`} stroke="var(--muted)" fontSize={11} />
        <YAxis type="category" dataKey="name" stroke="var(--muted)" fontSize={11} width={75} />
        <Tooltip content={({ active, payload }) => {
          if (!active || !payload?.[0]) return null;
          const d = payload[0].payload;
          return <div style={tooltipStyle}><div style={{ color: "var(--muted)", marginBottom: 2 }}>{d.name}</div><div style={{ fontWeight: 600, color: d.plPct >= 0 ? "var(--good)" : "var(--bad)" }}>{d.plPct >= 0 ? "+" : ""}{d.plPct.toFixed(1)}%</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{d.pl >= 0 ? "+" : ""}{formatAed(d.pl)}</div></div>;
        }} />
        <Bar dataKey="plPct" radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
