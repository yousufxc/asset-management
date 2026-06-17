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

/**
 * Price per sqft in fils.
 * current_value_fils / size_sqft.
 * Returns null if either value is missing or size is zero.
 */
export function pricePerSqftFils(p: Property): number | null {
  const value = p.current_value_fils;
  const size = p.size_sqft;
  if (value === null || size === null || size <= 0) return null;
  return Math.round(value / size);
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
