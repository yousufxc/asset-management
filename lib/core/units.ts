/**
 * PURE conversion helpers. No DB, no network. Trivially unit-testable.
 *
 * Covers the three conversion concerns in this app:
 *   1. Money:   AED <-> fils (integer minor units). ALL money math is in fils.
 *   2. Weight:  gram / kg / troy_oz / tola -> grams (canonical for valuation).
 *   3. Dates:   UAE DD/MM/YYYY display <-> ISO YYYY-MM-DD storage.
 *   4. Purity:  karat -> 0..1 fraction.
 */

import type { WeightUnit } from "@/lib/types";

// ---------------------------------------------------------------------------
// MONEY: AED <-> fils. 1 AED = 100 fils. Stored/computed as integer fils.
// ---------------------------------------------------------------------------

/** Convert an AED amount (e.g. 1234.56) to integer fils (123456). Rounds to nearest fil. */
export function aedToFils(aed: number): number {
  if (!Number.isFinite(aed)) throw new Error(`aedToFils: not a finite number: ${aed}`);
  return Math.round(aed * 100);
}

/** Convert integer fils to an AED number (123456 -> 1234.56). For display only. */
export function filsToAed(fils: number): number {
  if (!Number.isInteger(fils)) throw new Error(`filsToAed: fils must be an integer: ${fils}`);
  return fils / 100;
}

/** Format fils as a human AED string, e.g. 123456 -> "AED 1,234.56". */
export function formatAed(fils: number): string {
  const aed = filsToAed(fils);
  return `AED ${aed.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// WEIGHT: convert to grams (canonical unit used by valuation).
// ---------------------------------------------------------------------------

/** Grams per one unit of each supported weight unit. */
export const GRAMS_PER_UNIT: Record<WeightUnit, number> = {
  gram: 1,
  kg: 1000,
  troy_oz: 31.1034768, // international troy ounce
  tola: 11.6638038, // standard tola used in the Gulf gold trade
};

/** Convert a weight in any supported unit to grams. */
export function toGrams(weight: number, unit: WeightUnit): number {
  if (!Number.isFinite(weight)) throw new Error(`toGrams: not a finite number: ${weight}`);
  return weight * GRAMS_PER_UNIT[unit];
}

// ---------------------------------------------------------------------------
// PURITY: karat -> 0..1 fraction (24K = pure = 1.0).
// ---------------------------------------------------------------------------

export function karatToFraction(karat: number): number {
  if (karat < 0 || karat > 24) throw new Error(`karatToFraction: karat out of range: ${karat}`);
  return karat / 24;
}

// ---------------------------------------------------------------------------
// DATES: UAE locale is DD/MM/YYYY for INPUT/DISPLAY; storage is ISO YYYY-MM-DD.
// These functions are the single guard against MM/DD vs DD/MM ambiguity.
// ---------------------------------------------------------------------------

/**
 * Parse a UAE-format date string "DD/MM/YYYY" (also accepts "-" or "." separators)
 * into ISO "YYYY-MM-DD". Throws on invalid/ambiguous input rather than guessing.
 *
 * Example: "07/03/2026" -> "2026-03-07" (7 March, NOT 3 July).
 */
export function parseUaeDateToIso(input: string): string {
  const trimmed = input.trim();
  const m = trimmed.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (!m) throw new Error(`parseUaeDateToIso: expected DD/MM/YYYY, got "${input}"`);
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12) throw new Error(`parseUaeDateToIso: month out of range in "${input}"`);
  if (day < 1 || day > 31) throw new Error(`parseUaeDateToIso: day out of range in "${input}"`);
  const iso = `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  // Round-trip check to reject impossible dates like 31/02/2026.
  const d = new Date(`${iso}T00:00:00Z`);
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() + 1 !== month ||
    d.getUTCDate() !== day
  ) {
    throw new Error(`parseUaeDateToIso: invalid calendar date "${input}"`);
  }
  return iso;
}

/** Format an ISO "YYYY-MM-DD" date as UAE display "DD/MM/YYYY". */
export function formatIsoToUae(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`formatIsoToUae: expected YYYY-MM-DD, got "${iso}"`);
  return `${m[3]}/${m[2]}/${m[1]}`;
}
