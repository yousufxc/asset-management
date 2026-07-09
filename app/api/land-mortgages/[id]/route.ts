import { NextResponse } from "next/server";
import { LandMortgageUpdateSchema } from "@/lib/ingest/validate";
import { getLandMortgage, updateLandMortgage, deleteLandMortgage } from "@/lib/db/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid land mortgage id" }, { status: 400 });
  }
  const mortgage = getLandMortgage(id);
  if (!mortgage) {
    return NextResponse.json({ error: "Land mortgage not found" }, { status: 404 });
  }
  return NextResponse.json({ mortgage }, { status: 200 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid land mortgage id" }, { status: 400 });
  }

  const existing = getLandMortgage(id);
  if (!existing) {
    return NextResponse.json({ error: "Land mortgage not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = LandMortgageUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = updateLandMortgage(id, parsed.data);
  if (!result) {
    return NextResponse.json({ error: "Land mortgage not found" }, { status: 404 });
  }
  return NextResponse.json({ mortgage: result }, { status: 200 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid land mortgage id" }, { status: 400 });
  }

  const existing = getLandMortgage(id);
  if (!existing) {
    return NextResponse.json({ error: "Land mortgage not found" }, { status: 404 });
  }

  deleteLandMortgage(id);
  return NextResponse.json({ ok: true }, { status: 200 });
}
