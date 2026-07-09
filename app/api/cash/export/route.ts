import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { listCashAccounts } from "@/lib/db/queries";
import { fixedDepositMaturityValueFils } from "@/lib/core/cash-analytics";
import {
  addTitleRow, styleHeaderRow,
  aedVal, bool, fmtMoney, formatIsoDateToUae,
} from "@/lib/core/excel-utils";

export async function GET() {
  let accounts;
  try {
    accounts = listCashAccounts();
  } catch (e) {
    console.error("cash export: DB query failed", e);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Saving Accounts");

  const cols = [
    "Label", "Balance (AED)", "Is Fixed Deposit", "Interest Rate %",
    "Contract Period (mo)", "Start Date", "FD Maturity Value (AED)", "Notes",
  ];
  addTitleRow(ws, cols.length);

  const hRow = ws.addRow(cols);
  styleHeaderRow(ws, hRow.number);

  for (const a of accounts) {
    const maturity = fixedDepositMaturityValueFils(a);
    const row = ws.addRow([
      a.label,
      aedVal(a.current_balance_fils),
      bool(a.is_fixed_deposit),
      a.interest_rate ?? "",
      a.fixed_deposit_period_months ?? "",
      a.fixed_deposit_start_date ? formatIsoDateToUae(a.fixed_deposit_start_date) : "",
      maturity != null ? aedVal(maturity) : "",
      a.notes ?? "",
    ]);
    fmtMoney(row.getCell(2));
    if (maturity != null) fmtMoney(row.getCell(7));
  }

  ws.getColumn(1).width = 28;
  ws.getColumn(8).width = 30;
  for (let i = 2; i <= cols.length; i++) {
    const col = ws.getColumn(i);
    if (col) col.width = Math.max(14, (cols[i - 1]?.length ?? 10));
  }

  const buf = await wb.xlsx.writeBuffer();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="accounts-export-${dateStr}.xlsx"`,
    },
  });
}
