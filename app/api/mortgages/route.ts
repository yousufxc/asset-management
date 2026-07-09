import { NextResponse } from "next/server";
import { MortgageInputSchema } from "@/lib/ingest/validate";
import { insertMortgage, getMortgageForProperty } from "@/lib/db/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const propertyIdStr = searchParams.get("property_id");
  if (!propertyIdStr) {
    return NextResponse.json({ error: "Missing property_id query parameter" }, { status: 400 });
  }
  const propertyId = Number(propertyIdStr);
  if (!Number.isInteger(propertyId) || propertyId < 1) {
    return NextResponse.json({ error: "Invalid property_id" }, { status: 400 });
  }
  const mortgage = getMortgageForProperty(propertyId);
  if (!mortgage) {
    return NextResponse.json({ mortgage: null }, { status: 200 });
  }
  return NextResponse.json({ mortgage }, { status: 200 });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = MortgageInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const mortgage = insertMortgage(parsed.data);
  return NextResponse.json({ mortgage }, { status: 201 });
}
