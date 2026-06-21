"use client";

import { useState } from "react";
import type {
  Recommendation,
  SellCommodityMove,
  SimulatedImpact,
} from "@/lib/core/recommendations";
import { simulateImpact } from "@/lib/core/recommendations";
import type { RunwayInput } from "@/lib/core/runway";
import { formatAed, formatIsoToUae } from "@/lib/core/units";
import AnimateOnScroll from "@/app/components/AnimateOnScroll";

interface Props {
  recommendations: Recommendation[];
  runwayInput: RunwayInput;
}

const TYPE_LABELS: Record<string, string> = {
  sell_commodity: "Sell Asset",
  matured_deposit: "Matured Deposit",
  rental_surplus: "Rental Surplus",
  cash_gap: "Cash Shortfall",
};

const PRIORITY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  critical: { bg: "rgba(220,53,69,0.08)", border: "var(--bad)", text: "var(--bad)" },
  high: { bg: "rgba(240,160,32,0.08)", border: "var(--warn)", text: "var(--warn)" },
  medium: { bg: "rgba(79,156,249,0.06)", border: "var(--accent)", text: "var(--accent)" },
};

export default function RecommendedMoves({ recommendations, runwayInput }: Props) {
  if (recommendations.length === 0) {
    return (
      <AnimateOnScroll>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Recommended Moves</h3>
          <p className="muted" style={{ fontStyle: "italic" }}>
            No recommendations at this time — your assets are in good shape or no data is available yet.
          </p>
        </div>
      </AnimateOnScroll>
    );
  }

  return (
    <AnimateOnScroll>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Recommended Moves</h3>
        <p className="muted" style={{ fontSize: 13, margin: "0 0 16px" }}>
          Cross-category financial moves to help your assets sustain themselves.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {recommendations.map((rec) => (
            <RecCard key={recKey(rec)} rec={rec} runwayInput={runwayInput} />
          ))}
        </div>
      </div>
    </AnimateOnScroll>
  );
}

function RecCard({ rec, runwayInput }: { rec: Recommendation; runwayInput: RunwayInput }) {
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState<SimulatedImpact | null>(null);
  const [loading, setLoading] = useState(false);
  const colors = PRIORITY_COLORS[rec.priority]!;

  const isSimulatable = rec.type === "sell_commodity";

  const handlePreview = () => {
    if (preview) {
      setPreview(null);
      setExpanded(false);
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const impact = simulateImpact(rec as SellCommodityMove, runwayInput);
      setPreview(impact);
      setLoading(false);
      setExpanded(true);
    }, 50); // tiny delay so state flush is visible
  };

  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        padding: "10px 14px",
        background: colors.bg,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                color: colors.text,
                background: "transparent",
                border: `1px solid ${colors.border}`,
                borderRadius: 4,
                padding: "1px 6px",
              }}
            >
              {rec.priority}
            </span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {TYPE_LABELS[rec.type] ?? rec.type}
            </span>
          </div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{rec.title}</div>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
            {rec.description}
          </p>
        </div>
        {isSimulatable && (
          <button
            onClick={handlePreview}
            disabled={loading}
            style={{
              marginTop: 0,
              fontSize: 12,
              padding: "5px 10px",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {loading ? "..." : preview ? "Close preview" : "Preview impact"}
          </button>
        )}
      </div>

      {expanded && preview && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "var(--panel-2)",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <table style={{ width: "100%" }}>
            <thead>
              <tr>
                <th></th>
                <th>Before</th>
                <th>After</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ color: "var(--muted)" }}>Liquid cash</td>
                <td>{formatAed(preview.before.liquidCashFils)}</td>
                <td>{formatAed(preview.after.liquidCashFils)}</td>
                <td style={{ color: "var(--good)" }}>
                  +{formatAed(preview.after.liquidCashFils - preview.before.liquidCashFils)}
                </td>
              </tr>
              <tr>
                <td style={{ color: "var(--muted)" }}>Shortfall</td>
                <td>
                  {preview.before.shortfallDate
                    ? `${formatAed(preview.before.worstShortfallFils)} on ${formatIsoToUae(preview.before.shortfallDate)}`
                    : "None"}
                </td>
                <td>
                  {preview.after.shortfallDate
                    ? `${formatAed(preview.after.worstShortfallFils)} on ${formatIsoToUae(preview.after.shortfallDate)}`
                    : "None"}
                </td>
                <td>
                  {!preview.before.shortfallDate ? (
                    <span style={{ color: "var(--muted)" }}>—</span>
                  ) : !preview.after.shortfallDate ? (
                    <span style={{ color: "var(--good)" }}>Shortfall eliminated</span>
                  ) : (
                    <span style={{ color: "var(--good)" }}>
                      -{formatAed(preview.before.worstShortfallFils - preview.after.worstShortfallFils)}
                    </span>
                  )}
                </td>
              </tr>
              <tr>
                <td style={{ color: "var(--muted)" }}>Days until shortfall</td>
                <td>
                  {preview.before.daysUntilShortfall != null
                    ? `${preview.before.daysUntilShortfall} days`
                    : "N/A"}
                </td>
                <td>
                  {preview.after.daysUntilShortfall != null
                    ? `${preview.after.daysUntilShortfall} days`
                    : "N/A"}
                </td>
                <td>
                  {preview.before.daysUntilShortfall != null &&
                  preview.after.daysUntilShortfall != null ? (
                    <span style={{ color: "var(--good)" }}>
                      +{preview.after.daysUntilShortfall - preview.before.daysUntilShortfall} days
                    </span>
                  ) : preview.after.daysUntilShortfall === null &&
                    preview.before.daysUntilShortfall !== null ? (
                    <span style={{ color: "var(--good)" }}>
                      Shortfall eliminated
                    </span>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>—</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function recKey(rec: Recommendation): string {
  switch (rec.type) {
    case "sell_commodity":
      return `sell-${rec.commodityId}`;
    case "matured_deposit":
      return `matured-${rec.accountId}`;
    case "rental_surplus":
      return `rental-${rec.propertyId}`;
    case "cash_gap":
      return "cash-gap";
  }
}
