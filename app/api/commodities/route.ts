import { NextResponse } from "next/server";
import { CommodityInputSchema } from "@/lib/ingest/validate";
import { insertCommodity, listCommodities } from "@/lib/db/queries";

export async function GET() {
  return NextResponse.json({ commodities: listCommodities() });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CommodityInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const commodity = insertCommodity(parsed.data);
  return NextResponse.json({ commodity }, { status: 201 });
}
