"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { PropertyMaintenance } from "@/lib/types";
import { formatAed } from "@/lib/core/units";
import { yearlyMaintenanceBuckets } from "@/lib/core/property-analytics";

interface Props {
  maintenance: PropertyMaintenance[];
}

const tooltipStyle = {
  backgroundColor: "#1f232c",
  border: "1px solid #2a2f3a",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 13,
};

export default function PropertyMaintenanceChart({ maintenance }: Props) {
  const buckets = useMemo(() => yearlyMaintenanceBuckets(maintenance), [maintenance]);

  if (buckets.length === 0) {
    return <p className="muted">No maintenance records to chart.</p>;
  }

  const chartHeight = Math.max(160, 200);

  return (
    <div style={{ marginBottom: 12 }}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={buckets} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => {
              const aed = v / 100;
              if (aed >= 1000) return `${(aed / 1000).toFixed(1)}K`;
              return String(Math.round(aed));
            }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload;
              return (
                <div style={tooltipStyle}>
                  <div style={{ color: "#9aa3b2", marginBottom: 2 }}>{d.year}</div>
                  <div style={{ fontWeight: 600 }}>{formatAed(d.totalFils)}</div>
                  <div style={{ color: "#9aa3b2", fontSize: 11, marginTop: 4 }}>
                    {d.count} entr{d.count === 1 ? "y" : "ies"}
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="totalFils" fill="#e67e22" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
