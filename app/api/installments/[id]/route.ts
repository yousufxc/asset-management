import { NextResponse } from "next/server";
import { InstallmentUpdateSchema } from "@/lib/ingest/validate";
import {
  getInstallment,
  markInstallmentPaid,
  updateInstallment,
  deleteInstallment,
} from "@/lib/db/queries";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid installment id" }, { status: 400 });
  }

  const existing = getInstallment(id);
  if (!existing) {
    return NextResponse.json({ error: "Installment not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = InstallmentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // "mark paid" convenience: if status is "paid", use markInstallmentPaid
  if (data.status === "paid") {
    const result = markInstallmentPaid(id, data.paid_date, data.paid_amount_aed);
    if (result) {
      // If other fields were also set (e.g. notes), apply them on top
      const { status: _, paid_date: __, paid_amount_aed: ___, ...rest } = data;
      const hasOtherFields = Object.values(rest).some((v) => v !== undefined);
      if (hasOtherFields) {
        const updated = updateInstallment(id, {
          dueDateUae: data.due_date,
          amountAed: data.amount_aed,
          milestoneLabel: data.milestone_label,
          notes: data.notes,
        });
        return NextResponse.json({ installment: updated });
      }
    }
    return NextResponse.json({ installment: result });
  }

  const result = updateInstallment(id, {
    dueDateUae: data.due_date,
    amountAed: data.amount_aed,
    milestoneLabel: data.milestone_label,
    status: data.status,
    paidDateUae: data.paid_date,
    paidAmountAed: data.paid_amount_aed,
    notes: data.notes,
  });

  return NextResponse.json({ installment: result }, { status: 200 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid installment id" }, { status: 400 });
  }

  const existing = getInstallment(id);
  if (!existing) {
    return NextResponse.json({ error: "Installment not found" }, { status: 404 });
  }

  deleteInstallment(id);
  return NextResponse.json({ deleted: id }, { status: 200 });
}
