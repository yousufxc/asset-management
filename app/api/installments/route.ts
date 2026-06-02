/**
 * Installment (payment-schedule) API route — thin shell (rule 2.3).
 * Same pattern as app/api/properties/route.ts:
 *   1. Parse body with InstallmentInputSchema (Zod gate).
 *   2. Verify the referenced property exists (referential safety before write).
 *   3. Insert via the thin query helper; money->fils and date->ISO happen there.
 */

import { NextResponse } from "next/server";
import { InstallmentInputSchema } from "@/lib/ingest/validate";
import { insertInstallment, getProperty, listAllInstallments } from "@/lib/db/queries";

export async function GET() {
  return NextResponse.json({ installments: listAllInstallments() });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = InstallmentInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (!getProperty(parsed.data.property_id)) {
    return NextResponse.json(
      { error: `No property with id ${parsed.data.property_id}` },
      { status: 400 },
    );
  }

  const installment = insertInstallment(parsed.data);
  return NextResponse.json({ installment }, { status: 201 });
}
