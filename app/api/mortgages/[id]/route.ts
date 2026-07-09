import { NextResponse } from "next/server";
import { MortgageUpdateSchema } from "@/lib/ingest/validate";
import { getMortgage, updateMortgage, deleteMortgage } from "@/lib/db/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid mortgage id" }, { status: 400 });
  }
  const mortgage = getMortgage(id);
  if (!mortgage) {
    return NextResponse.json({ error: "Mortgage not found" }, { status: 404 });
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
    return NextResponse.json({ error: "Invalid mortgage id" }, { status: 400 });
  }

  const existing = getMortgage(id);
  if (!existing) {
    return NextResponse.json({ error: "Mortgage not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = MortgageUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = updateMortgage(id, parsed.data);
  if (!result) {
    return NextResponse.json({ error: "Mortgage not found" }, { status: 404 });
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
    return NextResponse.json({ error: "Invalid mortgage id" }, { status: 400 });
  }

  const existing = getMortgage(id);
  if (!existing) {
    return NextResponse.json({ error: "Mortgage not found" }, { status: 404 });
  }

  deleteMortgage(id);
  return NextResponse.json({ ok: true }, { status: 200 });
}
