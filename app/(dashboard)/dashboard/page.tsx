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
} from "@/lib/db/queries";
import { getSettingInt } from "@/lib/db/settings";
import { formatAed, formatIsoToUae, filsToAed } from "@/lib/core/units";
import { computeRunway, checkLiquidityWarning, generateRentalInflows } from "@/lib/core/runway";
import type { Liability, Inflow, RentalPropertyInput } from "@/lib/core/runway";
import { commodityTotalFils } from "@/lib/core/valuation";
import AssetPieChart, { type Slice } from "./AssetPieChart";
import AnimateOnScroll from "@/app/components/AnimateOnScroll";
import AnimateChartOnScroll from "@/app/components/AnimateChartOnScroll";

export const dynamic = "force-dynamic";

function addMonths(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const properties = listProperties();
  const accounts = listCashAccounts();
  const commodities = listCommodities();
  const installments = listAllInstallments();

  const propertyTotalFils = properties.reduce(
    (sum, p) => sum + (p.current_value_fils ?? 0),
    0,
  );
  const cashTotalFils = accounts.reduce(
    (sum, a) => sum + a.current_balance_fils,
    0,
  );
  const commodityTotalFilsAgg = commodities.reduce(
    (sum, c) =>
      sum +
      commodityTotalFils({
        weight: c.weight,
        pricePerUnitFils: c.current_price_per_unit_fils,
      }).totalFils,
    0,
  );
  const chartData: Slice[] = [
    { name: "Property", value: propertyTotalFils },
    { name: "Saving Accounts", value: cashTotalFils },
    { name: "Commodities", value: commodityTotalFilsAgg },
  ];

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  // ── Liquid cash (all cash counts as liquid — owner decision 2026-06-04) ───
  const liquidAccounts = accounts;
  const liquidFils = liquidAccounts.reduce((sum, a) => sum + a.current_balance_fils, 0);

  // ── Liabilities (unpaid installments) ────────────────────────────────────
  const liabilities: Liability[] = installments
    .filter((i) => i.status !== "paid")
    .map((i) => ({
      id: i.id,
      label: i.milestone_label ?? `Installment #${i.id}`,
      dueDate: i.due_date,
      amountFils: i.amount_fils,
      kind: "installment" as const,
    }));

  // ── Rental inflows (real cheques-per-year timing) ───────────────────────
  const rentalProperties = properties.filter(
    (p) => p.is_rental === 1 && (
      (p.annual_rent_fils && p.annual_rent_fils > 0) ||
      (p.short_term_annual_rent_fils && p.short_term_annual_rent_fils > 0)
    ),
  );

  // Find latest liability date for generating enough rent events
  let latestDate = addMonths(todayIso, 12); // at least 12 months
  for (const liab of liabilities) {
    if (liab.dueDate > latestDate) latestDate = liab.dueDate;
  }

  const inflows: Inflow[] = generateRentalInflows(
    properties as RentalPropertyInput[],
    latestDate,
  );

  // ── Read runway horizon from settings ──────────────────────────────────
  const runwayHorizonDays = getSettingInt("runwayHorizonDays");

  // ── Compute runway ──────────────────────────────────────────────────────
  const runway = computeRunway({
    asOf: todayIso,
    liquidCashFils: liquidFils,
    liabilities,
    inflows,
    horizonDays: runwayHorizonDays,
  });
  const warning = checkLiquidityWarning({
    asOf: todayIso,
    liquidCashFils: liquidFils,
    liabilities,
    inflows,
    horizonDays: runwayHorizonDays,
  });

  return (
    <>
      <h2>Dashboard</h2>

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
                <strong>Liabilities (unpaid):</strong> {liabilities.length} item(s) totaling{" "}
                {formatAed(liabilities.reduce((s, l) => s + l.amountFils, 0))}
              </p>
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
              installment(s) ·               {rentalProperties.length} rental property
              {rentalProperties.length === 1 ? "" : "ies"} generating{" "}
              {inflows.length} rent cheque event(s).
            </p>
          </div>
        </details>
      </div></AnimateOnScroll>

      {/* ─── PORTFOLIO ALLOCATION PIE CHART ─────────────────────────────── */}
      <AnimateChartOnScroll><AssetPieChart data={chartData} /></AnimateChartOnScroll>

      {/* ─── ASSET COUNTS ─────────────────────────────────────────────── */}
      <div className="row">
        <AnimateOnScroll><div className="card" style={{ flex: 1, minWidth: 200 }}>
          <div className="muted">Properties</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{properties.length}</div>
          <Link href="/properties">Manage →</Link>
        </div></AnimateOnScroll>
        <AnimateOnScroll><div className="card" style={{ flex: 1, minWidth: 200 }}>
          <div className="muted">Saving Accounts</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{accounts.length}</div>
          <Link href="/cash">Manage →</Link>
        </div></AnimateOnScroll>
        <AnimateOnScroll><div className="card" style={{ flex: 1, minWidth: 200 }}>
          <div className="muted">Commodities</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{commodities.length}</div>
          <Link href="/commodities">Manage →</Link>
        </div></AnimateOnScroll>
      </div>
    </>
  );
}
