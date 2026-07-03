import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/core/chat";
import type { PortfolioSnapshot } from "@/lib/core/chat";

const emptySnapshot: PortfolioSnapshot = {
  properties: [],
  cashAccounts: [],
  commodities: [],
  installments: [],
};

const populatedSnapshot: PortfolioSnapshot = {
  properties: [
    {
      id: 1, name: "Marina Tower 1204", subcategory: "existing", property_type: "apartment",
      bedrooms: "2BR", city: "Dubai", area: "Dubai Marina", developer: "Emaar",
      size_sqft: 1200, annual_service_charge_fils: 1500000, purchase_price_fils: 150000000,
      purchased_at: "2024-01-15", current_value_fils: 180000000, valued_at: "2026-06-01",
      is_rental: 1, rental_type: "long_term", annual_rent_fils: 9000000, rent_cheques_per_year: 4,
      rent_date_1: "2026-01-15", rent_date_2: "2026-04-15", rent_date_3: "2026-07-15",
      rent_date_4: "2026-10-15", pm_company_name: null, pm_commission_pct: null,
      short_term_annual_rent_fils: null, short_term_return_frequency: null,
      short_term_rent_deposit_date: null, contract_start_date: "2025-01-01",
      notes: null, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: 2, name: "Villa 42", subcategory: "off_plan", property_type: "villa",
      bedrooms: "4BR", city: "Abu Dhabi", area: "Saadiyat", developer: "Aldar",
      size_sqft: 3500, annual_service_charge_fils: null, purchase_price_fils: 350000000,
      purchased_at: "2025-03-01", current_value_fils: null, valued_at: null,
      is_rental: 0, rental_type: null, annual_rent_fils: null, rent_cheques_per_year: null,
      rent_date_1: null, rent_date_2: null, rent_date_3: null, rent_date_4: null,
      pm_company_name: null, pm_commission_pct: null, short_term_annual_rent_fils: null,
      short_term_return_frequency: null, short_term_rent_deposit_date: null, contract_start_date: null,
      notes: null, created_at: "2025-03-01T00:00:00Z", updated_at: "2025-03-01T00:00:00Z",
    },
  ],
  cashAccounts: [
    {
      id: 1, label: "ENBD Savings", current_balance_fils: 50000000, interest_rate: 2.5,
      is_fixed_deposit: 0, fixed_deposit_period_months: null, fixed_deposit_start_date: null,
      notes: null, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: 2, label: "ADCB Fixed Deposit", current_balance_fils: 100000000, interest_rate: 4.0,
      is_fixed_deposit: 1, fixed_deposit_period_months: 12, fixed_deposit_start_date: "2025-12-01",
      notes: null, created_at: "2025-12-01T00:00:00Z", updated_at: "2025-12-01T00:00:00Z",
    },
  ],
  commodities: [
    {
      id: 1, metal_type: "gold", weight: 100, weight_unit: "gram",
      current_price_per_unit_fils: 300000, bought_price_per_unit_fils: 250000,
      target_sell_price_per_unit_fils: null, purchase_date: "2024-06-01",
      current_price_date: "2026-07-01", notes: null,
      created_at: "2024-06-01T00:00:00Z", updated_at: "2024-07-01T00:00:00Z",
    },
  ],
  installments: [
    {
      id: 1, property_id: 2, due_date: "2026-07-15", amount_fils: 50000000,
      milestone_label: "Construction milestone 3", status: "upcoming",
      paid_date: null, paid_amount_fils: null, source: "manual", source_file: null,
      notes: null, created_at: "2025-03-01T00:00:00Z", updated_at: "2025-03-01T00:00:00Z",
    },
    {
      id: 2, property_id: 2, due_date: "2026-05-01", amount_fils: 40000000,
      milestone_label: "Construction milestone 2", status: "paid",
      paid_date: "2026-05-01", paid_amount_fils: 40000000, source: "manual", source_file: null,
      notes: null, created_at: "2025-03-01T00:00:00Z", updated_at: "2026-05-01T00:00:00Z",
    },
  ],
};

describe("buildSystemPrompt", () => {
  it("returns a string containing today's date", () => {
    const result = buildSystemPrompt(emptySnapshot, "2026-07-04");
    expect(result).toContain("2026-07-04");
  });

  it("includes KYNZi branding", () => {
    const result = buildSystemPrompt(emptySnapshot, "2026-07-04");
    expect(result).toContain("KYNZi");
  });

  it("handles empty portfolio gracefully", () => {
    const result = buildSystemPrompt(emptySnapshot, "2026-07-04");
    expect(result).toContain("AED 0");
    expect(result).not.toContain("## Cash Accounts");
    expect(result).not.toContain("## Properties");
    expect(result).not.toContain("## Commodities");
    expect(result).not.toContain("## Upcoming Installments");
  });

  it("includes cash account names and balances", () => {
    const result = buildSystemPrompt(populatedSnapshot, "2026-07-04");
    expect(result).toContain("ENBD Savings");
    expect(result).toContain("500,000");
  });

  it("includes property names and values", () => {
    const result = buildSystemPrompt(populatedSnapshot, "2026-07-04");
    expect(result).toContain("Marina Tower 1204");
    expect(result).toContain("1,800,000");
  });

  it("marks off-plan properties correctly", () => {
    const result = buildSystemPrompt(populatedSnapshot, "2026-07-04");
    expect(result).toContain("off-plan");
  });

  it("shows rental income info", () => {
    const result = buildSystemPrompt(populatedSnapshot, "2026-07-04");
    expect(result).toContain("rental");
  });

  it("includes upcoming installments (not paid)", () => {
    const result = buildSystemPrompt(populatedSnapshot, "2026-07-04");
    expect(result).toContain("Construction milestone 3");
    expect(result).not.toContain("Construction milestone 2"); // paid
  });

  it("includes commodities with current value", () => {
    const result = buildSystemPrompt(populatedSnapshot, "2026-07-04");
    expect(result).toContain("gold");
    expect(result).toContain("100 gram");
  });

  it("includes fixed deposit info with maturity", () => {
    const result = buildSystemPrompt(populatedSnapshot, "2026-07-04");
    expect(result).toContain("ADCB Fixed Deposit");
    expect(result).toContain("fixed deposit");
  });

  it("includes rules section", () => {
    const result = buildSystemPrompt(emptySnapshot, "2026-07-04");
    expect(result).toContain("## Rules");
  });

  it("shows correct net worth total", () => {
    // Cash: 50,000,000 + 100,000,000 = 150,000,000 fils = 1,500,000 AED
    // Property: 180,000,000 fils = 1,800,000 AED (Villa 42 has null value)
    // Commodity: 100g × 300,000 fils = 30,000,000 fils = 300,000 AED
    // Total: 150,000,000 + 180,000,000 + 30,000,000 = 360,000,000 fils = 3,600,000 AED
    const result = buildSystemPrompt(populatedSnapshot, "2026-07-04");
    expect(result).toContain("3,600,000");
  });

  it("shows correct liability total (only unpaid)", () => {
    // Only installment 1 (50,000,000 fils = 500,000 AED) is upcoming
    const result = buildSystemPrompt(populatedSnapshot, "2026-07-04");
    expect(result).toContain("500,000");
    expect(result).toContain("1 installment(s)");
  });
});
