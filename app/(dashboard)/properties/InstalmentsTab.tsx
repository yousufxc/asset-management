"use client";

import { useEffect, useMemo, useState } from "react";
import type { Property, Installment, Mortgage } from "@/lib/types";
import { formatAed, formatAedShort, formatIsoToUae } from "@/lib/core/units";
import {
  buildUnifiedPayments,
  computeKpiTotals,
  dropdownMatches,
  groupTimeline,
  kpiMatches,
  KPI_LABEL,
  type KpiKey,
  type TimelineGroup,
  type UnifiedPayment,
  TIMELINE_GROUPS,
  GROUP_LABEL,
} from "@/lib/core/instalment-grouping";
import { MarkPaidButton, MarkUnpaidButton } from "./InstallmentActions";
import AnimateOnScroll from "@/app/components/AnimateOnScroll";
import ConfirmModal from "@/app/components/ConfirmModal";

const typeBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 12,
  background: "var(--panel-2)",
  color: "var(--muted)",
  border: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

type TypeFilter = "all" | "installment" | "mortgage";
type StatusFilter = "all" | "overdue" | "upcoming" | "paid";

const PAGE_SIZE = 20;

const DEFAULT_VISIBLE: Record<TimelineGroup, number> = {
  overdue: PAGE_SIZE,
  due_this_month: PAGE_SIZE,
  next_30: PAGE_SIZE,
  next_60_90: PAGE_SIZE,
  beyond_90: PAGE_SIZE,
  paid: PAGE_SIZE,
};

export type MortgageRunItem =
  | { kind: "single"; payment: UnifiedPayment }
  | {
      kind: "group";
      groupKey: string;
      propertyId: number;
      lenderName: string;
      count: number;
      monthlyFils: number;
      totalFils: number;
      payments: UnifiedPayment[];
    };

function mortgageIdOf(p: UnifiedPayment): number | null {
  const m = /^m(\d+)-/.exec(p.key);
  return m ? Number(m[1]) : null;
}

/**
 * Collapse 3+ consecutive payments of the SAME mortgage (same mortgage id,
 * property, lender and amount) into a summary item. Instalments are never
 * collapsed. Rendering-level only — the data model is unchanged.
 */
export function groupMortgageRuns(rows: UnifiedPayment[]): MortgageRunItem[] {
  const items: MortgageRunItem[] = [];
  let i = 0;
  while (i < rows.length) {
    const p = rows[i]!;
    if (p.type === "mortgage") {
      const mid = mortgageIdOf(p);
      let j = i + 1;
      if (mid !== null) {
        while (
          j < rows.length &&
          rows[j]!.type === "mortgage" &&
          mortgageIdOf(rows[j]!) === mid &&
          rows[j]!.propertyId === p.propertyId &&
          rows[j]!.lenderName === p.lenderName &&
          rows[j]!.amountFils === p.amountFils
        ) j++;
      }
      if (j - i >= 3) {
        const run = rows.slice(i, j);
        items.push({
          kind: "group",
          groupKey: `${mid}-${p.propertyId}-${p.lenderName}-${p.amountFils}`,
          propertyId: p.propertyId,
          lenderName: p.lenderName ?? "",
          count: run.length,
          monthlyFils: p.amountFils,
          totalFils: run.reduce((s, x) => s + x.amountFils, 0),
          payments: run,
        });
        i = j;
        continue;
      }
    }
    items.push({ kind: "single", payment: p });
    i++;
  }
  return items;
}

export default function InstalmentsTab({
  properties,
  installments,
  mortgages,
  asOfIso,
  onSelectProperty,
}: {
  properties: Property[];
  installments: Installment[];
  mortgages: Mortgage[];
  asOfIso: string;
  onSelectProperty: (id: number) => void;
}) {
  const [propertyFilter, setPropertyFilter] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [kpiFilter, setKpiFilter] = useState<KpiKey | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [visibleCounts, setVisibleCounts] = useState<Record<TimelineGroup, number>>({ ...DEFAULT_VISIBLE });
  const [expandedMortgages, setExpandedMortgages] = useState<Set<string>>(new Set());

  const propertyById = useMemo(() => {
    const m = new Map<number, Property>();
    for (const p of properties) m.set(p.id, p);
    return m;
  }, [properties]);

  const unified = useMemo(
    () => buildUnifiedPayments(installments, mortgages, asOfIso),
    [installments, mortgages, asOfIso],
  );

  // KPIs respond to the three dropdown filters, but NOT to the KPI-card click
  // filter — clicking a KPI card only narrows the timeline (show-your-work).
  const dropdownFiltered = useMemo(() => {
    return unified.filter((p) =>
      dropdownMatches(p, { propertyId: propertyFilter, type: typeFilter, status: statusFilter }),
    );
  }, [unified, propertyFilter, typeFilter, statusFilter]);

  const kpis = useMemo(() => computeKpiTotals(dropdownFiltered, asOfIso), [dropdownFiltered, asOfIso]);

  const filtered = useMemo(() => {
    if (kpiFilter === null) return dropdownFiltered;
    return dropdownFiltered.filter((p) => kpiMatches(kpiFilter, p, asOfIso));
  }, [dropdownFiltered, kpiFilter, asOfIso]);

  const grouped = useMemo(() => groupTimeline(filtered, asOfIso), [filtered, asOfIso]);

  // Pagination restarts whenever the visible payment set changes (filters,
  // data refresh after mark-paid, etc.).
  useEffect(() => {
    setVisibleCounts({ ...DEFAULT_VISIBLE });
    setExpandedMortgages(new Set());
  }, [filtered]);

  const filterablePropertyIds = useMemo(() => {
    const ids = new Set(unified.map((p) => p.propertyId));
    return [...ids]
      .map((id) => propertyById.get(id))
      .filter((p): p is Property => p !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [unified, propertyById]);

  const filtersActive =
    propertyFilter !== null || typeFilter !== "all" || statusFilter !== "all" || kpiFilter !== null;

  function clearAllFilters() {
    setPropertyFilter(null);
    setTypeFilter("all");
    setStatusFilter("all");
    setKpiFilter(null);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/instalments/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      a.download = `instalments-export-${dateStr}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export error:", e);
    } finally {
      setExporting(false);
    }
  }

  const kpiCards: { key: KpiKey; total: { amountFils: number; count: number }; color: string }[] = [
    { key: "overdue", total: kpis.overdue, color: "var(--bad)" },
    { key: "due_this_month", total: kpis.dueThisMonth, color: "var(--warn)" },
    { key: "next_90", total: kpis.dueNext90, color: "var(--accent)" },
    { key: "remaining", total: kpis.remaining, color: "var(--text)" },
  ];

  function propertyName(id: number): string {
    return propertyById.get(id)?.name ?? `Property #${id}`;
  }

  function sectionHeader(group: TimelineGroup, rows: typeof grouped.overdue): React.ReactNode {
    const total = rows.reduce((s, p) => s + p.amountFils, 0);
    const color = group === "overdue" ? "var(--bad)" : "var(--text)";
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
        <h4 style={{ margin: 0, color }}>{GROUP_LABEL[group]} ({rows.length})</h4>
        <span style={{ fontWeight: 700, color }}>{formatAed(total)}</span>
      </div>
    );
  }

  function paymentRow(p: (typeof unified)[number], isLast: boolean) {
    return (
      <div
        key={p.key}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          padding: "8px 0",
          borderBottom: isLast ? "none" : "1px solid var(--border)",
        }}
      >
        <div style={{ flex: 2, minWidth: 160 }}>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onSelectProperty(p.propertyId);
            }}
            className="property-link"
            style={{ fontWeight: 600 }}
          >
            {propertyName(p.propertyId)}
          </a>
          {(p.type === "installment" ? p.milestoneLabel : p.lenderName) && (
            <div className="muted" style={{ fontSize: 12 }}>
              {p.type === "installment" ? p.milestoneLabel : p.lenderName}
            </div>
          )}
        </div>
        <span style={typeBadgeStyle}>{p.type === "installment" ? "Instalment" : "Mortgage"}</span>
        <span style={{ minWidth: 88 }}>{formatIsoToUae(p.dueDate)}</span>
        <span style={{ minWidth: 110, textAlign: "right", fontWeight: 600 }}>{formatAed(p.amountFils)}</span>
        <span className={`pill ${p.status}`}>{p.status}</span>
        {p.installmentId !== null && (
          p.status === "paid"
            ? <MarkUnpaidButton installmentId={p.installmentId} />
            : <MarkPaidButton installmentId={p.installmentId} />
        )}
      </div>
    );
  }

  function mortgageSummaryRow(item: Extract<MortgageRunItem, { kind: "group" }>, group: TimelineGroup, isLast: boolean) {
    const groupKey = `${group}|${item.groupKey}`;
    const expanded = expandedMortgages.has(groupKey);
    return (
      <div
        key={`g-${groupKey}`}
        style={{ padding: "8px 0", borderBottom: isLast ? "none" : "1px solid var(--border)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 2, minWidth: 160 }}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onSelectProperty(item.propertyId);
              }}
              className="property-link"
              style={{ fontWeight: 600 }}
            >
              {propertyName(item.propertyId)}
            </a>
            <div className="muted" style={{ fontSize: 12 }}>{item.lenderName}</div>
          </div>
          <span style={typeBadgeStyle}>Mortgage</span>
          <span className="muted" style={{ minWidth: 88 }}>
            {formatIsoToUae(item.payments[0]!.dueDate)}–{formatIsoToUae(item.payments[item.payments.length - 1]!.dueDate)}
          </span>
          <span style={{ fontWeight: 600 }}>
            {item.count} payments × {formatAed(item.monthlyFils)}/month — Total: {formatAed(item.totalFils)}
          </span>
          <button
            type="button"
            onClick={() =>
              setExpandedMortgages((prev) => {
                const next = new Set(prev);
                if (next.has(groupKey)) next.delete(groupKey);
                else next.add(groupKey);
                return next;
              })
            }
            style={{
              background: "transparent",
              color: "var(--muted)",
              border: "none",
              margin: 0,
              padding: "2px 8px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {expanded ? "Hide" : `Show ${item.count}`}
          </button>
        </div>
        {expanded && (
          <div style={{ marginTop: 4, paddingLeft: 12, borderLeft: "2px solid var(--border)" }}>
            {item.payments.map((p, i) => paymentRow(p, i === item.payments.length - 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        {kpiCards.map(({ key, total, color }) => (
          <AnimateOnScroll key={key}>
            <div
              className={kpiFilter === key ? "card kpi-clickable active" : "card kpi-clickable"}
              style={{ flex: 1, minWidth: 160 }}
              onClick={() => setKpiFilter((prev) => (prev === key ? null : key))}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setKpiFilter((prev) => (prev === key ? null : key));
                }
              }}
            >
              <div className="muted" style={{ fontSize: 13 }}>{KPI_LABEL[key]}</div>
              <div
                style={{ fontSize: 22, fontWeight: 700, color }}
                title={formatAed(total.amountFils)}
              >
                {formatAedShort(total.amountFils)}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                {total.count} payment{total.count === 1 ? "" : "s"}
              </div>
            </div>
          </AnimateOnScroll>
        ))}
      </div>

      <AnimateOnScroll><div className="card" style={{ padding: "12px 20px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 4 }}>
          {filtersActive && (
            <button
              type="button"
              onClick={clearAllFilters}
              style={{
                background: "transparent",
                color: "var(--muted)",
                border: "none",
                margin: 0,
                padding: "4px 12px",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Clear Filters
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowExportConfirm(true)}
            disabled={exporting}
            style={{ margin: 0, fontSize: 13, padding: "4px 12px" }}
          >
            {exporting ? "Exporting..." : "Export"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label>Property</label>
            <select
              value={propertyFilter ?? ""}
              onChange={(e) => setPropertyFilter(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">All Properties</option>
              {filterablePropertyIds.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label>Payment Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}>
              <option value="all">All</option>
              <option value="installment">Instalments</option>
              <option value="mortgage">Mortgage Payments</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label>Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="all">All</option>
              <option value="overdue">Overdue</option>
              <option value="upcoming">Upcoming</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </div>
      </div></AnimateOnScroll>

      {unified.length === 0 ? (
        <p className="muted">No instalments or mortgage payments yet.</p>
      ) : filtered.length === 0 ? (
        <p className="muted">No payments match your filters.</p>
      ) : (
        <AnimateOnScroll><div className="card">
          {TIMELINE_GROUPS.map((group) => {
            const rows = grouped[group];
            if (rows.length === 0) return null;
            const items = groupMortgageRuns(rows);
            const visibleItems = items.slice(0, visibleCounts[group]);
            const remaining = items.length - visibleItems.length;
            const header = sectionHeader(group, rows);
            const body = (
              <div>
                {visibleItems.map((item, i) => {
                  const isLast = i === visibleItems.length - 1 && remaining === 0;
                  return item.kind === "single"
                    ? paymentRow(item.payment, isLast)
                    : mortgageSummaryRow(item, group, isLast);
                })}
                {remaining > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleCounts((prev) => ({ ...prev, [group]: prev[group] + PAGE_SIZE }))
                    }
                    style={{
                      display: "block",
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      color: "var(--muted)",
                      margin: "8px 0 0",
                      padding: "6px 12px",
                      fontSize: 13,
                      fontWeight: 600,
                      textAlign: "center",
                    }}
                  >
                    Show more ({remaining} remaining)
                  </button>
                )}
              </div>
            );
            const collapsible = group === "paid" || group === "beyond_90";
            const wrapperStyle: React.CSSProperties = group === "paid" ? { opacity: 0.6 } : {};
            if (collapsible) {
              return (
                <details key={group} style={wrapperStyle}>
                  <summary style={{ cursor: "pointer", listStyle: "none" }}>{header}</summary>
                  {body}
                </details>
              );
            }
            return (
              <div key={group} style={wrapperStyle}>
                {header}
                {body}
              </div>
            );
          })}
        </div></AnimateOnScroll>
      )}

      {showExportConfirm && (
        <ConfirmModal
          title="Export Data"
          message="Are you sure you want to export instalments data?"
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
