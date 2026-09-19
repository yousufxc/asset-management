"use client";

import { useMemo, useState } from "react";
import type { Property, Installment, Mortgage } from "@/lib/types";
import { formatAed, formatAedShort, formatIsoToUae } from "@/lib/core/units";
import {
  buildUnifiedPayments,
  computeKpiTotals,
  groupTimeline,
  kpiMatches,
  KPI_LABEL,
  type KpiKey,
  type TimelineGroup,
  TIMELINE_GROUPS,
  GROUP_LABEL,
} from "@/lib/core/instalment-grouping";
import { MarkPaidButton, MarkUnpaidButton } from "./InstallmentActions";
import AnimateOnScroll from "@/app/components/AnimateOnScroll";

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

  const propertyById = useMemo(() => {
    const m = new Map<number, Property>();
    for (const p of properties) m.set(p.id, p);
    return m;
  }, [properties]);

  const unified = useMemo(
    () => buildUnifiedPayments(installments, mortgages, asOfIso),
    [installments, mortgages, asOfIso],
  );

  const kpis = useMemo(() => computeKpiTotals(unified, asOfIso), [unified, asOfIso]);

  const filtered = useMemo(() => {
    return unified.filter((p) => {
      if (propertyFilter !== null && p.propertyId !== propertyFilter) return false;
      if (typeFilter !== "all" && p.type !== typeFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (kpiFilter !== null && !kpiMatches(kpiFilter, p, asOfIso)) return false;
      return true;
    });
  }, [unified, propertyFilter, typeFilter, statusFilter, kpiFilter, asOfIso]);

  const grouped = useMemo(() => groupTimeline(filtered, asOfIso), [filtered, asOfIso]);

  const filterablePropertyIds = useMemo(() => {
    const ids = new Set(unified.map((p) => p.propertyId));
    return [...ids]
      .map((id) => propertyById.get(id))
      .filter((p): p is Property => p !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [unified, propertyById]);

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
            const header = sectionHeader(group, rows);
            const body = (
              <div>
                {rows.map((p, i) => paymentRow(p, i === rows.length - 1))}
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
    </>
  );
}
