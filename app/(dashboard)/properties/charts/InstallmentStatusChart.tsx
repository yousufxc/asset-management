"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { Installment } from "@/lib/types";
import { installmentStatus } from "@/lib/core/installments";
import { formatAed } from "@/lib/core/units";

const COLORS: Record<string, string> = { paid: "#38c172", upcoming: "#f0a020", overdue: "#e74c3c" };
const LABEL: Record<string, string> = { paid: "Paid", upcoming: "Upcoming", overdue: "Overdue" };
const tooltipStyle = { backgroundColor: "#1f232c", border: "1px solid #2a2f3a", borderRadius: 8, padding: "10px 14px", fontSize: 13 };

interface Props { installments: Installment[] }

export default function InstallmentStatusChart({ installments }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const slices = useMemo(() => {
    const map = new Map<string, { count: number; fils: number }>();
    for (const inst of installments) {
      const status = installmentStatus(inst, today);
      const entry = map.get(status) ?? { count: 0, fils: 0 };
      entry.count++;
      entry.fils += inst.amount_fils;
      map.set(status, entry);
    }
    if (map.size === 0) return [];
    const total = [...map.values()].reduce((a, b) => a + b.count, 0);
    return [...map.entries()].map(([status, v]) => ({
      name: LABEL[status] ?? status,
      count: v.count,
      fils: v.fils,
      pct: total > 0 ? (v.count / total) * 100 : 0,
    }));
  }, [installments, today]);

  if (slices.length === 0) return <p className="muted">No installments to chart.</p>;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={slices} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={2}>
          {slices.map((s, i) => (<Cell key={i} fill={COLORS[s.name.toLowerCase()] ?? COLORS.upcoming} />))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const d = payload[0].payload;
            return (
              <div style={tooltipStyle}>
                <div style={{ color: "#9aa3b2", marginBottom: 2 }}>{d.name}</div>
                <div>{d.count} instalment{d.count !== 1 ? "s" : ""}</div>
                <div style={{ fontWeight: 600 }}>{formatAed(d.fils)}</div>
                <div style={{ fontSize: 11, color: "#9aa3b2" }}>{d.pct.toFixed(1)}%</div>
              </div>
            );
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
