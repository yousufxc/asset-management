"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Commodity } from "@/lib/types";
import { formatAed, formatIsoToUae, toGrams } from "@/lib/core/units";
import { commodityTotalFils } from "@/lib/core/valuation";
import CommodityForm from "./CommodityForm";
import CommodityDetailPanel from "./CommodityDetailPanel";

const METAL_LABEL: Record<string, string> = {
  gold: "Gold",
  silver: "Silver",
  platinum: "Platinum",
  palladium: "Palladium",
  other: "Other",
};

type SortCol = "amount" | "date_purchased" | "bought_price" | "value_bought" | "current_price" | "current_value" | "profit_loss" | "profit_loss_pct";

interface EnrichedCommodity {
  commodity: Commodity;
  costFils: number;
  valueFils: number;
  grams: number;
  hasCurrent: boolean;
  pl: number;
  plPct: number | null;
}

export default function CommodityContent({
  commodities,
  selectedCommodity,
}: {
  commodities: Commodity[];
  selectedCommodity: Commodity | null;
}) {
  const router = useRouter();
  const [metalTypeFilter, setMetalTypeFilter] = useState("");
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const enriched = useMemo(() => {
    return commodities.map((c) => {
      const cost = commodityTotalFils({ weight: c.weight, pricePerUnitFils: c.bought_price_per_unit_fils });
      const value = commodityTotalFils({ weight: c.weight, pricePerUnitFils: c.current_price_per_unit_fils });
      const hasCurrent = c.current_price_per_unit_fils > 0;
      const pl = value.totalFils - cost.totalFils;
      const plPct = hasCurrent && cost.totalFils > 0 ? (pl / cost.totalFils) * 100 : null;
      const grams = toGrams(c.weight, c.weight_unit);
      return { commodity: c, costFils: cost.totalFils, valueFils: value.totalFils, grams, hasCurrent, pl, plPct };
    });
  }, [commodities]);

  const filtered = useMemo(() => {
    if (!metalTypeFilter) return enriched;
    return enriched.filter((e) => e.commodity.metal_type === metalTypeFilter);
  }, [enriched, metalTypeFilter]);

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

  return (
    <>
      <h2>Commodities</h2>
      <CommodityForm />

      <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
        <div className="card" style={{ flex: selectedCommodity ? 1 : undefined }}>
          <h3 style={{ marginTop: 0 }}>Holdings ({commodities.length})</h3>
          {sorted.length === 0 ? (
            <p className="muted">
              {commodities.length === 0
                ? "No commodities yet. Add one above."
                : "No holdings match this filter."}
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>
                    <span>
                      Type{" "}
                      <select
                        value={metalTypeFilter}
                        onChange={(e) => setMetalTypeFilter(e.target.value)}
                        style={{ border: "none", background: "transparent", color: "inherit", fontSize: "inherit", fontWeight: "inherit", cursor: "pointer", padding: 0, margin: 0, width: "auto" }}
                      >
                        <option value="">All</option>
                      <option value="gold">Gold</option>
                      <option value="silver">Silver</option>
                      <option value="platinum">Platinum</option>
                      <option value="palladium">Palladium</option>
                      <option value="other">Other</option>
                    </select>
                    </span>
                  </th>
                  <th {...thProps("amount")}>Amount{sortArrow("amount")}</th>
                  <th {...thProps("date_purchased")}>Date Purchased{sortArrow("date_purchased")}</th>
                  <th {...thProps("bought_price")}>Bought price{sortArrow("bought_price")}</th>
                  <th {...thProps("value_bought")}>Value when bought{sortArrow("value_bought")}</th>
                  <th {...thProps("current_price")}>Current price{sortArrow("current_price")}</th>
                  <th {...thProps("current_value")}>Current value{sortArrow("current_value")}</th>
                  <th {...thProps("profit_loss")}>Profit / loss{sortArrow("profit_loss")}</th>
                  <th {...thProps("profit_loss_pct")}>% Profit / loss{sortArrow("profit_loss_pct")}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((e) => {
                  const c = e.commodity;
                  const isSelected = selectedCommodity?.id === c.id;

                  return (
                    <tr
                      key={c.id}
                      className={isSelected ? "selected-row" : undefined}
                    >
                      <td>
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
                      <td>
                        {c.weight} {c.weight_unit}
                      </td>
                      <td>{formatIsoToUae(c.purchase_date)}</td>
                      <td>
                        {formatAed(c.bought_price_per_unit_fils)}/{c.weight_unit}
                      </td>
                      <td>{formatAed(e.costFils)}</td>
                      <td>
                        {c.current_price_per_unit_fils > 0
                          ? `${formatAed(c.current_price_per_unit_fils)}/${c.weight_unit}`
                          : "—"}
                      </td>
                      <td>
                        {c.current_price_per_unit_fils > 0
                          ? formatAed(e.valueFils)
                          : "—"}
                      </td>
                      <td>
                        {e.hasCurrent ? (
                          <span style={{ color: e.pl >= 0 ? "var(--good)" : "var(--bad)" }}>
                            {e.pl >= 0 ? "+" : "−"}
                            {formatAed(Math.abs(e.pl))}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
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
          )}
        </div>

        {selectedCommodity && (
          <div style={{ flex: 1, position: "sticky", top: 28 }}>
            <CommodityDetailPanel
              key={selectedCommodity.id}
              commodity={selectedCommodity}
            />
          </div>
        )}
      </div>
    </>
  );
}
