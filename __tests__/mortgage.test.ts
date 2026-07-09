import { describe, it, expect } from "vitest";
import { computeMonthlyPayment, computeOutstandingBalance, monthsElapsed, computeLoanEndDate } from "@/lib/core/mortgage";

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
