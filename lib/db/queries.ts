/**
 * Thin DB layer (rule 2.3): parameterized query helpers. NO business logic here
 * beyond converting validated human input (AED decimals, UAE dates) into the
 * stored representation (integer fils, ISO dates) via lib/core/units.ts.
 *
 * Every write takes an already-Zod-validated *Input object (lib/ingest/validate.ts).
 * Every statement is parameterized — never string-interpolate user input into SQL.
 */

import { getDb } from "@/lib/db/client";
import type { SQLInputValue } from "node:sqlite";
import { aedToFils, parseDateToIso } from "@/lib/core/units";
import { normalizeDescription, transactionHash } from "@/lib/core/dedup";
import type {
  PropertyInput,
  PropertyUpdate,
  InstallmentInput,
  CashAccountInput,
  CommodityInput,
} from "@/lib/ingest/validate";
import type { Property, Installment, CashAccount, Commodity } from "@/lib/types";

// Helpers --------------------------------------------------------------------
const aedOrNull = (v: number | null | undefined): number | null =>
  v === null || v === undefined ? null : aedToFils(v);
const dateOrNull = (v: string | null | undefined): string | null =>
  v === null || v === undefined ? null : parseDateToIso(v);

// PROPERTIES -----------------------------------------------------------------
export function insertProperty(input: PropertyInput): Property {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO properties
      (name, subcategory, property_type, bedrooms, city, area, developer, size_sqft,
       annual_service_charge_fils, purchase_price_fils,
       current_value_fils, valued_at, is_rental, annual_rent_fils, rent_cheques_per_year,
       rent_date_1, rent_date_2, rent_date_3, rent_date_4, notes)
    VALUES
      (@name, @subcategory, @property_type, @bedrooms, @city, @area, @developer, @size_sqft,
       @annual_service_charge_fils, @purchase_price_fils,
       @current_value_fils, @valued_at, @is_rental, @annual_rent_fils, @rent_cheques_per_year,
       @rent_date_1, @rent_date_2, @rent_date_3, @rent_date_4, @notes)
  `);
  const info = stmt.run({
    name: input.name,
    subcategory: input.subcategory,
    property_type: input.property_type ?? null,
    bedrooms: input.bedrooms ?? null,
    city: input.city ?? null,
    area: input.area ?? null,
    developer: input.developer ?? null,
    size_sqft: input.size_sqft ?? null,
    annual_service_charge_fils: aedOrNull(input.annual_service_charge_aed),
    purchase_price_fils: aedOrNull(input.purchase_price_aed),
    current_value_fils: aedOrNull(input.current_value_aed),
    valued_at: dateOrNull(input.valued_at),
    is_rental: input.is_rental ? 1 : 0,
    annual_rent_fils: aedOrNull(input.annual_rent_aed),
    rent_cheques_per_year: input.is_rental ? input.rent_cheques_per_year ?? null : null,
    rent_date_1: input.is_rental ? dateOrNull(input.rent_date_1) : null,
    rent_date_2: input.is_rental ? dateOrNull(input.rent_date_2) : null,
    rent_date_3: input.is_rental ? dateOrNull(input.rent_date_3) : null,
    rent_date_4: input.is_rental ? dateOrNull(input.rent_date_4) : null,
    notes: input.notes ?? null,
  });
  return getProperty(Number(info.lastInsertRowid))!;
}

export function getProperty(id: number): Property | undefined {
  return getDb().prepare(`SELECT * FROM properties WHERE id = ?`).get(id) as unknown as Property | undefined;
}

export function listProperties(): Property[] {
  return getDb().prepare(`SELECT * FROM properties ORDER BY created_at DESC`).all() as unknown as Property[];
}

export function updateProperty(id: number, data: PropertyUpdate): Property | undefined {
  const db = getDb();
  const sets: string[] = [];
  const params: Record<string, SQLInputValue> = { id };

  if (data.name !== undefined) { sets.push("name = @name"); params.name = data.name; }
  if (data.subcategory !== undefined) { sets.push("subcategory = @subcategory"); params.subcategory = data.subcategory; }
  if (data.property_type !== undefined) { sets.push("property_type = @property_type"); params.property_type = data.property_type; }
  if (data.bedrooms !== undefined) { sets.push("bedrooms = @bedrooms"); params.bedrooms = data.bedrooms; }
  if (data.city !== undefined) { sets.push("city = @city"); params.city = data.city; }
  if (data.area !== undefined) { sets.push("area = @area"); params.area = data.area; }
  if (data.developer !== undefined) { sets.push("developer = @developer"); params.developer = data.developer; }
  if (data.size_sqft !== undefined) { sets.push("size_sqft = @size_sqft"); params.size_sqft = data.size_sqft; }
  if (data.annual_service_charge_aed !== undefined) { sets.push("annual_service_charge_fils = @annual_service_charge_fils"); params.annual_service_charge_fils = aedOrNull(data.annual_service_charge_aed); }
  if (data.purchase_price_aed !== undefined) { sets.push("purchase_price_fils = @purchase_price_fils"); params.purchase_price_fils = aedOrNull(data.purchase_price_aed); }
  if (data.current_value_aed !== undefined) { sets.push("current_value_fils = @current_value_fils"); params.current_value_fils = aedOrNull(data.current_value_aed); }
  if (data.valued_at !== undefined) { sets.push("valued_at = @valued_at"); params.valued_at = dateOrNull(data.valued_at); }
  if (data.is_rental !== undefined) { sets.push("is_rental = @is_rental"); params.is_rental = data.is_rental ? 1 : 0; }
  if (data.annual_rent_aed !== undefined) { sets.push("annual_rent_fils = @annual_rent_fils"); params.annual_rent_fils = aedOrNull(data.annual_rent_aed); }
  if (data.rent_cheques_per_year !== undefined) { sets.push("rent_cheques_per_year = @rent_cheques_per_year"); params.rent_cheques_per_year = data.rent_cheques_per_year; }
  if (data.rent_date_1 !== undefined) { sets.push("rent_date_1 = @rent_date_1"); params.rent_date_1 = dateOrNull(data.rent_date_1); }
  if (data.rent_date_2 !== undefined) { sets.push("rent_date_2 = @rent_date_2"); params.rent_date_2 = dateOrNull(data.rent_date_2); }
  if (data.rent_date_3 !== undefined) { sets.push("rent_date_3 = @rent_date_3"); params.rent_date_3 = dateOrNull(data.rent_date_3); }
  if (data.rent_date_4 !== undefined) { sets.push("rent_date_4 = @rent_date_4"); params.rent_date_4 = dateOrNull(data.rent_date_4); }
  if (data.notes !== undefined) { sets.push("notes = @notes"); params.notes = data.notes; }

  if (sets.length === 0) return getProperty(id);

  sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
  db.prepare(`UPDATE properties SET ${sets.join(", ")} WHERE id = @id`).run(params);
  return getProperty(id);
}

// INSTALLMENTS ---------------------------------------------------------------
export function insertInstallment(input: InstallmentInput): Installment {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO installments
      (property_id, due_date, amount_fils, milestone_label, status,
       paid_date, paid_amount_fils, source, source_file, notes)
    VALUES
      (@property_id, @due_date, @amount_fils, @milestone_label, @status,
       @paid_date, @paid_amount_fils, @source, @source_file, @notes)
  `);
  const info = stmt.run({
    property_id: input.property_id,
    due_date: parseDateToIso(input.due_date),
    amount_fils: aedToFils(input.amount_aed),
    milestone_label: input.milestone_label ?? null,
    status: input.status,
    paid_date: dateOrNull(input.paid_date),
    paid_amount_fils: aedOrNull(input.paid_amount_aed),
    source: input.source,
    source_file: input.source_file ?? null,
    notes: input.notes ?? null,
  });
  return getDb()
    .prepare(`SELECT * FROM installments WHERE id = ?`)
    .get(Number(info.lastInsertRowid)) as unknown as Installment;
}

export function listInstallmentsForProperty(propertyId: number): Installment[] {
  return getDb()
    .prepare(`SELECT * FROM installments WHERE property_id = ? ORDER BY due_date ASC`)
    .all(propertyId) as unknown as Installment[];
}

export function listAllInstallments(): Installment[] {
  return getDb()
    .prepare(`SELECT * FROM installments ORDER BY due_date ASC`)
    .all() as unknown as Installment[];
}

export function getInstallment(id: number): Installment | undefined {
  return getDb()
    .prepare(`SELECT * FROM installments WHERE id = ?`)
    .get(id) as unknown as Installment | undefined;
}

export function markInstallmentPaid(
  id: number,
  paidDateUae?: string | null,
  paidAmountAed?: number | null,
): Installment | undefined {
  const db = getDb();
  const paidDateIso = dateOrNull(paidDateUae);
  const paidFils = aedOrNull(paidAmountAed);
  db.prepare(`
    UPDATE installments
    SET status = 'paid',
        paid_date = @paid_date,
        paid_amount_fils = @paid_amount_fils,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = @id
  `).run({ id, paid_date: paidDateIso, paid_amount_fils: paidFils });
  return getInstallment(id);
}

export function updateInstallment(
  id: number,
  data: {
    dueDateUae?: string;
    amountAed?: number;
    milestoneLabel?: string | null;
    status?: string;
    paidDateUae?: string | null;
    paidAmountAed?: number | null;
    notes?: string | null;
  },
): Installment | undefined {
  const db = getDb();
  const sets: string[] = [];
  const params: Record<string, SQLInputValue> = { id };

  if (data.dueDateUae !== undefined) {
    sets.push("due_date = @due_date");
    params.due_date = parseDateToIso(data.dueDateUae);
  }
  if (data.amountAed !== undefined) {
    sets.push("amount_fils = @amount_fils");
    params.amount_fils = aedToFils(data.amountAed);
  }
  if (data.milestoneLabel !== undefined) {
    sets.push("milestone_label = @milestone_label");
    params.milestone_label = data.milestoneLabel;
  }
  if (data.status !== undefined) {
    sets.push("status = @status");
    params.status = data.status;
  }
  if (data.paidDateUae !== undefined) {
    sets.push("paid_date = @paid_date");
    params.paid_date = dateOrNull(data.paidDateUae);
  }
  if (data.paidAmountAed !== undefined) {
    sets.push("paid_amount_fils = @paid_amount_fils");
    params.paid_amount_fils = aedOrNull(data.paidAmountAed);
  }
  if (data.notes !== undefined) {
    sets.push("notes = @notes");
    params.notes = data.notes;
  }

  if (sets.length === 0) return getInstallment(id);

  sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
  db.prepare(`UPDATE installments SET ${sets.join(", ")} WHERE id = @id`).run(params);
  return getInstallment(id);
}

export function deleteInstallment(id: number): void {
  getDb().prepare(`DELETE FROM installments WHERE id = ?`).run(id);
}
/** Check if an installment with (property_id, due_date, amount_fils) exists — used for PDF idempotency. */
export function installmentExistsByKey(
  propertyId: number,
  dueDateIso: string,
  amountFils: number,
): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 FROM installments WHERE property_id = ? AND due_date = ? AND amount_fils = ? LIMIT 1`,
    )
    .get(propertyId, dueDateIso, amountFils);
  return row !== undefined;
}

// CASH ACCOUNTS --------------------------------------------------------------
export function insertCashAccount(input: CashAccountInput): CashAccount {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO cash_accounts (label, current_balance_fils)
    VALUES (@label, @current_balance_fils)
  `);
  const info = stmt.run({
    label: input.label,
    current_balance_fils: aedToFils(input.current_balance_aed),
  });
  return getDb()
    .prepare(`SELECT * FROM cash_accounts WHERE id = ?`)
    .get(Number(info.lastInsertRowid)) as unknown as CashAccount;
}

export function listCashAccounts(): CashAccount[] {
  return getDb()
    .prepare(`SELECT * FROM cash_accounts ORDER BY created_at DESC`)
    .all() as unknown as CashAccount[];
}

// COMMODITIES ----------------------------------------------------------------
export function insertCommodity(input: CommodityInput): Commodity {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO commodities
      (metal_type, weight, weight_unit, current_price_per_unit_fils,
       bought_price_per_unit_fils, purchase_date, current_price_date)
    VALUES
      (@metal_type, @weight, @weight_unit, @current_price_per_unit_fils,
       @bought_price_per_unit_fils, @purchase_date, @current_price_date)
  `);
  const info = stmt.run({
    metal_type: input.metal_type,
    weight: input.weight,
    weight_unit: input.weight_unit,
    current_price_per_unit_fils: aedToFils(input.current_price_per_unit_aed),
    bought_price_per_unit_fils: aedOrNull(input.bought_price_per_unit_aed),
    purchase_date: dateOrNull(input.purchase_date),
    current_price_date: dateOrNull(input.current_price_date),
  });
  return getDb()
    .prepare(`SELECT * FROM commodities WHERE id = ?`)
    .get(Number(info.lastInsertRowid)) as unknown as Commodity;
}

export function listCommodities(): Commodity[] {
  return getDb()
    .prepare(`SELECT * FROM commodities ORDER BY created_at DESC`)
    .all() as unknown as Commodity[];
}

// TRANSACTIONS (dedup-aware) -------------------------------------------------
export interface RawTransaction {
  account_id: number | null;
  statement_id: number | null;
  txn_date: string; // ISO
  description: string;
  amount_fils: number; // signed
  source?: "pdf" | "manual";
}

/**
 * Insert a transaction, skipping it if its dedup_hash already exists.
 * Returns true if a new row was inserted, false if it was a duplicate.
 */
export function insertTransactionDeduped(txn: RawTransaction): boolean {
  const db = getDb();
  const hash = transactionHash({
    date: txn.txn_date,
    description: txn.description,
    amountFils: txn.amount_fils,
  });
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO transactions
      (account_id, statement_id, txn_date, description, normalized_description,
       amount_fils, dedup_hash, source)
    VALUES
      (@account_id, @statement_id, @txn_date, @description, @normalized_description,
       @amount_fils, @dedup_hash, @source)
  `);
  const info = stmt.run({
    account_id: txn.account_id,
    statement_id: txn.statement_id,
    txn_date: txn.txn_date,
    description: txn.description,
    normalized_description: normalizeDescription(txn.description),
    amount_fils: txn.amount_fils,
    dedup_hash: hash,
    source: txn.source ?? "pdf",
  });
  return info.changes > 0;
}
