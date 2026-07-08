import { NextResponse } from "next/server";
import { LandInputSchema } from "@/lib/ingest/validate";
import { insertLand, listLands } from "@/lib/db/queries";

export async function GET() {
  return NextResponse.json({ lands: listLands() });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = LandInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const land = insertLand(parsed.data);
  return NextResponse.json({ land }, { status: 201 });
}
