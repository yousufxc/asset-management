import { describe, it, expect } from "vitest";
import { computeMonthlyPayment, computeOutstandingBalance, monthsElapsed, computeLoanEndDate, generateMortgagePayments, computeNetEquity } from "@/lib/core/mortgage";
import type { MortgagePaymentInput } from "@/lib/core/mortgage";

describe("computeMonthlyPayment", () => {
  it("computes monthly payment for standard amortizing loan (hand-verified)", () => {
    // P = 100,000 AED = 10,000,000 fils, r = 6%, n = 12 months
    // Monthly rate = 0.005
    // PMT = 10,000,000 * 0.005 * (1.005)^12 / ((1.005)^12 - 1)
    // (1.005)^12 ≈ 1.061677812...
    // PMT = 10,000,000 * 0.005 * 1.0616778 / 0.0616778
    //     = 10,000,000 * 0.086066...
    //     = 860,664 fils
    const result = computeMonthlyPayment(10_000_000, 6, 12);
    expect(result).toBe(860_664);
  });

  it("handles zero interest rate (simple division)", () => {
    const result = computeMonthlyPayment(12_000, 0, 12);
    expect(result).toBe(1_000);
  });

  it("handles zero interest with rounding", () => {
    // 10,000 / 3 = 3333.33 -> rounds to 3333
    const result = computeMonthlyPayment(10_000, 0, 3);
    expect(result).toBe(3_333);
  });

  it("returns correct payment for longer term", () => {
    // Realistic UAE mortgage: 1,200,000 AED = 120,000,000 fils, 3.99%, 25 years = 300 months
    const result = computeMonthlyPayment(120_000_000, 3.99, 300);
    // Should be roughly 6,335 AED/month = 633,500 fils
    expect(result).toBeGreaterThan(630_000);
    expect(result).toBeLessThan(640_000);
  });

  it("throws on negative principal", () => {
    expect(() => computeMonthlyPayment(-1, 5, 12)).toThrow();
  });

  it("throws on negative rate", () => {
    expect(() => computeMonthlyPayment(1000, -1, 12)).toThrow();
  });

  it("throws on invalid term", () => {
    expect(() => computeMonthlyPayment(1000, 5, 0)).toThrow();
    expect(() => computeMonthlyPayment(1000, 5, -1)).toThrow();
  });
});

describe("computeOutstandingBalance", () => {
  const PRINCIPAL = 10_000_000; // 100,000 AED
  const RATE = 6;               // 6%
  const TERM = 12;              // 12 months

  it("returns full principal at month 0 (hand-verified)", () => {
    const result = computeOutstandingBalance(PRINCIPAL, RATE, TERM, 0);
    expect(result).toBe(PRINCIPAL);
  });

  it("returns 0 at end of term", () => {
    const result = computeOutstandingBalance(PRINCIPAL, RATE, TERM, 12);
    expect(result).toBe(0);
  });

  it("returns 0 past term", () => {
    const result = computeOutstandingBalance(PRINCIPAL, RATE, TERM, 24);
    expect(result).toBe(0);
  });

  it("computes correct balance at mid-term (hand-verified)", () => {
    // After 6 months:
    // B = P * ((1+r)^12 - (1+r)^6) / ((1+r)^12 - 1)
    // (1.005)^12 ≈ 1.0616778
    // (1.005)^6  ≈ 1.0303775
    // B = 10,000,000 * (1.0616778 - 1.0303775) / (1.0616778 - 1)
    // B = 10,000,000 * 0.0313003 / 0.0616778
    // B ≈ 5,074,800 fils
    const result = computeOutstandingBalance(PRINCIPAL, RATE, TERM, 6);
    // Allow ±2 fils rounding tolerance
    expect(result).toBeGreaterThan(5_074_700);
    expect(result).toBeLessThan(5_075_000);
  });

  it("handles zero interest rate", () => {
    // 12,000 fils, 0%, 12 months, after 4 months = 12,000 - 4,000 = 8,000
    const result = computeOutstandingBalance(12_000, 0, 12, 4);
    expect(result).toBe(8_000);
  });

  it("handles zero interest rate fully paid", () => {
    const result = computeOutstandingBalance(12_000, 0, 12, 12);
    expect(result).toBe(0);
  });

  it("throws on negative monthsElapsed", () => {
    expect(() => computeOutstandingBalance(1000, 5, 12, -1)).toThrow();
  });
});

describe("monthsElapsed", () => {
  it("returns 0 when dates are the same", () => {
    expect(monthsElapsed("2024-06-15", "2024-06-15")).toBe(0);
  });

  it("returns 0 when end is before start", () => {
    expect(monthsElapsed("2024-06-15", "2024-01-01")).toBe(0);
  });

  it("returns 0 within the same month (day not yet reached)", () => {
    expect(monthsElapsed("2024-01-15", "2024-02-14")).toBe(0);
  });

  it("returns 1 when exactly one month has passed", () => {
    expect(monthsElapsed("2024-01-15", "2024-02-15")).toBe(1);
  });

  it("handles year boundary correctly", () => {
    expect(monthsElapsed("2023-11-15", "2024-02-15")).toBe(3);
  });

  it("handles year boundary with short month", () => {
    // Jan 31 -> Feb 28: day 28 < day 31, so months = 0
    expect(monthsElapsed("2024-01-31", "2024-02-28")).toBe(0);
  });

  it("handles long duration (hand-verified)", () => {
    // 2020-01-15 to 2024-01-15 = exactly 48 months
    expect(monthsElapsed("2020-01-15", "2024-01-15")).toBe(48);
  });

  it("throws on invalid dates", () => {
    expect(() => monthsElapsed("not-a-date", "2024-01-01")).toThrow();
    expect(() => monthsElapsed("2024-01-01", "not-a-date")).toThrow();
  });
});

describe("computeLoanEndDate", () => {
  it("adds term months correctly", () => {
    expect(computeLoanEndDate("2024-01-15", 12)).toBe("2025-01-15");
  });

  it("handles mid-year starts", () => {
    expect(computeLoanEndDate("2024-06-01", 6)).toBe("2024-12-01");
  });

  it("handles standard UAE 25-year mortgage", () => {
    expect(computeLoanEndDate("2020-03-15", 300)).toBe("2045-03-15");
  });

  it("throws on invalid dates", () => {
    expect(() => computeLoanEndDate("not-a-date", 12)).toThrow();
  });

  it("throws on invalid term", () => {
    expect(() => computeLoanEndDate("2024-01-15", 0)).toThrow();
    expect(() => computeLoanEndDate("2024-01-15", -1)).toThrow();
  });
});

describe("generateMortgagePayments", () => {
  const baseMortgage: MortgagePaymentInput = {
    id: 1,
    label: "Mortgage: ENBD (Marina Tower)",
    loanAmountFils: 10_000_000, // AED 100,000
    annualRatePct: 6,
    termMonths: 300,
    loanStartDate: "2024-01-15",
  };

  it("emits correct number of payments in a 90-day window (hand-verified)", () => {
    // Loan starts 2024-01-15. asOf = 2025-01-15 (12 months later).
    // Monthly payment = computeMonthlyPayment(10_000_000, 6, 300) ≈ 64,430 fils
    // Payments 1..300 are due on 15th of each month from 2024-02-15 onward.
    // Window: asOf=2025-01-15 to until=2025-04-15 (90 days).
    // Payments due in window: 2025-02-15, 2025-03-15, 2025-04-15 = exactly 3 payments.
    const asOf = "2025-01-15";
    const until = "2025-04-15";
    const payments = generateMortgagePayments([baseMortgage], asOf, until);
    expect(payments.length).toBe(3);
    const expectedMonthly = computeMonthlyPayment(10_000_000, 6, 300);
    expect(payments[0]!.dueDate).toBe("2025-02-15");
    expect(payments[0]!.amountFils).toBe(expectedMonthly);
    expect(payments[0]!.kind).toBe("mortgage");
    expect(payments[1]!.dueDate).toBe("2025-03-15");
    expect(payments[1]!.amountFils).toBe(expectedMonthly);
    expect(payments[2]!.dueDate).toBe("2025-04-15");
    expect(payments[2]!.amountFils).toBe(expectedMonthly);
  });

  it("does not include payments on or before asOf", () => {
    // asOf = 2025-02-15, until = 2025-04-15
    // Payment due on 2025-02-15 is NOT > asOf → excluded.
    const asOf = "2025-02-15";
    const until = "2025-04-15";
    const payments = generateMortgagePayments([baseMortgage], asOf, until);
    // Only March 15 and April 15 should be included
    expect(payments.length).toBe(2);
    expect(payments[0]!.dueDate).toBe("2025-03-15");
    expect(payments[1]!.dueDate).toBe("2025-04-15");
  });

  it("does not include payments after until", () => {
    const asOf = "2025-01-01";
    const until = "2025-02-14";
    const payments = generateMortgagePayments([baseMortgage], asOf, until);
    // Jan 15 payment is included (> Jan 1, <= Feb 14), Feb 15 is NOT (> Feb 14)
    expect(payments.length).toBe(1);
    expect(payments[0]!.dueDate).toBe("2025-01-15");
  });

  it("fully-paid loan emits zero events", () => {
    // asOf is 300+ months after start → loan is paid off
    const asOf = "2050-01-01";
    const until = "2050-06-01";
    const payments = generateMortgagePayments([baseMortgage], asOf, until);
    expect(payments.length).toBe(0);
  });

  it("loan starting in the future: first payment one month after start, only within window", () => {
    const futureMortgage: MortgagePaymentInput = {
      ...baseMortgage,
      id: 2,
      loanStartDate: "2027-06-01",
      termMonths: 12,
    };
    // asOf = 2026-07-09 (today-ish), until = 2028-01-01
    // First payment: 2027-07-01, last: 2028-06-01
    const asOf = "2026-07-09";
    const until = "2028-01-01";
    const payments = generateMortgagePayments([futureMortgage], asOf, until);
    // Payments due: 2027-07-01, 2027-08-01, ..., 2028-01-01 = 7 payments
    expect(payments.length).toBe(7);
    expect(payments[0]!.dueDate).toBe("2027-07-01");
    const expectedMonthly = computeMonthlyPayment(10_000_000, 6, 12);
    expect(payments[0]!.amountFils).toBe(expectedMonthly);
  });

  it("handles zero-interest mortgage payments", () => {
    const zeroInterestMortgage: MortgagePaymentInput = {
      id: 3,
      label: "Mortgage: No Interest",
      loanAmountFils: 120_000,
      annualRatePct: 0,
      termMonths: 12,
      loanStartDate: "2026-01-01",
    };
    const asOf = "2026-01-01";
    const until = "2027-01-01";
    const payments = generateMortgagePayments([zeroInterestMortgage], asOf, until);
    // 12 payments of 10,000 fils each (120,000 / 12 = 10,000)
    expect(payments.length).toBe(12);
    expect(payments.every((p) => p.amountFils === 10_000)).toBe(true);
  });

  it("skips invalid mortgages (negative principal, etc.)", () => {
    const badMortgage: MortgagePaymentInput = {
      id: 99,
      label: "Bad",
      loanAmountFils: -100,
      annualRatePct: 5,
      termMonths: 12,
      loanStartDate: "2026-01-01",
    };
    const asOf = "2026-01-01";
    const until = "2027-01-01";
    const payments = generateMortgagePayments([badMortgage], asOf, until);
    expect(payments.length).toBe(0);
  });

  it("payments are sorted by due date", () => {
    const m1: MortgagePaymentInput = {
      id: 10,
      label: "M1",
      loanAmountFils: 1_000_000, annualRatePct: 5, termMonths: 60,
      loanStartDate: "2026-06-01",
    };
    const m2: MortgagePaymentInput = {
      id: 20,
      label: "M2",
      loanAmountFils: 1_000_000, annualRatePct: 5, termMonths: 60,
      loanStartDate: "2026-03-01",
    };
    const asOf = "2026-03-01";
    const until = "2026-12-01";
    const payments = generateMortgagePayments([m1, m2], asOf, until);
    for (let i = 1; i < payments.length; i++) {
      expect(payments[i]!.dueDate >= payments[i - 1]!.dueDate).toBe(true);
    }
  });
});

describe("computeNetEquity", () => {
  it("value minus outstanding = correct net equity", () => {
    expect(computeNetEquity(1_000_000, 400_000)).toBe(600_000);
  });

  it("no-mortgage asset (zero outstanding) returns full value", () => {
    expect(computeNetEquity(500_000, 0)).toBe(500_000);
  });

  it("over-leveraged asset returns negative (unclamped)", () => {
    // Property worth 500,000 but mortgage outstanding is 700,000
    expect(computeNetEquity(500_000, 700_000)).toBe(-200_000);
  });

  it("zero-value asset with mortgage returns negative", () => {
    expect(computeNetEquity(0, 100_000)).toBe(-100_000);
  });
});
