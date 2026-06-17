import { describe, it, expect } from "vitest";
import { computeRunway, generateRentalInflows } from "@/lib/core/runway";
import type { RunwayInput, RentalPropertyInput } from "@/lib/core/runway";

const asOf = "2026-06-01";
const horizonDays = 90;

describe("computeRunway", () => {
  it("no shortfall when cash always covers within horizon", () => {
    const input: RunwayInput = {
      asOf,
      liquidCashFils: 1_000_000, // AED 10,000
      liabilities: [
        { id: 1, label: "Installment A", dueDate: "2026-07-01", amountFils: 200_000, kind: "installment" },
        { id: 2, label: "Installment B", dueDate: "2026-08-01", amountFils: 300_000, kind: "installment" },
      ],
      horizonDays: 90,
    };
    const result = computeRunway(input);
    expect(result.shortfallDate).toBeNull();
    expect(result.daysUntilShortfall).toBeNull();
    expect(result.worstShortfallFils).toBe(0);
    expect(result.withinHorizon).toBe(false);
    expect(result.timeline.length).toBe(3); // start + 2 events
    expect(result.timeline[0]!.runningBalanceFils).toBe(1_000_000);
    // After first installment: 1,000,000 - 200,000 = 800,000
    expect(result.timeline[1]!.runningBalanceFils).toBe(800_000);
    // After second: 800,000 - 300,000 = 500,000
    expect(result.timeline[2]!.runningBalanceFils).toBe(500_000);
  });

  it("exact-zero: balance reaches 0 but does not go negative", () => {
    const input: RunwayInput = {
      asOf,
      liquidCashFils: 500_000,
      liabilities: [
        { id: 1, label: "Exact payment", dueDate: "2026-07-01", amountFils: 500_000, kind: "installment" },
      ],
      horizonDays: 90,
    };
    const result = computeRunway(input);
    expect(result.shortfallDate).toBeNull();
    expect(result.worstShortfallFils).toBe(0);
    // Running balance at exact 0 is not a shortfall
  });

  it("shortfall: correct date and amount", () => {
    const input: RunwayInput = {
      asOf,
      liquidCashFils: 1_000_000,
      liabilities: [
        { id: 1, label: "Small", dueDate: "2026-06-15", amountFils: 300_000, kind: "installment" },
        { id: 2, label: "Big", dueDate: "2026-07-01", amountFils: 900_000, kind: "installment" },
      ],
      horizonDays: 90,
    };
    const result = computeRunway(input);
    // After Small: 700,000. After Big: 700,000 - 900,000 = -200,000
    expect(result.shortfallDate).toBe("2026-07-01");
    expect(result.daysUntilShortfall).toBe(30); // from June 1 to July 1 = 30 days
    expect(result.worstShortfallFils).toBe(200_000);
    expect(result.withinHorizon).toBe(true); // 30 <= 90
  });

  it("tracks worst shortfall across multiple negative balances", () => {
    const input: RunwayInput = {
      asOf,
      liquidCashFils: 500_000,
      liabilities: [
        { id: 1, label: "A", dueDate: "2026-06-15", amountFils: 600_000, kind: "installment" },
        { id: 2, label: "B", dueDate: "2026-07-01", amountFils: 200_000, kind: "installment" },
      ],
      horizonDays: 90,
    };
    const result = computeRunway(input);
    // After A: 500,000 - 600,000 = -100,000 (first shortfall at June 15)
    // After B: -100,000 - 200,000 = -300,000 (worst at July 1)
    expect(result.shortfallDate).toBe("2026-06-15");
    expect(result.worstShortfallFils).toBe(300_000);
  });

  it("rental inflows shift/erase a shortfall", () => {
    const input: RunwayInput = {
      asOf,
      liquidCashFils: 1_000_000,
      liabilities: [
        { id: 1, label: "Big installment", dueDate: "2026-07-01", amountFils: 1_500_000, kind: "installment" },
      ],
      inflows: [
        { id: 100, label: "Rent income", date: "2026-06-15", amountFils: 750_000 },
      ],
      horizonDays: 90,
    };
    const result = computeRunway(input);
    // Start: 1,000,000
    // June 15: +750,000 rent = 1,750,000
    // July 1: -1,500,000 = 250,000 → no shortfall
    expect(result.shortfallDate).toBeNull();
    expect(result.worstShortfallFils).toBe(0);
    expect(result.timeline.length).toBe(3); // start + rent + installment
  });

  it("rental inflows reduce but do not eliminate shortfall", () => {
    const input: RunwayInput = {
      asOf,
      liquidCashFils: 500_000,
      liabilities: [
        { id: 1, label: "Big payment", dueDate: "2026-07-01", amountFils: 1_000_000, kind: "installment" },
      ],
      inflows: [
        { id: 100, label: "Rent", date: "2026-06-15", amountFils: 200_000 },
      ],
      horizonDays: 90,
    };
    const result = computeRunway(input);
    // Start: 500,000
    // June 15: +200,000 = 700,000
    // July 1: -1,000,000 = -300,000 → shortfall
    expect(result.shortfallDate).toBe("2026-07-01");
    expect(result.worstShortfallFils).toBe(300_000);
  });

  it("events before asOf are ignored", () => {
    const input: RunwayInput = {
      asOf,
      liquidCashFils: 1_000_000,
      liabilities: [
        { id: 1, label: "Past installment", dueDate: "2026-05-01", amountFils: 500_000, kind: "installment" },
      ],
      horizonDays: 90,
    };
    const result = computeRunway(input);
    // Past event is ignored because it's before asOf
    expect(result.shortfallDate).toBeNull();
    expect(result.timeline.length).toBe(1); // only starting cash
  });

  it("events beyond horizon are walked but shortfall is flagged outside window", () => {
    const input: RunwayInput = {
      asOf,
      liquidCashFils: 500_000,
      liabilities: [
        { id: 1, label: "Far future", dueDate: "2027-06-01", amountFils: 1_000_000, kind: "installment" },
      ],
      horizonDays: 90,
    };
    const result = computeRunway(input);
    // The shortfall IS detected across all events (uncapped)
    expect(result.shortfallDate).toBe("2027-06-01");
    expect(result.daysUntilShortfall).toBe(365);
    expect(result.withinHorizon).toBe(false);
    expect(result.worstShortfallFils).toBe(500_000);
    expect(result.timeline.length).toBe(2); // start + far-future event
  });

  it("multiple events on same date: outflows before inflows (conservative)", () => {
    const input: RunwayInput = {
      asOf,
      liquidCashFils: 500_000,
      liabilities: [
        { id: 1, label: "Payment", dueDate: "2026-06-15", amountFils: 400_000, kind: "installment" },
      ],
      inflows: [
        { id: 100, label: "Rent", date: "2026-06-15", amountFils: 200_000 },
      ],
      horizonDays: 90,
    };
    const result = computeRunway(input);
    // Order: outflow first (conservative), then inflow
    // 500,000 - 400,000 = 100,000 (outflow first, no shortfall)
    // 100,000 + 200,000 = 300,000
    expect(result.shortfallDate).toBeNull();
    expect(result.timeline[1]!.deltaFils).toBe(-400_000); // outflow first
    expect(result.timeline[2]!.deltaFils).toBe(200_000);  // inflow second
  });

  it("empty liabilities: no shortfall, timeline has only starting cash", () => {
    const result = computeRunway({ asOf, liquidCashFils: 1_000_000, liabilities: [], horizonDays: 90 });
    expect(result.shortfallDate).toBeNull();
    expect(result.timeline).toHaveLength(1);
    expect(result.timeline[0]!.label).toBe("Starting liquid cash");
  });

  it("shortfall at day 200 is reported uncapped, with withinHorizon false for 90-day window", () => {
    // 200 days from June 1 = Dec 18, 2026
    const input: RunwayInput = {
      asOf,
      liquidCashFils: 500_000,
      liabilities: [
        { id: 1, label: "Payment at day 200", dueDate: "2026-12-18", amountFils: 1_000_000, kind: "installment" },
      ],
      horizonDays: 90,
    };
    const result = computeRunway(input);
    expect(result.shortfallDate).toBe("2026-12-18");
    expect(result.daysUntilShortfall).toBe(200);
    expect(result.withinHorizon).toBe(false);
    expect(result.worstShortfallFils).toBe(500_000);
    // withinHorizon must be false since 200 > 90
  });
});

describe("generateRentalInflows", () => {
  const baseProp: RentalPropertyInput = {
    id: 1,
    name: "Marina Tower",
    is_rental: 1,
    rental_type: "long_term",
    annual_rent_fils: 120_000, // AED 1,200
    rent_cheques_per_year: 1,
    rent_date_1: null,
    rent_date_2: null,
    rent_date_3: null,
    rent_date_4: null,
    pm_company_name: null,
    pm_commission_pct: null,
    short_term_annual_rent_fils: null,
    short_term_return_frequency: null,
    short_term_rent_deposit_date: null,
  };

  it("1 cheque: generates annual event at the given date", () => {
    const prop = { ...baseProp, rent_cheques_per_year: 1, rent_date_1: "2026-02-15" };
    const inflows = generateRentalInflows([prop], "2027-06-01");
    expect(inflows.length).toBe(2);
    expect(inflows[0]!.date).toBe("2026-02-15");
    expect(inflows[0]!.amountFils).toBe(120_000);
    expect(inflows[0]!.label).toBe("Rent: Marina Tower (cheque 1)");
    expect(inflows[1]!.date).toBe("2027-02-15");
  });

  it("2 cheques with explicit dates: inflows on exact dates (not approximated intervals)", () => {
    const prop = {
      ...baseProp,
      rent_cheques_per_year: 2,
      rent_date_1: "2026-01-15",
      rent_date_2: "2026-07-01",
    };
    const inflows = generateRentalInflows([prop], "2027-06-01");
    expect(inflows.length).toBe(3);
    expect(inflows.find((i) => i.date === "2026-01-15" && i.label.includes("cheque 1"))?.amountFils).toBe(60_000);
    expect(inflows.find((i) => i.date === "2027-01-15" && i.label.includes("cheque 1"))?.amountFils).toBe(60_000);
    expect(inflows.find((i) => i.date === "2026-07-01" && i.label.includes("cheque 2"))?.amountFils).toBe(60_000);
    expect(inflows.find((i) => i.date === "2027-07-01")).toBeUndefined();
  });

  it("4 cheques with null date: skips that cheque", () => {
    const prop = {
      ...baseProp,
      rent_cheques_per_year: 4,
      rent_date_1: "2026-01-15",
      rent_date_2: "2026-03-01",
      rent_date_3: "2026-06-01",
      rent_date_4: null,
    };
    const inflows = generateRentalInflows([prop], "2027-06-01");
    expect(inflows.filter((i) => i.label.includes("cheque 1")).length).toBe(2);
    expect(inflows.filter((i) => i.label.includes("cheque 2")).length).toBe(2);
    expect(inflows.filter((i) => i.label.includes("cheque 3")).length).toBe(2);
    expect(inflows.filter((i) => i.label.includes("cheque 4")).length).toBe(0);
  });

  it("12 cheques (monthly): generates monthly events from rent_date_1", () => {
    const prop = {
      ...baseProp,
      rent_cheques_per_year: 12,
      rent_date_1: "2026-01-15",
    };
    const inflows = generateRentalInflows([prop], "2026-04-01");
    expect(inflows.length).toBe(3);
    expect(inflows[0]!.date).toBe("2026-01-15");
    expect(inflows[1]!.date).toBe("2026-02-15");
    expect(inflows[2]!.date).toBe("2026-03-15");
    expect(inflows[0]!.amountFils).toBe(10_000);
    expect(inflows[0]!.label).toBe("Rent: Marina Tower (monthly)");
  });

  it("12 cheques: null rent_date_1 produces no inflows", () => {
    const prop = {
      ...baseProp,
      rent_cheques_per_year: 12,
      rent_date_1: null,
    };
    expect(generateRentalInflows([prop], "2027-01-01")).toHaveLength(0);
  });

  it("property with is_rental=0 produces no inflows", () => {
    const prop = {
      ...baseProp,
      is_rental: 0 as const,
      rent_cheques_per_year: 2,
      rent_date_1: "2026-01-15",
      rent_date_2: "2026-07-01",
    };
    expect(generateRentalInflows([prop], "2027-01-01")).toHaveLength(0);
  });

  it("property with null annual_rent_fils produces no inflows", () => {
    const prop = {
      ...baseProp,
      annual_rent_fils: null,
      rent_cheques_per_year: 1,
      rent_date_1: "2026-01-15",
    };
    expect(generateRentalInflows([prop], "2027-01-01")).toHaveLength(0);
  });

  it("short-term monthly: 12 deposits backward from final date, non-recurring", () => {
    const prop: RentalPropertyInput = {
      ...baseProp,
      rental_type: "short_term",
      annual_rent_fils: null,
      rent_cheques_per_year: null,
      short_term_annual_rent_fils: 120_000, // AED 1,200 gross
      pm_commission_pct: 10, // 10%
      short_term_return_frequency: "monthly",
      short_term_rent_deposit_date: "2026-12-31",
    };
    const inflows = generateRentalInflows([prop], "2027-06-01");
    // Net annual = 120_000 * 0.9 = 108_000, per month = 9_000
    // 12 monthly deposits from Dec 31 backward: Dec, Nov, ... Jan
    expect(inflows.length).toBe(12);
    expect(inflows[0]!.date).toBe("2026-12-31");
    expect(inflows[0]!.amountFils).toBe(9_000);
    expect(inflows[11]!.date).toBe("2026-01-31");
    // No year 2 deposits (non-recurring)
    expect(inflows.every((i) => i.date.startsWith("2026"))).toBe(true);
  });

  it("short-term quarterly: 4 deposits backward from final date", () => {
    const prop: RentalPropertyInput = {
      ...baseProp,
      rental_type: "short_term",
      annual_rent_fils: null,
      rent_cheques_per_year: null,
      short_term_annual_rent_fils: 120_000,
      pm_commission_pct: 0,
      short_term_return_frequency: "quarterly",
      short_term_rent_deposit_date: "2026-12-31",
    };
    const inflows = generateRentalInflows([prop], "2027-06-01");
    // No commission, per quarter = 120_000 / 4 = 30_000
    expect(inflows.length).toBe(4);
    expect(inflows[0]!.date).toBe("2026-12-31");
    expect(inflows[0]!.amountFils).toBe(30_000);
    expect(inflows[3]!.date).toBe("2026-03-31");
  });

  it("short-term with commission correctly reduces net amount", () => {
    const prop: RentalPropertyInput = {
      ...baseProp,
      rental_type: "short_term",
      annual_rent_fils: null,
      rent_cheques_per_year: null,
      short_term_annual_rent_fils: 100_000,
      pm_commission_pct: 25, // 25% commission
      short_term_return_frequency: "quarterly",
      short_term_rent_deposit_date: "2026-12-31",
    };
    const inflows = generateRentalInflows([prop], "2027-06-01");
    // Net = 100_000 * 0.75 = 75_000, per quarter = 18_750
    expect(inflows[0]!.amountFils).toBe(18_750);
  });

  it("short-term: deposits capped by maxDate (only past-date deposits included)", () => {
    const prop: RentalPropertyInput = {
      ...baseProp,
      rental_type: "short_term",
      annual_rent_fils: null,
      rent_cheques_per_year: null,
      short_term_annual_rent_fils: 120_000,
      pm_commission_pct: 0,
      short_term_return_frequency: "monthly",
      short_term_rent_deposit_date: "2026-06-30",
    };
    // maxDate = 2026-03-01. Deposits backward: Jun, May, Apr, Mar — only Mar is <= maxDate? No.
    // Actually: Jun 30 > Mar 1, May 31 > Mar 1, Apr 30 > Mar 1, Mar 30 > Mar 1.
    // All past deposits fall after maxDate except... wait the deposit dates are in 2026.
    // Let me use a different maxDate that is earlier.
    const inflows = generateRentalInflows([prop], "2026-04-15");
    // Jun 30 > Apr 15, May 31 > Apr 15, Apr 30 > Apr 15 — all after. Only deposits on or before Apr 15.
    // Actually: Jun 30 > Apr 15 (skip), May 31 > Apr 15 (skip), Apr 30 > Apr 15 (skip), Mar 30 <= Apr 15 → include.
    // So Mar, Feb, Jan, Dec (of prior year) will be included because they're <= maxDate.
    // But we cap at 12 deposits, and backward from Jun 30: Jun, May, Apr, Mar, Feb, Jan, Dec 2025, etc.
    // Those <= Apr 15: Mar 30, Feb 28, Jan 30, Dec 2025, Nov, Oct, Sep, Aug, Jul, Jun 2025. That's 10 deposits.
    expect(inflows.length).toBeGreaterThan(0);
    expect(inflows.every((i) => i.date <= "2026-04-15")).toBe(true);
  });

  it("short-term with missing frequency produces no inflows", () => {
    const prop: RentalPropertyInput = {
      ...baseProp,
      rental_type: "short_term",
      annual_rent_fils: null,
      rent_cheques_per_year: null,
      short_term_annual_rent_fils: 120_000,
      pm_commission_pct: 0,
      short_term_return_frequency: null,
      short_term_rent_deposit_date: "2026-12-31",
    };
    expect(generateRentalInflows([prop], "2027-06-01")).toHaveLength(0);
  });

  it("short-term with missing final date produces no inflows", () => {
    const prop: RentalPropertyInput = {
      ...baseProp,
      rental_type: "short_term",
      annual_rent_fils: null,
      rent_cheques_per_year: null,
      short_term_annual_rent_fils: 120_000,
      pm_commission_pct: 0,
      short_term_return_frequency: "monthly",
      short_term_rent_deposit_date: null,
    };
    expect(generateRentalInflows([prop], "2027-06-01")).toHaveLength(0);
  });

  it("short-term with 0 commission and monthly: 12 equal deposits", () => {
    const prop: RentalPropertyInput = {
      ...baseProp,
      rental_type: "short_term",
      annual_rent_fils: null,
      rent_cheques_per_year: null,
      short_term_annual_rent_fils: 60_000,
      pm_commission_pct: 0,
      short_term_return_frequency: "monthly",
      short_term_rent_deposit_date: "2026-06-30",
    };
    const inflows = generateRentalInflows([prop], "2027-06-01");
    expect(inflows.length).toBe(12); // 12 monthly capped at one year
    expect(inflows.every((i) => i.amountFils === 5_000)).toBe(true); // 60_000 / 12
  });

  it("legacy rental_type=null coalesces to long_term and still generates inflows", () => {
    const prop = {
      ...baseProp,
      rental_type: null,
      rent_cheques_per_year: 1,
      rent_date_1: "2026-02-15",
    };
    const inflows = generateRentalInflows([prop], "2027-06-01");
    expect(inflows.length).toBeGreaterThanOrEqual(1);
    expect(inflows[0]!.label).toContain("cheque 1");
  });

  it("short-term monthly: 12 deposits in 12 distinct consecutive months (no month-end rollover)", () => {
    const prop: RentalPropertyInput = {
      ...baseProp,
      rental_type: "short_term",
      annual_rent_fils: null,
      rent_cheques_per_year: null,
      short_term_annual_rent_fils: 120_000,
      pm_commission_pct: 0,
      short_term_return_frequency: "monthly",
      short_term_rent_deposit_date: "2026-12-31",
    };
    const inflows = generateRentalInflows([prop], "2027-06-01");
    // Extract year-month pairs; 12 distinct months expected
    const yearMonths = inflows.map((i) => i.date.slice(0, 7));
    const unique = new Set(yearMonths);
    expect(unique.size).toBe(12);
    // Months must be consecutive backward: 2026-12, 2026-11, ..., 2026-01
    expect(unique.has("2026-12")).toBe(true);
    expect(unique.has("2026-11")).toBe(true);
    expect(unique.has("2026-10")).toBe(true);
    expect(unique.has("2026-09")).toBe(true);
    expect(unique.has("2026-08")).toBe(true);
    expect(unique.has("2026-07")).toBe(true);
    expect(unique.has("2026-06")).toBe(true);
    expect(unique.has("2026-05")).toBe(true);
    expect(unique.has("2026-04")).toBe(true);
    expect(unique.has("2026-03")).toBe(true);
    expect(unique.has("2026-02")).toBe(true);
    expect(unique.has("2026-01")).toBe(true);
  });
});
