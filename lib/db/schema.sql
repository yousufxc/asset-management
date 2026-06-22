-- ============================================================================
-- Liquidity & Asset Orchestration Platform — SQLite schema
-- ----------------------------------------------------------------------------
-- MONEY MODEL (read this before touching any money column):
--   All monetary values are stored as INTEGER "fils" (1 AED = 100 fils).
--   Never store money as REAL/float anywhere. Floats lose pennies and make the
--   double-entry balance check (opening + credits - debits == closing) fail in
--   ways the owner cannot see. Convert AED<->fils only at the edges using
--   lib/core/units.ts (aedToFils / filsToAed). All math happens in fils.
--
-- DATES:
--   Stored as TEXT in strict ISO 'YYYY-MM-DD'. The owner's locale is UAE
--   (DD/MM/YYYY) — that is a DISPLAY/INPUT concern handled in lib/core/units.ts
--   and the UI. The database is always ISO. See date-parsing tests.
--
-- CURRENCY: single currency, AED. No FX columns. Do not add multi-currency.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- ASSET CLASS 1: PROPERTY (subcategories: 'off_plan' | 'existing')
--   'existing'  = completed property the owner holds (typically rental income).
--   'off_plan'  = under-construction property still on an installment plan.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS properties (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  name                TEXT    NOT NULL,                 -- e.g. "Marina Tower 1204"
  subcategory         TEXT    NOT NULL CHECK (subcategory IN ('off_plan', 'existing')),
  property_type       TEXT    CHECK (property_type IS NULL OR property_type IN ('apartment', 'penthouse', 'townhouse', 'villa')),
  bedrooms            TEXT    CHECK (bedrooms IS NULL OR bedrooms IN ('Studio', '1BR', '2BR', '3BR', '4BR', '5BR', '+5BR')),
  city                TEXT,                              -- e.g. Dubai, Abu Dhabi
  area                TEXT,                              -- DLD community/area, used for AVM later
  developer           TEXT,                              -- off-plan developer
  size_sqft           REAL,                              -- for AVM: median price/sqft * size
  annual_service_charge_fils INTEGER CHECK (annual_service_charge_fils IS NULL OR annual_service_charge_fils >= 0),
   purchase_price_fils INTEGER CHECK (purchase_price_fils IS NULL OR purchase_price_fils >= 0),
   purchased_at       TEXT,                              -- ISO date of purchase
  current_value_fils  INTEGER CHECK (current_value_fils  IS NULL OR current_value_fils  >= 0),
  valued_at           TEXT,                              -- ISO date of last manual valuation (staleness)
  is_rental           INTEGER NOT NULL DEFAULT 0 CHECK (is_rental IN (0, 1)),
  rental_type         TEXT    CHECK (rental_type IS NULL OR rental_type IN ('long_term', 'short_term')),  -- NULL = long_term for legacy
  annual_rent_fils    INTEGER CHECK (annual_rent_fils IS NULL OR annual_rent_fils >= 0),  -- yearly rent (UAE rents are quoted annually)
  rent_cheques_per_year INTEGER CHECK (rent_cheques_per_year IS NULL OR rent_cheques_per_year IN (1, 2, 4, 12)),
  rent_date_1         TEXT,                              -- ISO: cheque 1 deposit date (also first monthly cheque for 12/year)
  rent_date_2         TEXT,                              -- ISO: cheque 2 (null if <2 or monthly)
  rent_date_3         TEXT,                              -- ISO: cheque 3 (null if <3 or monthly)
  rent_date_4         TEXT,                              -- ISO: cheque 4 (null if <4 or monthly)
  pm_company_name     TEXT,                              -- short-term: property management company name
  pm_commission_pct   REAL    CHECK (pm_commission_pct IS NULL OR (pm_commission_pct >= 0 AND pm_commission_pct <= 100)),  -- short-term: commission 0-100
  short_term_annual_rent_fils INTEGER CHECK (short_term_annual_rent_fils IS NULL OR short_term_annual_rent_fils >= 0),     -- short-term: expected annual rent
  short_term_return_frequency TEXT CHECK (short_term_return_frequency IS NULL OR short_term_return_frequency IN ('monthly', 'quarterly')),  -- short-term: deposit frequency
  short_term_rent_deposit_date TEXT,                     -- ISO: short-term final/last rental deposit date (non-recurring)
  notes               TEXT,
  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Installment schedule for off-plan properties (and any staged payment plan).
-- Fed by BOTH the manual entry form and the PDF->Claude ingestion pipeline;
-- this is the single source of truth for what is owed and when.
CREATE TABLE IF NOT EXISTS installments (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id      INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  due_date         TEXT    NOT NULL,                    -- ISO 'YYYY-MM-DD'
  amount_fils      INTEGER NOT NULL CHECK (amount_fils >= 0),
  milestone_label  TEXT,                                -- e.g. "20% on completion of foundation"
  status           TEXT    NOT NULL DEFAULT 'upcoming'
                     CHECK (status IN ('upcoming', 'paid', 'overdue')),
  paid_date        TEXT,                                -- ISO date actually paid
  paid_amount_fils INTEGER CHECK (paid_amount_fils IS NULL OR paid_amount_fils >= 0),
  source           TEXT    NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'pdf')),
  source_file      TEXT,                                -- original SPA filename if source='pdf'
  notes            TEXT,
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_installments_property ON installments(property_id);
CREATE INDEX IF NOT EXISTS idx_installments_due      ON installments(due_date);
CREATE INDEX IF NOT EXISTS idx_installments_status   ON installments(status);

-- ----------------------------------------------------------------------------
-- ASSET CLASS 2: SAVING ACCOUNTS (bank accounts). Manual entry only: an account
--   label, balance, optional fixed-deposit fields, and interest rate.
--   ALL cash counts as liquid for the runway (owner decision 2026-06-04).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_accounts (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  label                       TEXT    NOT NULL,               -- bank account name, e.g. "Emirates NBD Savings"
  current_balance_fils        INTEGER NOT NULL DEFAULT 0,     -- manually entered balance
  interest_rate               REAL,                            -- annual interest rate percentage (e.g. 4.5 for 4.5%)
  is_fixed_deposit            INTEGER NOT NULL DEFAULT 0 CHECK (is_fixed_deposit IN (0, 1)),
  fixed_deposit_period_months INTEGER,                         -- contract period in months (only relevant when is_fixed_deposit=1)
  fixed_deposit_start_date    TEXT,                            -- ISO date the fixed deposit started (only relevant when is_fixed_deposit=1)
  notes                       TEXT,
  created_at                  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at                  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ----------------------------------------------------------------------------
-- ASSET CLASS 3: COMMODITIES (manual entry — owner decision 2026-06-04).
--   Track: type, amount (weight + unit), current price PER UNIT, price-when-bought
--   PER UNIT, date of purchase, date of the current price.
--   Total value = round(weight * current_price_per_unit_fils). No live spot, no purity.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commodities (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  metal_type                  TEXT    NOT NULL CHECK (metal_type IN ('gold', 'silver', 'platinum', 'palladium', 'other')),
  weight                      REAL    NOT NULL CHECK (weight > 0),                 -- the amount
  weight_unit                 TEXT    NOT NULL CHECK (weight_unit IN ('gram', 'kg', 'troy_oz', 'tola')),
  current_price_per_unit_fils INTEGER NOT NULL DEFAULT 0 CHECK (current_price_per_unit_fils >= 0),  -- price per weight_unit, now
  bought_price_per_unit_fils  INTEGER NOT NULL CHECK (bought_price_per_unit_fils >= 0), -- per weight_unit, when bought
  purchase_date               TEXT    NOT NULL,               -- ISO date of purchase
  current_price_date          TEXT,                            -- ISO date the current price is as-of
  notes                       TEXT,
  created_at                  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at                  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ----------------------------------------------------------------------------
-- INGESTION: bank/SPA statements and their transactions (Phase 1 PDF pipeline).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS statements (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id           INTEGER REFERENCES cash_accounts(id) ON DELETE SET NULL,
  source_file          TEXT    NOT NULL,
  period_start         TEXT,                             -- ISO
  period_end           TEXT,                             -- ISO
  opening_balance_fils INTEGER,
  closing_balance_fils INTEGER,
  balance_check_passed INTEGER CHECK (balance_check_passed IN (0, 1)),
  ingested_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id             INTEGER REFERENCES cash_accounts(id) ON DELETE SET NULL,
  statement_id           INTEGER REFERENCES statements(id) ON DELETE SET NULL,
  txn_date               TEXT    NOT NULL,               -- ISO 'YYYY-MM-DD'
  description            TEXT    NOT NULL,
  normalized_description TEXT    NOT NULL,               -- from lib/core/dedup.ts
  amount_fils            INTEGER NOT NULL,               -- SIGNED: credits +, debits -
  -- Stable de-dup hash (sha256 of date|normalized_description|signed_amount_fils).
  -- UNIQUE enforces dedup at the DB level: re-ingesting the same row is a no-op.
  dedup_hash             TEXT    NOT NULL UNIQUE,
  source                 TEXT    NOT NULL DEFAULT 'pdf' CHECK (source IN ('pdf', 'manual')),
  created_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date    ON transactions(txn_date);

-- ----------------------------------------------------------------------------
-- SETTINGS — key/value store for user preferences (single-user, local).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- READ-ONLY VIEWS for the Phase-3 chatbot (rule 2.5).
--   The chatbot uses a separate read-only DB handle AND only sees these
--   sanitized views — never base tables, never anything holding secrets.
--   (API keys live in .env.local, never in the DB, so none are exposed here.)
-- ----------------------------------------------------------------------------
-- Safe migration for existing databases: add columns if they don't already exist.
-- (New databases get these from CREATE TABLE above.)
ALTER TABLE properties ADD COLUMN rental_type                TEXT CHECK (rental_type IS NULL OR rental_type IN ('long_term', 'short_term'));
ALTER TABLE properties ADD COLUMN pm_company_name            TEXT;
ALTER TABLE properties ADD COLUMN pm_commission_pct          REAL CHECK (pm_commission_pct IS NULL OR (pm_commission_pct >= 0 AND pm_commission_pct <= 100));
ALTER TABLE properties ADD COLUMN short_term_annual_rent_fils INTEGER CHECK (short_term_annual_rent_fils IS NULL OR short_term_annual_rent_fils >= 0);
ALTER TABLE properties ADD COLUMN short_term_return_frequency TEXT CHECK (short_term_return_frequency IS NULL OR short_term_return_frequency IN ('monthly', 'quarterly'));
ALTER TABLE properties ADD COLUMN short_term_rent_deposit_date TEXT;
ALTER TABLE cash_accounts ADD COLUMN fixed_deposit_start_date TEXT;
ALTER TABLE properties ADD COLUMN contract_start_date TEXT;

DROP VIEW IF EXISTS v_properties;
CREATE VIEW IF NOT EXISTS v_properties AS
  SELECT id, name, subcategory, property_type, bedrooms, city, area, developer, size_sqft,
         annual_service_charge_fils, purchase_price_fils, purchased_at, current_value_fils, valued_at,
         is_rental, rental_type, annual_rent_fils, rent_cheques_per_year,
         rent_date_1, rent_date_2, rent_date_3, rent_date_4,
         pm_company_name, pm_commission_pct, short_term_annual_rent_fils,
         short_term_return_frequency, short_term_rent_deposit_date, contract_start_date
  FROM properties;

DROP VIEW IF EXISTS v_installments;
CREATE VIEW IF NOT EXISTS v_installments AS
  SELECT id, property_id, due_date, amount_fils, milestone_label,
         status, paid_date, paid_amount_fils
  FROM installments;

DROP VIEW IF EXISTS v_cash_accounts;
CREATE VIEW IF NOT EXISTS v_cash_accounts AS
  SELECT id, label, current_balance_fils, interest_rate, is_fixed_deposit, fixed_deposit_period_months, fixed_deposit_start_date
  FROM cash_accounts;

DROP VIEW IF EXISTS v_commodities;
CREATE VIEW IF NOT EXISTS v_commodities AS
  SELECT id, metal_type, weight, weight_unit,
         current_price_per_unit_fils, bought_price_per_unit_fils,
         purchase_date, current_price_date, notes
  FROM commodities;

-- ----------------------------------------------------------------------------
-- RENTAL HISTORY — immutable snapshots of each contract period.
-- Created automatically when a contract is cancelled, renewed, or marked vacant.
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS v_rental_history;
CREATE TABLE IF NOT EXISTS rental_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  rental_type TEXT NOT NULL,
  annual_rent_fils INTEGER,
  rent_cheques_per_year INTEGER,
  rent_date_1 TEXT, rent_date_2 TEXT, rent_date_3 TEXT, rent_date_4 TEXT,
  pm_company_name TEXT, pm_commission_pct REAL,
  short_term_annual_rent_fils INTEGER,
  short_term_return_frequency TEXT, short_term_rent_deposit_date TEXT,
  contract_start_date TEXT NOT NULL,
  contract_end_date TEXT,
  end_reason TEXT CHECK (end_reason IN ('cancelled','vacant','renewed')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE VIEW IF NOT EXISTS v_rental_history AS
  SELECT id, property_id, rental_type, annual_rent_fils, rent_cheques_per_year,
         rent_date_1, rent_date_2, rent_date_3, rent_date_4,
         pm_company_name, pm_commission_pct, short_term_annual_rent_fils,
         short_term_return_frequency, short_term_rent_deposit_date,
         contract_start_date, contract_end_date, end_reason
  FROM rental_history;

-- ----------------------------------------------------------------------------
-- RENTAL DEPOSITS — individual deposit cheques with status tracking.
-- Auto-generated from property rental config; user marks each as deposited.
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS v_rental_deposits;
CREATE TABLE IF NOT EXISTS rental_deposits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  cheque_number INTEGER NOT NULL,
  deposit_date TEXT NOT NULL,
  amount_fils INTEGER NOT NULL CHECK (amount_fils >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','deposited')),
  deposited_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE VIEW IF NOT EXISTS v_rental_deposits AS
  SELECT id, property_id, cheque_number, deposit_date, amount_fils, status, deposited_date
  FROM rental_deposits;
