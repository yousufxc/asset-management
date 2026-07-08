"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Land } from "@/lib/types";
import { formatAed, formatIsoToUae } from "@/lib/core/units";
import LandForm from "./LandForm";
import LandDetailPanel from "./LandDetailPanel";
import AnimateOnScroll from "@/app/components/AnimateOnScroll";

const LAND_TYPE_LABEL: Record<string, string> = {
  residential: "Residential",
  commercial: "Commercial",
  agricultural: "Agricultural",
  industrial: "Industrial",
  mixed_use: "Mixed Use",
  other: "Other",
};

type SortCol = "name" | "type" | "city" | "area" | "size" | "price" | "value" | "purchased" | "valued";

export default function LandContent({
  lands,
  selectedLand,
}: {
  lands: Land[];
  selectedLand: Land | null;
}) {
  const router = useRouter();
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [exporting, setExporting] = useState(false);

  const sorted = useMemo(() => {
    if (!sortCol) return lands;
    const dir = sortDir === "asc" ? 1 : -1;
    const arr = [...lands];

    arr.sort((a, b) => {
      switch (sortCol) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "type":
          return ((a.land_type ?? "").localeCompare(b.land_type ?? "")) * dir;
        case "city":
          return ((a.city ?? "").localeCompare(b.city ?? "")) * dir;
        case "area":
          return ((a.area ?? "").localeCompare(b.area ?? "")) * dir;
        case "size":
          return ((a.size_sqft ?? 0) - (b.size_sqft ?? 0)) * dir;
        case "price":
          return ((a.purchase_price_fils ?? 0) - (b.purchase_price_fils ?? 0)) * dir;
        case "value":
          return ((a.current_value_fils ?? 0) - (b.current_value_fils ?? 0)) * dir;
        case "purchased":
          return ((a.purchased_at ?? "").localeCompare(b.purchased_at ?? "")) * dir;
        case "valued":
          return ((a.valued_at ?? "").localeCompare(b.valued_at ?? "")) * dir;
        default:
          return 0;
      }
    });
    return arr;
  }, [lands, sortCol, sortDir]);

  function handleSelect(id: number) {
    router.push(`/lands?selected=${id}`);
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

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/lands/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      a.download = `lands-export-${dateStr}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export error:", e);
    } finally {
      setExporting(false);
    }
  }

  const totalValueFils = lands.reduce((sum, l) => sum + (l.current_value_fils ?? 0), 0);
  const apprTotalFils = lands.reduce((sum, l) => {
    if (l.current_value_fils == null || l.purchase_price_fils == null) return sum;
    return sum + (l.current_value_fils - l.purchase_price_fils);
  }, 0);

  return (
    <>
      <h2>Land</h2>
      <LandForm />

      <div>
        <AnimateOnScroll><div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 0 }}>
            <h3 style={{ margin: 0 }}>My Lands ({lands.length})</h3>
            <button
              onClick={handleExport}
              disabled={exporting}
              style={{ marginTop: 0, fontSize: 13, padding: "4px 12px" }}
            >
              {exporting ? "Exporting..." : "Export"}
            </button>
          </div>

          {lands.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "8px 0 16px", fontSize: 14 }}>
              <span className="muted">Total value:</span>
              <strong>{formatAed(totalValueFils)}</strong>
              {lands.some((l) => l.purchase_price_fils != null && l.current_value_fils != null) && (
                <>
                  <span className="muted" style={{ marginLeft: 16 }}>Appreciation:</span>
                  <strong style={{ color: apprTotalFils >= 0 ? "var(--good)" : "var(--bad)" }}>
                    {apprTotalFils >= 0 ? "+" : "−"}{formatAed(Math.abs(apprTotalFils))}
                  </strong>
                </>
              )}
            </div>
          )}

          {sorted.length === 0 ? (
            <p className="muted">No lands yet. Add one above.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th className="sticky-name" style={{ minWidth: 140, whiteSpace: "nowrap" }}>
                      <span style={{ cursor: "pointer", userSelect: "none" as const }} onClick={() => handleSort("name")}>
                        Name{sortArrow("name")}
                      </span>
                    </th>
                    <th {...thProps("type")} style={{ minWidth: 110, whiteSpace: "nowrap" }}>Type{sortArrow("type")}</th>
                    <th {...thProps("city")} style={{ minWidth: 100, whiteSpace: "nowrap" }}>City{sortArrow("city")}</th>
                    <th {...thProps("area")} style={{ minWidth: 120, whiteSpace: "nowrap" }}>Area{sortArrow("area")}</th>
                    <th {...thProps("size")} style={{ minWidth: 90, whiteSpace: "nowrap" }}>Size{sortArrow("size")}</th>
                    <th {...thProps("price")} style={{ minWidth: 120, whiteSpace: "nowrap" }}>Bought for{sortArrow("price")}</th>
                    <th {...thProps("value")} style={{ minWidth: 120, whiteSpace: "nowrap" }}>Current value{sortArrow("value")}</th>
                    <th {...thProps("purchased")} style={{ minWidth: 110, whiteSpace: "nowrap" }}>Purchased{sortArrow("purchased")}</th>
                    <th {...thProps("valued")} style={{ minWidth: 110, whiteSpace: "nowrap" }}>Valued{sortArrow("valued")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((l) => {
                    const isSelected = selectedLand?.id === l.id;
                    const gain = l.current_value_fils != null && l.purchase_price_fils != null
                      ? l.current_value_fils - l.purchase_price_fils
                      : null;

                    return (
                      <tr
                        key={l.id}
                        className={isSelected ? "selected-row" : undefined}
                      >
                        <td className="sticky-name">
                          <a
                            href="#"
                            onClick={(ev) => {
                              ev.preventDefault();
                              handleSelect(l.id);
                            }}
                            className="property-link"
                          >
                            {l.name}
                          </a>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {l.land_type ? (LAND_TYPE_LABEL[l.land_type] ?? l.land_type) : "—"}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>{l.city ?? "—"}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{l.area ?? "—"}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {l.size_sqft != null ? `${l.size_sqft.toLocaleString()} sqft` : "—"}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {l.purchase_price_fils != null ? formatAed(l.purchase_price_fils) : "—"}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {l.current_value_fils != null ? (
                            <span>
                              {formatAed(l.current_value_fils)}
                              {gain != null && (
                                <span style={{ fontSize: 12, marginLeft: 6, color: gain >= 0 ? "var(--good)" : "var(--bad)" }}>
                                  ({gain >= 0 ? "+" : "−"}{formatAed(Math.abs(gain))})
                                </span>
                              )}
                            </span>
                          ) : "—"}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>{l.purchased_at ? formatIsoToUae(l.purchased_at) : "—"}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{l.valued_at ? formatIsoToUae(l.valued_at) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div></AnimateOnScroll>

        {selectedLand && (
          <div style={{ marginTop: 18 }}>
            <LandDetailPanel
              key={selectedLand.id}
              land={selectedLand}
            />
          </div>
        )}
      </div>
    </>
  );
}
