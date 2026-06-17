"use client";

import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { Installment, Property } from "@/lib/types";
import { cumulativeInstallmentSchedule } from "@/lib/core/property-analytics";
import { formatAed, formatIsoToUae } from "@/lib/core/units";

const tooltipStyle = { backgroundColor: "#1f232c", border: "1px solid #2a2f3a", borderRadius: 8, padding: "10px 14px", fontSize: 13 };

interface Props { installments: Installment[] }

export default function InstallmentTimelineChart({ installments }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const data = useMemo(() => {
    return cumulativeInstallmentSchedule(installments, today)
      .map((p) => ({ date: formatIsoToUae(p.dueDate), cumulative: p.cumulativeFils }));
  }, [installments, today]);

  if (data.length === 0) return <p className="muted">No upcoming installments to chart.</p>;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 20, bottom: 4, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatAed(v).replace("AED ", "")} width={70} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const d = payload[0].payload;
            return (<div style={tooltipStyle}><div style={{ color: "#9aa3b2", marginBottom: 2 }}>{d.date}</div><div style={{ fontWeight: 600 }}>{formatAed(d.cumulative)}</div></div>);
          }}
        />
        <Area type="monotone" dataKey="cumulative" stroke="#4f9cf9" fill="#4f9cf9" fillOpacity={0.15} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
