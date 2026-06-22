"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { CashAccount } from "@/lib/types";
import { splitFixedVsRegular } from "@/lib/core/cash-analytics";
import { formatAed } from "@/lib/core/units";

interface Slice {
  name: string;
  fils: number;
  pct: number;
}

const COLORS = ["#1f77b4", "#aec7e8"];
const tooltipStyle = { backgroundColor: "#1f232c", border: "1px solid #2a2f3a", borderRadius: 8, padding: "10px 14px", fontSize: 13 };

export default function CashCompositionChart({ accounts }: { accounts: CashAccount[] }) {
  const { fixedFils, regularFils } = splitFixedVsRegular(accounts);
  const total = fixedFils + regularFils;
  if (total === 0) return <p className="muted">No cash balance to display.</p>;

  const data: Slice[] = [
    { name: "Fixed Deposit", fils: fixedFils, pct: total > 0 ? (fixedFils / total) * 100 : 0 },
    { name: "Regular", fils: regularFils, pct: total > 0 ? (regularFils / total) * 100 : 0 },
  ];

  return (
    <>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="fils"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={100}
            paddingAngle={3}
            stroke="var(--panel)"
            strokeWidth={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i]} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as Slice;
              return (
                <div style={tooltipStyle}>
                  <div style={{ color: "#9aa3b2", marginBottom: 2 }}>{d.name}</div>
                  <div style={{ fontWeight: 600 }}>{formatAed(d.fils)}</div>
                  <div style={{ fontSize: 11, color: "#9aa3b2" }}>{d.pct.toFixed(1)}%</div>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", justifyContent: "center", marginTop: 8 }}>
        {data.map((s, i) => (
          <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", backgroundColor: COLORS[i], flexShrink: 0 }} />
            <span style={{ color: "var(--muted)" }}>{s.name} {s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </>
  );
}
