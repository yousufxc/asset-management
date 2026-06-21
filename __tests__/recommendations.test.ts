import { describe, it, expect } from "vitest";
import {
  computeRecommendations,
  simulateImpact,
} from "@/lib/core/recommendations";
import type { RecommendationInput, SellCommodityMove } from "@/lib/core/recommendations";
import type { RunwayInput } from "@/lib/core/runway";
import type { Property, CashAccount, Commodity, Installment } from "@/lib/types";

const asOf = "2026-06-01";
const horizonDays = 90;

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 1, name: "Test Property", subcategory: "existing", property_type: null,
    bedrooms: null, city: null, area: null, developer: null, size_sqft: null,
    annual_service_charge_fils: null, purchase_price_fils: null, purchased_at: null,
    current_value_fils: null, valued_at: null, is_rental: 0, rental_type: null,
    annual_rent_fils: null, rent_cheques_per_year: null,
    rent_date_1: null, rent_date_2: null, rent_date_3: null, rent_date_4: null,
    pm_company_name: null, pm_commission_pct: null,
    short_term_annual_rent_fils: null, short_term_return_frequency: null,
    short_term_rent_deposit_date: null, notes: null,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeCash(overrides: Partial<CashAccount> = {}): CashAccount {
  return {
    id: 1, label: "Test Account", current_balance_fils: 500_000,
    interest_rate: null, is_fixed_deposit: 0, fixed_deposit_period_months: null,
    fixed_deposit_start_date: null, notes: null,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeCommodity(overrides: Partial<Commodity> = {}): Commodity {
  return {
    id: 1, metal_type: "gold", weight: 50, weight_unit: "gram",
    current_price_per_unit_fils: 5000, bought_price_per_unit_fils: 4000,
    purchase_date: "2025-01-01", current_price_date: "2026-06-01",
    notes: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeInstallment(overrides: Partial<Installment> = {}): Installment {
  return {
    id: 1, property_id: 1, due_date: "2026-07-01", amount_fils: 200_000,
    milestone_label: "Installment A", status: "upcoming",
    paid_date: null, paid_amount_fils: null, source: "manual",
    source_file: null, notes: null,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const runwayInput: RunwayInput = {
  asOf,
  liquidCashFils: 500_000,
  liabilities: [
    { id: 1, label: "Installment A", dueDate: "2026-07-01", amountFils: 300_000, kind: "installment" },
    { id: 2, label: "Installment B", dueDate: "2026-08-01", amountFils: 400_000, kind: "installment" },
  ],
};

// ─── sell_commodity ────────────────────────────────────────────────────────

describe("sell_commodity recommendations", () => {
  it("generates sell rec when shortfall exists and commodity covers an installment", () => {
    const input: RecommendationInput = {
      asOf,
      properties: [],
      cashAccounts: [],
      commodities: [
        makeCommodity({ id: 1, metal_type: "gold", weight: 50, current_price_per_unit_fils: 8000 }),
      ],
      installments: [
        makeInstallment({ id: 1, amount_fils: 200_000, status: "upcoming", due_date: "2026-07-01" }),
        makeInstallment({ id: 2, amount_fils: 400_000, status: "upcoming", due_date: "2026-08-01" }),
      ],
      liquidCashFils: 100_000,
      runwayInput: {
        asOf,
        liquidCashFils: 100_000,
        liabilities: [
          { id: 1, label: "I1", dueDate: "2026-07-01", amountFils: 200_000, kind: "installment" },
          { id: 2, label: "I2", dueDate: "2026-08-01", amountFils: 400_000, kind: "installment" },
        ],
        horizonDays: 90,
      },
    };

    const recs = computeRecommendations(input);
    const sellRecs = recs.filter((r) => r.type === "sell_commodity");
    expect(sellRecs.length).toBe(1);
    const r = sellRecs[0] as SellCommodityMove;
    expect(r.totalValueFils).toBe(400_000); // 50 * 8000
    expect(r.coveredInstallments.length).toBe(1);
    expect(r.coveredInstallments[0]!.id).toBe(1); // covers first installment
  });

  it("does NOT generate sell rec when there is no shortfall", () => {
    const input: RecommendationInput = {
      asOf,
      properties: [],
      cashAccounts: [],
      commodities: [makeCommodity()],
      installments: [
        makeInstallment({ id: 1, amount_fils: 100_000, status: "upcoming" }),
      ],
      liquidCashFils: 1_000_000,
      runwayInput: {
        asOf,
        liquidCashFils: 1_000_000,
        liabilities: [
          { id: 1, label: "I1", dueDate: "2026-07-01", amountFils: 100_000, kind: "installment" },
        ],
        horizonDays: 90,
      },
    };

    const recs = computeRecommendations(input);
    expect(recs.filter((r) => r.type === "sell_commodity")).toHaveLength(0);
  });

  it("greedy: one commodity covers multiple installments", () => {
    const input: RecommendationInput = {
      asOf,
      properties: [],
      cashAccounts: [],
      commodities: [
        makeCommodity({ weight: 100, current_price_per_unit_fils: 5000 }),
      ],
      installments: [
        makeInstallment({ id: 1, amount_fils: 100_000, status: "upcoming", due_date: "2026-07-01" }),
        makeInstallment({ id: 2, amount_fils: 150_000, status: "upcoming", due_date: "2026-08-01" }),
        makeInstallment({ id: 3, amount_fils: 100_000, status: "upcoming", due_date: "2026-09-01" }),
      ],
      liquidCashFils: 50_000,
      runwayInput: {
        asOf,
        liquidCashFils: 50_000,
        liabilities: [
          { id: 1, label: "I1", dueDate: "2026-07-01", amountFils: 100_000, kind: "installment" },
          { id: 2, label: "I2", dueDate: "2026-08-01", amountFils: 150_000, kind: "installment" },
          { id: 3, label: "I3", dueDate: "2026-09-01", amountFils: 100_000, kind: "installment" },
        ],
        horizonDays: 90,
      },
    };

    const recs = computeRecommendations(input);
    const sellRecs = recs.filter((r) => r.type === "sell_commodity");
    expect(sellRecs.length).toBe(1);
    const r = sellRecs[0] as SellCommodityMove;
    // 100 * 5000 = 500_000 total
    // covers: 100k + 150k + 100k = 350k, remaining = 150k
    expect(r.coveredInstallments.length).toBe(3);
    expect(r.surplusFils).toBe(150_000);
  });

  it("skips zero-price commodities", () => {
    const input: RecommendationInput = {
      asOf,
      properties: [],
      cashAccounts: [],
      commodities: [makeCommodity({ current_price_per_unit_fils: 0 })],
      installments: [
        makeInstallment({ id: 1, amount_fils: 100_000, status: "upcoming" }),
      ],
      liquidCashFils: 1,
      runwayInput: {
        asOf,
        liquidCashFils: 1,
        liabilities: [
          { id: 1, label: "I1", dueDate: "2026-07-01", amountFils: 100_000, kind: "installment" },
        ],
        horizonDays: 90,
      },
    };

    const recs = computeRecommendations(input);
    expect(recs.filter((r) => r.type === "sell_commodity")).toHaveLength(0);
  });

  it("scores critical for installment due within 30 days", () => {
    const input: RecommendationInput = {
      asOf,
      properties: [],
      cashAccounts: [],
      commodities: [makeCommodity({ weight: 50, current_price_per_unit_fils: 10000 })],
      installments: [
        makeInstallment({ id: 1, amount_fils: 200_000, status: "upcoming", due_date: "2026-06-15" }),
      ],
      liquidCashFils: 100_000,
      runwayInput: {
        asOf,
        liquidCashFils: 100_000,
        liabilities: [
          { id: 1, label: "Urgent", dueDate: "2026-06-15", amountFils: 200_000, kind: "installment" },
        ],
        horizonDays: 90,
      },
    };

    const recs = computeRecommendations(input);
    const sellRecs = recs.filter((r) => r.type === "sell_commodity") as SellCommodityMove[];
    expect(sellRecs.length).toBeGreaterThan(0);
    expect(sellRecs[0]!.priority).toBe("critical");
  });
});

// ─── matured_deposit ───────────────────────────────────────────────────────

describe("matured_deposit recommendations", () => {
  it("generates when deposit has matured", () => {
    const input: RecommendationInput = {
      asOf,
      properties: [],
      cashAccounts: [
        makeCash({
          id: 1, label: "FD Savings",
          is_fixed_deposit: 1,
          fixed_deposit_period_months: 12,
          fixed_deposit_start_date: "2025-05-01",
          current_balance_fils: 300_000,
        }),
        makeCash({ id: 2, label: "Current" }),
      ],
      commodities: [],
      installments: [],
      liquidCashFils: 300_000,
      runwayInput: { ...runwayInput, liquidCashFils: 300_000 },
    };

    const recs = computeRecommendations(input);
    const maturedRecs = recs.filter((r) => r.type === "matured_deposit");
    expect(maturedRecs.length).toBe(1);
    expect(maturedRecs[0]!.priority).toBe("medium");
    expect(maturedRecs[0]!.title).toContain("FD Savings");
  });

  it("does NOT generate when deposit has NOT matured yet", () => {
    const input: RecommendationInput = {
      asOf,
      properties: [],
      cashAccounts: [
        makeCash({
          is_fixed_deposit: 1,
          fixed_deposit_period_months: 12,
          fixed_deposit_start_date: "2026-06-01",
        }),
      ],
      commodities: [],
      installments: [],
      liquidCashFils: 500_000,
      runwayInput: { ...runwayInput, liquidCashFils: 500_000 },
    };

    const recs = computeRecommendations(input);
    expect(recs.filter((r) => r.type === "matured_deposit")).toHaveLength(0);
  });

  it("skips deposit with null start_date", () => {
    const input: RecommendationInput = {
      asOf,
      properties: [],
      cashAccounts: [
        makeCash({ is_fixed_deposit: 1, fixed_deposit_period_months: 12, fixed_deposit_start_date: null }),
      ],
      commodities: [],
      installments: [],
      liquidCashFils: 500_000,
      runwayInput: { ...runwayInput, liquidCashFils: 500_000 },
    };

    const recs = computeRecommendations(input);
    expect(recs.filter((r) => r.type === "matured_deposit")).toHaveLength(0);
  });
});

// ─── rental_surplus ────────────────────────────────────────────────────────

describe("rental_surplus recommendations", () => {
  it("shows surplus when rent exceeds installments", () => {
    const input: RecommendationInput = {
      asOf,
      properties: [
        makeProperty({
          id: 1, name: "Marina", is_rental: 1, annual_rent_fils: 120_000,
        }),
      ],
      cashAccounts: [],
      commodities: [],
      installments: [
        makeInstallment({ id: 1, property_id: 1, amount_fils: 40_000, status: "upcoming", due_date: "2026-07-01" }),
        makeInstallment({ id: 2, property_id: 1, amount_fils: 40_000, status: "upcoming", due_date: "2026-08-01" }),
      ],
      liquidCashFils: 500_000,
      runwayInput: { ...runwayInput, liquidCashFils: 500_000 },
    };

    const recs = computeRecommendations(input);
    const rentalRecs = recs.filter((r) => r.type === "rental_surplus");
    expect(rentalRecs.length).toBe(1);
    const r = rentalRecs[0]!;
    expect(r.title).toContain("150%"); // 120k / 80k = 150%
    expect(r.priority).toBe("high");
  });

  it("ignores overdue installments (only upcoming with due_date >= asOf)", () => {
    const input: RecommendationInput = {
      asOf,
      properties: [
        makeProperty({ id: 1, name: "Marina", is_rental: 1, annual_rent_fils: 100_000 }),
      ],
      cashAccounts: [],
      commodities: [],
      installments: [
        makeInstallment({ id: 1, property_id: 1, amount_fils: 50_000, status: "upcoming", due_date: "2025-05-01" }), // overdue — past asOf
      ],
      liquidCashFils: 500_000,
      runwayInput: { ...runwayInput, liquidCashFils: 500_000 },
    };

    const recs = computeRecommendations(input);
    expect(recs.filter((r) => r.type === "rental_surplus")).toHaveLength(0);
  });

  it("short-term rental uses net rent after commission", () => {
    const input: RecommendationInput = {
      asOf,
      properties: [
        makeProperty({
          id: 1, name: "ST Rental", is_rental: 1, rental_type: "short_term",
          short_term_annual_rent_fils: 120_000, pm_commission_pct: 10,
        }),
      ],
      cashAccounts: [],
      commodities: [],
      installments: [
        makeInstallment({ id: 1, property_id: 1, amount_fils: 90_000, status: "upcoming", due_date: "2026-07-01" }),
      ],
      liquidCashFils: 500_000,
      runwayInput: { ...runwayInput, liquidCashFils: 500_000 },
    };

    const recs = computeRecommendations(input);
    const rentalRecs = recs.filter((r) => r.type === "rental_surplus");
    expect(rentalRecs.length).toBe(1);
    const r = rentalRecs[0]!;
    // Net = 120_000 * 0.9 = 108_000; installments = 90_000; coverage = 120%
    expect(r.title).toContain("120%");
  });
});

// ─── cash_gap ───────────────────────────────────────────────────────────────

describe("cash_gap recommendations", () => {
  it("generates cash_gap when withinHorizon is true", () => {
    const input: RecommendationInput = {
      asOf,
      properties: [],
      cashAccounts: [],
      commodities: [],
      installments: [],
      liquidCashFils: 100_000,
      runwayInput: {
        asOf,
        liquidCashFils: 100_000,
        liabilities: [
          { id: 1, label: "Big", dueDate: "2026-07-01", amountFils: 200_000, kind: "installment" },
        ],
        horizonDays: 90,
      },
    };

    const recs = computeRecommendations(input);
    const gapRecs = recs.filter((r) => r.type === "cash_gap");
    expect(gapRecs.length).toBe(1);
    expect(gapRecs[0]!.title).toContain("shortfall");
  });

  it("does NOT generate cash_gap when no shortfall", () => {
    const input: RecommendationInput = {
      asOf,
      properties: [],
      cashAccounts: [],
      commodities: [],
      installments: [],
      liquidCashFils: 1_000_000,
      runwayInput: {
        asOf,
        liquidCashFils: 1_000_000,
        liabilities: [],
        horizonDays: 90,
      },
    };

    const recs = computeRecommendations(input);
    expect(recs.filter((r) => r.type === "cash_gap")).toHaveLength(0);
  });
});

// ─── simulateImpact ────────────────────────────────────────────────────────

describe("simulateImpact", () => {
  it("adds commodity value to liquid cash and recomputes runway", () => {
    const move: SellCommodityMove = {
      type: "sell_commodity",
      priority: "high",
      title: "Sell gold",
      description: "Sell gold",
      commodityId: 1,
      metalType: "gold",
      weight: 50,
      weightUnit: "gram",
      totalValueFils: 200_000,
      coveredInstallments: [
        { id: 1, label: "I1", dueDate: "2026-07-01", amountFils: 200_000 },
      ],
      surplusFils: 0,
    };

    const rInput: RunwayInput = {
      asOf,
      liquidCashFils: 100_000,
      liabilities: [
        { id: 1, label: "Big", dueDate: "2026-07-01", amountFils: 200_000, kind: "installment" },
      ],
      horizonDays: 90,
    };

    const { before, after } = simulateImpact(move, rInput);
    expect(before.shortfallDate).toBe("2026-07-01");
    expect(after.shortfallDate).toBeNull();
    expect(after.liquidCashFils).toBe(300_000); // 100_000 + 200_000
  });
});

// ─── priority ordering ─────────────────────────────────────────────────────

describe("priority ordering", () => {
  it("sorts critical before high before medium", () => {
    const input: RecommendationInput = {
      asOf,
      properties: [
        makeProperty({ id: 1, name: "Test", is_rental: 1, annual_rent_fils: 100_000 }),
      ],
      cashAccounts: [
        makeCash({
          id: 1, label: "Matured FD", is_fixed_deposit: 1,
          fixed_deposit_period_months: 12, fixed_deposit_start_date: "2025-01-01",
          current_balance_fils: 300_000,
        }),
      ],
      commodities: [
        makeCommodity({ weight: 50, current_price_per_unit_fils: 10000 }),
      ],
      installments: [
        makeInstallment({ id: 1, property_id: 1, amount_fils: 50_000, status: "upcoming", due_date: "2026-06-15" }),
        makeInstallment({ id: 2, property_id: 1, amount_fils: 50_000, status: "upcoming", due_date: "2026-08-01" }),
      ],
      liquidCashFils: 100_000,
      runwayInput: {
        asOf,
        liquidCashFils: 100_000,
        liabilities: [
          { id: 1, label: "Urgent", dueDate: "2026-06-15", amountFils: 200_000, kind: "installment" },
          { id: 2, label: "Later", dueDate: "2026-08-01", amountFils: 200_000, kind: "installment" },
        ],
        horizonDays: 90,
      },
    };

    const recs = computeRecommendations(input);
    expect(recs.length).toBeGreaterThan(1);
    const priorities = recs.map((r) => r.priority);
    const pOrder = { critical: 0, high: 1, medium: 2 };
    for (let i = 1; i < priorities.length; i++) {
      expect(pOrder[priorities[i - 1]!]).toBeLessThanOrEqual(pOrder[priorities[i]!]);
    }
  });
});
