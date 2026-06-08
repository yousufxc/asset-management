"use client";

import { useRouter } from "next/navigation";
import type { Commodity } from "@/lib/types";
import { formatAed } from "@/lib/core/units";
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

export default function CommodityContent({
  commodities,
  selectedCommodity,
}: {
  commodities: Commodity[];
  selectedCommodity: Commodity | null;
}) {
  const router = useRouter();

  function handleSelect(id: number) {
    router.push(`/commodities?selected=${id}`);
  }

  return (
    <>
      <h2>Commodities</h2>
      <CommodityForm />

      <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
        <div className="card" style={{ flex: selectedCommodity ? 1 : undefined }}>
          <h3 style={{ marginTop: 0 }}>Holdings ({commodities.length})</h3>
          {commodities.length === 0 ? (
            <p className="muted">No commodities yet. Add one above.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Bought price</th>
                  <th>Value when bought</th>
                  <th>Current price</th>
                  <th>Current value</th>
                  <th>Profit / loss</th>
                  <th>% Profit / loss</th>
                </tr>
              </thead>
              <tbody>
                {commodities.map((c) => {
                  const value = commodityTotalFils({
                    weight: c.weight,
                    pricePerUnitFils: c.current_price_per_unit_fils,
                  });
                  const cost = commodityTotalFils({
                    weight: c.weight,
                    pricePerUnitFils: c.bought_price_per_unit_fils,
                  });
                  // Profit/loss is only meaningful once a current price is set.
                  // current_price_per_unit_fils === 0 is the "not set" sentinel —
                  // showing it as a 100% loss would be a misleading number.
                  const hasCurrent = c.current_price_per_unit_fils > 0;
                  const pl = value.totalFils - cost.totalFils;
                  const plPct =
                    hasCurrent && cost.totalFils > 0
                      ? ((pl / cost.totalFils) * 100)
                      : null;

                  const isSelected = selectedCommodity?.id === c.id;

                  return (
                    <tr
                      key={c.id}
                      className={isSelected ? "selected-row" : undefined}
                    >
                      <td>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
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
                      <td>
                        {formatAed(c.bought_price_per_unit_fils)}/{c.weight_unit}
                      </td>
                      <td>{formatAed(cost.totalFils)}</td>
                      <td>
                        {c.current_price_per_unit_fils > 0
                          ? `${formatAed(c.current_price_per_unit_fils)}/${c.weight_unit}`
                          : "—"}
                      </td>
                      <td>
                        {c.current_price_per_unit_fils > 0
                          ? formatAed(value.totalFils)
                          : "—"}
                      </td>
                      <td>
                        {hasCurrent ? (
                          <span style={{ color: pl >= 0 ? "var(--good)" : "var(--bad)" }}>
                            {pl >= 0 ? "+" : "−"}
                            {formatAed(Math.abs(pl))}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {plPct !== null ? (
                          <span style={{ color: plPct >= 0 ? "var(--good)" : "var(--bad)" }}>
                            {plPct >= 0 ? "+" : ""}
                            {plPct.toFixed(1)}%
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
