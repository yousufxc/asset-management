/**
 * PURE amortization math for mortgage calculations. No DB, no network.
 *
 * All money values are in integer fils (matching the app-wide convention).
 * Standard amortizing loan formula (principal + interest, equal monthly payments).
 *
 * Formula: PMT = P * r * (1+r)^n / ((1+r)^n - 1)
 *   where P = principal, r = monthly rate, n = total number of payments
 *
 * Outstanding balance after m payments:
 *   B = P * ((1+r)^n - (1+r)^m) / ((1+r)^n - 1)
 */

/** Compute the fixed monthly payment for a standard amortizing loan.
 *  Returns integer fils. For zero interest, returns principal / term. */
export function computeMonthlyPayment(
  principalFils: number,
  annualRatePct: number,
  termMonths: number,
): number {
  if (!Number.isFinite(principalFils) || principalFils < 0) {
    throw new Error(`computeMonthlyPayment: principal must be >= 0, got ${principalFils}`);
  }
  if (!Number.isFinite(annualRatePct) || annualRatePct < 0) {
    throw new Error(`computeMonthlyPayment: rate must be >= 0, got ${annualRatePct}`);
  }
  if (!Number.isInteger(termMonths) || termMonths <= 0) {
    throw new Error(`computeMonthlyPayment: term must be positive integer, got ${termMonths}`);
  }

  if (annualRatePct === 0) {
    return Math.round(principalFils / termMonths);
  }

  const r = annualRatePct / 100 / 12; // monthly interest rate (decimal)
  const n = termMonths;
  const pow = Math.pow(1 + r, n);
  const payment = (principalFils * r * pow) / (pow - 1);
  return Math.round(payment);
}

/** Compute the current outstanding (remaining) balance after a given number of
 *  monthly payments have elapsed. Returns integer fils.
 *
 *  monthsElapsed is the number of full monthly payment periods that have passed
 *  since the loan start date. If monthsElapsed >= termMonths, returns 0.
 *  If monthsElapsed <= 0, returns the full principal. */
export function computeOutstandingBalance(
  principalFils: number,
  annualRatePct: number,
  termMonths: number,
  monthsElapsed: number,
): number {
  if (!Number.isFinite(principalFils) || principalFils < 0) {
    throw new Error(`computeOutstandingBalance: principal must be >= 0, got ${principalFils}`);
  }
  if (!Number.isFinite(annualRatePct) || annualRatePct < 0) {
    throw new Error(`computeOutstandingBalance: rate must be >= 0, got ${annualRatePct}`);
  }
  if (!Number.isInteger(termMonths) || termMonths <= 0) {
    throw new Error(`computeOutstandingBalance: term must be positive integer, got ${termMonths}`);
  }
  if (!Number.isInteger(monthsElapsed) || monthsElapsed < 0) {
    throw new Error(`computeOutstandingBalance: monthsElapsed must be non-negative integer, got ${monthsElapsed}`);
  }

  if (monthsElapsed >= termMonths) return 0;
  if (monthsElapsed <= 0) return principalFils;

  if (annualRatePct === 0) {
    const paid = Math.round((principalFils / termMonths) * monthsElapsed);
    return principalFils - paid;
  }

  const r = annualRatePct / 100 / 12;
  const n = termMonths;
  const m = monthsElapsed;
  const powN = Math.pow(1 + r, n);
  const powM = Math.pow(1 + r, m);
  const balance = principalFils * (powN - powM) / (powN - 1);
  return Math.round(balance);
}

/** Compute the elapsed full months between two ISO dates.
 *  Used to determine how many payments have passed since the loan start.
 *  Returns 0 if end is before or equal to start. */
export function monthsElapsed(startDateIso: string, asOfIso: string): number {
  const start = new Date(`${startDateIso}T00:00:00Z`);
  const end = new Date(`${asOfIso}T00:00:00Z`);
  if (isNaN(start.getTime())) throw new Error(`monthsElapsed: invalid start date "${startDateIso}"`);
  if (isNaN(end.getTime())) throw new Error(`monthsElapsed: invalid asOf date "${asOfIso}"`);

  if (end <= start) return 0;

  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12
    + (end.getUTCMonth() - start.getUTCMonth());

  if (end.getUTCDate() < start.getUTCDate()) {
    months -= 1;
  }

  return Math.max(0, months);
}

/** Compute the loan end date as an ISO date string.
 *  Adds termMonths to the start date. */
export function computeLoanEndDate(startDateIso: string, termMonths: number): string {
  const d = new Date(`${startDateIso}T00:00:00Z`);
  if (isNaN(d.getTime())) throw new Error(`computeLoanEndDate: invalid start date "${startDateIso}"`);
  if (!Number.isInteger(termMonths) || termMonths <= 0) {
    throw new Error(`computeLoanEndDate: term must be positive integer, got ${termMonths}`);
  }

  const end = new Date(d);
  end.setUTCMonth(end.getUTCMonth() + termMonths);
  return end.toISOString().slice(0, 10);
}
