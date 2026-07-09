import { NextResponse } from "next/server";
import { RentalLifecycleSchema } from "@/lib/ingest/validate";
import {
  getProperty,
  updateProperty,
  insertRentalHistory,
  deleteRentalDepositsForProperty,
  upsertRentalDepositSchedule,
} from "@/lib/db/queries";
import { getDb } from "@/lib/db/client";
import { generateDepositSchedule } from "@/lib/core/rental-deposits";
import type { EndReason } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid property id" }, { status: 400 });
  }

  let property;
  try {
    property = getProperty(id);
  } catch (e) {
    console.error("rental-lifecycle: getProperty failed", e);
    return NextResponse.json({ error: "Failed to load property" }, { status: 500 });
  }
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RentalLifecycleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { action, ...renewFields } = parsed.data;

  if (action === "renew" && !property.is_rental) {
    return NextResponse.json(
      { error: "Property is not currently rented — cannot renew" },
      { status: 400 },
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  const db = getDb();
  db.exec("BEGIN");
  try {

    if (property.is_rental) {
      const reason: EndReason =
        action === "cancel" ? "cancelled"
        : action === "vacant" ? "vacant"
        : "renewed";

      insertRentalHistory(
        property,
        property.contract_start_date ?? today,
        today,
        reason,
      );
    }

    if (action === "renew") {
      updateProperty(id, {
        is_rental: true,
        rental_type: renewFields.rental_type ?? property.rental_type,
        annual_rent_aed: renewFields.annual_rent_aed,
        rent_cheques_per_year: renewFields.rent_cheques_per_year,
        rent_date_1: renewFields.rent_date_1,
        rent_date_2: renewFields.rent_date_2,
        rent_date_3: renewFields.rent_date_3,
        rent_date_4: renewFields.rent_date_4,
        pm_company_name: renewFields.pm_company_name,
        pm_commission_pct: renewFields.pm_commission_pct,
        short_term_annual_rent_aed: renewFields.short_term_annual_rent_aed,
        short_term_return_frequency: renewFields.short_term_return_frequency,
        short_term_rent_deposit_date: renewFields.short_term_rent_deposit_date,
        contract_start_date: renewFields.contract_start_date ?? today,
      });

      const updated = getProperty(id)!;
      const schedule = generateDepositSchedule(updated);
      upsertRentalDepositSchedule(id, schedule);
    } else {
      // cancel / vacant: delete all deposits and clear rental fields
      deleteRentalDepositsForProperty(id);
      updateProperty(id, {
        is_rental: false,
        rental_type: null,
        annual_rent_aed: null,
        rent_cheques_per_year: null,
        rent_date_1: null,
        rent_date_2: null,
        rent_date_3: null,
        rent_date_4: null,
        pm_company_name: null,
        pm_commission_pct: null,
        short_term_annual_rent_aed: null,
        short_term_return_frequency: null,
        short_term_rent_deposit_date: null,
        contract_start_date: null,
      });
    }

    db.exec("COMMIT");
  } catch (e) {
    console.error("rental-lifecycle: transaction failed", e);
    try { db.exec("ROLLBACK"); } catch (rollbackErr) {
      console.error("rental-lifecycle: ROLLBACK also failed", rollbackErr);
    }
    return NextResponse.json({ error: "Lifecycle action failed" }, { status: 500 });
  }

  return NextResponse.json({ property: getProperty(id) });
}
