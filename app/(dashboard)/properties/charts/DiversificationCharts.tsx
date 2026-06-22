"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { Property } from "@/lib/types";
import { formatAed } from "@/lib/core/units";

const COLORS = ["#38c172", "#4f9cf9", "#f0a020", "#a855f7", "#ec4899", "#e74c3c"];
const tooltipStyle = { backgroundColor: "#1f232c", border: "1px solid #2a2f3a", borderRadius: 8, padding: "10px 14px", fontSize: 13 };

interface Props { properties: Property[] }

function buildSlices(properties: Property[], key: keyof Pick<Property, "city" | "area" | "developer" | "bedrooms">) {
  const map = new Map<string, number>();
  for (const p of properties) {
    if (p.current_value_fils == null || p.current_value_fils <= 0) continue;
    const val = p[key];
    const label = val != null ? String(val) : "Unspecified";
    map.set(label, (map.get(label) ?? 0) + p.current_value_fils);
  }
  if (map.size === 0) return [];
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  return [...map.entries()]
    .map(([name, fils]) => ({ name, fils, pct: total > 0 ? (fils / total) * 100 : 0 }))
    .sort((a, b) => b.fils - a.fils);
}

function DonutCard({ title, slices }: { title: string; slices: { name: string; fils: number; pct: number }[] }) {
  if (slices.length === 0) {
    return (
      <div style={{ flex: 1, minWidth: 160 }}>
        <h5 style={{ margin: "0 0 4px", fontSize: 12, color: "var(--muted)", textAlign: "center" }}>{title}</h5>
        <p className="muted" style={{ fontSize: 11, textAlign: "center" }}>No data</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minWidth: 160 }}>
      <h5 style={{ margin: "0 0 4px", fontSize: 12, color: "var(--muted)", textAlign: "center" }}>{title}</h5>
      <ResponsiveContainer width="100%" height={140}>
        <PieChart>
          <Pie data={slices} dataKey="fils" nameKey="name" cx="50%" cy="50%" outerRadius={45} innerRadius={25} paddingAngle={1}>
            {slices.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
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
      <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 8px", justifyContent: "center", marginTop: 4 }}>
        {slices.map((s, i) => (
          <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10 }}>
            <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", backgroundColor: COLORS[i % COLORS.length], flexShrink: 0 }} />
            <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{s.name} {s.pct.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DiversificationCharts({ properties }: Props) {
  const byCity = useMemo(() => buildSlices(properties, "city"), [properties]);
  const byArea = useMemo(() => buildSlices(properties, "area"), [properties]);
  const byDeveloper = useMemo(() => buildSlices(properties, "developer"), [properties]);
  const byBedrooms = useMemo(() => buildSlices(properties, "bedrooms"), [properties]);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
      <DonutCard title="By City" slices={byCity} />
      <DonutCard title="By Area" slices={byArea} />
      <DonutCard title="By Developer" slices={byDeveloper} />
      <DonutCard title="By Bedrooms" slices={byBedrooms} />
    </div>
  );
}
