/**
 * PURE cash analytics functions. No DB, no network, no mutations.
 */

import type { CashAccount } from "@/lib/types";

export interface FixedVsRegularSplit {
  fixedFils: number;
  regularFils: number;
}

/** Split total balance into fixed-deposit and regular-account portions. */
export function splitFixedVsRegular(accounts: CashAccount[]): FixedVsRegularSplit {
  let fixedFils = 0;
  let regularFils = 0;
  for (const a of accounts) {
    if (a.is_fixed_deposit) {
      fixedFils += a.current_balance_fils;
    } else {
      regularFils += a.current_balance_fils;
    }
  }
  return { fixedFils, regularFils };
}

/**
 * Projected balance at the end of a fixed deposit contract period.
 * Principal + simple interest over the contract months.
 * Returns null if any required field is missing/zero (no projection possible).
 */
export function fixedDepositMaturityValueFils(a: CashAccount): number | null {
  if (!a.is_fixed_deposit) return null;
  if (a.fixed_deposit_period_months === null || a.fixed_deposit_period_months <= 0) return null;
  if (a.interest_rate === null || a.interest_rate < 0) return null;

  const principal = a.current_balance_fils;
  const rate = a.interest_rate / 100;
  const years = a.fixed_deposit_period_months / 12;

  const interestFils = Math.round(principal * rate * years);
  return principal + interestFils;
}
