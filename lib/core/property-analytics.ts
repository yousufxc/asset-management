/**
 * PURE property analytics functions. No DB, no network, no mutations.
 *
 * Every function returns null for missing/zero inputs so charts never render
 * NaN or Infinity. All money types are integer fils — never AED in logic.
 */

import type { Property, Installment } from "@/lib/types";

// ---------------------------------------------------------------------------
// Rent helpers
// ---------------------------------------------------------------------------

/** Resolve the effective gross annual rent in fils for any rental type. */
export function effectiveAnnualRentFils(p: Property): number | null {
  if (!p.is_rental) return null;
  if (p.rental_type === "short_term") return p.short_term_annual_rent_fils;
  return p.annual_rent_fils; // long_term or default
}

/**
 * Net annual rent = effective gross rent - service charge - PM commission (if short-term).
 * Returns null when rental is not set up or rent is missing/zero.
 */
export function netAnnualRentFils(p: Property): number | null {
  const gross = effectiveAnnualRentFils(p);
  if (gross === null || gross <= 0) return null;
  let net = gross;
  if (p.annual_service_charge_fils !== null && p.annual_service_charge_fils > 0) {
    net -= p.annual_service_charge_fils;
  }
  if (p.rental_type === "short_term" && p.pm_commission_pct !== null && p.pm_commission_pct > 0) {
    net -= Math.round(gross * (p.pm_commission_pct / 100));
  }
  return net;
}

// ---------------------------------------------------------------------------
// Performance metrics
// ---------------------------------------------------------------------------

/**
 * Capital appreciation as a percentage.
 * ((current - purchase) / purchase) * 100.
 * Returns null if either value is missing or purchase_price is zero.
 */
export function appreciationPct(p: Property): number | null {
  const purchase = p.purchase_price_fils;
  const current = p.current_value_fils;
  if (purchase === null || current === null || purchase <= 0) return null;
  return ((current - purchase) / purchase) * 100;
}

/**
 * Rental yield as a percentage.
 * (net annual rent / purchase price) * 100.
 * Returns null if either value is missing or zero.
 */
export function rentalYieldPct(p: Property): number | null {
  const net = netAnnualRentFils(p);
  const purchase = p.purchase_price_fils;
  if (net === null || purchase === null || purchase <= 0) return null;
  return (net / purchase) * 100;
}

const SQM_TO_SQFT = 10.7639;

/**
 * Price per sqft in fils — always returns the metric normalized to sqft
 * regardless of the property's size_unit, so comparisons are consistent.
 * current_value_fils / (size_sqft * conversion).
 * Returns null if either value is missing or size is zero.
 */
export function pricePerSqftFils(p: Property): number | null {
  const value = p.current_value_fils;
  const size = p.size_sqft;
  if (value === null || size === null || size <= 0) return null;
  const sqftSize = p.size_unit === "sqm" ? size * SQM_TO_SQFT : size;
  return Math.round(value / sqftSize);
}

/**
 * Service charge as a percentage of effective gross rent.
 * (service charge / gross rent) * 100.
 * Returns null if either value is missing or zero.
 */
export function serviceChargeBurdenPct(p: Property): number | null {
  const gross = effectiveAnnualRentFils(p);
  const charge = p.annual_service_charge_fils;
  if (gross === null || gross <= 0 || charge === null || charge <= 0) return null;
  return (charge / gross) * 100;
}

// ---------------------------------------------------------------------------
// Installment analytics
// ---------------------------------------------------------------------------

/** Determine if an installment is overdue (due_date < asOf AND not paid). */
export function isInstallmentOverdue(
  inst: { status: string; due_date: string; paid_date: string | null },
  asOfIso: string,
): boolean {
  if (inst.status === "paid" || inst.paid_date !== null) return false;
  return inst.due_date < asOfIso;
}

/** Live installment status — same semantics as lib/core/installments.ts. */
export function liveInstallmentStatus(
  inst: Installment,
  asOfIso: string,
): "paid" | "overdue" | "upcoming" {
  if (inst.status === "paid" || inst.paid_date !== null) return "paid";
  if (inst.due_date < asOfIso) return "overdue";
  return "upcoming";
}

/** Build a cumulative timeline of upcoming (non-paid) installments sorted by due date. */
export interface TimelinePoint {
  dueDate: string;
  amountFils: number;
  cumulativeFils: number;
}

export function cumulativeInstallmentSchedule(
  installments: Installment[],
  asOfIso: string,
): TimelinePoint[] {
  const upcoming = installments
    .filter((inst) => inst.status !== "paid" && inst.paid_date === null)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  let running = 0;
  return upcoming.map((inst) => {
    running += inst.amount_fils;
    return { dueDate: inst.due_date, amountFils: inst.amount_fils, cumulativeFils: running };
  });
}

// ---------------------------------------------------------------------------
// Equity
// ---------------------------------------------------------------------------

/** Equity = current value - unpaid instalments. Returns null if no current value. */
export function equityFils(p: Property, installments: Installment[]): number | null {
  if (p.current_value_fils == null) return null;
  const unpaid = installments
    .filter((i) => i.status !== "paid" && i.paid_date === null)
    .reduce((sum, i) => sum + i.amount_fils, 0);
  return p.current_value_fils - unpaid;
}

// ---------------------------------------------------------------------------
// Instalment progress
// ---------------------------------------------------------------------------

/** Total instalment amount across all instalments for a property. */
export function totalInstalmentFils(installments: Installment[]): number {
  return installments.reduce((sum, i) => sum + i.amount_fils, 0);
}

/** Paid instalment amount (uses paid_amount_fils if present, else 0 for paid status). */
export function paidInstalmentFils(installments: Installment[]): number {
  return installments.reduce((sum, i) => {
    if (i.status === "paid" || i.paid_date !== null) {
      return sum + (i.paid_amount_fils ?? i.amount_fils);
    }
    return sum;
  }, 0);
}

/** Instalment progress 0-100. Returns null if no instalments. */
export function instalmentProgressPct(installments: Installment[]): number | null {
  const total = totalInstalmentFils(installments);
  if (total === 0) return null;
  return (paidInstalmentFils(installments) / total) * 100;
}

// ---------------------------------------------------------------------------
// Cash flow projection
// ---------------------------------------------------------------------------

export interface MonthlyCashFlow {
  month: string;        // YYYY-MM
  rentalInflow: number; // fils
  instalmentOutflow: number; // fils
  netFlow: number;      // fils
}

/** Project rental inflows vs instalment outflows for the next N months. */
export function projectCashFlow(
  properties: Property[],
  installments: Installment[],
  monthsAhead: number,
  asOfIso: string,
): MonthlyCashFlow[] {
  const today = new Date(asOfIso + "T00:00:00Z");
  const startYear = today.getUTCFullYear();
  const startMonth = today.getUTCMonth() + 1; // 1-indexed

  const months: MonthlyCashFlow[] = [];
  for (let i = 0; i < monthsAhead; i++) {
    const y = startYear + Math.floor((startMonth + i - 1) / 12);
    const m = ((startMonth + i - 1) % 12) + 1;
    const key = `${y}-${String(m).padStart(2, "0")}`;
    months.push({ month: key, rentalInflow: 0, instalmentOutflow: 0, netFlow: 0 });
  }

  // Rental inflows
  for (const p of properties) {
    if (p.subcategory === "off_plan" || !p.is_rental) continue;

    if (p.rental_type === "long_term") {
      const cheques = p.rent_cheques_per_year ?? 1;
      const annual = p.annual_rent_fils ?? 0;
      if (annual <= 0 || cheques <= 0) continue;
      const perCheque = Math.round(annual / cheques);

      for (const n of [1, 2, 3, 4] as const) {
        const dateKey = `rent_date_${n}` as keyof Property;
        const date = p[dateKey] as string | null;
        if (!date) continue;
        const d = new Date(date + "T00:00:00Z");
        const my = d.getUTCFullYear();
        const mm = d.getUTCMonth() + 1;
        const key = `${my}-${String(mm).padStart(2, "0")}`;
        const target = months.find((m) => m.month === key);
        if (target && n <= cheques) target.rentalInflow += perCheque;
      }
    }

    if (p.rental_type === "short_term") {
      const annual = p.short_term_annual_rent_fils ?? 0;
      if (annual <= 0) continue;
      const freq = p.short_term_return_frequency ?? "monthly";
      const periodsPerYear = freq === "monthly" ? 12 : 4;
      const perPeriod = Math.round(annual / periodsPerYear);

      // Start from deposit date, or today if absent
      const startIso = p.short_term_rent_deposit_date ?? asOfIso;
      const start = new Date(startIso + "T00:00:00Z");

      const stepMonths = freq === "monthly" ? 1 : 3;
      const startTotalMonths = start.getUTCFullYear() * 12 + start.getUTCMonth();
      const todayTotalMonths = today.getUTCFullYear() * 12 + today.getUTCMonth();
      let offset = Math.ceil((todayTotalMonths - startTotalMonths) / stepMonths);
      if (offset < 0) offset = 0;

      for (let i = offset; i < offset + monthsAhead; i++) {
        const periodDate = new Date(start);
        periodDate.setUTCMonth(periodDate.getUTCMonth() + i * stepMonths);
        const py = periodDate.getUTCFullYear();
        const pm = periodDate.getUTCMonth() + 1;
        const key = `${py}-${String(pm).padStart(2, "0")}`;
        const target = months.find((m) => m.month === key);
        if (target) target.rentalInflow += perPeriod;
      }
    }
  }

  // Instalment outflows
  for (const inst of installments) {
    if (inst.status === "paid" || inst.paid_date !== null) continue;
    const d = new Date(inst.due_date + "T00:00:00Z");
    const my = d.getUTCFullYear();
    const mm = d.getUTCMonth() + 1;
    const key = `${my}-${String(mm).padStart(2, "0")}`;
    const target = months.find((m) => m.month === key);
    if (target) target.instalmentOutflow += inst.amount_fils;
  }

  // Compute net
  for (const m of months) {
    m.netFlow = m.rentalInflow - m.instalmentOutflow;
  }

  return months;
}

// ---------------------------------------------------------------------------
// ROI metrics
// ---------------------------------------------------------------------------

/**
 * Total ROI snapshot: capital appreciation + this year's net rental income as a
 * percentage of purchase price. Uses netAnnualRentFils (defaults to 0 when
 * property is not rented). Returns null when purchase price or current value
 * is missing/zero.
 */
export function totalROIPct(p: Property): number | null {
  const purchase = p.purchase_price_fils;
  const current = p.current_value_fils;
  if (purchase === null || current === null || purchase <= 0) return null;
  const netRent = netAnnualRentFils(p) ?? 0;
  return ((current - purchase + netRent) / purchase) * 100;
}

/**
 * Annualized ROI: time-weighted capital appreciation plus rental yield.
 * Requires purchased_at to compute holding period. Falls back to totalROIPct
 * when purchased_at is missing. Returns null when purchase price or current
 * value is missing/zero.
 */
export function annualizedROIPct(p: Property, asOfIso: string): number | null {
  const purchase = p.purchase_price_fils;
  const current = p.current_value_fils;
  if (purchase === null || current === null || purchase <= 0) return null;
  if (p.purchased_at === null) return null;
  const today = new Date(asOfIso + "T00:00:00Z");
  const purchased = new Date(p.purchased_at + "T00:00:00Z");
  const yearsHeld = Math.max(0.25, (today.getTime() - purchased.getTime()) / (365.25 * 86_400_000));
  const annualizedAppreciation = (Math.pow(current / purchase, 1 / yearsHeld) - 1) * 100;
  const netRent = netAnnualRentFils(p) ?? 0;
  const yieldPct = purchase > 0 ? (netRent / purchase) * 100 : 0;
  return annualizedAppreciation + yieldPct;
}

// ---------------------------------------------------------------------------
// Contract expiry
// ---------------------------------------------------------------------------

/** Days until the last rental cheque date of a long-term rental. Returns null if not applicable. */
export function daysUntilContractExpiry(p: Property, asOfIso: string): number | null {
  if (!p.is_rental || p.rental_type !== "long_term") return null;
  const cheques = p.rent_cheques_per_year ?? 0;
  if (cheques <= 0) return null;
  let furthest: string | null = null;
  for (const n of [1, 2, 3, 4] as const) {
    if (n > cheques) break;
    const key = `rent_date_${n}` as keyof Property;
    const date = p[key] as string | null;
    if (date && (furthest === null || date > furthest)) furthest = date;
  }
  if (!furthest) return null;
  const today = new Date(asOfIso + "T00:00:00Z").getTime();
  const expiry = new Date(furthest + "T00:00:00Z").getTime();
  return Math.floor((expiry - today) / 86_400_000);
}
