import { describe, it, expect } from "vitest";
import {
  effectiveAnnualRentFils,
  netAnnualRentFils,
  appreciationPct,
  rentalYieldPct,
  pricePerSqftFils,
  serviceChargeBurdenPct,
  isInstallmentOverdue,
  liveInstallmentStatus,
  cumulativeInstallmentSchedule,
} from "@/lib/core/property-analytics";
import type { Property, Installment } from "@/lib/types";

function mkProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 1,
    name: "Test",
    subcategory: "existing",
    property_type: "apartment",
    bedrooms: "2BR",
    city: null,
    area: null,
    developer: null,
    size_sqft: null,
    annual_service_charge_fils: null,
    purchase_price_fils: null,
    purchased_at: null,
    current_value_fils: null,
    valued_at: null,
    is_rental: 0,
    rental_type: null,
    annual_rent_fils: null,
    rent_cheques_per_year: null,
    rent_date_1: null,
    rent_date_2: null,
    rent_date_3: null,
    rent_date_4: null,
    pm_company_name: null,
    pm_commission_pct: null,
    short_term_annual_rent_fils: null,
    short_term_return_frequency: null,
    short_term_rent_deposit_date: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function mkInstallment(overrides: Partial<Installment> = {}): Installment {
  return {
    id: 1,
    property_id: 1,
    due_date: "2026-12-01",
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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// effectiveAnnualRentFils
// ---------------------------------------------------------------------------
describe("effectiveAnnualRentFils", () => {
  it("returns null for non-rental property", () => {
    expect(effectiveAnnualRentFils(mkProperty({ is_rental: 0 }))).toBeNull();
  });

  it("returns annual_rent_fils for long_term rental", () => {
    expect(effectiveAnnualRentFils(mkProperty({ is_rental: 1, rental_type: "long_term", annual_rent_fils: 100_000 }))).toBe(100_000);
  });

  it("returns short_term_annual_rent_fils for short_term rental", () => {
    expect(effectiveAnnualRentFils(mkProperty({ is_rental: 1, rental_type: "short_term", short_term_annual_rent_fils: 200_000 }))).toBe(200_000);
  });

  it("falls back to annual_rent_fils when rental_type is null but is_rental", () => {
    expect(effectiveAnnualRentFils(mkProperty({ is_rental: 1, rental_type: null, annual_rent_fils: 50_000 }))).toBe(50_000);
  });
});

// ---------------------------------------------------------------------------
// netAnnualRentFils
// ---------------------------------------------------------------------------
describe("netAnnualRentFils", () => {
  it("subtracts service charge and PM commission from gross rent", () => {
    const p = mkProperty({
      is_rental: 1,
      rental_type: "short_term",
      short_term_annual_rent_fils: 300_000,
      annual_service_charge_fils: 20_000,
      pm_commission_pct: 10,
    });
    // 300_000 - 20_000 - 30_000 = 250_000
    expect(netAnnualRentFils(p)).toBe(250_000);
  });

  it("returns gross rent when no service charge or commission", () => {
    const p = mkProperty({ is_rental: 1, annual_rent_fils: 100_000 });
    expect(netAnnualRentFils(p)).toBe(100_000);
  });

  it("returns null for non-rental property", () => {
    expect(netAnnualRentFils(mkProperty({ is_rental: 0 }))).toBeNull();
  });

  it("returns null when gross rent is zero", () => {
    expect(netAnnualRentFils(mkProperty({ is_rental: 1, annual_rent_fils: 0 }))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// appreciationPct
// ---------------------------------------------------------------------------
describe("appreciationPct", () => {
  it("computes appreciation for a gain", () => {
    const p = mkProperty({ purchase_price_fils: 1_000_000, current_value_fils: 1_200_000 });
    expect(appreciationPct(p)).toBeCloseTo(20, 2);
  });

  it("computes appreciation for a loss", () => {
    const p = mkProperty({ purchase_price_fils: 1_000_000, current_value_fils: 900_000 });
    expect(appreciationPct(p)).toBeCloseTo(-10, 2);
  });

  it("returns null when purchase_price is null", () => {
    expect(appreciationPct(mkProperty({ current_value_fils: 1_000_000 }))).toBeNull();
  });

  it("returns null when current_value is null", () => {
    expect(appreciationPct(mkProperty({ purchase_price_fils: 1_000_000 }))).toBeNull();
  });

  it("returns null when purchase_price is zero", () => {
    expect(appreciationPct(mkProperty({ purchase_price_fils: 0, current_value_fils: 1_000_000 }))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// rentalYieldPct
// ---------------------------------------------------------------------------
describe("rentalYieldPct", () => {
  it("computes rental yield", () => {
    const p = mkProperty({
      is_rental: 1, annual_rent_fils: 80_000, purchase_price_fils: 1_000_000,
    });
    expect(rentalYieldPct(p)).toBeCloseTo(8, 2);
  });

  it("returns null when not a rental", () => {
    expect(rentalYieldPct(mkProperty({ purchase_price_fils: 1_000_000 }))).toBeNull();
  });

  it("returns null when purchase_price is null", () => {
    expect(rentalYieldPct(mkProperty({ is_rental: 1, annual_rent_fils: 80_000 }))).toBeNull();
  });

  it("returns null when purchase_price is zero", () => {
    expect(rentalYieldPct(mkProperty({ is_rental: 1, annual_rent_fils: 80_000, purchase_price_fils: 0 }))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// pricePerSqftFils
// ---------------------------------------------------------------------------
describe("pricePerSqftFils", () => {
  it("computes price per sqft", () => {
    const p = mkProperty({ current_value_fils: 2_000_000, size_sqft: 1000 });
    expect(pricePerSqftFils(p)).toBe(2000);
  });

  it("returns null when current_value is null", () => {
    expect(pricePerSqftFils(mkProperty({ size_sqft: 1000 }))).toBeNull();
  });

  it("returns null when size is null", () => {
    expect(pricePerSqftFils(mkProperty({ current_value_fils: 2_000_000 }))).toBeNull();
  });

  it("returns null when size is zero", () => {
    expect(pricePerSqftFils(mkProperty({ current_value_fils: 2_000_000, size_sqft: 0 }))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// serviceChargeBurdenPct
// ---------------------------------------------------------------------------
describe("serviceChargeBurdenPct", () => {
  it("computes service charge as % of gross rent", () => {
    const p = mkProperty({
      is_rental: 1, annual_rent_fils: 100_000, annual_service_charge_fils: 15_000,
    });
    expect(serviceChargeBurdenPct(p)).toBeCloseTo(15, 2);
  });

  it("returns null for non-rental", () => {
    expect(serviceChargeBurdenPct(mkProperty({ annual_service_charge_fils: 15_000 }))).toBeNull();
  });

  it("returns null when service charge is null", () => {
    expect(serviceChargeBurdenPct(mkProperty({ is_rental: 1, annual_rent_fils: 100_000 }))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isInstallmentOverdue
// ---------------------------------------------------------------------------
describe("isInstallmentOverdue", () => {
  it("returns true when due_date is before asOf and status is not paid", () => {
    expect(isInstallmentOverdue({ status: "upcoming", due_date: "2025-06-01", paid_date: null }, "2026-01-01")).toBe(true);
  });

  it("returns false when status is paid", () => {
    expect(isInstallmentOverdue({ status: "paid", due_date: "2025-06-01", paid_date: "2025-05-01" }, "2026-01-01")).toBe(false);
  });

  it("returns false when paid_date is set", () => {
    expect(isInstallmentOverdue({ status: "upcoming", due_date: "2025-06-01", paid_date: "2025-05-01" }, "2026-01-01")).toBe(false);
  });

  it("returns false when due_date is in the future", () => {
    expect(isInstallmentOverdue({ status: "upcoming", due_date: "2027-06-01", paid_date: null }, "2026-01-01")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// liveInstallmentStatus
// ---------------------------------------------------------------------------
describe("liveInstallmentStatus", () => {
  it("returns 'paid' for paid installments", () => {
    expect(liveInstallmentStatus(mkInstallment({ status: "paid", paid_date: "2026-01-01" }), "2026-06-01")).toBe("paid");
  });

  it("returns 'overdue' when due_date < asOf and not paid", () => {
    expect(liveInstallmentStatus(mkInstallment({ due_date: "2025-06-01", status: "upcoming" }), "2026-01-01")).toBe("overdue");
  });

  it("returns 'upcoming' when due_date is in the future", () => {
    expect(liveInstallmentStatus(mkInstallment({ due_date: "2027-06-01" }), "2026-01-01")).toBe("upcoming");
  });
});

// ---------------------------------------------------------------------------
// cumulativeInstallmentSchedule
// ---------------------------------------------------------------------------
describe("cumulativeInstallmentSchedule", () => {
  it("builds cumulative timeline from upcoming installments", () => {
    const installments: Installment[] = [
      mkInstallment({ id: 1, due_date: "2026-03-01", amount_fils: 100_000, status: "upcoming" }),
      mkInstallment({ id: 2, due_date: "2026-06-01", amount_fils: 200_000, status: "upcoming" }),
      mkInstallment({ id: 3, due_date: "2025-01-01", amount_fils: 50_000, status: "paid", paid_date: "2025-01-01" }),
    ];
    const schedule = cumulativeInstallmentSchedule(installments, "2026-01-01");
    expect(schedule).toHaveLength(2);
    expect(schedule[0]).toEqual({ dueDate: "2026-03-01", amountFils: 100_000, cumulativeFils: 100_000 });
    expect(schedule[1]).toEqual({ dueDate: "2026-06-01", amountFils: 200_000, cumulativeFils: 300_000 });
  });

  it("returns empty array when all installments are paid", () => {
    const installments: Installment[] = [
      mkInstallment({ id: 1, status: "paid", paid_date: "2025-01-01" }),
    ];
    expect(cumulativeInstallmentSchedule(installments, "2026-01-01")).toHaveLength(0);
  });
});
