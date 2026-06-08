import { NextResponse } from "next/server";
import { CommodityUpdateSchema } from "@/lib/ingest/validate";
import { getCommodity, updateCommodity } from "@/lib/db/queries";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid commodity id" }, { status: 400 });
  }

  const existing = getCommodity(id);
  if (!existing) {
    return NextResponse.json({ error: "Commodity not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CommodityUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = updateCommodity(id, parsed.data);
  return NextResponse.json({ commodity: result }, { status: 200 });
}
