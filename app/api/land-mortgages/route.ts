import { NextResponse } from "next/server";
import { LandMortgageInputSchema } from "@/lib/ingest/validate";
import { insertLandMortgage, getLandMortgageForLand } from "@/lib/db/queries";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const landIdStr = searchParams.get("land_id");
  if (!landIdStr) {
    return NextResponse.json({ error: "Missing land_id query parameter" }, { status: 400 });
  }
  const landId = Number(landIdStr);
  if (!Number.isInteger(landId) || landId < 1) {
    return NextResponse.json({ error: "Invalid land_id" }, { status: 400 });
  }
  const mortgage = getLandMortgageForLand(landId);
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

  const parsed = LandMortgageInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const mortgage = insertLandMortgage(parsed.data);
  return NextResponse.json({ mortgage }, { status: 201 });
}
