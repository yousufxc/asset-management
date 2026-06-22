"use client";

import { useMemo } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import type { Property, Installment } from "@/lib/types";
import { projectCashFlow } from "@/lib/core/property-analytics";
import { formatAed } from "@/lib/core/units";

const tooltipStyle = { backgroundColor: "#1f232c", border: "1px solid #2a2f3a", borderRadius: 8, padding: "10px 14px", fontSize: 13 };

interface Props { properties: Property[]; installments: Installment[] }

export default function CashFlowTimelineChart({ properties, installments }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const data = useMemo(() => {
    const months = projectCashFlow(properties, installments, 24, today);
    return months.map((m) => ({
      month: m.month,
      label: new Date(m.month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      inflow: m.rentalInflow,
      outflow: m.instalmentOutflow,
      net: m.netFlow,
    }));
  }, [properties, installments, today]);

  if (data.every((d) => d.inflow === 0 && d.outflow === 0)) {
    return <p className="muted">No upcoming cash flow to project.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 20, bottom: 4, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatAed(v).replace("AED ", "")} width={70} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const d = payload[0].payload;
            return (
              <div style={tooltipStyle}>
                <div style={{ color: "#9aa3b2", marginBottom: 4 }}>{d.month}</div>
                <div style={{ color: "#38c172" }}>Inflow: {formatAed(d.inflow)}</div>
                <div style={{ color: "#e74c3c" }}>Outflow: {formatAed(d.outflow)}</div>
                <div style={{ fontWeight: 600, marginTop: 4 }}>Net: {formatAed(d.net)}</div>
              </div>
            );
          }}
        />
        <Legend />
        <Bar dataKey="inflow" fill="#38c172" name="Rental Inflow" stackId="a" />
        <Bar dataKey="outflow" fill="#e74c3c" name="Instalment Outflow" stackId="b" />
        <Line type="monotone" dataKey="net" stroke="#4f9cf9" name="Net" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
