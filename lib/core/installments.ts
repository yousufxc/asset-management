/**
 * PURE installment-status logic. No DB, no network, no mutations.
 *
 * Overdue is COMPUTED ON READ (owner decision, Decision Log 2026-06-02).
 * Status "overdue" = due_date < asOf AND not paid. Never writes to the DB.
 *
 * asOf is an INPUT (no Date.now() inside) for testability.
 */

export interface InstallmentLike {
  status: string;
  due_date: string; // ISO YYYY-MM-DD
  paid_date: string | null;
}

export type LiveStatus = "upcoming" | "paid" | "overdue";

/**
 * Determine the live display status of an installment.
 *
 * - "paid" if the stored status is "paid" OR paid_date is set — paid always wins,
 *   even if the due date was in the past.
 * - "overdue" if due_date < asOf AND not paid — derived on read only.
 * - "upcoming" otherwise.
 */
export function installmentStatus(
  inst: InstallmentLike,
  asOfIso: string,
): LiveStatus {
  if (inst.status === "paid" || inst.paid_date !== null) return "paid";
  if (inst.due_date < asOfIso) return "overdue";
  return "upcoming";
}
