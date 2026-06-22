"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { EnrichedCommodity } from "@/lib/core/commodity-analytics";
import { groupByMetal } from "@/lib/core/commodity-analytics";
import { formatAed } from "@/lib/core/units";

const COLORS = ["#f0a020", "#aeb0b5", "#4f9cf9", "#a855f7", "#38c172"];
const tooltipStyle = { backgroundColor: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", fontSize: 13 };
const METAL_LABEL: Record<string, string> = { gold: "Gold", silver: "Silver", platinum: "Platinum", palladium: "Palladium", other: "Other" };

export default function CommodityMetalCompositionChart({ enriched }: { enriched: EnrichedCommodity[] }) {
  const aggregates = groupByMetal(enriched);
  if (aggregates.length === 0) return <p className="muted">No holdings to display.</p>;

  const total = aggregates.reduce((s, a) => s + a.totalValueFils, 0);

  const data = aggregates.map((a) => ({
    name: METAL_LABEL[a.metalType] ?? a.metalType,
    fils: a.totalValueFils,
    pct: total > 0 ? (a.totalValueFils / total) * 100 : 0,
    count: a.holdingCount,
  }));

  return (
    <>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="fils" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const d = payload[0].payload;
            return <div style={tooltipStyle}><div style={{ color: "var(--muted)", marginBottom: 2 }}>{d.name}</div><div style={{ fontWeight: 600 }}>{formatAed(d.fils)}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{d.pct.toFixed(1)}% · {d.count} holding{d.count !== 1 ? "s" : ""}</div></div>;
          }} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", justifyContent: "center", marginTop: 8 }}>
        {data.map((s, i) => (
          <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", backgroundColor: COLORS[i % COLORS.length], flexShrink: 0 }} />
            <span style={{ color: "var(--muted)" }}>{s.name} {s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </>
  );
}
