import type { Property, CashAccount, Commodity, Installment } from "@/lib/types";
import { filsToAed } from "@/lib/core/units";

export interface PortfolioSnapshot {
  properties: Property[];
  cashAccounts: CashAccount[];
  commodities: Commodity[];
  installments: Installment[];
}

export function buildSystemPrompt(snapshot: PortfolioSnapshot, asOfIso: string): string {
  const { properties, cashAccounts, commodities, installments } = snapshot;

  const totalCashFils = cashAccounts.reduce((s, a) => s + a.current_balance_fils, 0);
  const totalPropertyValueFils = properties.reduce((s, p) => s + (p.current_value_fils ?? 0), 0);
  const totalCommodityValueFils = commodities.reduce(
    (s, c) => s + Math.round(c.weight * c.current_price_per_unit_fils),
    0,
  );
  const totalNetWorthFils = totalCashFils + totalPropertyValueFils + totalCommodityValueFils;

  const upcomingInstallments = installments
    .filter((i) => i.status !== "paid")
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const totalLiabilitiesFils = upcomingInstallments.reduce((s, i) => s + i.amount_fils, 0);

  const rentalProperties = properties.filter(
    (p) => p.is_rental === 1 && p.annual_rent_fils != null && p.annual_rent_fils > 0,
  );

  const fixedDepositAccounts = cashAccounts.filter((a) => a.is_fixed_deposit === 1);

  const lines: string[] = [];

  lines.push("You are an AI assistant for KYNZi, a personal asset management platform.");
  lines.push("The platform helps the owner manage a multi-asset portfolio denominated in AED.");
  lines.push("");
  lines.push(`Today is ${asOfIso}.`);

  lines.push("");
  lines.push("## Portfolio Snapshot");
  lines.push(`- Total net worth: AED ${filsToAed(totalNetWorthFils).toLocaleString("en-AE")}`);
  lines.push(`- Liquid cash: AED ${filsToAed(totalCashFils).toLocaleString("en-AE")} across ${cashAccounts.length} account(s)`);
  lines.push(`- Property value: AED ${filsToAed(totalPropertyValueFils).toLocaleString("en-AE")}`);
  lines.push(`- Commodities value: AED ${filsToAed(totalCommodityValueFils).toLocaleString("en-AE")}`);
  lines.push(`- Upcoming liabilities: AED ${filsToAed(totalLiabilitiesFils).toLocaleString("en-AE")} across ${upcomingInstallments.length} installment(s)`);

  if (cashAccounts.length > 0) {
    lines.push("");
    lines.push("## Cash Accounts");
    for (const a of cashAccounts) {
      const fdLabel = a.is_fixed_deposit ? " [fixed deposit]" : "";
      lines.push(`- ${a.label}: AED ${filsToAed(a.current_balance_fils).toLocaleString("en-AE")}${fdLabel}`);
      if (a.interest_rate != null && a.interest_rate > 0) {
        lines.push(`  Interest rate: ${a.interest_rate}%`);
      }
    }
  }

  if (properties.length > 0) {
    lines.push("");
    lines.push("## Properties");
    for (const p of properties) {
      const valStr = p.current_value_fils != null
        ? `AED ${filsToAed(p.current_value_fils).toLocaleString("en-AE")}`
        : "value not set";
      const rentalStr = p.is_rental === 1
        ? ` (rental, AED ${filsToAed(p.annual_rent_fils ?? 0).toLocaleString("en-AE")}/year)`
        : p.subcategory === "off_plan"
          ? " (off-plan)"
          : "";
      lines.push(`- ${p.name}: ${valStr}${rentalStr} [${p.subcategory}, ${p.city ?? "unknown city"}]`);
    }
  }

  if (commodities.length > 0) {
    lines.push("");
    lines.push("## Commodities");
    for (const c of commodities) {
      const val = Math.round(c.weight * c.current_price_per_unit_fils);
      const boughtVal = Math.round(c.weight * c.bought_price_per_unit_fils);
      const gain = val - boughtVal;
      const gainPct = boughtVal > 0 ? ((gain / boughtVal) * 100).toFixed(1) : "N/A";
      lines.push(`- ${c.metal_type}: ${c.weight} ${c.weight_unit}, current value AED ${filsToAed(val).toLocaleString("en-AE")}, bought at AED ${filsToAed(boughtVal).toLocaleString("en-AE")} (${gain >= 0 ? "+" : ""}${gainPct}%)`);
    }
  }

  if (upcomingInstallments.length > 0) {
    lines.push("");
    lines.push("## Upcoming Installments");
    for (const i of upcomingInstallments) {
      const prop = properties.find((p) => p.id === i.property_id);
      const propName = prop ? prop.name : `Property #${i.property_id}`;
      lines.push(`- ${propName}: ${i.milestone_label ?? "Installment"} — AED ${filsToAed(i.amount_fils).toLocaleString("en-AE")} due ${i.due_date} [${i.status}]`);
    }
  }

  if (fixedDepositAccounts.length > 0) {
    lines.push("");
    lines.push("## Fixed Deposits");
    for (const a of fixedDepositAccounts) {
      const maturityDate = a.fixed_deposit_start_date && a.fixed_deposit_period_months
        ? addMonths(a.fixed_deposit_start_date, a.fixed_deposit_period_months)
        : null;
      const maturityStr = maturityDate ? `, matures ${maturityDate}` : "";
      lines.push(`- ${a.label}: AED ${filsToAed(a.current_balance_fils).toLocaleString("en-AE")} at ${a.interest_rate ?? "?"}%${maturityStr}`);
    }
  }

  if (rentalProperties.length > 0) {
    lines.push("");
    lines.push("## Rental Income");
    for (const p of rentalProperties) {
      const annualRentAed = filsToAed(p.annual_rent_fils ?? 0);
      const cheques = p.rent_cheques_per_year ?? "?";
      // Round to whole fils before filsToAed — it throws on non-integer input,
      // and annual_rent/cheques is often fractional (e.g. 10,000,000 fils / 12).
      const perCheque = cheques !== "?" ? filsToAed(Math.round((p.annual_rent_fils ?? 0) / (cheques as number))) : "?";
      lines.push(`- ${p.name}: AED ${annualRentAed.toLocaleString("en-AE")}/year (${cheques} cheque(s), ~AED ${perCheque.toLocaleString("en-AE")}/cheque)`);
    }
  }

  lines.push("");
  lines.push("## Rules");
  lines.push("- Answer concisely. The owner is not a financial expert — use plain language.");
  lines.push("- All amounts are in AED. Never convert to other currencies.");
  lines.push("- When you reference a specific asset or installment, be specific (name, amount, date).");
  lines.push("- If the owner asks about selling assets or liquidity strategy, consider the runway implications.");
  lines.push("- Do not give tax, legal, or regulated financial advice. Frame suggestions as options, not directives.");
  lines.push("- The system prompt changes as the owner updates their portfolio — do not reference data from memory.");

  return lines.join("\n");
}

function addMonths(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}
