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

function shortfallInput(liquidFils = 100_000, extraLiabilities: RunwayInput["liabilities"] = []): RunwayInput {
  return {
    asOf,
    liquidCashFils: liquidFils,
    liabilities: [
      { id: 1, label: "I1", dueDate: "2026-07-01", amountFils: 200_000, kind: "installment" },
      { id: 2, label: "I2", dueDate: "2026-08-01", amountFils: 400_000, kind: "installment" },
      ...extraLiabilities,
    ],
    horizonDays: 90,
  };
}

function noShortfallInput(): RunwayInput {
  return { asOf, liquidCashFils: 1_000_000, liabilities: [], horizonDays: 90 };
}

// ─── sell_commodity: gated on shortfall ────────────────────────────────────

describe("sell_commodity gating", () => {
  it("generates recs only when shortfall exists", () => {
    const input: RecommendationInput = {
      asOf, properties: [], cashAccounts: [],
      commodities: [makeCommodity()],
      installments: [makeInstallment({ amount_fils: 100_000 })],
      liquidCashFils: 1_000_000,
      runwayInput: noShortfallInput(),
    };
    const recs = computeRecommendations(input);
    expect(recs.filter((r) => r.type === "sell_commodity")).toHaveLength(0);
  });

  it("generates recs when withinHorizon is true", () => {
    const input: RecommendationInput = {
      asOf, properties: [], cashAccounts: [],
      commodities: [makeCommodity({ weight: 50, current_price_per_unit_fils: 10000 })],
      installments: [
        makeInstallment({ id: 1, amount_fils: 200_000, status: "upcoming", due_date: "2026-07-01" }),
      ],
      liquidCashFils: 100_000,
      runwayInput: shortfallInput(100_000),
    };
    const recs = computeRecommendations(input);
    expect(recs.filter((r) => r.type === "sell_commodity").length).toBeGreaterThan(0);
  });
});

// ─── minimal option ───────────────────────────────────────────────────────

describe("sell_commodity: minimal option", () => {
  it("covers only the first unpaid installment", () => {
    const input: RecommendationInput = {
      asOf, properties: [], cashAccounts: [],
      commodities: [makeCommodity({ weight: 50, current_price_per_unit_fils: 10000 })],
      installments: [
        makeInstallment({ id: 1, amount_fils: 200_000, due_date: "2026-07-01" }),
        makeInstallment({ id: 2, amount_fils: 400_000, due_date: "2026-08-01" }),
      ],
      liquidCashFils: 100_000,
      runwayInput: shortfallInput(100_000),
    };
    const recs = computeRecommendations(input);
    const minimal = recs.filter((r) => r.type === "sell_commodity" && (r as SellCommodityMove).option === "minimal") as SellCommodityMove[];
    expect(minimal.length).toBe(1);
    expect(minimal[0]!.coveredInstallments).toHaveLength(1);
    expect(minimal[0]!.coveredInstallments[0]!.id).toBe(1);
    expect(minimal[0]!.weightToSell).toBeLessThan(50);
    expect(minimal[0]!.totalValueFils).toBeGreaterThanOrEqual(200_000);
  });

  it("has rationale and priority", () => {
    const input: RecommendationInput = {
      asOf, properties: [], cashAccounts: [],
      commodities: [makeCommodity({ weight: 50, current_price_per_unit_fils: 10000 })],
      installments: [makeInstallment({ id: 1, amount_fils: 200_000, due_date: "2026-06-15" })],
      liquidCashFils: 100_000,
      runwayInput: shortfallInput(100_000, [
        { id: 1, label: "Urgent", dueDate: "2026-06-15", amountFils: 200_000, kind: "installment" },
      ]),
    };
    const recs = computeRecommendations(input);
    const minimal = recs.filter((r) => r.type === "sell_commodity" && (r as SellCommodityMove).option === "minimal") as SellCommodityMove[];
    expect(minimal.length).toBeGreaterThan(0);
    expect(minimal[0]!.rationale).toBeTruthy();
    expect(minimal[0]!.priority).toBe("critical"); // due within 30 days
  });
});

// ─── full_coverage option ─────────────────────────────────────────────────

describe("sell_commodity: full_coverage option", () => {
  it("covers multiple installments via greedy allocation", () => {
    const input: RecommendationInput = {
      asOf, properties: [], cashAccounts: [],
      commodities: [makeCommodity({ weight: 100, current_price_per_unit_fils: 5000 })],
      installments: [
        makeInstallment({ id: 1, amount_fils: 100_000, due_date: "2026-07-01" }),
        makeInstallment({ id: 2, amount_fils: 150_000, due_date: "2026-08-01" }),
        makeInstallment({ id: 3, amount_fils: 100_000, due_date: "2026-09-01" }),
      ],
      liquidCashFils: 50_000,
      runwayInput: shortfallInput(50_000),
    };
    const recs = computeRecommendations(input);
    const fullCov = recs.filter((r) => r.type === "sell_commodity" && (r as SellCommodityMove).option === "full_coverage") as SellCommodityMove[];
    expect(fullCov.length).toBe(1);
    expect(fullCov[0]!.coveredInstallments.length).toBe(3);
    expect(fullCov[0]!.surplusFils).toBe(150_000); // 500k - 350k
  });

  it("skips if only 1 installment (minimal is enough)", () => {
    // full_coverage only generates if covered.length > 1
    const input: RecommendationInput = {
      asOf, properties: [], cashAccounts: [],
      commodities: [makeCommodity({ weight: 50, current_price_per_unit_fils: 10000 })],
      installments: [makeInstallment({ id: 1, amount_fils: 200_000, due_date: "2026-07-01" })],
      liquidCashFils: 100_000,
      runwayInput: shortfallInput(100_000),
    };
    const recs = computeRecommendations(input);
    const fullCov = recs.filter((r) => r.type === "sell_commodity" && (r as SellCommodityMove).option === "full_coverage") as SellCommodityMove[];
    expect(fullCov.length).toBe(0); // covered.length = 1, so no full_coverage
  });
});

// ─── best_value option ────────────────────────────────────────────────────

describe("sell_commodity: best_value option", () => {
  it("picks the commodity with lowest margin", () => {
    const input: RecommendationInput = {
      asOf, properties: [], cashAccounts: [],
      commodities: [
        makeCommodity({ id: 1, metal_type: "gold", current_price_per_unit_fils: 5000, bought_price_per_unit_fils: 4000, weight: 50 }),
        makeCommodity({ id: 2, metal_type: "silver", current_price_per_unit_fils: 3000, bought_price_per_unit_fils: 1000, weight: 100 }),
      ],
      installments: [
        makeInstallment({ id: 1, amount_fils: 100_000, due_date: "2026-07-01" }),
      ],
      liquidCashFils: 500,
      runwayInput: shortfallInput(500),
    };
    const recs = computeRecommendations(input);
    const bestValue = recs.filter((r) => r.type === "sell_commodity" && (r as SellCommodityMove).option === "best_value") as SellCommodityMove[];

    // gold margin = (5000-4000)/4000 = 25%; silver = (3000-1000)/1000 = 200%
    // gold has lowest margin → best value
    expect(bestValue.length).toBe(1);
    expect(bestValue[0]!.metalType).toBe("gold");
    expect(bestValue[0]!.rationale).toContain("silver");
  });

  it("does NOT generate best_value with only 1 commodity", () => {
    const input: RecommendationInput = {
      asOf, properties: [], cashAccounts: [],
      commodities: [makeCommodity({ weight: 50, current_price_per_unit_fils: 10000 })],
      installments: [makeInstallment({ id: 1, amount_fils: 100_000, due_date: "2026-07-01" })],
      liquidCashFils: 100_000,
      runwayInput: shortfallInput(100_000),
    };
    const recs = computeRecommendations(input);
    const bestValue = recs.filter((r) => r.type === "sell_commodity" && (r as SellCommodityMove).option === "best_value");
    expect(bestValue.length).toBe(0);
  });
});

// ─── combo ────────────────────────────────────────────────────────────────

describe("combo: commodity + cash", () => {
  it("generates combo when single commodity cannot fully cover the gap", () => {
    const input: RecommendationInput = {
      asOf, properties: [],
      cashAccounts: [
        makeCash({ id: 1, label: "ENBD Current", current_balance_fils: 300_000, is_fixed_deposit: 0 }),
      ],
      commodities: [
        makeCommodity({ id: 1, metal_type: "gold", weight: 20, current_price_per_unit_fils: 5000 }),
      ],
      installments: [makeInstallment({ id: 1, amount_fils: 200_000, due_date: "2026-07-01" })],
      liquidCashFils: 200_000, // 100k commodity + need 300k cash to cover 500k total gap? No, gap = 200k installment - 100k cash = 100k
      runwayInput: {
        asOf,
        liquidCashFils: 50_000,
        liabilities: [
          { id: 1, label: "Big", dueDate: "2026-07-01", amountFils: 200_000, kind: "installment" },
        ],
        horizonDays: 90,
      },
    };
    const recs = computeRecommendations(input);
    const combos = recs.filter((r) => r.type === "combo");
    // worstShortfallFils = 150_000 (50k cash - 200k liability)
    // commodity totalFils = 100_000 (20 * 5000)
    // gapRemaining = max(0, 150k - 100k) = 50k → check if any account has >= 50k
    // ENBD Current has 300k → combo generated
    expect(combos.length).toBe(1);
    expect(combos[0]!.rationale).toContain("gold");
  });

  it("does NOT generate combo when commodity fully covers the gap", () => {
    const input: RecommendationInput = {
      asOf, properties: [],
      cashAccounts: [makeCash({ id: 1, label: "ENBD", current_balance_fils: 500_000 })],
      commodities: [makeCommodity({ weight: 100, current_price_per_unit_fils: 10000 })],
      installments: [makeInstallment({ id: 1, amount_fils: 200_000, due_date: "2026-07-01" })],
      liquidCashFils: 50_000,
      runwayInput: {
        asOf, liquidCashFils: 50_000,
        liabilities: [{ id: 1, label: "Big", dueDate: "2026-07-01", amountFils: 200_000, kind: "installment" }],
        horizonDays: 90,
      },
    };
    const recs = computeRecommendations(input);
    // worstShortfallFils = 150k, commodity totalFils = 1M → gapRemaining ≤ 0 → no combo
    expect(recs.filter((r) => r.type === "combo")).toHaveLength(0);
  });
});

// ─── matured_deposit ───────────────────────────────────────────────────────

describe("matured_deposit", () => {
  it("generates with rationale when deposit matured", () => {
    const input: RecommendationInput = {
      asOf, properties: [], commodities: [], installments: [],
      cashAccounts: [
        makeCash({ id: 1, label: "FD", is_fixed_deposit: 1, fixed_deposit_period_months: 12,
          fixed_deposit_start_date: "2025-01-01", current_balance_fils: 500_000 }),
      ],
      liquidCashFils: 500_000,
      runwayInput: noShortfallInput(),
    };
    const recs = computeRecommendations(input);
    const matured = recs.filter((r) => r.type === "matured_deposit");
    expect(matured.length).toBe(1);
    expect(matured[0]!.rationale).toBeTruthy();
  });
});

// ─── rental_surplus ────────────────────────────────────────────────────────

describe("rental_surplus", () => {
  it("includes rationale with coverage explanation", () => {
    const input: RecommendationInput = {
      asOf, commodities: [], cashAccounts: [],
      properties: [makeProperty({ id: 1, name: "Marina", is_rental: 1, annual_rent_fils: 120_000 })],
      installments: [
        makeInstallment({ id: 1, property_id: 1, amount_fils: 50_000, due_date: "2026-07-01" }),
        makeInstallment({ id: 2, property_id: 1, amount_fils: 50_000, due_date: "2026-08-01" }),
      ],
      liquidCashFils: 500_000,
      runwayInput: noShortfallInput(),
    };
    const recs = computeRecommendations(input);
    const rental = recs.filter((r) => r.type === "rental_surplus");
    expect(rental.length).toBe(1);
    expect(rental[0]!.rationale).toContain("fully self-sustaining");
  });
});

// ─── cash_gap ──────────────────────────────────────────────────────────────

describe("cash_gap", () => {
  it("includes rationale with urgency", () => {
    const input: RecommendationInput = {
      asOf, properties: [], cashAccounts: [], commodities: [], installments: [],
      liquidCashFils: 50_000,
      runwayInput: {
        asOf, liquidCashFils: 50_000,
        liabilities: [{ id: 1, label: "Big", dueDate: "2026-07-01", amountFils: 200_000, kind: "installment" }],
        horizonDays: 90,
      },
    };
    const recs = computeRecommendations(input);
    const gap = recs.filter((r) => r.type === "cash_gap");
    expect(gap.length).toBe(1);
    expect(gap[0]!.rationale).toContain("cannot cover");
  });
});

// ─── simulateImpact ────────────────────────────────────────────────────────

describe("simulateImpact", () => {
  it("simulates sell_commodity", () => {
    const move: SellCommodityMove = {
      type: "sell_commodity", option: "minimal", priority: "high",
      title: "Sell gold", description: "Test", rationale: "Test",
      commodityId: 1, metalType: "gold", weight: 50, weightUnit: "gram",
      weightToSell: 20, totalValueFils: 200_000,
      coveredInstallments: [{ id: 1, label: "I1", dueDate: "2026-07-01", amountFils: 200_000 }],
      surplusFils: 0,
    };
    const input: RunwayInput = { asOf, liquidCashFils: 100_000,
      liabilities: [{ id: 1, label: "Big", dueDate: "2026-07-01", amountFils: 200_000, kind: "installment" }],
      horizonDays: 90 };
    const { before, after } = simulateImpact(move, input);
    expect(before.shortfallDate).toBe("2026-07-01");
    expect(after.shortfallDate).toBeNull();
    expect(after.liquidCashFils).toBe(300_000);
  });

  it("simulates combo move — only commodity value adds new liquidity", () => {
    const combo = {
      type: "combo" as const, priority: "high" as const,
      title: "Combo", description: "Test", rationale: "Test",
      commodity: { commodityId: 1, metalType: "gold", weightUnit: "gram", weightToSell: 20, sellValueFils: 100_000 },
      cash: { accountId: 1, accountLabel: "ENBD", amountFils: 50_000, isLiquid: true },
      coveredInstallments: [],
      totalValueFils: 150_000,
    };
    // liquidCashFils already includes the cash account's balance (50k).
    // Only the commodity sale (100k) is new liquidity.
    const input: RunwayInput = { asOf, liquidCashFils: 50_000,
      liabilities: [{ id: 1, label: "Big", dueDate: "2026-07-01", amountFils: 200_000, kind: "installment" }],
      horizonDays: 90 };
    const { before, after } = simulateImpact(combo, input);
    expect(before.shortfallDate).toBe("2026-07-01");
    // 50k cash + 100k commodity = 150k < 200k → still short
    expect(after.shortfallDate).toBe("2026-07-01");
    expect(after.worstShortfallFils).toBe(50_000);
  });
});

// ─── priority ordering ─────────────────────────────────────────────────────

describe("priority ordering", () => {
  it("critical before high before medium, cash_gap first in same priority", () => {
    const input: RecommendationInput = {
      asOf,
      properties: [
        makeProperty({ id: 1, name: "Test", is_rental: 1, annual_rent_fils: 100_000 }),
      ],
      cashAccounts: [
        makeCash({ id: 1, label: "Matured FD", is_fixed_deposit: 1,
          fixed_deposit_period_months: 12, fixed_deposit_start_date: "2025-01-01" }),
      ],
      commodities: [
        makeCommodity({ id: 1, metal_type: "gold", weight: 50, current_price_per_unit_fils: 10000, bought_price_per_unit_fils: 8000 }),
        makeCommodity({ id: 2, metal_type: "silver", weight: 80, current_price_per_unit_fils: 5000, bought_price_per_unit_fils: 4000 }),
      ],
      installments: [
        makeInstallment({ id: 1, property_id: 1, amount_fils: 50_000, due_date: "2026-06-15" }),
        makeInstallment({ id: 2, property_id: 1, amount_fils: 50_000, due_date: "2026-08-01" }),
      ],
      liquidCashFils: 100_000,
      runwayInput: {
        asOf, liquidCashFils: 100_000,
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

// ─── zero-value/edge cases ─────────────────────────────────────────────────

describe("edge cases", () => {
  it("skips zero-price commodities", () => {
    const input: RecommendationInput = {
      asOf, properties: [], cashAccounts: [],
      commodities: [makeCommodity({ current_price_per_unit_fils: 0 })],
      installments: [makeInstallment({ amount_fils: 100_000 })],
      liquidCashFils: 1,
      runwayInput: shortfallInput(1),
    };
    const recs = computeRecommendations(input);
    expect(recs.filter((r) => r.type === "sell_commodity")).toHaveLength(0);
  });

  it("skips fix-deposits with null start_date", () => {
    const input: RecommendationInput = {
      asOf, properties: [], commodities: [], installments: [],
      cashAccounts: [makeCash({ is_fixed_deposit: 1, fixed_deposit_period_months: 12, fixed_deposit_start_date: null })],
      liquidCashFils: 500_000,
      runwayInput: noShortfallInput(),
    };
    expect(computeRecommendations(input).filter((r) => r.type === "matured_deposit")).toHaveLength(0);
  });

  it("rental_surplus ignores overdue installments", () => {
    const input: RecommendationInput = {
      asOf, commodities: [], cashAccounts: [],
      properties: [makeProperty({ id: 1, name: "Marina", is_rental: 1, annual_rent_fils: 100_000 })],
      installments: [makeInstallment({ id: 1, property_id: 1, amount_fils: 50_000, due_date: "2025-05-01" })],
      liquidCashFils: 500_000,
      runwayInput: noShortfallInput(),
    };
    expect(computeRecommendations(input).filter((r) => r.type === "rental_surplus")).toHaveLength(0);
  });

  it("short-term rental uses net rent after commission", () => {
    const input: RecommendationInput = {
      asOf, commodities: [], cashAccounts: [],
      properties: [makeProperty({ id: 1, name: "ST Rental", is_rental: 1, rental_type: "short_term",
        short_term_annual_rent_fils: 120_000, pm_commission_pct: 10 })],
      installments: [makeInstallment({ id: 1, property_id: 1, amount_fils: 90_000, due_date: "2026-07-01" })],
      liquidCashFils: 500_000,
      runwayInput: noShortfallInput(),
    };
    const recs = computeRecommendations(input);
    const rental = recs.filter((r) => r.type === "rental_surplus");
    expect(rental.length).toBe(1);
    expect(rental[0]!.title).toContain("120%"); // 108k net / 90k
  });
});
