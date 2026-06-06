import { describe, it, expect } from "vitest";
import {
  InstallmentInputSchema,
  PropertyInputSchema,
} from "@/lib/ingest/validate";

describe("dateString validation accepts both ISO and UAE formats", () => {
  it("accepts a valid DD/MM/YYYY installment date", () => {
    const r = InstallmentInputSchema.safeParse({
      property_id: 1,
      due_date: "15/09/2026",
      amount_aed: 75000,
    });
    expect(r.success).toBe(true);
  });

  it("accepts a valid ISO YYYY-MM-DD installment date", () => {
    const r = InstallmentInputSchema.safeParse({
      property_id: 1,
      due_date: "2026-09-15",
      amount_aed: 75000,
    });
    expect(r.success).toBe(true);
  });

  it("rejects a regex-shaped but impossible date (32/13/2026)", () => {
    const r = InstallmentInputSchema.safeParse({
      property_id: 1,
      due_date: "32/13/2026",
      amount_aed: 75000,
    });
    expect(r.success).toBe(false);
  });

  it("rejects 31/02 (Feb has no 31st)", () => {
    const r = InstallmentInputSchema.safeParse({
      property_id: 1,
      due_date: "31/02/2026",
      amount_aed: 1000,
    });
    expect(r.success).toBe(false);
  });

  it("rejects garbage that doesn't match the shape", () => {
    const r = InstallmentInputSchema.safeParse({
      property_id: 1,
      due_date: "not-a-date",
      amount_aed: 1000,
    });
    expect(r.success).toBe(false);
  });

  it("also guards property dates (valued_at)", () => {
    const r = PropertyInputSchema.safeParse({
      name: "X",
      subcategory: "existing",
      valued_at: "30/02/2026",
    });
    expect(r.success).toBe(false);
  });
});

describe("noFutureDate: purchased_at / valued_at cannot be in the future", () => {
  const farFuture = "2999-01-01";
  const past = "2020-01-01";

  it("rejects a future purchase date", () => {
    const r = PropertyInputSchema.safeParse({
      name: "X",
      subcategory: "existing",
      purchased_at: farFuture,
    });
    expect(r.success).toBe(false);
  });

  it("rejects a future valuation date", () => {
    const r = PropertyInputSchema.safeParse({
      name: "X",
      subcategory: "existing",
      valued_at: farFuture,
    });
    expect(r.success).toBe(false);
  });

  it("accepts a past purchase date", () => {
    const r = PropertyInputSchema.safeParse({
      name: "X",
      subcategory: "existing",
      purchased_at: past,
    });
    expect(r.success).toBe(true);
  });

  it("accepts today (boundary, not future)", () => {
    const today = new Date().toISOString().slice(0, 10);
    const r = PropertyInputSchema.safeParse({
      name: "X",
      subcategory: "existing",
      purchased_at: today,
    });
    expect(r.success).toBe(true);
  });

  it("accepts a UAE-format past date too", () => {
    const r = PropertyInputSchema.safeParse({
      name: "X",
      subcategory: "existing",
      purchased_at: "01/01/2020",
    });
    expect(r.success).toBe(true);
  });
});
