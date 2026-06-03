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
// Accept dates in ISO (YYYY-MM-DD) or UAE (DD/MM/YYYY) format AND reject
// impossible calendar dates (e.g. 32/13/2026, 31/02/2026) at validation time.
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

// ---------------------------------------------------------------------------
// PROPERTY
// ---------------------------------------------------------------------------
export const PropertyInputSchema = z.object({
  name: z.string().min(1),
  subcategory: z.enum(["off_plan", "existing"]),
  property_type: z.enum(["apartment", "penthouse", "townhouse", "villa"]).optional().nullable(),
  bedrooms: z.enum(["Studio", "1BR", "2BR", "3BR", "4BR", "5BR", "+5BR"]).optional().nullable(),
  city: z.string().optional().nullable(),
  area: z.string().optional().nullable(),
  developer: z.string().optional().nullable(),
  size_sqft: z.number().positive().optional().nullable(),
  annual_service_charge_aed: aedAmount.optional().nullable(),
  purchase_price_aed: aedAmount.optional().nullable(),
  current_value_aed: aedAmount.optional().nullable(),
  valued_at: dateString.optional().nullable(),
  is_rental: z.boolean().default(false),
  annual_rent_aed: aedAmount.optional().nullable(),
  rent_cheques_per_year: z.number().int().refine((v) => [1, 2, 4, 12].includes(v), "must be 1, 2, 4, or 12").optional().nullable(),
  rent_date_1: dateString.optional().nullable(),
  rent_date_2: dateString.optional().nullable(),
  rent_date_3: dateString.optional().nullable(),
  rent_date_4: dateString.optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type PropertyInput = z.infer<typeof PropertyInputSchema>;

// ---------------------------------------------------------------------------
// PROPERTY UPDATE (partial — fields allowed in PATCH)
// ---------------------------------------------------------------------------
export const PropertyUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  subcategory: z.enum(["off_plan", "existing"]).optional(),
  property_type: z.enum(["apartment", "penthouse", "townhouse", "villa"]).optional().nullable(),
  bedrooms: z.enum(["Studio", "1BR", "2BR", "3BR", "4BR", "5BR", "+5BR"]).optional().nullable(),
  city: z.string().optional().nullable(),
  area: z.string().optional().nullable(),
  developer: z.string().optional().nullable(),
  size_sqft: z.number().positive().optional().nullable(),
  annual_service_charge_aed: aedAmount.optional().nullable(),
  purchase_price_aed: aedAmount.optional().nullable(),
  current_value_aed: aedAmount.optional().nullable(),
  valued_at: dateString.optional().nullable(),
  is_rental: z.boolean().optional(),
  annual_rent_aed: aedAmount.optional().nullable(),
  rent_cheques_per_year: z.number().int().refine((v) => [1, 2, 4, 12].includes(v), "must be 1, 2, 4, or 12").optional().nullable(),
  rent_date_1: dateString.optional().nullable(),
  rent_date_2: dateString.optional().nullable(),
  rent_date_3: dateString.optional().nullable(),
  rent_date_4: dateString.optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type PropertyUpdate = z.infer<typeof PropertyUpdateSchema>;

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
// CASH ACCOUNT — manual entry only: account label + balance. All cash is liquid.
// ---------------------------------------------------------------------------
export const CashAccountInputSchema = z.object({
  label: z.string().min(1),
  current_balance_aed: z.number().finite().default(0),
});
export type CashAccountInput = z.infer<typeof CashAccountInputSchema>;

// ---------------------------------------------------------------------------
// COMMODITY — manual entry: type + amount (weight+unit) + current/bought price
//   PER UNIT + purchase date + current-price date.
// ---------------------------------------------------------------------------
export const CommodityInputSchema = z.object({
  metal_type: z.enum(["gold", "silver", "platinum", "palladium", "other"]),
  weight: z.number().positive(),
  weight_unit: z.enum(["gram", "kg", "troy_oz", "tola"]),
  current_price_per_unit_aed: aedAmount,
  bought_price_per_unit_aed: aedAmount.optional().nullable(),
  purchase_date: dateString.optional().nullable(),
  current_price_date: dateString.optional().nullable(),
});
export type CommodityInput = z.infer<typeof CommodityInputSchema>;

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
