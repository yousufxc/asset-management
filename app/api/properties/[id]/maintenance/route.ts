import { NextResponse } from "next/server";
import { PropertyMaintenanceInputSchema } from "@/lib/ingest/validate";
import { getProperty, insertPropertyMaintenance, listMaintenanceForProperty } from "@/lib/db/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid property id" }, { status: 400 });
  }

  const property = getProperty(id);
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const maintenance = listMaintenanceForProperty(id);
  return NextResponse.json({ maintenance }, { status: 200 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid property id" }, { status: 400 });
  }

  const property = getProperty(id);
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PropertyMaintenanceInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.property_id !== id) {
    return NextResponse.json(
      { error: "property_id must match URL parameter" },
      { status: 400 },
    );
  }

  const result = insertPropertyMaintenance(parsed.data);
  return NextResponse.json({ maintenance: result }, { status: 201 });
}
