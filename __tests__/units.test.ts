import { describe, it, expect } from "vitest";
import {
  aedToFils,
  filsToAed,
  toGrams,
  GRAMS_PER_UNIT,
  karatToFraction,
  parseUaeDateToIso,
  parseDateToIso,
  formatIsoToUae,
} from "@/lib/core/units";

describe("money AED <-> fils", () => {
  it("converts AED to integer fils, rounding to the nearest fil", () => {
    expect(aedToFils(1234.56)).toBe(123456);
    expect(aedToFils(0)).toBe(0);
    expect(aedToFils(0.1)).toBe(10);
    // classic float trap: 0.1 + 0.2 in AED must still round cleanly in fils
    expect(aedToFils(0.1 + 0.2)).toBe(30);
  });
  it("round-trips fils back to AED", () => {
    expect(filsToAed(123456)).toBe(1234.56);
    expect(filsToAed(0)).toBe(0);
  });
  it("throws on non-finite AED", () => {
    expect(() => aedToFils(NaN)).toThrow();
    expect(() => aedToFils(Infinity)).toThrow();
  });
});

describe("weight -> grams", () => {
  it("uses correct gram factors", () => {
    expect(GRAMS_PER_UNIT.gram).toBe(1);
    expect(GRAMS_PER_UNIT.kg).toBe(1000);
    expect(toGrams(1, "kg")).toBe(1000);
    expect(toGrams(1, "troy_oz")).toBeCloseTo(31.1034768, 6);
    expect(toGrams(1, "tola")).toBeCloseTo(11.6638038, 6);
  });
});

describe("purity karat -> fraction", () => {
  it("maps karat onto 0..1", () => {
    expect(karatToFraction(24)).toBe(1);
    expect(karatToFraction(22)).toBeCloseTo(0.91667, 4);
    expect(karatToFraction(18)).toBe(0.75);
  });
});

describe("UAE date parsing (DD/MM/YYYY) — the silent-bug guard (rule 2.2)", () => {
  it("parses DD/MM/YYYY, NOT MM/DD/YYYY", () => {
    // 07/03/2026 must be 7 March 2026, never 3 July 2026
    expect(parseUaeDateToIso("07/03/2026")).toBe("2026-03-07");
    // a day > 12 proves the order is unambiguous
    expect(parseUaeDateToIso("25/12/2026")).toBe("2026-12-25");
    expect(parseUaeDateToIso("1/1/2026")).toBe("2026-01-01");
  });
  it("accepts . and - separators", () => {
    expect(parseUaeDateToIso("07-03-2026")).toBe("2026-03-07");
    expect(parseUaeDateToIso("07.03.2026")).toBe("2026-03-07");
  });
  it("rejects impossible and US-format dates", () => {
    expect(() => parseUaeDateToIso("31/02/2026")).toThrow(); // no 31 Feb
    expect(() => parseUaeDateToIso("13/13/2026")).toThrow(); // month 13
    expect(() => parseUaeDateToIso("2026-03-07")).toThrow(); // ISO, not UAE input
  });
  it("round-trips to UAE display", () => {
    expect(formatIsoToUae("2026-03-07")).toBe("07/03/2026");
  });
});

describe("parseDateToIso accepts both ISO and UAE formats", () => {
  it("passes through valid ISO dates", () => {
    expect(parseDateToIso("2026-03-07")).toBe("2026-03-07");
    expect(parseDateToIso("2026-12-25")).toBe("2026-12-25");
  });

  it("parses UAE DD/MM/YYYY to ISO", () => {
    expect(parseDateToIso("07/03/2026")).toBe("2026-03-07");
    expect(parseDateToIso("25/12/2026")).toBe("2026-12-25");
  });

  it("rejects impossible calendar dates regardless of format", () => {
    expect(() => parseDateToIso("2026-02-31")).toThrow();
    expect(() => parseDateToIso("31/02/2026")).toThrow();
    expect(() => parseDateToIso("not-a-date")).toThrow();
  });
});
