import { NextResponse } from "next/server";
import { CashAccountInputSchema } from "@/lib/ingest/validate";
import { insertCashAccount, listCashAccounts } from "@/lib/db/queries";

export async function GET() {
  return NextResponse.json({ accounts: listCashAccounts() });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CashAccountInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const account = insertCashAccount(parsed.data);
  return NextResponse.json({ account }, { status: 201 });
}
