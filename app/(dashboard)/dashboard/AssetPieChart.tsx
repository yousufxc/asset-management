"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { PieLabelRenderProps } from "recharts";
import { formatAed } from "@/lib/core/units";
import AnimateOnScroll from "@/app/components/AnimateOnScroll";

export interface Slice {
  name: string;
  value: number;
}

const COLORS = ["#f0a020", "#38c172", "#4f9cf9"];

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  if (!entry) return null;
  return (
    <div
      style={{
        backgroundColor: "#1f232c",
        border: "1px solid #2a2f3a",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 13,
      }}
    >
      <div style={{ color: "#9aa3b2", marginBottom: 2 }}>{entry.name}</div>
      <div style={{ fontWeight: 600 }}>{formatAed(entry.value)}</div>
    </div>
  );
}

function renderCustomLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: PieLabelRenderProps) {
  if (
    cx === undefined ||
    cy === undefined ||
    midAngle === undefined ||
    innerRadius === undefined ||
    outerRadius === undefined ||
    percent === undefined
  ) {
    return null;
  }
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null;

  return (
    <text
      x={x}
      y={y}
      fill="#e6e8ec"
      textAnchor="middle"
      dominantBaseline="central"
      style={{ fontSize: 13, fontWeight: 600 }}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export default function AssetPieChart({ data }: { data: Slice[] }) {
  const totalFils = data.reduce((sum, d) => sum + d.value, 0);
  if (totalFils === 0) {
    return (
      <AnimateOnScroll><div className="card">
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Portfolio allocation</h3>
        <p className="muted">No capital data available yet. Add assets to see the allocation breakdown.</p>
      </div></AnimateOnScroll>
    );
  }

  return (
    <AnimateOnScroll><div className="card">
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>Portfolio allocation</h3>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={110}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              label={renderCustomLabel}
              labelLine={false}
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 140 }}>
          {data.map((slice, index) => (
            <div key={slice.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  backgroundColor: COLORS[index % COLORS.length],
                  flexShrink: 0,
                }}
              />
              <div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {slice.name}
                </div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {formatAed(slice.value)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div></AnimateOnScroll>
  );
}
