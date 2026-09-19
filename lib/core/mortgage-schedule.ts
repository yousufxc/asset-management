/**
 * PURE mortgage payment schedule generation for the Instalments view.
 * No DB, no network, no mutations.
 *
 * Mortgages are stored as loan parameters only — there are no per-payment
 * rows. This module materialises the monthly payments so they can sit
 * alongside instalments in one timeline.
 *
 * asOfIso is an INPUT (no Date.now() inside) for testability and to keep
 * server and client renders identical.
 */

import type { Mortgage } from "@/lib/types";
import { computeMonthlyPayment, addMonthsIso } from "@/lib/core/mortgage";

export interface MortgagePaymentEntry {
  /** Stable unique key for React lists and dedup: "m<id>-<paymentIndex>". */
  key: string;
  mortgageId: number;
  propertyId: number;
  dueDate: string; // ISO YYYY-MM-DD
  amountFils: number;
  type: "mortgage";
  status: "paid" | "upcoming";
  lenderName: string;
}

/**
 * Generate every monthly payment for a mortgage from loan start to term end.
 *
 * Payment k (1-based) is due `addMonthsIso(loan_start_date, k)`. Payments due
 * before asOf are assumed PAID (mortgages have no manual paid/unpaid toggle —
 * owner decision: they are informational), the rest are upcoming.
 */
export function generateMortgageSchedule(mortgage: Mortgage, asOfIso: string): MortgagePaymentEntry[] {
  const monthlyFils = computeMonthlyPayment(
    mortgage.loan_amount_fils,
    mortgage.interest_rate_pct,
    mortgage.loan_term_months,
  );

  const entries: MortgagePaymentEntry[] = [];
  for (let k = 1; k <= mortgage.loan_term_months; k++) {
    const dueDate = addMonthsIso(mortgage.loan_start_date, k);
    entries.push({
      key: `m${mortgage.id}-${k}`,
      mortgageId: mortgage.id,
      propertyId: mortgage.property_id,
      dueDate,
      amountFils: monthlyFils,
      type: "mortgage",
      status: dueDate < asOfIso ? "paid" : "upcoming",
      lenderName: mortgage.lender_name,
    });
  }
  return entries;
}
