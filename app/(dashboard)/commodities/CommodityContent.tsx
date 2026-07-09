"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Commodity } from "@/lib/types";
import { formatAed, formatIsoToUae } from "@/lib/core/units";
import { enrichCommodities } from "@/lib/core/commodity-analytics";
import type { EnrichedCommodity } from "@/lib/core/commodity-analytics";
import CommodityForm from "./CommodityForm";
import CommodityDetailPanel from "./CommodityDetailPanel";
import CommodityMetalCompositionChart from "./charts/CommodityMetalCompositionChart";
import CommodityPLByHoldingChart from "./charts/CommodityPLByHoldingChart";
import CommodityCostVsValueChart from "./charts/CommodityCostVsValueChart";
import CommodityROIChart from "./charts/CommodityROIChart";
import CommodityWeightByMetalChart from "./charts/CommodityWeightByMetalChart";
import AnimateOnScroll from "@/app/components/AnimateOnScroll";
import AnimateChartOnScroll from "@/app/components/AnimateChartOnScroll";
import ConfirmModal from "@/app/components/ConfirmModal";

const METAL_LABEL: Record<string, string> = {
  gold: "Gold",
  silver: "Silver",
  platinum: "Platinum",
  palladium: "Palladium",
  other: "Other",
};

const ALL_METAL_TYPES = ["gold", "silver", "platinum", "palladium", "other"] as const;

type SortCol = "amount" | "date_purchased" | "bought_price" | "value_bought" | "current_price" | "current_value" | "profit_loss" | "profit_loss_pct";

export default function CommodityContent({
  commodities,
  selectedCommodity,
}: {
  commodities: Commodity[];
  selectedCommodity: Commodity | null;
}) {
  const router = useRouter();
  const [metalTypeFilter, setMetalTypeFilter] = useState<Set<string>>(new Set(ALL_METAL_TYPES));
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [exporting, setExporting] = useState(false);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filterOpen) return;
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [filterOpen]);

  const enriched = useMemo(() => enrichCommodities(commodities), [commodities]);

  const isAllSelected = metalTypeFilter.size === ALL_METAL_TYPES.length;

  const filtered = useMemo(() => {
    if (isAllSelected) return enriched;
    return enriched.filter((e) => metalTypeFilter.has(e.commodity.metal_type));
  }, [enriched, metalTypeFilter, isAllSelected]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    const arr = [...filtered];

    const forceBottom = (e: EnrichedCommodity) => !e.hasCurrent;

    arr.sort((a, b) => {
      switch (sortCol) {
        case "amount":
          return (a.grams - b.grams) * dir;
        case "date_purchased":
          return a.commodity.purchase_date.localeCompare(b.commodity.purchase_date) * dir;
        case "bought_price":
          return (a.commodity.bought_price_per_unit_fils - b.commodity.bought_price_per_unit_fils) * dir;
        case "value_bought":
          return (a.costFils - b.costFils) * dir;
        case "current_price": {
          const aUnset = forceBottom(a);
          const bUnset = forceBottom(b);
          if (aUnset && bUnset) return 0;
          if (aUnset) return 1;
          if (bUnset) return -1;
          return (a.commodity.current_price_per_unit_fils - b.commodity.current_price_per_unit_fils) * dir;
        }
        case "current_value": {
          const aUnset = forceBottom(a);
          const bUnset = forceBottom(b);
          if (aUnset && bUnset) return 0;
          if (aUnset) return 1;
          if (bUnset) return -1;
          return (a.valueFils - b.valueFils) * dir;
        }
        case "profit_loss": {
          const aUnset = forceBottom(a);
          const bUnset = forceBottom(b);
          if (aUnset && bUnset) return 0;
          if (aUnset) return 1;
          if (bUnset) return -1;
          return (a.pl - b.pl) * dir;
        }
        case "profit_loss_pct": {
          const aUnset = forceBottom(a);
          const bUnset = forceBottom(b);
          if (aUnset && bUnset) return 0;
          if (aUnset) return 1;
          if (bUnset) return -1;
          const aPct = a.plPct ?? 0;
          const bPct = b.plPct ?? 0;
          return (aPct - bPct) * dir;
        }
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sortCol, sortDir]);

  function handleSelect(id: number) {
    router.push(`/commodities?selected=${id}`);
  }

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        setSortCol(null);
      }
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  function sortArrow(col: SortCol): string {
    if (sortCol !== col) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  function thProps(col: SortCol) {
    return {
      onClick: () => handleSort(col),
      style: { cursor: "pointer", userSelect: "none" as const },
    };
  }

  function toggleMetalType(type: string) {
    setMetalTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/commodities/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      a.download = `commodities-export-${dateStr}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export error:", e);
    } finally {
      setExporting(false);
    }
  }

  function selectAll() {
    setMetalTypeFilter(new Set(ALL_METAL_TYPES));
  }

  function clearAll() {
    setMetalTypeFilter(new Set());
  }

  return (
    <>
      <h2>Commodities</h2>
      <CommodityForm />

      {commodities.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 24 }}>
          <AnimateOnScroll><div className="card">
            <h4 style={{ marginTop: 0 }}>Portfolio by Metal</h4>
            <AnimateChartOnScroll><CommodityMetalCompositionChart enriched={enriched} /></AnimateChartOnScroll>
          </div></AnimateOnScroll>
          <AnimateOnScroll><div className="card">
            <h4 style={{ marginTop: 0 }}>Weight by Metal</h4>
            <AnimateChartOnScroll><CommodityWeightByMetalChart enriched={enriched} /></AnimateChartOnScroll>
          </div></AnimateOnScroll>
          <AnimateOnScroll><div className="card">
            <h4 style={{ marginTop: 0 }}>P&L by Holding</h4>
            <AnimateChartOnScroll><CommodityPLByHoldingChart enriched={enriched} /></AnimateChartOnScroll>
          </div></AnimateOnScroll>
          <AnimateOnScroll><div className="card">
            <h4 style={{ marginTop: 0 }}>Cost vs Current Value</h4>
            <AnimateChartOnScroll><CommodityCostVsValueChart enriched={enriched} /></AnimateChartOnScroll>
          </div></AnimateOnScroll>
          <AnimateOnScroll><div className="card" style={{ gridColumn: "1 / -1" }}>
            <h4 style={{ marginTop: 0 }}>ROI % by Holding</h4>
            <AnimateChartOnScroll><CommodityROIChart enriched={enriched} /></AnimateChartOnScroll>
          </div></AnimateOnScroll>
        </div>
      )}

      <div>
        <AnimateOnScroll><div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 0 }}>
            <h3 style={{ margin: 0 }}>My Holdings ({commodities.length})</h3>
            <button
              onClick={() => setShowExportConfirm(true)}
              disabled={exporting}
              style={{ marginTop: 0, fontSize: 13, padding: "4px 12px" }}
            >
              {exporting ? "Exporting..." : "Export"}
            </button>
          </div>
          {sorted.length === 0 ? (
            <p className="muted">
              {commodities.length === 0
                ? "No commodities yet. Add one above."
                : "No holdings match this filter."}
            </p>
            ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ minWidth: 1100 }}>
                <thead>
                  <tr>
                    <th className="sticky-name" style={{ minWidth: 120, whiteSpace: "nowrap" }}>
                      <div ref={filterRef} style={{ position: "relative", display: "inline-block" }}>
                        <button
                          type="button"
                          onClick={() => setFilterOpen((p) => !p)}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "inherit",
                            fontSize: "inherit",
                            fontWeight: "inherit",
                            cursor: "pointer",
                            padding: 0,
                            margin: 0,
                          }}
                        >
                          Type ▾
                        </button>
                        {filterOpen && (
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              zIndex: 20,
                              background: "var(--panel)",
                              border: "1px solid var(--border)",
                              borderRadius: 6,
                              padding: "6px 0",
                              minWidth: 150,
                              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                            }}
                          >
                            <button
                              type="button"
                              onClick={selectAll}
                              style={dropdownBtnStyle}
                            >
                              ✓ Select All
                            </button>
                            <button
                              type="button"
                              onClick={clearAll}
                              style={dropdownBtnStyle}
                            >
                              ✗ Clear All
                            </button>
                            <hr style={{ margin: "4px 8px", borderColor: "var(--border)" }} />
                            {ALL_METAL_TYPES.map((mt) => (
                              <button
                                key={mt}
                                type="button"
                                onClick={() => toggleMetalType(mt)}
                                style={{
                                  ...dropdownBtnStyle,
                                  fontWeight: metalTypeFilter.has(mt) ? 600 : 400,
                                }}
                              >
                                {metalTypeFilter.has(mt) ? "✓ " : "  "}
                                {METAL_LABEL[mt]}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </th>
                    <th {...thProps("amount")} style={{ minWidth: 110, whiteSpace: "nowrap" }}>Amount{sortArrow("amount")}</th>
                    <th {...thProps("date_purchased")} style={{ minWidth: 130, whiteSpace: "nowrap" }}>Date{sortArrow("date_purchased")}</th>
                    <th {...thProps("bought_price")} style={{ minWidth: 120, whiteSpace: "nowrap" }}>Bought{sortArrow("bought_price")}</th>
                    <th {...thProps("value_bought")} style={{ minWidth: 120, whiteSpace: "nowrap" }}>Cost{sortArrow("value_bought")}</th>
                    <th style={{ minWidth: 120, whiteSpace: "nowrap" }}>Target /unit</th>
                    <th style={{ minWidth: 110, whiteSpace: "nowrap" }}>Target %</th>
                    <th {...thProps("current_price")} style={{ minWidth: 120, whiteSpace: "nowrap" }}>Current{sortArrow("current_price")}</th>
                    <th {...thProps("current_value")} style={{ minWidth: 120, whiteSpace: "nowrap" }}>Value{sortArrow("current_value")}</th>
                    <th {...thProps("profit_loss")} style={{ minWidth: 110, whiteSpace: "nowrap" }}>P/L{sortArrow("profit_loss")}</th>
                    <th {...thProps("profit_loss_pct")} style={{ minWidth: 90, whiteSpace: "nowrap" }}>P/L %{sortArrow("profit_loss_pct")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((e) => {
                    const c = e.commodity;
                    const isSelected = selectedCommodity?.id === c.id;
                    const targetPct = c.target_sell_price_per_unit_fils != null && c.target_sell_price_per_unit_fils > 0 && c.bought_price_per_unit_fils > 0
                      ? ((c.target_sell_price_per_unit_fils - c.bought_price_per_unit_fils) / c.bought_price_per_unit_fils) * 100
                      : null;

                    return (
                      <tr
                        key={c.id}
                        className={isSelected ? "selected-row" : undefined}
                      >
                        <td className="sticky-name">
                          <a
                            href="#"
                            onClick={(ev) => {
                              ev.preventDefault();
                              handleSelect(c.id);
                            }}
                            className="property-link"
                          >
                            {METAL_LABEL[c.metal_type] ?? c.metal_type}
                          </a>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {c.weight} {c.weight_unit}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>{formatIsoToUae(c.purchase_date)}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {formatAed(c.bought_price_per_unit_fils)}/{c.weight_unit}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>{formatAed(e.costFils)}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {c.target_sell_price_per_unit_fils != null && c.target_sell_price_per_unit_fils > 0
                            ? `${formatAed(c.target_sell_price_per_unit_fils)}/${c.weight_unit}`
                            : "—"}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {targetPct !== null ? (
                            <span style={{ color: "var(--good)" }}>+{targetPct.toFixed(1)}%</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {c.current_price_per_unit_fils > 0
                            ? `${formatAed(c.current_price_per_unit_fils)}/${c.weight_unit}`
                            : "—"}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {c.current_price_per_unit_fils > 0
                            ? formatAed(e.valueFils)
                            : "—"}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {e.hasCurrent ? (
                            <span style={{ color: e.pl >= 0 ? "var(--good)" : "var(--bad)" }}>
                              {e.pl >= 0 ? "+" : "−"}
                              {formatAed(Math.abs(e.pl))}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {e.plPct !== null ? (
                            <span style={{ color: e.plPct >= 0 ? "var(--good)" : "var(--bad)" }}>
                              {e.plPct >= 0 ? "+" : ""}
                              {e.plPct.toFixed(1)}%
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div></AnimateOnScroll>

        {selectedCommodity && (
          <div style={{ marginTop: 18 }}>
            <CommodityDetailPanel
              key={selectedCommodity.id}
              commodity={selectedCommodity}
            />
          </div>
        )}
      </div>
      {showExportConfirm && (
        <ConfirmModal
          title="Export Data"
          message="Are you sure you want to export commodities data?"
          confirmLabel="Export"
          onConfirm={() => {
            handleExport();
            setShowExportConfirm(false);
          }}
          onCancel={() => setShowExportConfirm(false)}
        />
      )}
    </>
  );
}

const dropdownBtnStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  border: "none",
  background: "transparent",
  color: "inherit",
  fontSize: 13,
  cursor: "pointer",
  padding: "4px 12px",
  margin: 0,
};
