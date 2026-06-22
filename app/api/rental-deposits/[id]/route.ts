import { NextResponse } from "next/server";
import { RentalDepositUpdateSchema } from "@/lib/ingest/validate";
import { getRentalDeposit, markRentalDepositDeposited, markRentalDepositPending } from "@/lib/db/queries";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid deposit id" }, { status: 400 });
  }

  const existing = getRentalDeposit(id);
  if (!existing) {
    return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RentalDepositUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.status === "deposited") {
    const depositDate = parsed.data.deposited_date ?? new Date().toISOString().slice(0, 10);
    const result = markRentalDepositDeposited(id, depositDate);
    return NextResponse.json({ deposit: result });
  }

  const result = markRentalDepositPending(id);
  return NextResponse.json({ deposit: result });
}
