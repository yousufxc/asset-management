import { NextResponse } from "next/server";
import { getProperty, listRentalHistory } from "@/lib/db/queries";

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

  const history = listRentalHistory(id);
  return NextResponse.json({ history });
}
