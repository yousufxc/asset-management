import { describe, it, expect } from "vitest";
import { normalizeDescription, transactionHash } from "@/lib/core/dedup";

describe("normalizeDescription", () => {
  it("lowercases, collapses whitespace, trims", () => {
    expect(normalizeDescription("  POS  Purchase   CARREFOUR ")).toBe("pos purchase carrefour");
  });
});

describe("transactionHash (dedup correctness — rule 2.2)", () => {
  const base = { date: "2026-03-07", description: "POS Purchase CARREFOUR", amountFils: -15050 };

  it("is stable for identical input", () => {
    expect(transactionHash(base)).toBe(transactionHash(base));
  });

  it("ignores cosmetic description differences (whitespace/case)", () => {
    const noisy = { ...base, description: "  pos   purchase carrefour  " };
    expect(transactionHash(noisy)).toBe(transactionHash(base));
  });

  it("differs when amount, date, or real description differs", () => {
    expect(transactionHash({ ...base, amountFils: -15051 })).not.toBe(transactionHash(base));
    expect(transactionHash({ ...base, date: "2026-03-08" })).not.toBe(transactionHash(base));
    expect(transactionHash({ ...base, description: "ATM withdrawal" })).not.toBe(transactionHash(base));
  });

  it("distinguishes sign (credit vs debit of same magnitude)", () => {
    expect(transactionHash({ ...base, amountFils: 15050 })).not.toBe(
      transactionHash({ ...base, amountFils: -15050 }),
    );
  });

  it("requires integer fils", () => {
    expect(() => transactionHash({ ...base, amountFils: 150.5 })).toThrow();
  });
});
