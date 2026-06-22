import { describe, expect, it } from "vitest";
import { generateDepositSchedule, depositStatus } from "@/lib/core/rental-deposits";
import type { Property } from "@/lib/types";

function makeProp(overrides: Partial<Property>): Property {
  return {
    id: 1, name: "Test", subcategory: "existing",
    property_type: null, bedrooms: null, city: null, area: null, developer: null,
    size_sqft: null, annual_service_charge_fils: null,
    purchase_price_fils: null, purchased_at: null,
    current_value_fils: null, valued_at: null,
    is_rental: 1, rental_type: "long_term",
    annual_rent_fils: null, rent_cheques_per_year: null,
    rent_date_1: null, rent_date_2: null, rent_date_3: null, rent_date_4: null,
    pm_company_name: null, pm_commission_pct: null,
    short_term_annual_rent_fils: null,
    short_term_return_frequency: null, short_term_rent_deposit_date: null,
    contract_start_date: null,
    notes: null, created_at: "2024-01-01", updated_at: "2024-01-01",
    ...overrides,
  };
}

describe("generateDepositSchedule — long-term", () => {
  it("1 cheque: full amount", () => {
    const p = makeProp({
      annual_rent_fils: 100_000, rent_cheques_per_year: 1,
      rent_date_1: "2025-01-15",
    });
    const s = generateDepositSchedule(p);
    expect(s).toHaveLength(1);
    expect(s[0]!.chequeNumber).toBe(1);
    expect(s[0]!.amountFils).toBe(100_000);
    expect(s[0]!.depositDate).toBe("2025-01-15");
  });

  it("3 cheques: sum = 100000, last absorbs remainder", () => {
    const p = makeProp({
      annual_rent_fils: 100_000, rent_cheques_per_year: 3,
      rent_date_1: "2025-01-01", rent_date_2: "2025-05-01", rent_date_3: "2025-09-01",
    });
    const s = generateDepositSchedule(p);
    expect(s).toHaveLength(3);
    const sum = s.reduce((a, e) => a + e.amountFils, 0);
    expect(sum).toBe(100_000);
    expect(s[0]!.amountFils).toBe(33333);
    expect(s[1]!.amountFils).toBe(33333);
    expect(s[2]!.amountFils).toBe(33334);
  });

  it("12 cheques (monthly): auto-generates 12 dates from rent_date_1", () => {
    const p = makeProp({
      annual_rent_fils: 120_000, rent_cheques_per_year: 12,
      rent_date_1: "2026-01-15",
    });
    const s = generateDepositSchedule(p);
    expect(s).toHaveLength(12);
    const sum = s.reduce((a, e) => a + e.amountFils, 0);
    expect(sum).toBe(120_000);
    expect(s[0]!.depositDate).toBe("2026-01-15");
    expect(s[11]!.depositDate).toBe("2026-12-15");
    expect(s[0]!.amountFils).toBe(10000);
  });

  it("4 cheques: sum = 100000", () => {
    const p = makeProp({
      annual_rent_fils: 100_000, rent_cheques_per_year: 4,
      rent_date_1: "2025-01-01", rent_date_2: "2025-04-01",
      rent_date_3: "2025-07-01", rent_date_4: "2025-10-01",
    });
    const s = generateDepositSchedule(p);
    expect(s).toHaveLength(4);
    const sum = s.reduce((a, e) => a + e.amountFils, 0);
    expect(sum).toBe(100_000);
  });

  it("null annual_rent → empty", () => {
    const p = makeProp({ annual_rent_fils: null, rent_cheques_per_year: 1, rent_date_1: "2025-01-01" });
    expect(generateDepositSchedule(p)).toEqual([]);
  });

  it("rent_date_2 null for 2-cheque → only cheque 1 at slot=1", () => {
    const p = makeProp({
      annual_rent_fils: 100_000, rent_cheques_per_year: 2,
      rent_date_1: "2025-01-01", rent_date_2: null,
    });
    const s = generateDepositSchedule(p);
    expect(s).toHaveLength(1);
    expect(s[0]!.chequeNumber).toBe(1);
  });

  it("all dates null → empty", () => {
    const p = makeProp({ annual_rent_fils: 100_000, rent_cheques_per_year: 2 });
    expect(generateDepositSchedule(p)).toEqual([]);
  });

  it("4 cheques, rent_date_3 null → entries at slots 1,2,4 (slot=3 skipped)", () => {
    const p = makeProp({
      annual_rent_fils: 100_000, rent_cheques_per_year: 4,
      rent_date_1: "2025-01-01", rent_date_2: "2025-04-01",
      rent_date_3: null, rent_date_4: "2025-10-01",
    });
    const s = generateDepositSchedule(p);
    expect(s).toHaveLength(3);
    expect(s.map(e => e.chequeNumber)).toEqual([1, 2, 4]);
  });

  it("not rental → empty", () => {
    const p = makeProp({ is_rental: 0 });
    expect(generateDepositSchedule(p)).toEqual([]);
  });
});

describe("generateDepositSchedule — short-term", () => {
  it("monthly: 120000 fils / 12 periods → sum = 120000", () => {
    const p = makeProp({
      is_rental: 1, rental_type: "short_term",
      short_term_annual_rent_fils: 120_000,
      short_term_return_frequency: "monthly",
      short_term_rent_deposit_date: "2025-12-31",
    });
    const s = generateDepositSchedule(p);
    expect(s).toHaveLength(12);
    const sum = s.reduce((a, e) => a + e.amountFils, 0);
    expect(sum).toBe(120_000);
  });

  it("quarterly: 100000 fils / 4 periods → sum = 100000", () => {
    const p = makeProp({
      is_rental: 1, rental_type: "short_term",
      short_term_annual_rent_fils: 100_000,
      short_term_return_frequency: "quarterly",
      short_term_rent_deposit_date: "2025-12-31",
    });
    const s = generateDepositSchedule(p);
    expect(s).toHaveLength(4);
    const sum = s.reduce((a, e) => a + e.amountFils, 0);
    expect(sum).toBe(100_000);
  });

  it("missing end date → empty", () => {
    const p = makeProp({
      is_rental: 1, rental_type: "short_term",
      short_term_annual_rent_fils: 100_000,
      short_term_return_frequency: "monthly",
    });
    expect(generateDepositSchedule(p)).toEqual([]);
  });

  it("dates step backward from end date", () => {
    const p = makeProp({
      is_rental: 1, rental_type: "short_term",
      short_term_annual_rent_fils: 120_000,
      short_term_return_frequency: "quarterly",
      short_term_rent_deposit_date: "2025-12-31",
    });
    const s = generateDepositSchedule(p);
    expect(s).toHaveLength(4);
    expect(s[0]!.depositDate).toBe("2025-03-31");
    expect(s[1]!.depositDate).toBe("2025-06-30");
    expect(s[2]!.depositDate).toBe("2025-09-30");
    expect(s[3]!.depositDate).toBe("2025-12-31");
  });
});

describe("depositStatus", () => {
  it("status=deposited + past date → deposited", () => {
    expect(depositStatus({ status: "deposited", deposit_date: "2025-01-01", deposited_date: null }, "2025-06-01")).toBe("deposited");
  });

  it("status=pending + past date → overdue", () => {
    expect(depositStatus({ status: "pending", deposit_date: "2025-01-01", deposited_date: null }, "2025-06-01")).toBe("overdue");
  });

  it("status=pending + future date → pending", () => {
    expect(depositStatus({ status: "pending", deposit_date: "2026-01-01", deposited_date: null }, "2025-06-01")).toBe("pending");
  });

  it("deposited_date set + status=pending → deposited", () => {
    expect(depositStatus({ status: "pending", deposit_date: "2025-01-01", deposited_date: "2025-01-15" }, "2025-06-01")).toBe("deposited");
  });

  it("status=deposited + future date → deposited", () => {
    expect(depositStatus({ status: "deposited", deposit_date: "2026-01-01", deposited_date: null }, "2025-06-01")).toBe("deposited");
  });

  it("boundary: today → not overdue", () => {
    const today = "2025-06-01";
    expect(depositStatus({ status: "pending", deposit_date: today, deposited_date: null }, today)).toBe("pending");
  });
});
