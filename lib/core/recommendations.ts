/**
 * Pure recommendation engine. Zero DB, zero network. All amounts in fils.
 *
 * Generates cross-category financial moves to keep assets self-sustaining.
 * Only sell_commodity is simulatable (commodities aren't in liquidCashFils).
 * matured_deposit, rental_surplus, and cash_gap are informational only.
 */
import { computeRunway, addMonthsIso } from "@/lib/core/runway";
import { commodityTotalFils } from "@/lib/core/valuation";
import { formatAed } from "@/lib/core/units";
import type { RunwayInput, RunwayResult } from "@/lib/core/runway";
import type { Property, CashAccount, Commodity, Installment } from "@/lib/types";

export type MoveType = "sell_commodity" | "matured_deposit" | "rental_surplus" | "cash_gap";
export type Priority = "critical" | "high" | "medium";

export interface SellCommodityMove {
  type: "sell_commodity";
  priority: Priority;
  title: string;
  description: string;
  commodityId: number;
  metalType: string;
  weight: number;
  weightUnit: string;
  totalValueFils: number;
  coveredInstallments: Array<{ id: number; label: string; dueDate: string; amountFils: number }>;
  surplusFils: number;
}

export interface MaturedDepositMove {
  type: "matured_deposit";
  priority: Priority;
  title: string;
  description: string;
  accountId: number;
  accountLabel: string;
  balanceFils: number;
  maturityDate: string;
}

export interface RentalSurplusMove {
  type: "rental_surplus";
  priority: Priority;
  title: string;
  description: string;
  propertyId: number;
  propertyName: string;
  annualRentFils: number;
  totalInstallmentsFils: number;
  coveragePct: number;
  surplusFils: number;
}

export interface CashGapMove {
  type: "cash_gap";
  priority: Priority;
  title: string;
  description: string;
  shortfallDate: string;
  shortfallFils: number;
  daysUntil: number;
}

export type Recommendation =
  | SellCommodityMove
  | MaturedDepositMove
  | RentalSurplusMove
  | CashGapMove;

export interface RecommendationInput {
  asOf: string;
  properties: Property[];
  cashAccounts: CashAccount[];
  commodities: Commodity[];
  installments: Installment[];
  liquidCashFils: number;
  runwayInput: RunwayInput;
}

export function computeRecommendations(
  input: RecommendationInput,
): Recommendation[] {
  const recs: Recommendation[] = [];
  const { asOf, properties, cashAccounts, commodities, installments, liquidCashFils, runwayInput } = input;

  // ── Pre-compute runway to gate sell_commodity ─────────────────────────
  const runway = computeRunway(runwayInput);
  const hasShortfall = runway.withinHorizon;

  // ── Unpaid installments (upcoming + overdue, same as runway) ─────────
  const unpaid = installments
    .filter((i) => i.status !== "paid")
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  // ── 1. sell_commodity (gated on actual shortfall) ────────────────────
  if (hasShortfall) {
    for (const c of commodities) {
      if (c.current_price_per_unit_fils <= 0 || c.weight <= 0) continue;
      const { totalFils } = commodityTotalFils({
        weight: c.weight,
        pricePerUnitFils: c.current_price_per_unit_fils,
      });
      if (totalFils <= 0) continue;

      const covered: SellCommodityMove["coveredInstallments"] = [];
      let remaining = totalFils;

      for (const inst of unpaid) {
        if (remaining <= 0) break;
        if (inst.amount_fils <= 0) continue;
        if (remaining >= inst.amount_fils) {
          covered.push({
            id: inst.id,
            label: inst.milestone_label ?? `Installment #${inst.id}`,
            dueDate: inst.due_date,
            amountFils: inst.amount_fils,
          });
          remaining -= inst.amount_fils;
        }
      }

      if (covered.length === 0) continue;

      const priority = covered.some((i) => i.dueDate <= addDays(asOf, 30))
        ? "critical"
        : "high";

      const coveredLabels = covered
        .map((i) => `${i.label} (${formatAed(i.amountFils)} due ${i.dueDate})`)
        .join(", ");
      const surplusText =
        remaining > 0 && remaining < totalFils
          ? ` with ${formatAed(remaining)} left over`
          : "";

      recs.push({
        type: "sell_commodity",
        priority,
        title: `Sell ${c.metal_type} holding`,
        description: `Sell ${c.weight}${c.weight_unit} of ${c.metal_type} (worth ${formatAed(totalFils)}) to cover: ${coveredLabels}${surplusText}.`,
        commodityId: c.id,
        metalType: c.metal_type,
        weight: c.weight,
        weightUnit: c.weight_unit,
        totalValueFils: totalFils,
        coveredInstallments: covered,
        surplusFils: remaining,
      });
    }
  }

  // ── 2. matured_deposit (informational only) ──────────────────────────
  for (const a of cashAccounts) {
    if (!a.is_fixed_deposit) continue;
    if (!a.fixed_deposit_start_date || !a.fixed_deposit_period_months) continue;
    const maturityDate = addMonthsIso(a.fixed_deposit_start_date, a.fixed_deposit_period_months);
    if (maturityDate > asOf) continue;

    recs.push({
      type: "matured_deposit",
      priority: "medium",
      title: `Fixed deposit matured: ${a.label}`,
      description: `Your fixed deposit "${a.label}" (${formatAed(a.current_balance_fils)}) matured on ${maturityDate} — these funds are now accessible.`,
      accountId: a.id,
      accountLabel: a.label,
      balanceFils: a.current_balance_fils,
      maturityDate,
    });
  }

  // ── 3. rental_surplus (informational only) ───────────────────────────
  for (const p of properties) {
    if (p.is_rental !== 1) continue;

    const annualRent = computeAnnualRentFils(p);
    if (annualRent === null || annualRent <= 0) continue;

    const propertyInstallments = unpaid.filter(
      (i) => i.property_id === p.id && i.due_date >= asOf,
    );
    const totalInstFils = propertyInstallments.reduce(
      (sum, i) => sum + i.amount_fils,
      0,
    );
    if (totalInstFils === 0) continue;

    const coveragePct = Math.round((annualRent / totalInstFils) * 100);
    const surplusFils = Math.max(0, annualRent - totalInstFils);

    recs.push({
      type: "rental_surplus",
      priority: coveragePct >= 80 ? "high" : "medium",
      title: `${p.name}: rent covers ${coveragePct}% of its installments`,
      description: surplusFils > 0
        ? `${p.name}'s annual rent of ${formatAed(annualRent)} covers all its installments (${formatAed(totalInstFils)}) with ${formatAed(surplusFils)} net surplus.`
        : `${p.name}'s annual rent of ${formatAed(annualRent)} covers ${coveragePct}% of its upcoming installments (${formatAed(totalInstFils)}).`,
      propertyId: p.id,
      propertyName: p.name,
      annualRentFils: annualRent,
      totalInstallmentsFils: totalInstFils,
      coveragePct,
      surplusFils,
    });
  }

  // ── 4. cash_gap (informational only) ─────────────────────────────────
  if (runway.withinHorizon && runway.shortfallDate && runway.daysUntilShortfall !== null) {
    recs.push({
      type: "cash_gap",
      priority: runway.daysUntilShortfall <= 30 ? "critical" : "high",
      title: `Cash shortfall of ${formatAed(runway.worstShortfallFils)}`,
      description: `You run short by ${formatAed(runway.worstShortfallFils)} on ${runway.shortfallDate} (in ${runway.daysUntilShortfall} days). Consider selling a commodity or adding cash.`,
      shortfallDate: runway.shortfallDate,
      shortfallFils: runway.worstShortfallFils,
      daysUntil: runway.daysUntilShortfall,
    });
  }

  return recs.sort((a, b) => {
    const p = { critical: 0, high: 1, medium: 2 };
    return p[a.priority] - p[b.priority];
  });
}

export interface SimulatedImpact {
  before: RunwayResult;
  after: RunwayResult;
}

/**
 * Simulate selling a commodity: add its total value to liquid cash,
 * recompute runway, return before/after diff.
 */
export function simulateImpact(
  move: SellCommodityMove,
  input: RunwayInput,
): SimulatedImpact {
  const before = computeRunway(input);
  const after = computeRunway({
    ...input,
    liquidCashFils: input.liquidCashFils + move.totalValueFils,
  });
  return { before, after };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function computeAnnualRentFils(p: Property): number | null {
  if (p.rental_type === "short_term") {
    if (!p.short_term_annual_rent_fils || p.short_term_annual_rent_fils <= 0) return null;
    const commissionPct = p.pm_commission_pct ?? 0;
    return Math.round(p.short_term_annual_rent_fils * (100 - commissionPct) / 100);
  }
  return p.annual_rent_fils && p.annual_rent_fils > 0 ? p.annual_rent_fils : null;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
