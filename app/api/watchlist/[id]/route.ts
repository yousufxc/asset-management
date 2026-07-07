import { NextResponse } from "next/server";
import { deleteWatchlistItem } from "@/lib/db/queries";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const idNum = parseInt(id, 10);
  if (isNaN(idNum)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  deleteWatchlistItem(idNum);
  return NextResponse.json({ ok: true });
}
