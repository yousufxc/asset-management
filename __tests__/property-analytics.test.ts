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
  totalROIPct,
  annualizedROIPct,
  totalMaintenanceFils,
  yearlyMaintenanceBuckets,
} from "@/lib/core/property-analytics";
import type { Property, Installment, PropertyMaintenance } from "@/lib/types";

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
    contract_start_date: null,
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

  it("normalises sqm to sqft before dividing (100 sqm = 1076.39 sqft)", () => {
    // value 10,763,900 fils / (100 × 10.7639) sqft = exactly 10,000 fils/sqft.
    const p = mkProperty({ current_value_fils: 10_763_900, size_sqft: 100, size_unit: "sqm" });
    expect(pricePerSqftFils(p)).toBe(10_000);
  });

  it("treats the same numeric size very differently for sqm vs sqft", () => {
    const value = 10_763_900;
    const sqm = pricePerSqftFils(mkProperty({ current_value_fils: value, size_sqft: 100, size_unit: "sqm" }));
    const sqft = pricePerSqftFils(mkProperty({ current_value_fils: value, size_sqft: 100, size_unit: "sqft" }));
    expect(sqm).toBe(10_000);
    expect(sqft).toBe(107_639); // 10,763,900 / 100
  });

  it("defaults to sqft when size_unit is absent (legacy rows)", () => {
    const p = mkProperty({ current_value_fils: 2_000_000, size_sqft: 1000 });
    expect(p.size_unit).toBeUndefined();
    expect(pricePerSqftFils(p)).toBe(2000); // treated as sqft, not converted
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
    const schedule = cumulativeInstallmentSchedule(installments);
    expect(schedule).toHaveLength(2);
    expect(schedule[0]).toEqual({ dueDate: "2026-03-01", amountFils: 100_000, cumulativeFils: 100_000 });
    expect(schedule[1]).toEqual({ dueDate: "2026-06-01", amountFils: 200_000, cumulativeFils: 300_000 });
  });

  it("returns empty array when all installments are paid", () => {
    const installments: Installment[] = [
      mkInstallment({ id: 1, status: "paid", paid_date: "2025-01-01" }),
    ];
    expect(cumulativeInstallmentSchedule(installments)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// totalROIPct
// ---------------------------------------------------------------------------
describe("totalROIPct", () => {
  it("computes ROI with appreciation and net rent", () => {
    const p = mkProperty({
      purchase_price_fils: 1_000_000,
      current_value_fils: 1_200_000,
      is_rental: 1,
      annual_rent_fils: 80_000,
    });
    // (200k + 80k) / 1M * 100 = 28%
    expect(totalROIPct(p)).toBeCloseTo(28, 2);
  });

  it("computes ROI for non-rental (net rent defaults to 0)", () => {
    const p = mkProperty({
      purchase_price_fils: 1_000_000,
      current_value_fils: 1_200_000,
    });
    // (200k + 0) / 1M * 100 = 20%
    expect(totalROIPct(p)).toBeCloseTo(20, 2);
  });

  it("computes negative ROI for a loss", () => {
    const p = mkProperty({
      purchase_price_fils: 1_000_000,
      current_value_fils: 900_000,
    });
    expect(totalROIPct(p)).toBeCloseTo(-10, 2);
  });

  it("returns null when purchase_price is null", () => {
    expect(totalROIPct(mkProperty({ current_value_fils: 1_000_000 }))).toBeNull();
  });

  it("returns null when current_value is null", () => {
    expect(totalROIPct(mkProperty({ purchase_price_fils: 1_000_000 }))).toBeNull();
  });

  it("returns null when purchase_price is zero", () => {
    expect(totalROIPct(mkProperty({ purchase_price_fils: 0, current_value_fils: 1_000_000 }))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// annualizedROIPct
// ---------------------------------------------------------------------------
describe("annualizedROIPct", () => {
  const asOf = "2026-01-01";

  it("computes annualized ROI: 20% appreciation over 2 years + 8% yield", () => {
    const p = mkProperty({
      purchase_price_fils: 1_000_000,
      current_value_fils: 1_200_000,
      purchased_at: "2024-01-01",
      is_rental: 1,
      annual_rent_fils: 80_000,
    });
    // yearsHeld = 2, annualized appreciation = (1.20^(1/2)-1)*100 ≈ 9.5445
    // rental yield = 8%, total ≈ 17.5445
    expect(annualizedROIPct(p, asOf)).toBeCloseTo(17.54, 1);
  });

  it("returns null when purchased_at is null", () => {
    const p = mkProperty({
      purchase_price_fils: 1_000_000,
      current_value_fils: 1_200_000,
      is_rental: 1,
      annual_rent_fils: 80_000,
    });
    expect(annualizedROIPct(p, asOf)).toBeNull();
  });

  it("returns null when purchase_price is null", () => {
    expect(annualizedROIPct(mkProperty({
      current_value_fils: 1_000_000,
      purchased_at: "2024-01-01",
    }), asOf)).toBeNull();
  });

  it("floors holding period at 0.25 years", () => {
    const p = mkProperty({
      purchase_price_fils: 1_000_000,
      current_value_fils: 1_100_000,
      purchased_at: "2025-12-01",
    });
    // yearsHeld floored to 0.25, not (1 month ≈ 0.083)
    // annualized = (1.10^(1/0.25)-1)*100 ≈ (1.10^4-1)*100 ≈ 46.41%
    expect(annualizedROIPct(p, asOf)).toBeCloseTo(46.41, 1);
  });

  it("uses net rent (not gross) for yield component, matching snapshot mode", () => {
    const p = mkProperty({
      purchase_price_fils: 1_000_000,
      current_value_fils: 1_200_000,
      purchased_at: "2024-01-01",
      is_rental: 1,
      rental_type: "short_term",
      short_term_annual_rent_fils: 200_000,
      pm_commission_pct: 20,
    });
    // Net rent = 200k - 40k commission = 160k
    // Net yield = 160k / 1M * 100 = 16%
    // Appreciation = 20% over 2 years → annualized ≈ 9.5445%
    // Total ≈ 25.5445%
    // Snapshot: (200k + 160k) / 1M * 100 = 36%
    expect(annualizedROIPct(p, asOf)).toBeCloseTo(25.54, 1);
    expect(totalROIPct(p)).toBeCloseTo(36, 2);
  });
});

// ---------------------------------------------------------------------------
// Maintenance tests
// ---------------------------------------------------------------------------
function mkMaintenance(overrides: Partial<PropertyMaintenance> = {}): PropertyMaintenance {
  return {
    id: 1,
    property_id: 1,
    amount_fils: 50_000,
    maintenance_date: "2025-06-15",
    notes: null,
    created_at: "2025-06-15T00:00:00Z",
    updated_at: "2025-06-15T00:00:00Z",
    ...overrides,
  };
}

describe("totalMaintenanceFils", () => {
  it("returns 0 for empty array", () => {
    expect(totalMaintenanceFils([])).toBe(0);
  });

  it("sums all maintenance entries", () => {
    const entries = [
      mkMaintenance({ amount_fils: 50_000 }),
      mkMaintenance({ id: 2, amount_fils: 30_000 }),
      mkMaintenance({ id: 3, amount_fils: 20_000 }),
    ];
    expect(totalMaintenanceFils(entries)).toBe(100_000);
  });
});

describe("yearlyMaintenanceBuckets", () => {
  it("returns empty for no entries", () => {
    expect(yearlyMaintenanceBuckets([])).toEqual([]);
  });

  it("groups entries by year", () => {
    const entries = [
      mkMaintenance({ maintenance_date: "2024-03-01", amount_fils: 10_000 }),
      mkMaintenance({ id: 2, maintenance_date: "2024-08-15", amount_fils: 20_000 }),
      mkMaintenance({ id: 3, maintenance_date: "2025-01-10", amount_fils: 30_000 }),
      mkMaintenance({ id: 4, maintenance_date: "2025-06-20", amount_fils: 40_000 }),
    ];
    const buckets = yearlyMaintenanceBuckets(entries);
    expect(buckets).toHaveLength(2);
    const y2024 = buckets.find((b) => b.year === "2024")!;
    const y2025 = buckets.find((b) => b.year === "2025")!;
    expect(y2024.totalFils).toBe(30_000);
    expect(y2024.count).toBe(2);
    expect(y2025.totalFils).toBe(70_000);
    expect(y2025.count).toBe(2);
  });

  it("returns buckets sorted by year", () => {
    const entries = [
      mkMaintenance({ maintenance_date: "2025-01-01", amount_fils: 1 }),
      mkMaintenance({ id: 2, maintenance_date: "2023-01-01", amount_fils: 2 }),
    ];
    const buckets = yearlyMaintenanceBuckets(entries);
    expect(buckets[0]!.year).toBe("2023");
    expect(buckets[1]!.year).toBe("2025");
  });
});

describe("totalROIPct with maintenance", () => {
  it("deducts maintenance from total ROI", () => {
    const p = mkProperty({
      purchase_price_fils: 1_000_000,
      current_value_fils: 1_200_000,
      is_rental: 1,
      rental_type: "long_term",
      annual_rent_fils: 100_000,
    });
    // No maintenance: ((200k + 100k) / 1M) * 100 = 30%
    expect(totalROIPct(p, [])).toBeCloseTo(30, 2);
    // With 50k maintenance: ((200k + 100k - 50k) / 1M) * 100 = 25%
    expect(totalROIPct(p, [mkMaintenance({ amount_fils: 50_000 })])).toBeCloseTo(25, 2);
  });

  it("returns null when purchase price is missing", () => {
    const p = mkProperty({ purchase_price_fils: null });
    expect(totalROIPct(p)).toBeNull();
  });

  it("works without maintenance parameter (backward compat)", () => {
    const p = mkProperty({
      purchase_price_fils: 1_000_000,
      current_value_fils: 1_200_000,
      is_rental: 1,
      annual_rent_fils: 100_000,
    });
    expect(totalROIPct(p)).toBeCloseTo(30, 2);
  });
});

describe("annualizedROIPct with maintenance", () => {
  it("deducts maintenance from annualized ROI", () => {
    const asOf = "2026-01-15";
    const p = mkProperty({
      purchase_price_fils: 1_000_000,
      current_value_fils: 1_200_000,
      purchased_at: "2024-01-01",
      is_rental: 1,
      rental_type: "long_term",
      annual_rent_fils: 100_000,
    });
    const without = annualizedROIPct(p, asOf, []);
    const withMaint = annualizedROIPct(p, asOf, [mkMaintenance({ amount_fils: 100_000 })]);
    expect(withMaint).not.toBeNull();
    expect(without).not.toBeNull();
    expect(withMaint!).toBeLessThan(without!);
  });

  it("works without maintenance parameter (backward compat)", () => {
    const asOf = "2026-01-15";
    const p = mkProperty({
      purchase_price_fils: 1_000_000,
      current_value_fils: 1_200_000,
      purchased_at: "2024-01-01",
    });
    expect(annualizedROIPct(p, asOf)).not.toBeNull();
  });
});
