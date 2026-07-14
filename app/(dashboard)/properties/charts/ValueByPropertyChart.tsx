"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { Property } from "@/lib/types";
import { formatAed } from "@/lib/core/units";

const tooltipStyle = { backgroundColor: "#1f232c", border: "1px solid #2a2f3a", borderRadius: 8, padding: "10px 14px", fontSize: 13 };

interface Props { properties: Property[] }

export default function ValueByPropertyChart({ properties }: Props) {
  const data = useMemo(() => {
    return properties
      .filter((p) => p.current_value_fils !== null && p.current_value_fils > 0)
      .map((p) => ({ name: p.name, fils: p.current_value_fils! }))
      .sort((a, b) => b.fils - a.fils);
  }, [properties]);

  if (data.length === 0) return <p className="muted">No property valuations available.</p>;

  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ left: 90, right: 20, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatAed(v).replace("AED ", "")} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={85} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const d = payload[0].payload;
            return (<div style={tooltipStyle}><div style={{ color: "#9aa3b2", marginBottom: 2 }}>{d.name}</div><div style={{ fontWeight: 600 }}>{formatAed(d.fils)}</div></div>);
          }}
        />
        <Bar dataKey="fils" fill="#38c172" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
