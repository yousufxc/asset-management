import { describe, it, expect } from "vitest";
import {
  InstallmentInputSchema,
  PropertyInputSchema,
  TitleDeedExtractSchema,
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

describe("TitleDeedExtractSchema: Claude output gate + date normalisation", () => {
  it("normalises a UAE DD/MM/YYYY deed date to ISO (§2.2)", () => {
    // 07/03/2026 is 7 March, NOT 3 July — the ISO output must reflect that.
    const r = TitleDeedExtractSchema.safeParse({ purchased_at: "07/03/2026" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.purchased_at).toBe("2026-03-07");
  });

  it("passes an already-ISO date through unchanged", () => {
    const r = TitleDeedExtractSchema.safeParse({ purchased_at: "2023-11-30" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.purchased_at).toBe("2023-11-30");
  });

  it("drops an unparseable date to null instead of failing the whole extraction", () => {
    const r = TitleDeedExtractSchema.safeParse({
      name: "Marina Tower 1204",
      purchased_at: "not a date",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.purchased_at).toBeNull();
      expect(r.data.name).toBe("Marina Tower 1204"); // other fields survive
    }
  });

  it("treats null / missing date as null", () => {
    const rNull = TitleDeedExtractSchema.safeParse({ purchased_at: null });
    const rMissing = TitleDeedExtractSchema.safeParse({ name: "X" });
    expect(rNull.success && rNull.data.purchased_at).toBeNull();
    expect(rMissing.success && rMissing.data.purchased_at).toBeNull();
  });

  it("rejects hallucinated out-of-enum values and negative prices", () => {
    expect(TitleDeedExtractSchema.safeParse({ property_type: "castle" }).success).toBe(false);
    expect(TitleDeedExtractSchema.safeParse({ subcategory: "maybe" }).success).toBe(false);
    expect(TitleDeedExtractSchema.safeParse({ purchase_price_aed: -5000 }).success).toBe(false);
    expect(TitleDeedExtractSchema.safeParse({ size_sqft: 0 }).success).toBe(false);
  });

  it("accepts a full valid extraction", () => {
    const r = TitleDeedExtractSchema.safeParse({
      name: "Marina Tower 1204",
      subcategory: "existing",
      property_type: "apartment",
      bedrooms: "1BR",
      city: "Dubai",
      area: "Dubai Marina",
      developer: "Emaar",
      size_sqft: 1200,
      purchase_price_aed: 1200000,
      purchased_at: "15/06/2023",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.purchased_at).toBe("2023-06-15");
  });
});
