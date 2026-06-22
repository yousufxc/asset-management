import { NextResponse } from "next/server";
import { PropertyUpdateSchema } from "@/lib/ingest/validate";
import { getProperty, updateProperty, deleteProperty, deleteRentalDepositsForProperty, upsertRentalDepositSchedule, insertRentalHistory } from "@/lib/db/queries";
import { generateDepositSchedule } from "@/lib/core/rental-deposits";
import type { EndReason } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid property id" }, { status: 400 });
  }

  const existing = getProperty(id);
  if (!existing) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PropertyUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = updateProperty(id, parsed.data);

  if (!result) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  // Sync deposits if rental fields changed
  const data = parsed.data;
  const rentalFieldsChanged =
    data.is_rental !== undefined ||
    data.rental_type !== undefined ||
    data.annual_rent_aed !== undefined ||
    data.rent_cheques_per_year !== undefined ||
    data.rent_date_1 !== undefined ||
    data.rent_date_2 !== undefined ||
    data.rent_date_3 !== undefined ||
    data.rent_date_4 !== undefined ||
    data.short_term_annual_rent_aed !== undefined ||
    data.short_term_return_frequency !== undefined ||
    data.short_term_rent_deposit_date !== undefined;

  if (rentalFieldsChanged) {
    if (result.is_rental) {
      const schedule = generateDepositSchedule(result);
      upsertRentalDepositSchedule(id, schedule);
    } else {
      // is_rental went 1→0: snapshot to history before clearing deposits
      if (existing.is_rental) {
        const today = new Date().toISOString().slice(0, 10);
        insertRentalHistory(existing, existing.contract_start_date ?? today, today, "vacant" as EndReason);
      }
      deleteRentalDepositsForProperty(id);
    }
  }

  return NextResponse.json({ property: result }, { status: 200 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid property id" }, { status: 400 });
  }

  const existing = getProperty(id);
  if (!existing) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  deleteProperty(id);
  return NextResponse.json({ ok: true }, { status: 200 });
}
