/**
 * Pure recommendation engine. Zero DB, zero network. All amounts in fils.
 *
 * Generates cross-category financial moves to keep assets self-sustaining.
 * Each sell_commodity recommendation now includes multiple options (minimal,
 * full_coverage, best_value) with explicit rationales so the user can choose
 * between aggressive and conservative moves.
 */
import { computeRunway, addMonthsIso } from "@/lib/core/runway";
import { commodityTotalFils } from "@/lib/core/valuation";
import { formatAed, formatIsoToUae } from "@/lib/core/units";
import type { RunwayInput, RunwayResult } from "@/lib/core/runway";
import type { Property, CashAccount, Commodity, Installment } from "@/lib/types";

export type MoveType = "sell_commodity" | "matured_deposit" | "rental_surplus" | "cash_gap" | "combo";
export type Priority = "critical" | "high" | "medium";
export type Option = "minimal" | "full_coverage" | "best_value";

export interface CoveredInstallment {
  id: number;
  label: string;
  dueDate: string;
  amountFils: number;
}

export interface SellCommodityMove {
  type: "sell_commodity";
  option: Option;
  priority: Priority;
  rationale: string;
  title: string;
  description: string;
  commodityId: number;
  metalType: string;
  weight: number;
  weightUnit: string;
  weightToSell: number;
  totalValueFils: number;
  coveredInstallments: CoveredInstallment[];
  surplusFils: number;
}

export interface MaturedDepositMove {
  type: "matured_deposit";
  priority: Priority;
  rationale: string;
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
  rationale: string;
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
  rationale: string;
  title: string;
  description: string;
  shortfallDate: string;
  shortfallFils: number;
  daysUntil: number;
}

export interface ComboMove {
  type: "combo";
  priority: Priority;
  rationale: string;
  title: string;
  description: string;
  commodity: { commodityId: number; metalType: string; weightUnit: string; weightToSell: number; sellValueFils: number };
  cash: { accountId: number; accountLabel: string; amountFils: number; isLiquid: boolean };
  coveredInstallments: CoveredInstallment[];
  totalValueFils: number;
}

export type Recommendation =
  | SellCommodityMove
  | MaturedDepositMove
  | RentalSurplusMove
  | CashGapMove
  | ComboMove;

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
  const { asOf, properties, cashAccounts, commodities, installments, runwayInput } = input;

  const runway = computeRunway(runwayInput);
  const hasShortfall = runway.withinHorizon;

  const unpaid = installments
    .filter((i) => i.status !== "paid")
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  // ── Helpers ──────────────────────────────────────────────────────────
  const commodityValueMap = new Map<number, number>();
  const validCommodities: Commodity[] = [];
  for (const c of commodities) {
    if (c.current_price_per_unit_fils <= 0 || c.weight <= 0) continue;
    const { totalFils } = commodityTotalFils({ weight: c.weight, pricePerUnitFils: c.current_price_per_unit_fils });
    if (totalFils <= 0) continue;
    commodityValueMap.set(c.id, totalFils);
    validCommodities.push(c);
  }

  // ── 1. sell_commodity (gated on actual shortfall) ────────────────────
  if (hasShortfall) {
    for (const c of validCommodities) {
      const totalFils = commodityValueMap.get(c.id)!;

      // a) Minimal — cover only the first unpaid installment
      const firstInst = unpaid[0];
      if (firstInst && totalFils >= firstInst.amount_fils) {
        const weightNeeded = Math.ceil((firstInst.amount_fils / totalFils) * c.weight * 100) / 100;
        const weightToSell = Math.min(weightNeeded, c.weight);
        const sellValue = Math.round((weightToSell / c.weight) * totalFils);

        const criticality = firstInst.due_date <= addDays(asOf, 30);
        recs.push({
          type: "sell_commodity",
          option: "minimal",
          priority: criticality ? "critical" : "high",
          rationale: `Covers only the most urgent payment (${firstInst.milestone_label ?? `#${firstInst.id}`} due ${formatIsoToUae(firstInst.due_date)}) while preserving ${formatAed(totalFils - sellValue)} of your ${c.metal_type} position. Lowest-risk move.`,
          title: `Sell part of ${c.metal_type}: urgent cover`,
          description: `Sell ${weightToSell}${c.weight_unit} of ${c.metal_type} (worth ${formatAed(sellValue)}) to cover ${firstInst.milestone_label ?? `Installment #${firstInst.id}`} (${formatAed(firstInst.amount_fils)} due ${formatIsoToUae(firstInst.due_date)}). Preserves ${formatAed(totalFils - sellValue)} of your position.`,
          commodityId: c.id,
          metalType: c.metal_type,
          weight: c.weight,
          weightUnit: c.weight_unit,
          weightToSell,
          totalValueFils: sellValue,
          coveredInstallments: [{
            id: firstInst.id,
            label: firstInst.milestone_label ?? `Installment #${firstInst.id}`,
            dueDate: firstInst.due_date,
            amountFils: firstInst.amount_fils,
          }],
          surplusFils: 0,
        });
      }

      // b) Full coverage — greedy allocation across all unpaid installments
      {
        const covered: CoveredInstallment[] = [];
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
        if (covered.length > 1) {
          const critical = covered.some((i) => i.dueDate <= addDays(asOf, 30));
          const effectiveWeight = Math.min(
            Math.ceil(((totalFils - remaining) / totalFils) * c.weight * 100) / 100,
            c.weight,
          );

          recs.push({
            type: "sell_commodity",
            option: "full_coverage",
            priority: critical ? "critical" : "high",
            rationale: `Clears ${covered.length} upcoming payments totaling ${formatAed(totalFils - remaining)}, buying you substantial breathing room.`,
            title: `Sell ${c.metal_type}: clear ${covered.length} payment${covered.length === 1 ? "" : "s"}`,
            description: `Sell ${effectiveWeight}${c.weight_unit} of ${c.metal_type} (worth ${formatAed(totalFils)}${remaining > 0 ? `, with ${formatAed(remaining)} left over` : ""}) to cover: ${covered.map((i) => `${i.label} (${formatAed(i.amountFils)})`).join(", ")}.`,
            commodityId: c.id,
            metalType: c.metal_type,
            weight: c.weight,
            weightUnit: c.weight_unit,
            weightToSell: effectiveWeight,
            totalValueFils: totalFils,
            coveredInstallments: covered,
            surplusFils: remaining,
          });
        }
      }
    }

    // c) Best value — rank commodities by margin, recommend lowest
    if (validCommodities.length >= 2) {
      const ranked = validCommodities.map((c) => ({
        c,
        totalFils: commodityValueMap.get(c.id)!,
        marginPct: computeMarginPct(c),
      })).sort((a, b) => a.marginPct - b.marginPct);

      const best = ranked[0]!;
      if (best.totalFils > 0) {
        const covered: CoveredInstallment[] = [];
        let remaining = best.totalFils;
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
        if (covered.length > 0) {
          const others = ranked.slice(1).map((r) =>
            `${r.c.metal_type} (${r.marginPct}% gain vs bought)`
          ).join(", ");

          recs.push({
            type: "sell_commodity",
            option: "best_value",
            priority: "high",
            rationale: `${best.c.metal_type} has the lowest unrealised gain margin (${best.marginPct}% vs bought) — you lose the least potential upside by selling this first. Compared to: ${others}.`,
            title: `Best value sale: ${best.c.metal_type}`,
            description: `Sell your ${best.c.metal_type} holding (${best.c.weight}${best.c.weight_unit}, worth ${formatAed(best.totalFils)}, bought at ${formatAed(best.c.bought_price_per_unit_fils)}/unit, now ${formatAed(best.c.current_price_per_unit_fils)}/unit, +${best.marginPct}%) to cover ${covered.length} payment${covered.length === 1 ? "" : "s"}: ${covered.map((i) => `${i.label} (${formatAed(i.amountFils)})`).join(", ")}.${remaining > 0 ? ` ${formatAed(remaining)} left over.` : ""}`,
            commodityId: best.c.id,
            metalType: best.c.metal_type,
            weight: best.c.weight,
            weightUnit: best.c.weight_unit,
            weightToSell: best.c.weight,
            totalValueFils: best.totalFils,
            coveredInstallments: covered,
            surplusFils: remaining,
          });
        }
      }
    }
  }

  // ── 2. combo: commodity + cash to cover the gap ──────────────────────
  if (hasShortfall && validCommodities.length > 0 && runway.worstShortfallFils > 0) {
    const liquidAccounts = cashAccounts.filter((a) => a.is_fixed_deposit === 0 && a.current_balance_fils > 0);
    if (liquidAccounts.length > 0) {
      const bestCommodity = validCommodities
        .map((c) => ({ c, totalFils: commodityValueMap.get(c.id)! }))
        .sort((a, b) => a.totalFils - b.totalFils)[0]!;

      const gapRemaining = Math.max(0, runway.worstShortfallFils - bestCommodity.totalFils);
      if (gapRemaining > 0) {
        const bestCash = liquidAccounts
          .filter((a) => a.current_balance_fils >= gapRemaining)
          .sort((a, b) => a.current_balance_fils - b.current_balance_fils)[0];

        if (bestCash) {
          recs.push({
            type: "combo",
            priority: runway.daysUntilShortfall !== null && runway.daysUntilShortfall <= 30 ? "critical" : "high",
            rationale: `${bestCommodity.c.metal_type} covers ${formatAed(bestCommodity.totalFils)} of the ${formatAed(runway.worstShortfallFils)} gap; the remaining ${formatAed(gapRemaining)} can be drawn from your liquid ${bestCash.label} (${formatAed(bestCash.current_balance_fils)} available). The commodity sale provides the genuinely new liquidity.`,
            title: `Sell ${bestCommodity.c.metal_type} + draw from ${bestCash.label}`,
            description: `Sell your ${bestCommodity.c.metal_type} (${bestCommodity.c.weight}${bestCommodity.c.weight_unit}, worth ${formatAed(bestCommodity.totalFils)}) for ${formatAed(bestCommodity.totalFils)} in new liquidity, and draw ${formatAed(gapRemaining)} from ${bestCash.label} to cover the ${formatAed(runway.worstShortfallFils)} shortfall.`,
            commodity: {
              commodityId: bestCommodity.c.id,
              metalType: bestCommodity.c.metal_type,
              weightUnit: bestCommodity.c.weight_unit,
              weightToSell: bestCommodity.c.weight,
              sellValueFils: bestCommodity.totalFils,
            },
            cash: {
              accountId: bestCash.id,
              accountLabel: bestCash.label,
              amountFils: gapRemaining,
              isLiquid: true,
            },
            coveredInstallments: [],
            totalValueFils: bestCommodity.totalFils + gapRemaining,
          });
        }
      }
    }
  }

  // ── 3. matured_deposit ───────────────────────────────────────────────
  for (const a of cashAccounts) {
    if (!a.is_fixed_deposit) continue;
    if (!a.fixed_deposit_start_date || !a.fixed_deposit_period_months) continue;
    const maturityDate = addMonthsIso(a.fixed_deposit_start_date, a.fixed_deposit_period_months);
    if (maturityDate > asOf) continue;

    recs.push({
      type: "matured_deposit",
      priority: "medium",
      rationale: `This fixed deposit started on ${formatIsoToUae(a.fixed_deposit_start_date)} and completed its ${a.fixed_deposit_period_months}-month term on ${formatIsoToUae(maturityDate)}. The funds are now fully accessible without penalty.`,
      title: `Fixed deposit matured: ${a.label}`,
      description: `Your fixed deposit "${a.label}" (${formatAed(a.current_balance_fils)}) matured on ${formatIsoToUae(maturityDate)} — these funds are now accessible for any need.`,
      accountId: a.id,
      accountLabel: a.label,
      balanceFils: a.current_balance_fils,
      maturityDate,
    });
  }

  // ── 4. rental_surplus ────────────────────────────────────────────────
  for (const p of properties) {
    if (p.is_rental !== 1) continue;

    const annualRent = computeAnnualRentFils(p);
    if (annualRent === null || annualRent <= 0) continue;

    const propertyInstallments = unpaid.filter(
      (i) => i.property_id === p.id && i.due_date >= asOf,
    );
    const totalInstFils = propertyInstallments.reduce((sum, i) => sum + i.amount_fils, 0);
    if (totalInstFils === 0) continue;

    const coveragePct = Math.round((annualRent / totalInstFils) * 100);
    const surplusFils = Math.max(0, annualRent - totalInstFils);

    recs.push({
      type: "rental_surplus",
      priority: coveragePct >= 80 ? "high" : "medium",
      rationale: surplusFils > 0
        ? `${p.name} generates ${formatAed(annualRent)} in annual rent against ${formatAed(totalInstFils)} in upcoming installments — it's fully self-sustaining with a net surplus of ${formatAed(surplusFils)}/year.`
        : `${p.name}'s annual rent of ${formatAed(annualRent)} covers ${coveragePct}% of its upcoming installments (${formatAed(totalInstFils)}). The remaining ${formatAed(totalInstFils - annualRent)} must be covered from other sources.`,
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

  // ── 5. cash_gap ──────────────────────────────────────────────────────
  if (runway.withinHorizon && runway.shortfallDate && runway.daysUntilShortfall !== null) {
    recs.push({
      type: "cash_gap",
      priority: runway.daysUntilShortfall <= 30 ? "critical" : "high",
      rationale: `Your liquid cash of ${formatAed(runway.liquidCashFils)} cannot cover upcoming liabilities. The first shortfall of ${formatAed(runway.worstShortfallFils)} hits on ${formatIsoToUae(runway.shortfallDate)} — just ${runway.daysUntilShortfall} days away. Address this before it becomes critical.`,
      title: `Cash shortfall of ${formatAed(runway.worstShortfallFils)}`,
      description: `You run short by ${formatAed(runway.worstShortfallFils)} on ${formatIsoToUae(runway.shortfallDate)} (in ${runway.daysUntilShortfall} days). Consider selling a commodity, using matured deposits, or adding cash.`,
      shortfallDate: runway.shortfallDate,
      shortfallFils: runway.worstShortfallFils,
      daysUntil: runway.daysUntilShortfall,
    });
  }

  // ── Sort: critical → high → medium, then by option order within same type ──
  return recs.sort((a, b) => {
    const p = { critical: 0, high: 1, medium: 2 };
    if (p[a.priority] !== p[b.priority]) return p[a.priority] - p[b.priority];
    // same priority: grouped by type
    const typeOrder = { cash_gap: 0, sell_commodity: 1, combo: 2, matured_deposit: 3, rental_surplus: 4 };
    return (typeOrder[a.type] ?? 5) - (typeOrder[b.type] ?? 5);
  });
}

// ── simulateImpact ──────────────────────────────────────────────────────

export interface SimulatedImpact {
  before: RunwayResult;
  after: RunwayResult;
}

export function simulateImpact(
  move: SellCommodityMove | ComboMove,
  input: RunwayInput,
): SimulatedImpact {
  const before = computeRunway(input);
  // Combo: only the commodity sale is genuinely new liquidity.
  // The cash part is already included in liquidCashFils (runway input).
  const extra = move.type === "combo"
    ? move.commodity.sellValueFils
    : move.totalValueFils;
  const after = computeRunway({
    ...input,
    liquidCashFils: input.liquidCashFils + extra,
  });
  return { before, after };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function computeMarginPct(c: Commodity): number {
  if (!c.bought_price_per_unit_fils || c.bought_price_per_unit_fils <= 0) return 0;
  return Math.round(
    ((c.current_price_per_unit_fils - c.bought_price_per_unit_fils) / c.bought_price_per_unit_fils) * 100,
  );
}

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
