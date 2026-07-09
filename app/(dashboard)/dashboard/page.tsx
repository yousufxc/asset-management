/**
 * Dashboard — headline cash-runway number from lib/core/runway.ts.
 * Shows days-of-runway, shortfall warning, and full event timeline (rule 2.1).
 */

import Link from "next/link";
import {
  listProperties,
  listCashAccounts,
  listCommodities,
  listAllInstallments,
  listLands,
  listMortgages,
  listLandMortgages,
} from "@/lib/db/queries";
import { getSettingInt, getSetting } from "@/lib/db/settings";
import { formatAed, formatIsoToUae } from "@/lib/core/units";
import { computeRunway, checkLiquidityWarning, generateRentalInflows, addMonthsIso } from "@/lib/core/runway";
import type { Liability, Inflow, RentalPropertyInput } from "@/lib/core/runway";
import {
  computeOutstandingBalance,
  monthsElapsed,
  computeLoanEndDate,
  generateMortgagePayments,
  computeNetEquity,
} from "@/lib/core/mortgage";
import type { MortgagePaymentInput } from "@/lib/core/mortgage";
import { shouldSellAlert } from "@/lib/core/commodity-analytics";
import { commodityTotalFils } from "@/lib/core/valuation";
import { computeRecommendations } from "@/lib/core/recommendations";
import AssetPieChart, { type Slice } from "./AssetPieChart";
import AnimateOnScroll from "@/app/components/AnimateOnScroll";
import AnimateChartOnScroll from "@/app/components/AnimateChartOnScroll";
import RecommendedMoves from "./RecommendedMoves";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const properties = listProperties();
  const accounts = listCashAccounts();
  const commodities = listCommodities();
  const lands = listLands();
  const installments = listAllInstallments();
  const mortgages = listMortgages();
  const landMortgages = listLandMortgages();

  // ── Asset selection filtering ──────────────────────────────────────────
  let selected: Set<string> = new Set(["properties", "commodities", "cash", "lands"]);
  try {
    const raw = getSetting("assetSelection");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((s: unknown) => typeof s === "string")) {
        selected = new Set(parsed);
      }
    }
  } catch {}

  const showProperties = selected.has("properties");
  const showCash = selected.has("cash");
  const showCommodities = selected.has("commodities");
  const showLands = selected.has("lands");

  const filteredProperties = showProperties ? properties : [];
  const filteredAccounts = showCash ? accounts : [];
  const filteredCommodities = showCommodities ? commodities : [];
  const filteredLands = showLands ? lands : [];
  const filteredInstallments = showProperties ? installments : [];

  const filteredPropertyIds = new Set(filteredProperties.map((p) => p.id));
  const filteredLandIds = new Set(filteredLands.map((l) => l.id));
  const filteredMortgages = showProperties
    ? mortgages.filter((m) => filteredPropertyIds.has(m.property_id))
    : [];
  const filteredLandMortgages = showLands
    ? landMortgages.filter((m) => filteredLandIds.has(m.land_id))
    : [];

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  const propertyMortgageMap = new Map(filteredMortgages.map((m) => [m.property_id, m]));
  const landMortgageMap = new Map(filteredLandMortgages.map((m) => [m.land_id, m]));

  // ── Net equity per property ────────────────────────────────────────────
  type MortgagedAssetDetail = {
    name: string;
    currentValueFils: number;
    outstandingBalanceFils: number;
    netEquityFils: number;
  };
  const propertyDetails: MortgagedAssetDetail[] = [];
  let propertyNetFils = 0;

  for (const p of filteredProperties) {
    const value = p.current_value_fils ?? 0;
    const m = propertyMortgageMap.get(p.id);
    if (m) {
      const elapsed = monthsElapsed(m.loan_start_date, todayIso);
      const outstanding = computeOutstandingBalance(
        m.loan_amount_fils, m.interest_rate_pct, m.loan_term_months, elapsed,
      );
      const net = computeNetEquity(value, outstanding);
      propertyDetails.push({
        name: p.name,
        currentValueFils: value,
        outstandingBalanceFils: outstanding,
        netEquityFils: net,
      });
      propertyNetFils += net;
    } else {
      propertyNetFils += value;
    }
  }

  // ── Net equity per land ───────────────────────────────────────────────
  const landDetails: MortgagedAssetDetail[] = [];
  let landNetFils = 0;

  for (const l of filteredLands) {
    const value = l.current_value_fils ?? 0;
    const m = landMortgageMap.get(l.id);
    if (m) {
      const elapsed = monthsElapsed(m.loan_start_date, todayIso);
      const outstanding = computeOutstandingBalance(
        m.loan_amount_fils, m.interest_rate_pct, m.loan_term_months, elapsed,
      );
      const net = computeNetEquity(value, outstanding);
      landDetails.push({
        name: l.name,
        currentValueFils: value,
        outstandingBalanceFils: outstanding,
        netEquityFils: net,
      });
      landNetFils += net;
    } else {
      landNetFils += value;
    }
  }

  const cashTotalFils = filteredAccounts.reduce(
    (sum, a) => sum + a.current_balance_fils,
    0,
  );
  const commodityTotalFilsAgg = filteredCommodities.reduce(
    (sum, c) =>
      sum +
      commodityTotalFils({
        weight: c.weight,
        pricePerUnitFils: c.current_price_per_unit_fils,
      }).totalFils,
    0,
  );

  const totalMortgageDebtFils =
    propertyDetails.reduce((s, d) => s + d.outstandingBalanceFils, 0) +
    landDetails.reduce((s, d) => s + d.outstandingBalanceFils, 0);

  const chartData: Slice[] = [];
  if (showProperties) chartData.push({ name: "Property", value: Math.max(0, propertyNetFils) });
  if (showCash) chartData.push({ name: "Saving Accounts", value: cashTotalFils });
  if (showCommodities) chartData.push({ name: "Commodities", value: commodityTotalFilsAgg });
  if (showLands) chartData.push({ name: "Land", value: Math.max(0, landNetFils) });

  // ── Liquid cash (all cash counts as liquid — owner decision 2026-06-04) ───
  const liquidAccounts = filteredAccounts;
  const liquidFils = liquidAccounts.reduce((sum, a) => sum + a.current_balance_fils, 0);

  // ── Liabilities (unpaid installments) ────────────────────────────────────
  const liabilities: Liability[] = filteredInstallments
    .filter((i) => i.status !== "paid")
    .map((i) => ({
      id: i.id,
      label: i.milestone_label ?? `Installment #${i.id}`,
      dueDate: i.due_date,
      amountFils: i.amount_fils,
      kind: "installment" as const,
    }));

  // ── Mortgage outflows (monthly payments as recurring dated liabilities) ──
  const propertyNameMap = new Map(filteredProperties.map((p) => [p.id, p.name]));
  const landNameMap = new Map(filteredLands.map((l) => [l.id, l.name]));

  const mortgagePaymentInputs: MortgagePaymentInput[] = [
    ...filteredMortgages.map((m) => ({
      id: m.id,
      label: `Mortgage: ${m.lender_name} (${propertyNameMap.get(m.property_id) ?? `Property #${m.property_id}`})`,
      loanAmountFils: m.loan_amount_fils,
      annualRatePct: m.interest_rate_pct,
      termMonths: m.loan_term_months,
      loanStartDate: m.loan_start_date,
    })),
    ...filteredLandMortgages.map((m) => ({
      id: m.id + 10_000_000, // offset to avoid collision with property mortgage IDs
      label: `Mortgage: ${m.lender_name} (${landNameMap.get(m.land_id) ?? `Land #${m.land_id}`})`,
      loanAmountFils: m.loan_amount_fils,
      annualRatePct: m.interest_rate_pct,
      termMonths: m.loan_term_months,
      loanStartDate: m.loan_start_date,
    })),
  ];

  // Compute initial latestDate (12 months out, extended by installments)
  let latestDate = addMonthsIso(todayIso, 12);
  for (const liab of liabilities) {
    if (liab.dueDate > latestDate) latestDate = liab.dueDate;
  }

  // Extend latestDate to fully cover mortgage horizons
  for (const mi of mortgagePaymentInputs) {
    const endDate = computeLoanEndDate(mi.loanStartDate, mi.termMonths);
    if (endDate > latestDate) latestDate = endDate;
  }

  const mortgagePayments = generateMortgagePayments(mortgagePaymentInputs, todayIso, latestDate);

  const mortgageLiabilities: Liability[] = mortgagePayments.map((mp) => ({
    id: mp.id,
    label: mp.label,
    dueDate: mp.dueDate,
    amountFils: mp.amountFils,
    kind: "mortgage" as const,
  }));

  const allLiabilities = [...liabilities, ...mortgageLiabilities];

  // ── Rental inflows (real cheques-per-year timing) ───────────────────────
  const rentalProperties = filteredProperties.filter(
    (p) => p.is_rental === 1 && (
      (p.annual_rent_fils && p.annual_rent_fils > 0) ||
      (p.short_term_annual_rent_fils && p.short_term_annual_rent_fils > 0)
    ),
  );

  const inflows: Inflow[] = generateRentalInflows(
    filteredProperties as RentalPropertyInput[],
    latestDate,
  );

  // ── Read runway horizon from settings ──────────────────────────────────
  let runwayHorizonDays = 90;
  try {
    runwayHorizonDays = getSettingInt("runwayHorizonDays");
  } catch {
    // fallback to default 90 days if setting is corrupt
  }

  // ── Compute runway ──────────────────────────────────────────────────────
  const runway = computeRunway({
    asOf: todayIso,
    liquidCashFils: liquidFils,
    liabilities: allLiabilities,
    inflows,
    horizonDays: runwayHorizonDays,
  });
  const warning = checkLiquidityWarning({
    asOf: todayIso,
    liquidCashFils: liquidFils,
    liabilities: allLiabilities,
    inflows,
    horizonDays: runwayHorizonDays,
  });

  return (
    <>
      <h2>My Dashboard</h2>

      {/* ─── LIQUIDITY WARNING BANNER ──────────────────────────────────── */}
      {warning.breached && (
        <AnimateOnScroll><div
          className="card"
          style={{
            borderLeft: "4px solid var(--bad)",
            backgroundColor: "rgba(220,53,69,0.06)",
          }}
        >
          <h3 style={{ marginTop: 0, color: "var(--bad)" }}>
            {runwayHorizonDays}-day liquidity warning
          </h3>
          <p>
            You will run out of liquid cash in{" "}
            <strong style={{ color: "var(--bad)", fontSize: 20 }}>
              {warning.daysUntil} day{warning.daysUntil === 1 ? "" : "s"}
            </strong>
            {warning.byDate ? ` (by ${formatIsoToUae(warning.byDate)})` : ""}.
            Shortfall: <strong style={{ color: "var(--bad)" }}>
              {formatAed(warning.shortfallFils)}
            </strong>.
          </p>
          <details className="work">
            <summary>Show contributing items</summary>
            <div className="work-body">
              <p>
                <strong>Liquid cash:</strong> {formatAed(liquidFils)} across{" "}
                {liquidAccounts.length} account(s)
              </p>
              <p>
                <strong>Liabilities (unpaid):</strong> {allLiabilities.length} item(s) totaling{" "}
                {formatAed(allLiabilities.reduce((s, l) => s + l.amountFils, 0))}
              </p>
              {liabilities.length > 0 && (
                <p style={{ marginLeft: 16 }}>
                  · Installments: {liabilities.length} totaling{" "}
                  {formatAed(liabilities.reduce((s, l) => s + l.amountFils, 0))}
                </p>
              )}
              {mortgageLiabilities.length > 0 && (
                <p style={{ marginLeft: 16 }}>
                  · Mortgage payments: {mortgageLiabilities.length} totaling{" "}
                  {formatAed(mortgageLiabilities.reduce((s, l) => s + l.amountFils, 0))}
                </p>
              )}
              {inflows.length > 0 && (
                <p>
                  <strong>Expected inflows:</strong> {formatAed(inflows.reduce((s, i) => s + i.amountFils, 0))}{" "}
                  from {rentalProperties.length} rental propert{rentalProperties.length === 1 ? "y" : "ies"}
                </p>
              )}
            </div>
          </details>
        </div></AnimateOnScroll>
      )}

      {/* ─── PORTFOLIO ALLOCATION PIE CHART ─────────────────────────────── */}
      {chartData.length > 0 && (
        <AnimateChartOnScroll><AssetPieChart data={chartData} /></AnimateChartOnScroll>
      )}

      {/* ─── NET WORTH SHOW-YOUR-WORK ────────────────────────────────────── */}
      {(propertyDetails.length > 0 || landDetails.length > 0) && (
        <AnimateOnScroll><div className="card">
          <details className="work">
            <summary>Show net worth breakdown (mortgage-adjusted)</summary>
            <div className="work-body">
              {propertyDetails.length > 0 && (
                <>
                  <p><strong>Properties (net equity):</strong></p>
                  <table style={{ width: "100%", fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th>Property</th>
                        <th>Current value</th>
                        <th>Outstanding mortgage</th>
                        <th>Net equity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {propertyDetails.map((d, i) => (
                        <tr key={i}>
                          <td>{d.name}</td>
                          <td>{formatAed(d.currentValueFils)}</td>
                          <td style={{ color: "var(--bad)" }}>−{formatAed(d.outstandingBalanceFils)}</td>
                          <td style={{ fontWeight: 600, color: d.netEquityFils < 0 ? "var(--bad)" : undefined }}>
                            {formatAed(d.netEquityFils)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {landDetails.length > 0 && (
                <>
                  <p style={{ marginTop: 12 }}><strong>Land (net equity):</strong></p>
                  <table style={{ width: "100%", fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th>Land</th>
                        <th>Current value</th>
                        <th>Outstanding mortgage</th>
                        <th>Net equity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {landDetails.map((d, i) => (
                        <tr key={i}>
                          <td>{d.name}</td>
                          <td>{formatAed(d.currentValueFils)}</td>
                          <td style={{ color: "var(--bad)" }}>−{formatAed(d.outstandingBalanceFils)}</td>
                          <td style={{ fontWeight: 600, color: d.netEquityFils < 0 ? "var(--bad)" : undefined }}>
                            {formatAed(d.netEquityFils)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              <hr />
              <p><strong>Total mortgage debt:</strong> <span style={{ color: "var(--bad)" }}>{formatAed(totalMortgageDebtFils)}</span></p>
              <p className="muted" style={{ fontSize: 12 }}>
                Pie slices show net equity clamped to 0 (no negative slices).<br />
                Property net equity: {formatAed(propertyNetFils)} · Land net equity: {formatAed(landNetFils)}.
              </p>
            </div>
          </details>
        </div></AnimateOnScroll>
      )}

      {/* ─── ASSET COUNTS ─────────────────────────────────────────────── */}
      <div className="row" style={{ justifyContent: "center" }}>
        {showProperties && (
          <AnimateOnScroll><div className="card" style={{ flex: 1, minWidth: 200, maxWidth: 280 }}>
            <div className="muted">Properties</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{filteredProperties.length}</div>
            <Link href="/properties">Manage →</Link>
          </div></AnimateOnScroll>
        )}
        {showCash && (
          <AnimateOnScroll><div className="card" style={{ flex: 1, minWidth: 200 }}>
            <div className="muted">Saving Accounts</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{filteredAccounts.length}</div>
            <Link href="/cash">Manage →</Link>
          </div></AnimateOnScroll>
        )}
        {showCommodities && (
          <AnimateOnScroll><div className="card" style={{ flex: 1, minWidth: 200 }}>
            <div className="muted">Commodities</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{filteredCommodities.length}</div>
            <Link href="/commodities">Manage →</Link>
          </div></AnimateOnScroll>
        )}
        {showLands && (
          <AnimateOnScroll><div className="card" style={{ flex: 1, minWidth: 200 }}>
            <div className="muted">Land</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{filteredLands.length}</div>
            <Link href="/lands">Manage →</Link>
          </div></AnimateOnScroll>
        )}
      </div>

      {/* ─── SELL ALERTS — commodities at or above target price ─────────── */}
      {showCommodities && (() => {
        const sellAlerts = filteredCommodities.filter(shouldSellAlert);
        if (sellAlerts.length === 0) return null;
        return (
          <AnimateOnScroll><div
            className="card"
            style={{ borderLeft: "4px solid var(--good)", backgroundColor: "rgba(56,193,114,0.06)" }}
          >
            <h3 style={{ marginTop: 0, color: "var(--good)" }}>Time to sell</h3>
            <p className="muted">{sellAlerts.length} holding{sellAlerts.length !== 1 ? "s" : ""} hit target price.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sellAlerts.map((c) => {
                const currentVal = commodityTotalFils({ weight: c.weight, pricePerUnitFils: c.current_price_per_unit_fils }).totalFils;
                const boughtVal = commodityTotalFils({ weight: c.weight, pricePerUnitFils: c.bought_price_per_unit_fils }).totalFils;
                const gain = currentVal - boughtVal;
                return (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <strong>{c.metal_type.charAt(0).toUpperCase()}{c.metal_type.slice(1)}</strong>
                      <span className="muted" style={{ marginLeft: 8 }}>{c.weight} {c.weight_unit}</span>
                    </div>
                    <div>
                      <span className="muted" style={{ marginRight: 8 }}>Target: {formatAed(c.target_sell_price_per_unit_fils!)}/{c.weight_unit}</span>
                      <span style={{ color: "var(--good)", fontWeight: 600 }}>Now: {formatAed(c.current_price_per_unit_fils)}/{c.weight_unit}</span>
                      <span style={{ color: "var(--good)", fontWeight: 600, marginLeft: 12 }}>{gain >= 0 ? "+" : ""}{formatAed(gain)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <Link href="/commodities" style={{ marginTop: 8, display: "inline-block" }}>View all →</Link>
          </div></AnimateOnScroll>
        );
      })()}

      {/* ─── RUNWAY HEADLINE ──────────────────────────────────────────── */}
      <AnimateOnScroll><div className="card">
        <h3 style={{ marginTop: 0 }}>Cash runway</h3>

        {runway.shortfallDate ? (
          <>
            <p style={{ fontSize: 20, fontWeight: 700, color: "var(--bad)" }}>
              Shortfall in{" "}
              <span style={{ fontSize: 28 }}>
                {runway.daysUntilShortfall} day
                {runway.daysUntilShortfall === 1 ? "" : "s"}
              </span>
              {!runway.withinHorizon && (
                <span className="muted" style={{ fontSize: 14 }}>
                  {" "}
                  (beyond {runwayHorizonDays}-day window)
                </span>
              )}
            </p>
            <p>
              On <strong>{formatIsoToUae(runway.shortfallDate)}</strong> you will be
              short by{" "}
              <strong style={{ color: "var(--bad)" }}>
                {formatAed(runway.worstShortfallFils)}
              </strong>
              .
            </p>
          </>
        ) : (
          <p style={{ fontSize: 20, fontWeight: 700, color: "var(--good)" }}>
            No shortfall within {runwayHorizonDays} days
          </p>
        )}

        <details className="work" open>
          <summary>Show full timeline (show your work)</summary>
          <div className="work-body">
            <table style={{ width: "100%", fontSize: 14 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Event</th>
                  <th>Amount</th>
                  <th>Running balance</th>
                </tr>
              </thead>
              <tbody>
                {runway.timeline.map((t, idx) => (
                  <tr
                    key={idx}
                    style={
                      t.runningBalanceFils < 0
                        ? { backgroundColor: "rgba(255,0,0,0.08)" }
                        : undefined
                    }
                  >
                    <td>{formatIsoToUae(t.date)}</td>
                    <td>{t.label}</td>
                    <td
                      style={
                        t.deltaFils < 0
                          ? { color: "var(--bad)" }
                          : { color: "var(--good)" }
                      }
                    >
                      {t.deltaFils > 0 ? "+" : ""}
                      {formatAed(t.deltaFils)}
                    </td>
                    <td
                      style={
                        t.runningBalanceFils < 0
                          ? { color: "var(--bad)", fontWeight: 600 }
                          : undefined
                      }
                    >
                      {formatAed(t.runningBalanceFils)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <hr />
            <p className="muted">
              <strong>Inputs:</strong> Liquid cash: {formatAed(liquidFils)} across{" "}
              {liquidAccounts.length} account(s) · {liabilities.length} unpaid
              installment(s){mortgageLiabilities.length > 0 ? ` · ${mortgageLiabilities.length} mortgage payment(s)` : ""} · {rentalProperties.length} rental property
              {rentalProperties.length === 1 ? "" : "ies"} generating{" "}
              {inflows.length} rent cheque event(s).
            </p>
          </div>
        </details>
      </div></AnimateOnScroll>

      {/* ─── RECOMMENDED MOVES ───────────────────────────────────────── */}
      <RecommendedMoves
        recommendations={computeRecommendations({
          asOf: todayIso,
          properties: filteredProperties,
          cashAccounts: filteredAccounts,
          commodities: filteredCommodities,
          installments: filteredInstallments,
          liquidCashFils: liquidFils,
          runwayInput: {
            asOf: todayIso,
            liquidCashFils: liquidFils,
            liabilities: allLiabilities,
            inflows,
            horizonDays: runwayHorizonDays,
          },
        })}
        runwayInput={{
          asOf: todayIso,
          liquidCashFils: liquidFils,
          liabilities: allLiabilities,
          inflows,
          horizonDays: runwayHorizonDays,
        }}
      />
    </>
  );
}
