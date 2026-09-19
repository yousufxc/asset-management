import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { listProperties, listAllInstallments, listAllMortgages } from "@/lib/db/queries";
import { buildUnifiedPayments, groupTimeline, TIMELINE_GROUPS, GROUP_LABEL } from "@/lib/core/instalment-grouping";
import {
  addTitleRow, styleHeaderRow, styleSectionTitle,
  aedVal, dateVal, fmtMoney, fmtDate,
} from "@/lib/core/excel-utils";

export async function GET() {
  let properties, installments, mortgages;
  try {
    properties = listProperties();
    installments = listAllInstallments();
    mortgages = listAllMortgages();
  } catch (e) {
    console.error("instalments export: DB query failed", e);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }

  const asOfIso = new Date().toISOString().slice(0, 10);
  const nameById = new Map<number, string>(properties.map((p) => [p.id, p.name]));
  const unified = buildUnifiedPayments(installments, mortgages, asOfIso);
  const grouped = groupTimeline(unified, asOfIso);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Instalments Timeline");
  const cols = ["Property", "Type", "Due Date", "Amount (AED)", "Status", "Milestone/Lender", "Timeline Group"];

  addTitleRow(ws, cols.length);
  const hRow = ws.addRow(cols);
  styleHeaderRow(ws, hRow.number);

  for (const g of TIMELINE_GROUPS) {
    const rows = grouped[g];
    if (rows.length === 0) continue;

    ws.addRow([]);
    const totalFils = rows.reduce((s, p) => s + p.amountFils, 0);
    const secRow = ws.addRow([
      `${GROUP_LABEL[g]} — ${rows.length} payment(s), total AED ${(totalFils / 100).toFixed(2)}`,
    ]);
    styleSectionTitle(ws, secRow.number, cols.length);

    for (const p of rows) {
      const r = ws.addRow([
        nameById.get(p.propertyId) ?? `Property #${p.propertyId}`,
        p.type === "installment" ? "Instalment" : "Mortgage",
        dateVal(p.dueDate),
        aedVal(p.amountFils),
        p.status,
        p.type === "installment" ? (p.milestoneLabel ?? "") : (p.lenderName ?? ""),
        GROUP_LABEL[g],
      ]);
      fmtDate(r.getCell(3));
      fmtMoney(r.getCell(4));
    }
  }

  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 12;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 14;
  ws.getColumn(5).width = 10;
  ws.getColumn(6).width = 24;
  ws.getColumn(7).width = 18;

  const buf = await wb.xlsx.writeBuffer();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="instalments-export-${dateStr}.xlsx"`,
    },
  });
}
