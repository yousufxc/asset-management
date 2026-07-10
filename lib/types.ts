/**
 * Shared domain types. These mirror the DB schema (lib/db/schema.sql).
 * Remember: every *_fils field is an INTEGER amount in fils (1 AED = 100 fils).
 */

export type PropertySubcategory = "off_plan" | "existing";
export type PropertyType = "apartment" | "penthouse" | "townhouse" | "villa" | "farm" | "commercial";
export type Bedrooms = "Studio" | "1BR" | "2BR" | "3BR" | "4BR" | "5BR" | "+5BR";
export type RentalType = "long_term" | "short_term";
export type ShortTermReturnFrequency = "monthly" | "quarterly";
export type InstallmentStatus = "upcoming" | "paid" | "overdue";
export type InstallmentSource = "manual" | "pdf";
export type MetalType = "gold" | "silver" | "platinum" | "palladium" | "other";
export type WeightUnit = "gram" | "kg" | "troy_oz" | "tola";

export type LandType = "residential" | "commercial" | "agricultural" | "industrial" | "mixed_use" | "other";

export type RentalDepositStatus = "pending" | "deposited";
export type EndReason = "cancelled" | "vacant" | "renewed";

export type SizeUnit = "sqft" | "sqm";
export type RateType = "fixed" | "variable";
export type WatchlistType = "property" | "commodity";

export interface WatchlistItem {
  id: number;
  type: WatchlistType;
  label: string;
  target_price_fils: number | null;
  target_price_per_unit_fils: number | null;
  property_type: PropertyType | null;
  city: string | null;
  area: string | null;
  metal_type: MetalType | null;
  weight: number | null;
  weight_unit: WeightUnit | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: number;
  name: string;
  subcategory: PropertySubcategory;
  property_type: PropertyType | null;
  bedrooms: Bedrooms | null;
  city: string | null;
  area: string | null;
  developer: string | null;
  size_sqft: number | null;
  size_unit?: SizeUnit;
  annual_service_charge_fils: number | null;
  purchase_price_fils: number | null;
  purchased_at: string | null;
  current_value_fils: number | null;
  valued_at: string | null;
  is_rental: 0 | 1;
  rental_type: RentalType | null;
  annual_rent_fils: number | null;
  rent_cheques_per_year: number | null; // 1|2|4|12
  rent_date_1: string | null; // ISO
  rent_date_2: string | null; // ISO
  rent_date_3: string | null; // ISO
  rent_date_4: string | null; // ISO
  pm_company_name: string | null;
  pm_commission_pct: number | null; // 0-100
  short_term_annual_rent_fils: number | null;
  short_term_return_frequency: ShortTermReturnFrequency | null;
  short_term_rent_deposit_date: string | null; // ISO
  contract_start_date: string | null; // ISO
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
  current_balance_fils: number;
  interest_rate: number | null;
  is_fixed_deposit: 0 | 1;
  fixed_deposit_period_months: number | null;
  fixed_deposit_start_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  runwayHorizonDays: number;
}

export interface Commodity {
  id: number;
  metal_type: MetalType;
  weight: number; // the amount
  weight_unit: WeightUnit;
  current_price_per_unit_fils: number; // price per weight_unit, now
  bought_price_per_unit_fils: number; // price per weight_unit, when bought
  target_sell_price_per_unit_fils: number | null; // user's sell target price per unit
  purchase_date: string; // ISO
  current_price_date: string | null; // ISO
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RentalHistory {
  id: number;
  property_id: number;
  rental_type: RentalType;
  annual_rent_fils: number | null;
  rent_cheques_per_year: number | null;
  rent_date_1: string | null;
  rent_date_2: string | null;
  rent_date_3: string | null;
  rent_date_4: string | null;
  pm_company_name: string | null;
  pm_commission_pct: number | null;
  short_term_annual_rent_fils: number | null;
  short_term_return_frequency: ShortTermReturnFrequency | null;
  short_term_rent_deposit_date: string | null;
  contract_start_date: string;
  contract_end_date: string | null;
  end_reason: EndReason | null;
  notes: string | null;
  created_at: string;
}

export interface RentalDeposit {
  id: number;
  property_id: number;
  cheque_number: number;
  deposit_date: string; // ISO
  amount_fils: number;
  status: RentalDepositStatus;
  deposited_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Mortgage {
  id: number;
  property_id: number;
  loan_amount_fils: number;
  interest_rate_pct: number;
  rate_type: RateType;
  loan_start_date: string;
  loan_term_months: number;
  lender_name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LandMortgage {
  id: number;
  land_id: number;
  loan_amount_fils: number;
  interest_rate_pct: number;
  rate_type: RateType;
  loan_start_date: string;
  loan_term_months: number;
  lender_name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Land {
  id: number;
  name: string;
  land_type: LandType | null;
  city: string | null;
  area: string | null;
  size_sqft: number | null;
  purchase_price_fils: number | null;
  current_value_fils: number | null;
  purchased_at: string | null;
  valued_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
