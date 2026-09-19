import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import * as React from "react";
import InstalmentsTab, { groupMortgageRuns } from "@/app/(dashboard)/properties/InstalmentsTab";
import type { Property, Installment, Mortgage } from "@/lib/types";
import type { UnifiedPayment } from "@/lib/core/instalment-grouping";
import { formatAed } from "@/lib/core/units";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

// The repo's tsconfig uses the classic JSX runtime (jsx: "preserve"), so
// esbuild compiles components to React.createElement with a bare React
// identifier. Next injects it at build time; plain vitest does not, so
// expose React globally for the components under test.
(globalThis as { React?: unknown }).React = React;

const properties = [
  { id: 1, name: "Marina Tower 1204" },
  { id: 2, name: "Villa Palm" },
] as Property[];

const inst = (over: Partial<Installment>): Installment => ({
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
});

const installments = [
  inst({ id: 1, due_date: "2026-08-15", amount_fils: 50_000 }),
  inst({ id: 2, due_date: "2026-09-10", amount_fils: 25_000 }),
  inst({ id: 3, due_date: "2026-09-25", amount_fils: 100_000, milestone_label: "Structure 20%" }),
  inst({ id: 4, due_date: "2026-10-05", amount_fils: 10_000 }),
  inst({ id: 5, due_date: "2026-11-01", amount_fils: 20_000 }),
  inst({ id: 6, due_date: "2027-03-01", amount_fils: 500_000 }),
  inst({ id: 9, due_date: "2026-07-01", amount_fils: 30_000, paid_date: "2026-07-01" }),
];

const mortgages: Mortgage[] = [
  {
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
  },
];

describe("InstalmentsTab render smoke", () => {
  it("renders KPI cards, sections, rows, badges, and actions", () => {
    const html = renderToString(
      React.createElement(InstalmentsTab, {
        properties,
        installments,
        mortgages,
        asOfIso: "2026-09-20",
        onSelectProperty: () => {},
      }),
    ).replace(/<!-- -->/g, "");

    expect(html).toContain("Total Overdue");
    expect(html).toContain("AED 750.00");
    expect(html).toContain("Due Next 90 Days");
    expect(html).toContain("Total Remaining");
    expect(html).toContain("2 payment");

    expect(html).toContain("Overdue (2)");
    expect(html).toContain(formatAed(75_000));
    expect(html).toContain("Due This Month (1)");
    expect(html).toContain("Next 30 Days (2)");
    expect(html).toContain("Next 30–90 Days (3)");
    expect(html).toContain("Beyond 90 Days (2)");
    expect(html).toContain("<details");
    expect(html).toContain("Paid (9)");

    expect((html.match(/Mark paid/g) ?? []).length).toBe(6);
    expect((html.match(/Mark unpaid/g) ?? []).length).toBe(1);
    expect((html.match(/Instalment<\/span>/g) ?? []).length).toBe(7);
    // 4 upcoming mortgage singles + 2 collapsed paid mortgage groups (5+3)
    expect((html.match(/Mortgage<\/span>/g) ?? []).length).toBe(6);
    expect(html).toContain("Structure 20%");
    // 4 upcoming singles + 2 group lender labels
    expect((html.match(/Test Bank/g) ?? []).length).toBe(6);
    // the 8 paid mortgage payments are collapsed into two summary rows
    expect(html).toContain("5 payments × AED 10,000.00/month — Total: AED 50,000.00");
    expect(html).toContain("3 payments × AED 10,000.00/month — Total: AED 30,000.00");
    expect(html).toContain("Show 5");
    expect(html).toContain("Show 3");
    expect(html).toContain("Marina Tower 1204");
    expect(html).toContain("Villa Palm");
    expect(html).toContain("25/09/2026");
    expect(html).toContain("15/02/2026");
    expect((html.match(/pill overdue/g) ?? []).length).toBe(2);
    expect((html.match(/pill upcoming/g) ?? []).length).toBe(8); // 4 instalments + 4 mortgages
    expect((html.match(/pill paid/g) ?? []).length).toBe(1); // only the paid instalment; mortgage groups have no pill
  });

  it("paginates long sections to 20 rows with a show-more button", () => {
    const manyPaid = Array.from({ length: 25 }, (_, i) =>
      inst({
        id: 100 + i,
        due_date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
        amount_fils: 10_000,
        paid_date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
      }),
    );

    const html = renderToString(
      React.createElement(InstalmentsTab, {
        properties,
        installments: manyPaid,
        mortgages: [],
        asOfIso: "2026-09-20",
        onSelectProperty: () => {},
      }),
    ).replace(/<!-- -->/g, "");

    expect(html).toContain("Show more (5 remaining)");
    expect((html.match(/Mark unpaid/g) ?? []).length).toBe(20);
  });
});

describe("groupMortgageRuns (rendering-level mortgage collapsing)", () => {
  function mPay(key: string, dueDate: string, over: Partial<UnifiedPayment> = {}): UnifiedPayment {
    return {
      key,
      propertyId: 1,
      dueDate,
      amountFils: 1_000_000,
      type: "mortgage",
      status: "paid",
      milestoneLabel: null,
      lenderName: "Test Bank",
      installmentId: null,
      ...over,
    };
  }

  function iPay(dueDate: string): UnifiedPayment {
    return {
      key: `i${dueDate}`,
      propertyId: 1,
      dueDate,
      amountFils: 10_000,
      type: "installment",
      status: "paid",
      milestoneLabel: null,
      lenderName: null,
      installmentId: 9,
    };
  }

  it("collapses 3+ consecutive payments of the same mortgage into one group", () => {
    const rows = [mPay("m1-1", "2026-02-15"), mPay("m1-2", "2026-03-15"), mPay("m1-3", "2026-04-15"), mPay("m1-4", "2026-05-15")];
    const items = groupMortgageRuns(rows);
    expect(items).toHaveLength(1);
    expect(items[0]!.kind).toBe("group");
    if (items[0]!.kind === "group") {
      expect(items[0]!.count).toBe(4);
      expect(items[0]!.monthlyFils).toBe(1_000_000);
      expect(items[0]!.totalFils).toBe(4_000_000);
      expect(items[0]!.payments).toHaveLength(4);
    }
  });

  it("leaves runs of 2 as individual rows", () => {
    const rows = [mPay("m1-1", "2026-02-15"), mPay("m1-2", "2026-03-15")];
    const items = groupMortgageRuns(rows);
    expect(items.every((x) => x.kind === "single")).toBe(true);
    expect(items).toHaveLength(2);
  });

  it("an instalment breaks a mortgage run", () => {
    const rows = [
      mPay("m1-1", "2026-02-15"),
      mPay("m1-2", "2026-03-15"),
      mPay("m1-3", "2026-04-15"),
      iPay("2026-04-20"),
      mPay("m1-4", "2026-05-15"),
      mPay("m1-5", "2026-06-15"),
    ];
    const items = groupMortgageRuns(rows);
    expect(items).toHaveLength(4); // group(3) + instalment + single + single
    expect(items[0]!.kind).toBe("group");
    expect(items[1]!.kind).toBe("single");
    expect(items[2]!.kind).toBe("single");
    expect(items[3]!.kind).toBe("single");
  });

  it("does not merge different mortgage ids even with identical details", () => {
    const rows = [
      mPay("m1-1", "2026-02-15"), mPay("m1-2", "2026-03-15"), mPay("m1-3", "2026-04-15"),
      mPay("m2-1", "2026-05-15"), mPay("m2-2", "2026-06-15"), mPay("m2-3", "2026-07-15"),
    ];
    const items = groupMortgageRuns(rows);
    expect(items).toHaveLength(2);
    expect(items[0]!.kind).toBe("group");
    expect(items[1]!.kind).toBe("group");
  });

  it("never collapses instalments", () => {
    const rows = [iPay("2026-02-01"), iPay("2026-03-01"), iPay("2026-04-01")];
    expect(groupMortgageRuns(rows).every((x) => x.kind === "single")).toBe(true);
  });
});
