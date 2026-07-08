import { NextResponse } from "next/server";
import { LandUpdateSchema } from "@/lib/ingest/validate";
import { getLand, updateLand, deleteLand } from "@/lib/db/queries";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid land id" }, { status: 400 });
  }

  const existing = getLand(id);
  if (!existing) {
    return NextResponse.json({ error: "Land not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = LandUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = updateLand(id, parsed.data);
  return NextResponse.json({ land: result }, { status: 200 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid land id" }, { status: 400 });
  }

  const existing = getLand(id);
  if (!existing) {
    return NextResponse.json({ error: "Land not found" }, { status: 404 });
  }

  deleteLand(id);
  return NextResponse.json({ ok: true }, { status: 200 });
}
