import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import * as React from "react";
import InstalmentsTab from "@/app/(dashboard)/properties/InstalmentsTab";
import type { Property, Installment, Mortgage } from "@/lib/types";
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
    expect((html.match(/Mortgage<\/span>/g) ?? []).length).toBe(12);
    expect(html).toContain("Structure 20%");
    expect((html.match(/Test Bank/g) ?? []).length).toBe(12);
    expect(html).toContain("Marina Tower 1204");
    expect(html).toContain("Villa Palm");
    expect(html).toContain("25/09/2026");
    expect(html).toContain("15/02/2026");
    expect((html.match(/pill overdue/g) ?? []).length).toBe(2);
    expect((html.match(/pill upcoming/g) ?? []).length).toBe(8); // 4 instalments + 4 mortgages
    expect((html.match(/pill paid/g) ?? []).length).toBe(9);
  });
});
