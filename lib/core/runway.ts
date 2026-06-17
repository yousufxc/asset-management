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

export interface RentalPropertyInput {
  id: number;
  name: string;
  is_rental: 0 | 1;
  rental_type: string | null;
  annual_rent_fils: number | null;
  rent_cheques_per_year: number | null;
  rent_date_1: string | null; // ISO
  rent_date_2: string | null; // ISO
  rent_date_3: string | null; // ISO
  rent_date_4: string | null; // ISO
  pm_company_name: string | null;
  pm_commission_pct: number | null;
  short_term_annual_rent_fils: number | null;
  short_term_return_frequency: string | null;
  short_term_rent_deposit_date: string | null; // ISO
}

/** Add `months` months to an ISO date string, returning a new ISO date string. */
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const idx = (m - 1) + months;
  const ty = y + Math.floor(idx / 12);
  const tm = ((idx % 12) + 12) % 12; // 0–11
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const td = Math.min(d, lastDay);
  return `${String(ty).padStart(4, "0")}-${String(tm + 1).padStart(2, "0")}-${String(td).padStart(2, "0")}`;
}

/**
 * Generate rental inflow events from rental properties for the runway timeline.
 * Pure function — no DB, no network. maxDate caps the horizon.
 *
 * Long-term: recurring annual deposits based on cheques_per_year schedule.
 * Short-term: capped 12-month contract (non-recurring). Deposits step backward
 *   from final_deposit_date by the return frequency period.
 */
export function generateRentalInflows(
  properties: RentalPropertyInput[],
  maxDate: string,
): Inflow[] {
  const inflows: Inflow[] = [];
  const rentalProperties = properties.filter(
    (p) => p.is_rental === 1,
  );

  for (const prop of rentalProperties) {
    const rentalType = prop.rental_type ?? "long_term";

    if (rentalType === "short_term") {
      const netAnnualRent = computeShortTermNetAnnual(prop);
      if (netAnnualRent === null) continue;
      const frequency = prop.short_term_return_frequency;
      const finalDate = prop.short_term_rent_deposit_date;
      if (!frequency || !finalDate) continue;

      const periodsPerYear = frequency === "monthly" ? 12 : 4;
      const perPeriodFils = Math.round(netAnnualRent / periodsPerYear);

      // Generate up to periodsPerYear deposits stepping backward from the final date,
      // but no more than what fits before maxDate.
      let depositsAdded = 0;
      let monthsBack = 0;
      const freqMonths = frequency === "monthly" ? 1 : 3;

      while (depositsAdded < periodsPerYear) {
        const depositDate = subtractMonthsIso(finalDate, monthsBack);
        if (depositDate > maxDate) {
          monthsBack += freqMonths;
          continue;
        }
        inflows.push({
          id: prop.id * 2000 + depositsAdded,
          label: `Rent: ${prop.name} (${formatShortTermLabel(prop)} — deposit ${depositsAdded + 1})`,
          date: depositDate,
          amountFils: perPeriodFils,
        });
        depositsAdded++;
        monthsBack += freqMonths;
      }
      continue;
    }

    // ── LONG-TERM (existing logic) ──────────────────────────────────────
    if (!prop.annual_rent_fils || prop.annual_rent_fils <= 0) continue;
    const chequesPerYear = prop.rent_cheques_per_year;
    if (!chequesPerYear) continue;
    const annualRentFils = prop.annual_rent_fils;

    if (chequesPerYear === 12) {
      const firstDate = prop.rent_date_1;
      if (!firstDate) continue;
      const perMonthFils = Math.round(annualRentFils / 12);
      let monthIdx = 0;
      for (let d = firstDate; d <= maxDate; d = addMonthsIso(firstDate, monthIdx)) {
        inflows.push({
          id: prop.id * 1000 + monthIdx,
          label: `Rent: ${prop.name} (monthly)`,
          date: d,
          amountFils: perMonthFils,
        });
        monthIdx++;
      }
    } else {
      for (let n = 1; n <= chequesPerYear; n++) {
        const dates = [null, prop.rent_date_1, prop.rent_date_2, prop.rent_date_3, prop.rent_date_4];
        const chequeDate = dates[n];
        if (!chequeDate) continue;
        const perChequeFils = Math.round(annualRentFils / chequesPerYear);
        let yearOffset = 0;
        for (let d = addMonthsIso(chequeDate, 0); d <= maxDate; d = addMonthsIso(chequeDate, yearOffset * 12)) {
          inflows.push({
            id: prop.id * 1000 + n * 100 + yearOffset,
            label: `Rent: ${prop.name} (cheque ${n})`,
            date: d,
            amountFils: perChequeFils,
          });
          yearOffset++;
        }
      }
    }
  }

  return inflows;
}

/** Short-term net annual rent after commission. Integer-safe: rounds once. */
function computeShortTermNetAnnual(prop: RentalPropertyInput): number | null {
  if (!prop.short_term_annual_rent_fils || prop.short_term_annual_rent_fils <= 0) return null;
  const gross = prop.short_term_annual_rent_fils;
  const commissionPct = prop.pm_commission_pct ?? 0;
  return Math.round(gross * (100 - commissionPct) / 100);
}

/** Subtracts `months` months from an ISO date string, returning a new ISO date string. */
function subtractMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const idx = (m - 1) - months;
  const ty = y + Math.floor(idx / 12);
  const tm = ((idx % 12) + 12) % 12; // 0–11
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const td = Math.min(d, lastDay);
  return `${String(ty).padStart(4, "0")}-${String(tm + 1).padStart(2, "0")}-${String(td).padStart(2, "0")}`;
}

function formatShortTermLabel(prop: RentalPropertyInput): string {
  const parts: string[] = [];
  if (prop.pm_company_name) parts.push(prop.pm_company_name);
  if (prop.pm_commission_pct != null) parts.push(`${prop.pm_commission_pct}% comm`);
  return parts.join(" · ");
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

// ─── Liquidity warning (reuses computeRunway) ────────────────────────────

export interface LiquidityWarning {
  /** True when liquid cash + inflows < liabilities within the horizon window. */
  breached: boolean;
  /** Largest shortfall amount in fils (positive number), or 0 if not breached. */
  shortfallFils: number;
  /** Date of first shortfall (ISO), or null if not breached. */
  byDate: string | null;
  /** Days from asOf to the first shortfall date, or null. */
  daysUntil: number | null;
}

/**
 * Check whether liquidity is sufficient over the given window.
 * Thin wrapper around computeRunway; breached is driven by withinHorizon.
 */
export function checkLiquidityWarning(
  input: RunwayInput,
): LiquidityWarning {
  const runway = computeRunway(input);
  return {
    breached: runway.withinHorizon,
    shortfallFils: runway.worstShortfallFils,
    byDate: runway.shortfallDate,
    daysUntil: runway.daysUntilShortfall,
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
