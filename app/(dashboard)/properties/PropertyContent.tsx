"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Property, Installment } from "@/lib/types";
import { formatAed } from "@/lib/core/units";
import { netAnnualRentFils, appreciationPct, rentalYieldPct } from "@/lib/core/property-analytics";
import PropertyForm from "./PropertyForm";
import PropertyDetailPanel from "./PropertyDetailPanel";
import ValueByPropertyChart from "./charts/ValueByPropertyChart";
import CapitalAppreciationChart from "./charts/CapitalAppreciationChart";
import PortfolioCompositionChart from "./charts/PortfolioCompositionChart";
import RentalIncomeChart from "./charts/RentalIncomeChart";
import InstallmentTimelineChart from "./charts/InstallmentTimelineChart";
import RentalYieldChart from "./charts/RentalYieldChart";
import PricePerSqftChart from "./charts/PricePerSqftChart";

const TYPE_LABEL: Record<string, string> = {
  apartment: "Apartment",
  penthouse: "Penthouse",
  townhouse: "Townhouse",
  villa: "Villa",
};

const ALL_PROPERTY_TYPES = ["apartment", "penthouse", "townhouse", "villa", "unspecified"] as const;

type SortCol = "bought_for" | "current_value" | "capital_appreciation" | "rental_yield" | "annual_profit";

function daysSince(iso: string | null): string {
  if (!iso) return "never valued";
  const then = new Date(`${iso}T00:00:00Z`).getTime();
  const days = Math.floor((Date.now() - then) / 86_400_000);
  return `last valued ${days} day${days === 1 ? "" : "s"} ago`;
}

export default function PropertyContent({
  properties,
  installments,
  selectedProperty,
}: {
  properties: Property[];
  installments: Installment[];
  selectedProperty: Property | null;
}) {
  const router = useRouter();

  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set(ALL_PROPERTY_TYPES));
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
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

  function handleSelect(id: number) {
    router.push(`/properties?selected=${id}`);
  }

  const isAllSelected = typeFilter.size === ALL_PROPERTY_TYPES.length;

  const filtered = useMemo(() => {
    if (isAllSelected) return properties;
    return properties.filter((p) => {
      const key = p.property_type ?? "unspecified";
      return typeFilter.has(key);
    });
  }, [properties, typeFilter, isAllSelected]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    const arr = [...filtered];
    arr.sort((a, b) => {
      switch (sortCol) {
        case "bought_for": {
          const aVal = a.purchase_price_fils ?? 0;
          const bVal = b.purchase_price_fils ?? 0;
          if (aVal === 0 && bVal === 0) return 0;
          if (aVal === 0) return 1;
          if (bVal === 0) return -1;
          return (aVal - bVal) * dir;
        }
        case "current_value": {
          const aVal = a.current_value_fils ?? 0;
          const bVal = b.current_value_fils ?? 0;
          if (aVal === 0 && bVal === 0) return 0;
          if (aVal === 0) return 1;
          if (bVal === 0) return -1;
          return (aVal - bVal) * dir;
        }
        case "capital_appreciation": {
          const aPct = appreciationPct(a);
          const bPct = appreciationPct(b);
          if (aPct === null && bPct === null) return 0;
          if (aPct === null) return 1;
          if (bPct === null) return -1;
          return (aPct - bPct) * dir;
        }
        case "rental_yield": {
          const aPct = rentalYieldPct(a);
          const bPct = rentalYieldPct(b);
          if (aPct === null && bPct === null) return 0;
          if (aPct === null) return 1;
          if (bPct === null) return -1;
          return (aPct - bPct) * dir;
        }
        case "annual_profit": {
          const aVal = netAnnualRentFils(a) ?? 0;
          const bVal = netAnnualRentFils(b) ?? 0;
          if (aVal === 0 && bVal === 0) return 0;
          if (aVal === 0) return 1;
          if (bVal === 0) return -1;
          return (aVal - bVal) * dir;
        }
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sortCol, sortDir]);

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

  function thSortProps(col: SortCol): { onClick: () => void } {
    return { onClick: () => handleSort(col) };
  }

  function toggleType(type: string) {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  function selectAll() {
    setTypeFilter(new Set(ALL_PROPERTY_TYPES));
  }

  function clearAll() {
    setTypeFilter(new Set());
  }

  const portfolioProps = properties.filter((p) => p.current_value_fils !== null && p.current_value_fils > 0);
  const totalPortfolioValue = portfolioProps.reduce((sum, p) => sum + p.current_value_fils!, 0);

  const totalAppreciationFils = portfolioProps.reduce((sum, p) => {
    if (p.purchase_price_fils != null && p.purchase_price_fils > 0) {
      return sum + (p.current_value_fils! - p.purchase_price_fils);
    }
    return sum;
  }, 0);

  const totalPurchaseFils = portfolioProps.reduce((sum, p) => {
    if (p.purchase_price_fils != null && p.purchase_price_fils > 0) {
      return sum + p.purchase_price_fils;
    }
    return sum;
  }, 0);

  const totalAppreciationPct = totalPurchaseFils > 0 ? (totalAppreciationFils / totalPurchaseFils) * 100 : null;

  const totalNetRent = properties
    .filter((p) => p.subcategory !== "off_plan")
    .map((p) => netAnnualRentFils(p))
    .filter((n): n is number => n !== null)
    .reduce((a, b) => a + b, 0);

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

  return (
    <>
      <h2>Property</h2>
      <PropertyForm />

      {properties.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 24 }}>
          <div className="card">
            <h4 style={{ marginTop: 0 }}>Portfolio Value</h4>
            <ValueByPropertyChart properties={properties} />
            {totalPortfolioValue > 0 && (
              <div className="kpi-total">{formatAed(totalPortfolioValue)}</div>
            )}
          </div>
          <div className="card">
            <h4 style={{ marginTop: 0 }}>Capital Appreciation</h4>
            <CapitalAppreciationChart properties={properties} />
            {totalPortfolioValue > 0 && (
              <div className="kpi-total" style={{ color: totalAppreciationFils >= 0 ? "var(--good)" : "var(--bad)" }}>
                {totalAppreciationFils >= 0 ? "+" : ""}{formatAed(totalAppreciationFils)}
                {totalAppreciationPct !== null && (
                  <span style={{ fontSize: 14, marginLeft: 6 }}>({totalAppreciationPct >= 0 ? "+" : ""}{totalAppreciationPct.toFixed(1)}%)</span>
                )}
              </div>
            )}
          </div>
          <div className="card"><h4 style={{ marginTop: 0 }}>Composition by Type</h4><PortfolioCompositionChart properties={properties} /></div>
          <div className="card">
            <h4 style={{ marginTop: 0 }}>Net Rental Income</h4>
            <RentalIncomeChart properties={properties} />
            {totalNetRent !== 0 && (
              <div className="kpi-total" style={{ color: totalNetRent >= 0 ? "var(--good)" : "var(--bad)" }}>
                {formatAed(totalNetRent)}
              </div>
            )}
          </div>
          <div className="card"><h4 style={{ marginTop: 0 }}>Installment Timeline</h4><InstallmentTimelineChart installments={installments} /></div>
          <div className="card"><h4 style={{ marginTop: 0 }}>Rental Yield</h4><RentalYieldChart properties={properties} /></div>
          <div className="card"><h4 style={{ marginTop: 0 }}>Price per Sqft</h4><PricePerSqftChart properties={properties} /></div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Your properties ({sorted.length})</h3>
        {properties.length === 0 ? (
          <p className="muted">No properties yet. Add one above.</p>
        ) : sorted.length === 0 ? (
          <p className="muted">No properties match this filter.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 1000 }}>
              <thead>
                <tr>
                  <th {...thSortProps("rental_yield")} style={{ minWidth: 100, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}>Rental Yield{sortArrow("rental_yield")}</th>
                  <th style={{ minWidth: 180 }}>Name</th>
                  <th style={{ minWidth: 140, position: "relative" }}>
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
                          <button type="button" onClick={selectAll} style={dropdownBtnStyle}>
                            ✓ Select All
                          </button>
                          <button type="button" onClick={clearAll} style={dropdownBtnStyle}>
                            ✗ Clear All
                          </button>
                          <hr style={{ margin: "4px 8px", borderColor: "var(--border)" }} />
                          {ALL_PROPERTY_TYPES.map((mt) => (
                            <button
                              key={mt}
                              type="button"
                              onClick={() => toggleType(mt)}
                              style={{
                                ...dropdownBtnStyle,
                                fontWeight: typeFilter.has(mt) ? 600 : 400,
                              }}
                            >
                              {typeFilter.has(mt) ? "✓ " : "  "}
                              {mt === "unspecified" ? "Unspecified" : TYPE_LABEL[mt]}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </th>
                  <th style={{ minWidth: 100, whiteSpace: "nowrap" }}>Area</th>
                  <th {...thSortProps("bought_for")} style={{ minWidth: 120, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}>Bought for{sortArrow("bought_for")}</th>
                  <th {...thSortProps("current_value")} style={{ minWidth: 120, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}>Current value{sortArrow("current_value")}</th>
                  <th style={{ minWidth: 140, whiteSpace: "nowrap" }}>Valuation freshness</th>
                  <th {...thSortProps("capital_appreciation")} style={{ minWidth: 150, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}>Capital Appreciation{sortArrow("capital_appreciation")}</th>
                  <th {...thSortProps("annual_profit")} style={{ minWidth: 120, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}>Annual Profit{sortArrow("annual_profit")}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => {
                  const isSelected = selectedProperty?.id === p.id;
                  const yieldPct = rentalYieldPct(p);
                  return (
                    <tr
                      key={p.id}
                      className={isSelected ? "selected-row" : undefined}
                    >
                      <td>
                        {yieldPct !== null ? (
                          <span style={{ color: yieldPct >= 0 ? "var(--good)" : "var(--bad)" }}>
                            {yieldPct >= 0 ? "+" : ""}{yieldPct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handleSelect(p.id);
                          }}
                          className="property-link"
                        >
                          {p.name}
                        </a>
                      </td>
                      <td>
                        {p.property_type ? `${TYPE_LABEL[p.property_type]} · ` : ""}
                        {p.subcategory === "off_plan" ? "Off-plan" : "Existing"}
                        {p.is_rental ? " · rental" : ""}
                      </td>
                      <td>{p.area ?? "—"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{p.purchase_price_fils != null ? formatAed(p.purchase_price_fils) : "—"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{p.current_value_fils != null ? formatAed(p.current_value_fils) : "—"}</td>
                      <td className="muted" style={{ whiteSpace: "nowrap" }}>{daysSince(p.valued_at)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {(() => {
                          if (p.purchase_price_fils != null && p.current_value_fils != null && p.purchase_price_fils > 0) {
                            const diff = ((p.current_value_fils - p.purchase_price_fils) / p.purchase_price_fils) * 100;
                            const color = diff >= 0 ? "var(--good)" : "var(--bad)";
                            return <span style={{ color }}>{diff >= 0 ? "+" : ""}{diff.toFixed(1)}%</span>;
                          }
                          return <span className="muted">—</span>;
                        })()}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {(() => {
                          if (p.subcategory === "off_plan") return <span className="muted">—</span>;
                          if (!p.is_rental) return <span className="muted">Vacant</span>;
                          const net = netAnnualRentFils(p);
                          if (net === null) return <span className="muted">—</span>;
                          return <span style={{ color: net >= 0 ? "var(--good)" : "var(--bad)" }}>{formatAed(net)}</span>;
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedProperty && (
        <div style={{ marginTop: 18 }}>
          <PropertyDetailPanel key={selectedProperty.id} property={selectedProperty} installments={installments.filter((i) => i.property_id === selectedProperty.id).sort((a, b) => a.due_date.localeCompare(b.due_date))} />
        </div>
      )}
    </>
  );
}
