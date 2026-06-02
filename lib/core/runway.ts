/**
 * PURE liquidity-runway math. No DB, no network. THIS IS THE HEART OF THE APP.
 *
 * Core question (CLAUDE.md §0): on a given future date, is there enough liquid
 * cash to cover what is owed — and if not, by how much and how many days out?
 *
 * Phase 2 will implement these. They are stubbed with full type contracts and a
 * "show your work" result shape now so the dashboard (rule 2.1) and DeepSeek's
 * implementation both build against a fixed interface.
 *
 * All amounts integer fils. All dates ISO 'YYYY-MM-DD'.
 */

export interface Liability {
  id: number;
  label: string;
  dueDate: string; // ISO
  amountFils: number;
  kind: "installment" | "other";
}

export interface Inflow {
  id: number;
  label: string;
  date: string; // ISO
  amountFils: number;
}

export interface RunwayInput {
  /** "Today" as ISO date, injected for testability (no Date.now() in pure core). */
  asOf: string;
  /** Sum of liquid cash available now, in fils. */
  liquidCashFils: number;
  /** Scheduled outflows (installments, etc.), already filtered to liabilities. */
  liabilities: Liability[];
  /** Expected inflows (rent, maturities). Optional; default none. */
  inflows?: Inflow[];
  /** Horizon in days for the liquidity warning window. Default 90. */
  horizonDays?: number;
}

export interface RunwayResult {
  asOf: string;
  liquidCashFils: number;
  /** First date (ISO) at which cumulative balance goes negative, or null if never within horizon. */
  shortfallDate: string | null;
  /** Days from asOf to shortfallDate, or null. */
  daysUntilShortfall: number | null;
  /** Largest shortfall amount within the horizon (fils, positive number), or 0. */
  worstShortfallFils: number;
  /** Ordered ledger of events with running balance — the show-your-work lineage. */
  timeline: Array<{
    date: string;
    label: string;
    deltaFils: number;
    runningBalanceFils: number;
  }>;
}

/**
 * Walk the timeline day-by-day (event-by-event) from asOf, applying inflows and
 * liabilities to the running liquid balance, and report the first/worst shortfall
 * within the horizon. MUST be deterministic and pure — no Date.now().
 */
export function computeRunway(_input: RunwayInput): RunwayResult {
  throw new Error("computeRunway: not implemented (Phase 2)");
}
