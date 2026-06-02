import { describe, it, expect } from "vitest";
import { computeRunway } from "@/lib/core/runway";
import type { RunwayInput } from "@/lib/core/runway";

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
