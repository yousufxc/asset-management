import { NextResponse } from "next/server";
import { PropertyMaintenanceUpdateSchema } from "@/lib/ingest/validate";
import { getPropertyMaintenance, updatePropertyMaintenance, deletePropertyMaintenance } from "@/lib/db/queries";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid maintenance id" }, { status: 400 });
  }

  const existing = getPropertyMaintenance(id);
  if (!existing) {
    return NextResponse.json({ error: "Maintenance entry not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PropertyMaintenanceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = updatePropertyMaintenance(id, parsed.data);
  return NextResponse.json({ maintenance: result }, { status: 200 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid maintenance id" }, { status: 400 });
  }

  const existing = getPropertyMaintenance(id);
  if (!existing) {
    return NextResponse.json({ error: "Maintenance entry not found" }, { status: 404 });
  }

  deletePropertyMaintenance(id);
  return NextResponse.json({ ok: true }, { status: 200 });
}
