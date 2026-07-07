import { NextResponse } from "next/server";
import { WatchlistInputSchema } from "@/lib/ingest/validate";
import { insertWatchlistItem, listWatchlist } from "@/lib/db/queries";

export async function GET() {
  return NextResponse.json({ items: listWatchlist() });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = WatchlistInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const item = insertWatchlistItem(parsed.data);
  return NextResponse.json({ item }, { status: 201 });
}
