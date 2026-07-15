/**
 * Zod schemas — the single gate every object must pass before any DB write
 * (rule 2.3 / §3 "Validation: Zod"). API routes parse request bodies with these
 * and reject on failure; the PDF pipeline validates Claude's JSON with these.
 *
 * INPUT CONVENTION: forms/users submit AED as decimal numbers and dates as
 * UAE "DD/MM/YYYY". These schemas accept that human input and the *Insert*
 * helpers in lib/db/queries.ts convert to fils + ISO via lib/core/units.ts.
 * Schemas suffixed `Fils` accept already-converted integer fils (machine input
 * such as the PDF pipeline / re-imports).
 */

import { z } from "zod";
import { parseDateToIso } from "@/lib/core/units";

const aedAmount = z.number().nonnegative().finite();
const dateString = z
  .string()
  .refine((v) => {
    try {
      parseDateToIso(v);
      return true;
    } catch {
      return false;
    }
  }, "invalid date (use YYYY-MM-DD or DD/MM/YYYY)");

const noFutureDate = dateString.refine(
  (v) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      return parseDateToIso(v) <= today;
    } catch {
      return false;
    }
  },
  "date cannot be in the future",
);

// ---------------------------------------------------------------------------
// PROPERTY
// ---------------------------------------------------------------------------
export const PropertyInputSchema = z.object({
  name: z.string().min(1),
  subcategory: z.enum(["off_plan", "existing"]),
  property_type: z.enum(["apartment", "penthouse", "townhouse", "villa", "farm", "commercial"]).optional().nullable(),
  bedrooms: z.enum(["Studio", "1BR", "2BR", "3BR", "4BR", "5BR", "+5BR"]).optional().nullable(),
  city: z.string().optional().nullable(),
  area: z.string().optional().nullable(),
  developer: z.string().optional().nullable(),
  size_sqft: z.number().positive().optional().nullable(),
  size_unit: z.enum(["sqft", "sqm"]).default("sqft"),
  annual_service_charge_aed: aedAmount.optional().nullable(),
  purchase_price_aed: aedAmount.optional().nullable(),
  purchased_at: noFutureDate.optional().nullable(),
  current_value_aed: aedAmount.optional().nullable(),
  valued_at: noFutureDate.optional().nullable(),
  is_rental: z.boolean().default(false),
  rental_type: z.enum(["long_term", "short_term"]).optional().nullable(),
  annual_rent_aed: aedAmount.optional().nullable(),
  rent_cheques_per_year: z.number().int().refine((v) => [1, 2, 4, 12].includes(v), "must be 1, 2, 4, or 12").optional().nullable(),
  rent_date_1: dateString.optional().nullable(),
  rent_date_2: dateString.optional().nullable(),
  rent_date_3: dateString.optional().nullable(),
  rent_date_4: dateString.optional().nullable(),
  pm_company_name: z.string().optional().nullable(),
  pm_commission_pct: z.number().min(0).max(100).optional().nullable(),
  short_term_annual_rent_aed: aedAmount.optional().nullable(),
  short_term_return_frequency: z.enum(["monthly", "quarterly"]).optional().nullable(),
  short_term_rent_deposit_date: dateString.optional().nullable(),
  contract_start_date: dateString.optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type PropertyInput = z.infer<typeof PropertyInputSchema>;

// ---------------------------------------------------------------------------
// PROPERTY UPDATE (partial — fields allowed in PATCH)
// ---------------------------------------------------------------------------
export const PropertyUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  subcategory: z.enum(["off_plan", "existing"]).optional(),
  property_type: z.enum(["apartment", "penthouse", "townhouse", "villa", "farm", "commercial"]).optional().nullable(),
  bedrooms: z.enum(["Studio", "1BR", "2BR", "3BR", "4BR", "5BR", "+5BR"]).optional().nullable(),
  city: z.string().optional().nullable(),
  area: z.string().optional().nullable(),
  developer: z.string().optional().nullable(),
  size_sqft: z.number().positive().optional().nullable(),
  size_unit: z.enum(["sqft", "sqm"]).optional(),
  annual_service_charge_aed: aedAmount.optional().nullable(),
  purchase_price_aed: aedAmount.optional().nullable(),
  purchased_at: noFutureDate.optional().nullable(),
  current_value_aed: aedAmount.optional().nullable(),
  valued_at: noFutureDate.optional().nullable(),
  is_rental: z.boolean().optional(),
  rental_type: z.enum(["long_term", "short_term"]).optional().nullable(),
  annual_rent_aed: aedAmount.optional().nullable(),
  rent_cheques_per_year: z.number().int().refine((v) => [1, 2, 4, 12].includes(v), "must be 1, 2, 4, or 12").optional().nullable(),
  rent_date_1: dateString.optional().nullable(),
  rent_date_2: dateString.optional().nullable(),
  rent_date_3: dateString.optional().nullable(),
  rent_date_4: dateString.optional().nullable(),
  pm_company_name: z.string().optional().nullable(),
  pm_commission_pct: z.number().min(0).max(100).optional().nullable(),
  short_term_annual_rent_aed: aedAmount.optional().nullable(),
  short_term_return_frequency: z.enum(["monthly", "quarterly"]).optional().nullable(),
  short_term_rent_deposit_date: dateString.optional().nullable(),
  contract_start_date: dateString.optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type PropertyUpdate = z.infer<typeof PropertyUpdateSchema>;

// ---------------------------------------------------------------------------
// PROPERTY MAINTENANCE
// ---------------------------------------------------------------------------
export const PropertyMaintenanceInputSchema = z.object({
  property_id: z.number().int().positive(),
  amount_aed: aedAmount,
  maintenance_date: noFutureDate,
  notes: z.string().optional().nullable(),
});
export type PropertyMaintenanceInput = z.infer<typeof PropertyMaintenanceInputSchema>;

export const PropertyMaintenanceUpdateSchema = z.object({
  amount_aed: aedAmount.optional(),
  maintenance_date: noFutureDate.optional(),
  notes: z.string().optional().nullable(),
});
export type PropertyMaintenanceUpdate = z.infer<typeof PropertyMaintenanceUpdateSchema>;

// ---------------------------------------------------------------------------
// MORTGAGE
// ---------------------------------------------------------------------------
export const MortgageInputSchema = z.object({
  property_id: z.number().int().positive(),
  loan_amount_aed: aedAmount,
  interest_rate_pct: z.number().nonnegative().finite(),
  rate_type: z.enum(["fixed", "variable"]),
  loan_start_date: noFutureDate,
  loan_term_months: z.number().int().positive(),
  lender_name: z.string().min(1),
  notes: z.string().optional().nullable(),
});
export type MortgageInput = z.infer<typeof MortgageInputSchema>;

export const MortgageUpdateSchema = z.object({
  loan_amount_aed: aedAmount.optional(),
  interest_rate_pct: z.number().nonnegative().finite().optional(),
  rate_type: z.enum(["fixed", "variable"]).optional(),
  loan_start_date: noFutureDate.optional(),
  loan_term_months: z.number().int().positive().optional(),
  lender_name: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
});
export type MortgageUpdate = z.infer<typeof MortgageUpdateSchema>;

// ---------------------------------------------------------------------------
// LAND MORTGAGE
// ---------------------------------------------------------------------------
export const LandMortgageInputSchema = z.object({
  land_id: z.number().int().positive(),
  loan_amount_aed: aedAmount,
  interest_rate_pct: z.number().nonnegative().finite(),
  rate_type: z.enum(["fixed", "variable"]),
  loan_start_date: noFutureDate,
  loan_term_months: z.number().int().positive(),
  lender_name: z.string().min(1),
  notes: z.string().optional().nullable(),
});
export type LandMortgageInput = z.infer<typeof LandMortgageInputSchema>;

export const LandMortgageUpdateSchema = z.object({
  loan_amount_aed: aedAmount.optional(),
  interest_rate_pct: z.number().nonnegative().finite().optional(),
  rate_type: z.enum(["fixed", "variable"]).optional(),
  loan_start_date: noFutureDate.optional(),
  loan_term_months: z.number().int().positive().optional(),
  lender_name: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
});
export type LandMortgageUpdate = z.infer<typeof LandMortgageUpdateSchema>;

// ---------------------------------------------------------------------------
// INSTALLMENT (manual form AND PDF pipeline target this shape)
// ---------------------------------------------------------------------------
export const InstallmentInputSchema = z.object({
  property_id: z.number().int().positive(),
  due_date: dateString,
  amount_aed: aedAmount,
  milestone_label: z.string().optional().nullable(),
  status: z.enum(["upcoming", "paid", "overdue"]).default("upcoming"),
  paid_date: dateString.optional().nullable(),
  paid_amount_aed: aedAmount.optional().nullable(),
  source: z.enum(["manual", "pdf"]).default("manual"),
  source_file: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type InstallmentInput = z.infer<typeof InstallmentInputSchema>;

// ---------------------------------------------------------------------------
// SAVING ACCOUNTS — manual entry only: account label, balance, optional
//   fixed-deposit fields, and interest rate. All cash is liquid.
// ---------------------------------------------------------------------------
export const CashAccountInputSchema = z.object({
  label: z.string().min(1),
  current_balance_aed: z.number().nonnegative().finite().default(0),
  interest_rate: z.number().nonnegative().finite().optional().nullable(),
  is_fixed_deposit: z.boolean().default(false),
  fixed_deposit_period_months: z.number().int().positive().optional().nullable(),
  fixed_deposit_start_date: dateString.optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type CashAccountInput = z.infer<typeof CashAccountInputSchema>;

export const CashAccountUpdateSchema = z.object({
  label: z.string().min(1).optional(),
  current_balance_aed: z.number().nonnegative().finite().optional(),
  interest_rate: z.number().nonnegative().finite().optional().nullable(),
  is_fixed_deposit: z.boolean().optional(),
  fixed_deposit_period_months: z.number().int().positive().optional().nullable(),
  fixed_deposit_start_date: dateString.optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type CashAccountUpdate = z.infer<typeof CashAccountUpdateSchema>;

// ---------------------------------------------------------------------------
// COMMODITY — manual entry: type + amount (weight+unit) + current/bought price
//   PER UNIT + purchase date + current-price date.
// ---------------------------------------------------------------------------
export const CommodityInputSchema = z.object({
  metal_type: z.enum(["gold", "silver", "platinum", "palladium", "other"]),
  weight: z.number().positive(),
  weight_unit: z.enum(["gram", "kg", "troy_oz", "tola"]),
  current_price_per_unit_aed: aedAmount.optional().default(0),
  bought_price_per_unit_aed: aedAmount,
  target_sell_price_per_unit_aed: aedAmount.optional().nullable(),
  purchase_date: noFutureDate,
  current_price_date: noFutureDate.optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type CommodityInput = z.infer<typeof CommodityInputSchema>;

export const CommodityUpdateSchema = z.object({
  metal_type: z.enum(["gold", "silver", "platinum", "palladium", "other"]).optional(),
  weight: z.number().positive().optional(),
  weight_unit: z.enum(["gram", "kg", "troy_oz", "tola"]).optional(),
  current_price_per_unit_aed: aedAmount.optional(),
  bought_price_per_unit_aed: aedAmount.optional(),
  target_sell_price_per_unit_aed: aedAmount.optional().nullable(),
  purchase_date: noFutureDate.optional(),
  current_price_date: noFutureDate.optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type CommodityUpdate = z.infer<typeof CommodityUpdateSchema>;

// ---------------------------------------------------------------------------
// TITLE DEED EXTRACTION — Claude output from a DLD title deed PDF.
// Every field is optional+nullable: the model returns null for anything it
// cannot find on the deed. Field names match PropertyForm input names so the
// frontend maps 1:1.
// ---------------------------------------------------------------------------
export const TitleDeedExtractSchema = z.object({
  name: z.string().optional().nullable(),
  subcategory: z.enum(["off_plan", "existing"]).optional().nullable(),
  property_type: z.enum(["apartment", "penthouse", "townhouse", "villa", "farm", "commercial"]).optional().nullable(),
  bedrooms: z.enum(["Studio", "1BR", "2BR", "3BR", "4BR", "5BR", "+5BR"]).optional().nullable(),
  city: z.string().optional().nullable(),
  area: z.string().optional().nullable(),
  developer: z.string().optional().nullable(),
  size_sqft: z.number().positive().optional().nullable(),
  purchase_price_aed: z.number().nonnegative().finite().optional().nullable(),
  // Normalise the model's date to ISO with our tested parser rather than
  // trusting the LLM's DD/MM→ISO conversion (§2.2 — DD/MM vs MM/DD is exactly
  // the kind of silent date bug this project guards against). The form field is
  // type="date" and only accepts ISO, so an un-normalised "12/05/2023" would be
  // silently dropped. Unparseable → null so one bad date doesn't void the whole
  // extraction; the form is reviewed and the final PropertyInput submit
  // re-validates with noFutureDate.
  purchased_at: z
    .string()
    .optional()
    .nullable()
    .transform((v) => {
      if (v == null || v.trim() === "") return null;
      try {
        return parseDateToIso(v);
      } catch {
        return null;
      }
    }),
});
export type TitleDeedExtract = z.infer<typeof TitleDeedExtractSchema>;

// ---------------------------------------------------------------------------
// INSTALLMENT UPDATE (partial — fields allowed in PATCH)
// ---------------------------------------------------------------------------
export const InstallmentUpdateSchema = z.object({
  due_date: dateString.optional(),
  amount_aed: aedAmount.optional(),
  milestone_label: z.string().optional().nullable(),
  status: z.enum(["upcoming", "paid", "overdue"]).optional(),
  paid_date: dateString.optional().nullable(),
  paid_amount_aed: aedAmount.optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type InstallmentUpdate = z.infer<typeof InstallmentUpdateSchema>;

// ---------------------------------------------------------------------------
// RENTAL DEPOSIT UPDATE — used by PATCH /api/rental-deposits/[id]
// ---------------------------------------------------------------------------
export const RentalDepositUpdateSchema = z.object({
  status: z.enum(["pending", "deposited"]),
  deposited_date: dateString.optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type RentalDepositUpdate = z.infer<typeof RentalDepositUpdateSchema>;

// ---------------------------------------------------------------------------
// RENTAL LIFECYCLE — actions that change the contract state
// ---------------------------------------------------------------------------
export const RentalLifecycleSchema = z.object({
  action: z.enum(["cancel", "vacant", "renew"]),
  rental_type: z.enum(["long_term", "short_term"]).optional(),
  annual_rent_aed: aedAmount.optional().nullable(),
  rent_cheques_per_year: z.number().int().refine((v) => [1, 2, 4, 12].includes(v), "must be 1, 2, 4, or 12").optional().nullable(),
  rent_date_1: dateString.optional().nullable(),
  rent_date_2: dateString.optional().nullable(),
  rent_date_3: dateString.optional().nullable(),
  rent_date_4: dateString.optional().nullable(),
  pm_company_name: z.string().optional().nullable(),
  pm_commission_pct: z.number().min(0).max(100).optional().nullable(),
  short_term_annual_rent_aed: aedAmount.optional().nullable(),
  short_term_return_frequency: z.enum(["monthly", "quarterly"]).optional().nullable(),
  short_term_rent_deposit_date: dateString.optional().nullable(),
  contract_start_date: dateString.optional().nullable(),
});
// ---------------------------------------------------------------------------
// LAND — manual entry: name, type, city, area, size, price/value/dates.
// ---------------------------------------------------------------------------
export const LandInputSchema = z.object({
  name: z.string().min(1),
  land_type: z.enum(["residential", "commercial", "agricultural", "industrial", "mixed_use", "other"]).optional().nullable(),
  city: z.string().optional().nullable(),
  area: z.string().optional().nullable(),
  size_sqft: z.number().positive().optional().nullable(),
  purchase_price_aed: aedAmount.optional().nullable(),
  current_value_aed: aedAmount.optional().nullable(),
  purchased_at: noFutureDate.optional().nullable(),
  valued_at: noFutureDate.optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type LandInput = z.infer<typeof LandInputSchema>;

export const LandUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  land_type: z.enum(["residential", "commercial", "agricultural", "industrial", "mixed_use", "other"]).optional().nullable(),
  city: z.string().optional().nullable(),
  area: z.string().optional().nullable(),
  size_sqft: z.number().positive().optional().nullable(),
  purchase_price_aed: aedAmount.optional().nullable(),
  current_value_aed: aedAmount.optional().nullable(),
  purchased_at: noFutureDate.optional().nullable(),
  valued_at: noFutureDate.optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type LandUpdate = z.infer<typeof LandUpdateSchema>;

// ---------------------------------------------------------------------------
// WATCHLIST — aspirational items (property or commodity)
// ---------------------------------------------------------------------------
export const WatchlistInputSchema = z.object({
  type: z.enum(["property", "commodity"]),
  label: z.string().min(1),
  target_price_aed: aedAmount.optional().nullable(),
  target_price_per_unit_aed: aedAmount.optional().nullable(),
  property_type: z.enum(["apartment", "penthouse", "townhouse", "villa", "farm", "commercial"]).optional().nullable(),
  city: z.string().optional().nullable(),
  area: z.string().optional().nullable(),
  metal_type: z.enum(["gold", "silver", "platinum", "palladium", "other"]).optional().nullable(),
  weight: z.number().positive().optional().nullable(),
  weight_unit: z.enum(["gram", "kg", "troy_oz", "tola"]).optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type WatchlistInput = z.infer<typeof WatchlistInputSchema>;
