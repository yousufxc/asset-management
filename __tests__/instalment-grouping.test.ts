import { describe, it, expect } from "vitest";
import {
  addDaysIso,
  buildUnifiedPayments,
  computeKpiTotals,
  endOfMonthIso,
  groupTimeline,
  kpiMatches,
  timelineGroup,
  type UnifiedPayment,
  type UnifiedPaymentStatus,
} from "@/lib/core/instalment-grouping";
import type { Installment, Mortgage } from "@/lib/types";

const AS_OF = "2026-09-20";

function inst(over: Partial<Installment> = {}): Installment {
  return {
    id: 1,
    property_id: 1,
    due_date: "2026-09-25",
    amount_fils: 100_000,
    milestone_label: null,
    status: "upcoming",
    paid_date: null,
    paid_amount_fils: null,
    source: "manual",
    source_file: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function mortgage(over: Partial<Mortgage> = {}): Mortgage {
  return {
    id: 1,
    property_id: 2,
    loan_amount_fils: 12_000_000,
    interest_rate_pct: 0,
    rate_type: "fixed",
    loan_start_date: "2026-01-15",
    loan_term_months: 12,
    lender_name: "Test Bank",
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("date helpers", () => {
  it("addDaysIso adds calendar days in UTC", () => {
    expect(addDaysIso("2026-09-20", 30)).toBe("2026-10-20");
    expect(addDaysIso("2026-09-20", 90)).toBe("2026-12-19");
  });

  it("endOfMonthIso returns the last day of the containing month", () => {
    expect(endOfMonthIso("2026-09-20")).toBe("2026-09-30");
    expect(endOfMonthIso("2026-02-03")).toBe("2026-02-28");
    expect(endOfMonthIso("2024-02-10")).toBe("2024-02-29"); // leap year
  });
});

describe("buildUnifiedPayments", () => {
  it("derives overdue on read for unpaid past-due instalments", () => {
    const [p] = buildUnifiedPayments(
      [inst({ id: 7, due_date: "2026-08-15", status: "upcoming" })],
      [],
      AS_OF,
    );
    expect(p!.status).toBe("overdue");
    expect(p!.installmentId).toBe(7);
    expect(p!.type).toBe("installment");
  });

  it("paid wins over a past due date", () => {
    const [p] = buildUnifiedPayments(
      [inst({ due_date: "2026-08-15", status: "upcoming", paid_date: "2026-08-10" })],
      [],
      AS_OF,
    );
    expect(p!.status).toBe("paid");
  });

  it("materialises mortgage payments with type mortgage", () => {
    const payments = buildUnifiedPayments([], [mortgage({})], AS_OF);
    const mPayments = payments.filter((p) => p.type === "mortgage");
    expect(mPayments).toHaveLength(12);
    expect(mPayments.filter((p) => p.status === "paid")).toHaveLength(8); // Feb..Sep < Sep 20
    expect(mPayments[0]!.lenderName).toBe("Test Bank");
    expect(mPayments[0]!.installmentId).toBeNull();
  });
});

describe("timelineGroup buckets", () => {
  function p(dueDate: string, status: UnifiedPaymentStatus): UnifiedPayment {
    return {
      key: "x",
      propertyId: 1,
      dueDate,
      amountFils: 100_000,
      type: "installment",
      status,
      milestoneLabel: null,
      lenderName: null,
      installmentId: 1,
    };
  }

  it("places unpaid past-due payments in overdue", () => {
    expect(timelineGroup(p("2026-09-10", "overdue"), AS_OF)).toBe("overdue");
  });

  it("places the current calendar month (not overdue) in due_this_month", () => {
    expect(timelineGroup(p("2026-09-25", "upcoming"), AS_OF)).toBe("due_this_month");
    expect(timelineGroup(p("2026-09-30", "upcoming"), AS_OF)).toBe("due_this_month");
  });

  it("places next-month payments within 30 days in next_30 (excluding current month)", () => {
    expect(timelineGroup(p("2026-10-05", "upcoming"), AS_OF)).toBe("next_30");
    expect(timelineGroup(p("2026-10-20", "upcoming"), AS_OF)).toBe("next_30"); // exactly 30 days
  });

  it("places 31–90 days out in next_60_90", () => {
    expect(timelineGroup(p("2026-10-21", "upcoming"), AS_OF)).toBe("next_60_90");
    expect(timelineGroup(p("2026-12-19", "upcoming"), AS_OF)).toBe("next_60_90"); // exactly 90 days
  });

  it("places >90 days out in beyond_90", () => {
    expect(timelineGroup(p("2026-12-20", "upcoming"), AS_OF)).toBe("beyond_90");
  });

  it("places paid payments in paid regardless of date", () => {
    expect(timelineGroup(p("2026-01-01", "paid"), AS_OF)).toBe("paid");
  });
});

describe("groupTimeline and KPI totals (hand-checked)", () => {
  // asOf = 2026-09-20. Mortgage: AED 10,000/month (0% of AED 120,000 / 12).
  const installments = [
    inst({ id: 1, property_id: 1, due_date: "2026-08-15", amount_fils: 50_000, status: "upcoming" }), // overdue
    inst({ id: 2, property_id: 1, due_date: "2026-09-10", amount_fils: 25_000, status: "upcoming" }), // overdue
    inst({ id: 3, property_id: 1, due_date: "2026-09-25", amount_fils: 100_000 }),                   // this month
    inst({ id: 4, property_id: 1, due_date: "2026-10-05", amount_fils: 10_000 }),                     // next 30
    inst({ id: 5, property_id: 1, due_date: "2026-11-01", amount_fils: 20_000 }),                     // 60–90
    inst({ id: 6, property_id: 1, due_date: "2027-03-01", amount_fils: 500_000 }),                    // beyond 90
    inst({ id: 9, property_id: 1, due_date: "2026-07-01", amount_fils: 30_000, paid_date: "2026-07-01" }), // paid
  ];

  it("sorts each group by due date ascending", () => {
    const payments = buildUnifiedPayments(installments, [], AS_OF);
    const groups = groupTimeline(payments, AS_OF);
    expect(groups.overdue.map((p) => p.key)).toEqual(["i1", "i2"]);
    for (const g of Object.values(groups)) {
      const dates = g.map((p) => p.dueDate);
      expect([...dates].sort((a, b) => a.localeCompare(b))).toEqual(dates);
    }
  });

  it("computes KPI totals across instalments and mortgages", () => {
    const payments = buildUnifiedPayments(installments, [mortgage({})], AS_OF);
    const k = computeKpiTotals(payments, AS_OF);

    expect(k.overdue).toEqual({ amountFils: 75_000, count: 2 });
    expect(k.dueThisMonth).toEqual({ amountFils: 100_000, count: 1 });

    // this month (100,000) + next_30 (10,000 + mortgage Oct 1,000,000)
    //   + next_60_90 (20,000 + mortgage Nov 1,000,000 + mortgage Dec 1,000,000)
    expect(k.dueNext90).toEqual({ amountFils: 3_130_000, count: 6 });

    // overdue (75,000) + dueNext90 (3,130,000) + beyond_90 (500,000 + mortgage Jan 2027 1,000,000)
    expect(k.remaining).toEqual({ amountFils: 4_705_000, count: 10 });
  });
});

describe("kpiMatches (show-your-work filtering)", () => {
  const installments = [
    inst({ id: 1, due_date: "2026-08-15", status: "upcoming" }), // overdue
    inst({ id: 2, due_date: "2026-09-25" }),                     // this month
    inst({ id: 3, due_date: "2026-10-05" }),                     // next 30
    inst({ id: 4, due_date: "2026-12-20" }),                     // beyond 90
    inst({ id: 5, due_date: "2026-07-01", paid_date: "2026-07-01" }), // paid
  ];
  const payments = buildUnifiedPayments(installments, [], AS_OF);
  const byKey = Object.fromEntries(payments.map((p) => [p.key, p]));

  it("overdue KPI matches only the overdue group", () => {
    expect(kpiMatches("overdue", byKey["i1"]!, AS_OF)).toBe(true);
    expect(kpiMatches("overdue", byKey["i2"]!, AS_OF)).toBe(false);
    expect(kpiMatches("overdue", byKey["i5"]!, AS_OF)).toBe(false);
  });

  it("next_90 KPI spans this-month, next 30 and 60–90 but not overdue or beyond", () => {
    expect(kpiMatches("next_90", byKey["i1"]!, AS_OF)).toBe(false);
    expect(kpiMatches("next_90", byKey["i2"]!, AS_OF)).toBe(true);
    expect(kpiMatches("next_90", byKey["i3"]!, AS_OF)).toBe(true);
    expect(kpiMatches("next_90", byKey["i4"]!, AS_OF)).toBe(false);
    expect(kpiMatches("next_90", byKey["i5"]!, AS_OF)).toBe(false);
  });

  it("remaining KPI matches everything unpaid, including overdue and beyond-90", () => {
    expect(kpiMatches("remaining", byKey["i1"]!, AS_OF)).toBe(true);
    expect(kpiMatches("remaining", byKey["i4"]!, AS_OF)).toBe(true);
    expect(kpiMatches("remaining", byKey["i5"]!, AS_OF)).toBe(false);
  });

  it("due_this_month KPI matches only that group", () => {
    expect(kpiMatches("due_this_month", byKey["i2"]!, AS_OF)).toBe(true);
    expect(kpiMatches("due_this_month", byKey["i3"]!, AS_OF)).toBe(false);
  });
});
