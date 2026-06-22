"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import type { Property, Installment } from "@/lib/types";
import { equityFils } from "@/lib/core/property-analytics";
import { formatAed } from "@/lib/core/units";

const tooltipStyle = { backgroundColor: "#1f232c", border: "1px solid #2a2f3a", borderRadius: 8, padding: "10px 14px", fontSize: 13 };

interface Props { properties: Property[]; installments: Installment[] }

export default function EquityChart({ properties, installments }: Props) {
  const data = useMemo(() => {
    return properties
      .map((p) => ({
        name: p.name,
        equity: equityFils(p, installments.filter((i) => i.property_id === p.id)),
        value: p.current_value_fils,
      }))
      .filter((d) => d.equity !== null && d.value !== null && d.value > 0)
      .sort((a, b) => b.equity! - a.equity!);
  }, [properties, installments]);

  if (data.length === 0) return <p className="muted">No equity data available.</p>;

  const totalEquity = data.reduce((sum, d) => sum + d.equity!, 0);

  return (
    <>
      <div className="kpi-total" style={{ fontSize: 18 }}>{formatAed(totalEquity)}</div>
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 34)}>
        <BarChart data={data} layout="vertical" margin={{ left: 90, right: 20, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatAed(v).replace("AED ", "")} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={85} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload;
              return (
                <div style={tooltipStyle}>
                  <div style={{ color: "#9aa3b2", marginBottom: 2 }}>{d.name}</div>
                  <div style={{ fontWeight: 600 }}>{formatAed(d.equity)}</div>
                  {d.value && (
                    <div style={{ color: "#9aa3b2", fontSize: 11, marginTop: 4 }}>
                      Value: {formatAed(d.value)}
                    </div>
                  )}
                </div>
              );
            }}
          />
          <Bar dataKey="equity" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.equity! >= 0 ? "#38c172" : "#e74c3c"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}
