"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { EnrichedCommodity } from "@/lib/core/commodity-analytics";
import { groupByMetal } from "@/lib/core/commodity-analytics";

const COLORS: Record<string, string> = { gold: "#f0a020", silver: "#aeb0b5", platinum: "#4f9cf9", palladium: "#a855f7", other: "#38c172" };
const METAL_LABEL: Record<string, string> = { gold: "Gold", silver: "Silver", platinum: "Platinum", palladium: "Palladium", other: "Other" };
const tooltipStyle = { backgroundColor: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", fontSize: 13 };

export default function CommodityWeightByMetalChart({ enriched }: { enriched: EnrichedCommodity[] }) {
  const aggregates = groupByMetal(enriched);
  if (aggregates.length === 0) return <p className="muted">No holdings to display.</p>;

  const data = aggregates.map((a) => ({
    name: METAL_LABEL[a.metalType] ?? a.metalType,
    grams: Math.round(a.totalGrams),
    count: a.holdingCount,
    metalType: a.metalType,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 48)}>
      <BarChart data={data} layout="vertical" margin={{ left: 65, right: 20, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis type="number" tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}kg` : `${v}g`} stroke="var(--muted)" fontSize={11} />
        <YAxis type="category" dataKey="name" stroke="var(--muted)" fontSize={11} width={60} />
        <Tooltip content={({ active, payload }) => {
          if (!active || !payload?.[0]) return null;
          const d = payload[0].payload;
          return <div style={tooltipStyle}><div style={{ color: "var(--muted)", marginBottom: 2 }}>{d.name}</div><div style={{ fontWeight: 600 }}>{d.grams.toLocaleString()} g</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{d.count} holding{d.count !== 1 ? "s" : ""}</div></div>;
        }} />
        <Bar dataKey="grams" radius={[0, 4, 4, 0]} maxBarSize={40}>
          {data.map((entry) => <Cell key={entry.metalType} fill={COLORS[entry.metalType] ?? "#888"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
