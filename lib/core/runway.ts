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
  /** First date (ISO) at which cumulative balance goes negative, or null if never. */
  shortfallDate: string | null;
  /** Days from asOf to shortfallDate (uncapped), or null. */
  daysUntilShortfall: number | null;
  /** Largest shortfall amount across ALL events (fils, positive number), or 0. */
  worstShortfallFils: number;
  /** True if shortfallDate is not null AND daysUntilShortfall <= horizonDays. */
  withinHorizon: boolean;
  /** Ordered ledger of events with running balance — the show-your-work lineage. */
  timeline: Array<{
    date: string;
    label: string;
    deltaFils: number;
    runningBalanceFils: number;
  }>;
}

/**
 * Walk ALL events in date order from asOf, applying inflows and
 * liabilities to the running liquid balance, and report the first/worst shortfall.
 * shortfallDate and daysUntilShortfall are the TRUE values across all events.
 * withinHorizon is true only if the shortfall is within horizonDays.
 * MUST be deterministic and pure — no Date.now().
 */
export function computeRunway(input: RunwayInput): RunwayResult {
  const { asOf, liquidCashFils, liabilities, inflows, horizonDays = 90 } = input;

  // Combine liabilities (outflows) and inflows into a single event stream
  const events: Array<{
    date: string;
    label: string;
    deltaFils: number;
  }> = [];

  for (const liab of liabilities) {
    events.push({
      date: liab.dueDate,
      label: `${liab.label} (${formatLabel(liab)})`,
      deltaFils: -liab.amountFils,
    });
  }

  if (inflows) {
    for (const inflow of inflows) {
      events.push({
        date: inflow.date,
        label: inflow.label,
        deltaFils: inflow.amountFils,
      });
    }
  }

  // Sort by date ASC, then by delta ASC (outflows before inflows on same date — conservative)
  events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.deltaFils - b.deltaFils;
  });

  let runningBalance = liquidCashFils;
  let firstShortfallDate: string | null = null;
  let worstShortfall = 0;

  // Build timeline — starts with opening balance
  const timeline: RunwayResult["timeline"] = [
    {
      date: asOf,
      label: "Starting liquid cash",
      deltaFils: liquidCashFils,
      runningBalanceFils: liquidCashFils,
    },
  ];

  for (const event of events) {
    // Skip events before asOf (shouldn't happen, but defensive)
    if (event.date < asOf) continue;

    runningBalance += event.deltaFils;

    timeline.push({
      date: event.date,
      label: event.label,
      deltaFils: event.deltaFils,
      runningBalanceFils: runningBalance,
    });

    if (runningBalance < 0) {
      if (firstShortfallDate === null) {
        firstShortfallDate = event.date;
      }
      const shortfall = -runningBalance;
      if (shortfall > worstShortfall) {
        worstShortfall = shortfall;
      }
    }
  }

  const daysUntil = firstShortfallDate ? daysBetween(asOf, firstShortfallDate) : null;
  const withinHorizon = firstShortfallDate !== null && daysUntil !== null && daysUntil <= horizonDays;

  return {
    asOf,
    liquidCashFils,
    shortfallDate: firstShortfallDate,
    daysUntilShortfall: daysUntil,
    worstShortfallFils: worstShortfall,
    withinHorizon,
    timeline,
  };
}

// ─── Pure date helpers (deterministic, no Date.now()) ─────────────────────

/** Add `days` days to an ISO date string, returning a new ISO date string. */
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Count calendar days from startIso to endIso (inclusive of start, exclusive of end). */
function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function formatLabel(liab: Liability): string {
  return liab.kind === "installment" ? "installment" : "liability";
}
