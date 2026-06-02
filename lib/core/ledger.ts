/**
 * PURE double-entry balance check. No DB, no network.
 *
 * Rule 2.2: for any ingested statement,
 *     opening + sum(credits) - sum(debits) == closing   (within tolerance)
 *
 * Everything here is in integer fils, so the check is exact and the default
 * tolerance is 0. A small tolerance is exposed only as a safety valve for
 * statements whose own rounding is imperfect; prefer 0.
 */

export interface DoubleEntryInput {
  openingFils: number;
  closingFils: number;
  /** Positive credit amounts in fils (money in). */
  creditsFils: number[];
  /** Positive debit amounts in fils (money out). */
  debitsFils: number[];
}

export interface DoubleEntryResult {
  expectedClosingFils: number;
  actualClosingFils: number;
  /** actual - expected. Zero when perfectly balanced. */
  deltaFils: number;
  balanced: boolean;
}

/**
 * @param toleranceFils maximum allowed |delta| in fils. Default 0 (exact).
 */
export function checkDoubleEntry(
  input: DoubleEntryInput,
  toleranceFils = 0,
): DoubleEntryResult {
  const sumCredits = input.creditsFils.reduce((a, b) => a + b, 0);
  const sumDebits = input.debitsFils.reduce((a, b) => a + b, 0);
  const expectedClosingFils = input.openingFils + sumCredits - sumDebits;
  const deltaFils = input.closingFils - expectedClosingFils;
  return {
    expectedClosingFils,
    actualClosingFils: input.closingFils,
    deltaFils,
    balanced: Math.abs(deltaFils) <= toleranceFils,
  };
}
