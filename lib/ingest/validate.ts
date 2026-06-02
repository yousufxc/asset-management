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

const aedAmount = z.number().nonnegative().finite();
const uaeDate = z
  .string()
  .regex(/^\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4}$/, "expected DD/MM/YYYY");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

// ---------------------------------------------------------------------------
// PROPERTY
// ---------------------------------------------------------------------------
export const PropertyInputSchema = z.object({
  name: z.string().min(1),
  subcategory: z.enum(["off_plan", "existing"]),
  property_type: z.enum(["apartment", "penthouse", "townhouse", "villa"]).optional().nullable(),
  city: z.string().optional().nullable(),
  area: z.string().optional().nullable(),
  developer: z.string().optional().nullable(),
  size_sqft: z.number().positive().optional().nullable(),
  purchase_price_aed: aedAmount.optional().nullable(),
  current_value_aed: aedAmount.optional().nullable(),
  valued_at: uaeDate.optional().nullable(),
  is_rental: z.boolean().default(false),
  annual_rent_aed: aedAmount.optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type PropertyInput = z.infer<typeof PropertyInputSchema>;

// ---------------------------------------------------------------------------
// INSTALLMENT (manual form AND PDF pipeline target this shape)
// ---------------------------------------------------------------------------
export const InstallmentInputSchema = z.object({
  property_id: z.number().int().positive(),
  due_date: uaeDate,
  amount_aed: aedAmount,
  milestone_label: z.string().optional().nullable(),
  status: z.enum(["upcoming", "paid", "overdue"]).default("upcoming"),
  paid_date: uaeDate.optional().nullable(),
  paid_amount_aed: aedAmount.optional().nullable(),
  source: z.enum(["manual", "pdf"]).default("manual"),
  source_file: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type InstallmentInput = z.infer<typeof InstallmentInputSchema>;

// ---------------------------------------------------------------------------
// CASH ACCOUNT
// ---------------------------------------------------------------------------
export const CashAccountInputSchema = z.object({
  label: z.string().min(1),
  bank_name: z.string().optional().nullable(),
  account_type: z.enum(["current", "savings", "fixed_deposit", "other"]).optional().nullable(),
  current_balance_aed: z.number().finite().default(0),
  is_liquid: z.boolean().default(true),
  last_updated: uaeDate.optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type CashAccountInput = z.infer<typeof CashAccountInputSchema>;

// ---------------------------------------------------------------------------
// COMMODITY (weight + purity + type)
// ---------------------------------------------------------------------------
export const CommodityInputSchema = z.object({
  name: z.string().min(1),
  metal_type: z.enum(["gold", "silver", "platinum", "palladium", "other"]),
  weight: z.number().positive(),
  weight_unit: z.enum(["gram", "kg", "troy_oz", "tola"]),
  purity_fraction: z.number().gt(0).lte(1),
  form: z.enum(["bar", "coin", "jewelry", "other"]).optional().nullable(),
  quantity: z.number().int().min(1).default(1),
  storage_location: z.string().optional().nullable(),
  acquisition_price_aed: aedAmount.optional().nullable(),
  manual_value_aed: aedAmount.optional().nullable(),
  valued_at: uaeDate.optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type CommodityInput = z.infer<typeof CommodityInputSchema>;

// ---------------------------------------------------------------------------
// INSTALLMENT UPDATE (partial — fields allowed in PATCH)
// ---------------------------------------------------------------------------
export const InstallmentUpdateSchema = z.object({
  due_date: uaeDate.optional(),
  amount_aed: aedAmount.optional(),
  milestone_label: z.string().optional().nullable(),
  status: z.enum(["upcoming", "paid", "overdue"]).optional(),
  paid_date: uaeDate.optional().nullable(),
  paid_amount_aed: aedAmount.optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type InstallmentUpdate = z.infer<typeof InstallmentUpdateSchema>;

// ---------------------------------------------------------------------------
// PDF PIPELINE OUTPUT — what Claude must return for an SPA installment schedule.
// Machine input: amounts already in AED decimals, dates ISO. Validated before
// dedup + double-entry + DB write (Phase 1 ingestion).
// ---------------------------------------------------------------------------
export const ParsedInstallmentSchema = z.object({
  due_date: isoDate,
  amount_aed: aedAmount,
  milestone_label: z.string().optional().nullable(),
});

export const ParsedScheduleSchema = z.object({
  property_name: z.string().optional().nullable(),
  developer: z.string().optional().nullable(),
  installments: z.array(ParsedInstallmentSchema).min(1),
});
export type ParsedSchedule = z.infer<typeof ParsedScheduleSchema>;
