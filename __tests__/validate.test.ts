import { describe, it, expect } from "vitest";
import {
  InstallmentInputSchema,
  PropertyInputSchema,
} from "@/lib/ingest/validate";

describe("uaeDate validation rejects impossible calendar dates (no more 500s)", () => {
  it("accepts a valid DD/MM/YYYY installment date", () => {
    const r = InstallmentInputSchema.safeParse({
      property_id: 1,
      due_date: "15/09/2026",
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
