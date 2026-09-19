/**
 * PURE unified payment timeline for the Instalments tab. No DB, no network.
 *
 * Turns instalments (stored per-payment rows) and mortgages (loan parameters,
 * materialised via mortgage-schedule) into one list of payments grouped into
 * chronological buckets, plus the KPI totals shown above the timeline.
 *
 * asOfIso is an INPUT everywhere (no Date.now()) for testability and so the
 * server-rendered HTML matches the client hydration.
 */

import type { Installment, Mortgage } from "@/lib/types";
import { installmentStatus } from "@/lib/core/installments";
import { generateMortgageSchedule } from "@/lib/core/mortgage-schedule";

export type UnifiedPaymentType = "installment" | "mortgage";
export type UnifiedPaymentStatus = "upcoming" | "overdue" | "paid";

export interface UnifiedPayment {
  key: string;
  propertyId: number;
  dueDate: string; // ISO YYYY-MM-DD
  amountFils: number;
  type: UnifiedPaymentType;
  status: UnifiedPaymentStatus;
  milestoneLabel: string | null;
  lenderName: string | null;
  /** Set only for instalments — drives the Mark Paid / Mark Unpaid action. */
  installmentId: number | null;
}

export function buildUnifiedPayments(
  installments: Installment[],
  mortgages: Mortgage[],
  asOfIso: string,
): UnifiedPayment[] {
  const payments: UnifiedPayment[] = [];

  for (const i of installments) {
    payments.push({
      key: `i${i.id}`,
      propertyId: i.property_id,
      dueDate: i.due_date,
      amountFils: i.amount_fils,
      type: "installment",
      status: installmentStatus(i, asOfIso),
      milestoneLabel: i.milestone_label,
      lenderName: null,
      installmentId: i.id,
    });
  }

  for (const m of mortgages) {
    for (const e of generateMortgageSchedule(m, asOfIso)) {
      payments.push({
        key: e.key,
        propertyId: e.propertyId,
        dueDate: e.dueDate,
        amountFils: e.amountFils,
        type: "mortgage",
        status: e.status,
        milestoneLabel: null,
        lenderName: e.lenderName,
        installmentId: null,
      });
    }
  }

  return payments;
}

export type TimelineGroup =
  | "overdue"
  | "due_this_month"
  | "next_30"
  | "next_60_90"
  | "beyond_90"
  | "paid";

export const TIMELINE_GROUPS: TimelineGroup[] = [
  "overdue",
  "due_this_month",
  "next_30",
  "next_60_90",
  "beyond_90",
  "paid",
];

export const GROUP_LABEL: Record<TimelineGroup, string> = {
  overdue: "Overdue",
  due_this_month: "Due This Month",
  next_30: "Next 30 Days",
  next_60_90: "Next 60–90 Days",
  beyond_90: "Beyond 90 Days",
  paid: "Paid",
};

/** ISO date + N calendar days (UTC arithmetic on the date itself). */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Last calendar day of the month containing `iso`, as ISO. */
export function endOfMonthIso(iso: string): string {
  const [y, m] = iso.split("-").map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/**
 * Bucket an unpaid payment by due date, or "paid".
 *
 * Order matters: overdue (past-due, unpaid) wins over "due this month";
 * "due this month" is the current calendar month; next_30 excludes the current
 * month; next_60_90 is (30, 90] days out; everything later is beyond_90.
 */
export function timelineGroup(p: UnifiedPayment, asOfIso: string): TimelineGroup {
  if (p.status === "paid") return "paid";
  if (p.dueDate < asOfIso) return "overdue";
  if (p.dueDate <= endOfMonthIso(asOfIso)) return "due_this_month";
  if (p.dueDate <= addDaysIso(asOfIso, 30)) return "next_30";
  if (p.dueDate <= addDaysIso(asOfIso, 90)) return "next_60_90";
  return "beyond_90";
}

export function groupTimeline(
  payments: UnifiedPayment[],
  asOfIso: string,
): Record<TimelineGroup, UnifiedPayment[]> {
  const groups: Record<TimelineGroup, UnifiedPayment[]> = {
    overdue: [],
    due_this_month: [],
    next_30: [],
    next_60_90: [],
    beyond_90: [],
    paid: [],
  };
  for (const p of payments) {
    groups[timelineGroup(p, asOfIso)].push(p);
  }
  for (const g of TIMELINE_GROUPS) {
    groups[g].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }
  return groups;
}

export interface KpiTotal {
  amountFils: number;
  count: number;
}

export interface KpiTotals {
  overdue: KpiTotal;
  dueThisMonth: KpiTotal;
  /** Everything unpaid due within the next 90 days (this month + next 30 + 60–90). */
  dueNext90: KpiTotal;
  /** Everything unpaid, regardless of when it is due. */
  remaining: KpiTotal;
}

export function computeKpiTotals(payments: UnifiedPayment[], asOfIso: string): KpiTotals {
  const groups = groupTimeline(payments, asOfIso);

  const sum = (g: TimelineGroup): KpiTotal => ({
    amountFils: groups[g].reduce((s, p) => s + p.amountFils, 0),
    count: groups[g].length,
  });

  const overdue = sum("overdue");
  const dueThisMonth = sum("due_this_month");
  const dueNext90 = {
    amountFils:
      groups.due_this_month.reduce((s, p) => s + p.amountFils, 0) +
      groups.next_30.reduce((s, p) => s + p.amountFils, 0) +
      groups.next_60_90.reduce((s, p) => s + p.amountFils, 0),
    count: groups.due_this_month.length + groups.next_30.length + groups.next_60_90.length,
  };
  const remaining = {
    amountFils:
      overdue.amountFils + dueNext90.amountFils + groups.beyond_90.reduce((s, p) => s + p.amountFils, 0),
    count: overdue.count + dueNext90.count + groups.beyond_90.length,
  };

  return { overdue, dueThisMonth, dueNext90, remaining };
}

/** Which KPI cards exist — each is a filter over the payment set. */
export type KpiKey = "overdue" | "due_this_month" | "next_90" | "remaining";

export const KPI_LABEL: Record<KpiKey, string> = {
  overdue: "Total Overdue",
  due_this_month: "Due This Month",
  next_90: "Due Next 90 Days",
  remaining: "Total Remaining",
};

/**
 * Does `p` belong to the set a KPI card summarises? Used so clicking a KPI
 * filters the timeline to exactly those payments (show-your-work, rule 2.1).
 */
export function kpiMatches(kpi: KpiKey, p: UnifiedPayment, asOfIso: string): boolean {
  switch (kpi) {
    case "overdue":
      return timelineGroup(p, asOfIso) === "overdue";
    case "due_this_month":
      return timelineGroup(p, asOfIso) === "due_this_month";
    case "next_90": {
      const g = timelineGroup(p, asOfIso);
      return g === "due_this_month" || g === "next_30" || g === "next_60_90";
    }
    case "remaining":
      return p.status !== "paid";
  }
}
