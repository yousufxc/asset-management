/**
 * REFERENCE API ROUTE (thin shell — rule 2.3).
 * Pattern for DeepSeek to mirror for cash / commodities / installments:
 *   1. Parse the JSON body with the Zod schema (lib/ingest/validate.ts).
 *   2. On failure -> 400 with the issues (never write unvalidated data).
 *   3. On success -> call the thin query helper (lib/db/queries.ts) and return JSON.
 * No money math or date parsing here — that lives in lib/core via the query layer.
 */

import { NextResponse } from "next/server";
import { PropertyInputSchema } from "@/lib/ingest/validate";
import { insertProperty, listProperties } from "@/lib/db/queries";

export async function GET() {
  return NextResponse.json({ properties: listProperties() });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PropertyInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const property = insertProperty(parsed.data);
  return NextResponse.json({ property }, { status: 201 });
}
