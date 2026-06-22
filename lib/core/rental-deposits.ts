/**
 * PURE functions for rental deposit schedule generation and status derivation.
 * No DB, no network, no mutations.
 */

import type { Property } from "@/lib/types";

export interface DepositScheduleEntry {
  chequeNumber: number;
  depositDate: string;   // ISO
  amountFils: number;    // never null, >= 0
}

/**
 * Generate the deposit schedule for a property's current rental config.
 * Distributes the annual rent across cheques (long-term) or periods (short-term),
 * absorbing any remainder in the last entry so sum(amountFils) === annual rent.
 * Skips entries whose source date is null (no NOT NULL violation downstream).
 */
export function generateDepositSchedule(p: Property): DepositScheduleEntry[] {
  if (!p.is_rental) return [];

  if (p.rental_type === "short_term") {
    return generateShortTermSchedule(p);
  }
  return generateLongTermSchedule(p);
}

function generateLongTermSchedule(p: Property): DepositScheduleEntry[] {
  const annual = p.annual_rent_fils;
  const cheques = p.rent_cheques_per_year;
  if (annual === null || annual <= 0 || cheques === null || cheques <= 0) return [];

  const dateKeys = ["rent_date_1", "rent_date_2", "rent_date_3", "rent_date_4"] as const;
  const entries: { slot: number; date: string }[] = [];
  for (let i = 0; i < cheques; i++) {
    const date = p[dateKeys[i] as keyof Property] as string | null;
    if (date) entries.push({ slot: i + 1, date });
  }

  const n = entries.length;
  if (n === 0) return [];

  const perCheque = Math.floor(annual / n);
  const remainder = annual - perCheque * n;

  return entries.map((e, i) => ({
    chequeNumber: e.slot,
    depositDate: e.date,
    amountFils: perCheque + (i === n - 1 ? remainder : 0),
  }));
}

function generateShortTermSchedule(p: Property): DepositScheduleEntry[] {
  // Computed from short_term_rent_deposit_date backward by stepMonths.
  // Same logic as runway.ts short-term inflow generation. Past deposit dates
  // are intentionally included (they show as "overdue" or can be marked
  // deposited retroactively for audit).
  //
  // Uses gross annual rent (short_term_annual_rent_fils), NOT net-after-commission.
  // Deposit cheques represent the gross amount received; commission is a later
  // expense. runway.ts uses net for liquidity projections, but deposit tracking
  // uses gross since it's what the PM actually remits.
  const annual = p.short_term_annual_rent_fils;
  const freq = p.short_term_return_frequency;
  const endDate = p.short_term_rent_deposit_date;
  if (annual === null || annual <= 0 || freq === null || !endDate) return [];

  const periodsPerYear = freq === "monthly" ? 12 : 4;
  const stepMonths = freq === "monthly" ? 1 : 3;
  const end = new Date(endDate + "T00:00:00Z");

  const dates: string[] = [];
  for (let i = periodsPerYear - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCMonth(d.getUTCMonth() - i * stepMonths, 1); // set to 1st to avoid auto-roll
    // Clamp day to last day of target month
    const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    const day = Math.min(end.getUTCDate(), lastDay);
    d.setUTCDate(day);
    dates.push(d.toISOString().slice(0, 10));
  }

  const n = dates.length;
  const perPeriod = Math.floor(annual / n);
  const remainder = annual - perPeriod * n;

  return dates.map((date, i) => ({
    chequeNumber: i + 1,
    depositDate: date,
    amountFils: perPeriod + (i === n - 1 ? remainder : 0),
  }));
}

/** Live deposit status — same semantics as liveInstallmentStatus in property-analytics.ts. */
export function depositStatus(
  deposit: { status: string; deposit_date: string; deposited_date: string | null },
  asOfIso: string,
): "deposited" | "overdue" | "pending" {
  if (deposit.status === "deposited" || deposit.deposited_date !== null) return "deposited";
  if (deposit.deposit_date < asOfIso) return "overdue";
  return "pending";
}
