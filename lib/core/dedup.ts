/**
 * PURE transaction de-duplication. No DB, no network.
 *
 * A transaction's identity is the stable hash of:
 *     date | normalized_description | signed_amount_fils
 * Re-ingesting the same statement produces identical hashes, and the UNIQUE
 * constraint on transactions.dedup_hash turns a re-insert into a no-op.
 *
 * normalizeDescription must be DETERMINISTIC and stable across re-ingests — if
 * it changes, old and new hashes diverge and dedup silently breaks. Change it
 * only with a deliberate re-hash migration.
 */

import { createHash } from "node:crypto";

/**
 * Normalize a bank/statement description so cosmetic differences (extra spaces,
 * case, trailing reference noise) don't defeat dedup.
 *   - lowercase
 *   - collapse all whitespace runs to a single space
 *   - trim
 */
export function normalizeDescription(description: string): string {
  return description.toLowerCase().replace(/\s+/g, " ").trim();
}

export interface TransactionIdentity {
  /** ISO date 'YYYY-MM-DD'. */
  date: string;
  /** Raw or normalized description; this function normalizes it either way. */
  description: string;
  /** SIGNED amount in integer fils (credits +, debits -). */
  amountFils: number;
}

/** Compute the stable SHA-256 dedup hash for a transaction. */
export function transactionHash(txn: TransactionIdentity): string {
  if (!Number.isInteger(txn.amountFils)) {
    throw new Error(`transactionHash: amountFils must be an integer (fils): ${txn.amountFils}`);
  }
  const normalized = normalizeDescription(txn.description);
  const payload = `${txn.date}|${normalized}|${txn.amountFils}`;
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
