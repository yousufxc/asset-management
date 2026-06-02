/**
 * Shared domain types. These mirror the DB schema (lib/db/schema.sql).
 * Remember: every *_fils field is an INTEGER amount in fils (1 AED = 100 fils).
 */

export type PropertySubcategory = "off_plan" | "existing";
export type PropertyType = "apartment" | "penthouse" | "townhouse" | "villa";
export type InstallmentStatus = "upcoming" | "paid" | "overdue";
export type InstallmentSource = "manual" | "pdf";
export type MetalType = "gold" | "silver" | "platinum" | "palladium" | "other";
export type WeightUnit = "gram" | "kg" | "troy_oz" | "tola";
export type CommodityForm = "bar" | "coin" | "jewelry" | "other";
export type AccountType = "current" | "savings" | "fixed_deposit" | "other";

export interface Property {
  id: number;
  name: string;
  subcategory: PropertySubcategory;
  property_type: PropertyType | null;
  city: string | null;
  area: string | null;
  developer: string | null;
  size_sqft: number | null;
  purchase_price_fils: number | null;
  current_value_fils: number | null;
  valued_at: string | null;
  is_rental: 0 | 1;
  annual_rent_fils: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Installment {
  id: number;
  property_id: number;
  due_date: string; // ISO YYYY-MM-DD
  amount_fils: number;
  milestone_label: string | null;
  status: InstallmentStatus;
  paid_date: string | null;
  paid_amount_fils: number | null;
  source: InstallmentSource;
  source_file: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CashAccount {
  id: number;
  label: string;
  bank_name: string | null;
  account_type: AccountType | null;
  currency: "AED";
  current_balance_fils: number;
  is_liquid: 0 | 1;
  last_updated: string | null;
  gocardless_account_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Commodity {
  id: number;
  name: string;
  metal_type: MetalType;
  weight: number;
  weight_unit: WeightUnit;
  purity_fraction: number; // 0..1
  form: CommodityForm | null;
  quantity: number;
  storage_location: string | null;
  acquisition_price_fils: number | null;
  manual_value_fils: number | null;
  valued_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
