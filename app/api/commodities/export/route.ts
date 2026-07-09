import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { listCommodities } from "@/lib/db/queries";
import { enrichCommodities } from "@/lib/core/commodity-analytics";
import {
  addTitleRow, styleHeaderRow,
  aedVal, dateVal, pctVal,
  fmtMoney, fmtDate, fmtPct,
} from "@/lib/core/excel-utils";

export async function GET() {
  let commodities;
  try {
    commodities = listCommodities();
  } catch (e) {
    console.error("commodities export: DB query failed", e);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
  const enriched = enrichCommodities(commodities);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Commodities");

  const cols = [
    "Metal Type", "Weight", "Unit", "Purchase Date",
    "Bought Price/Unit (AED)", "Cost (AED)", "Current Price/Unit (AED)",
    "Current Value (AED)", "Target Sell/Unit (AED)", "Target %",
    "P/L (AED)", "P/L %", "Notes",
  ];
  addTitleRow(ws, cols.length);

  const hRow = ws.addRow(cols);
  styleHeaderRow(ws, hRow.number);

  for (const e of enriched) {
    const c = e.commodity;
    const targetPct = c.target_sell_price_per_unit_fils != null && c.target_sell_price_per_unit_fils > 0 && c.bought_price_per_unit_fils > 0
      ? ((c.target_sell_price_per_unit_fils - c.bought_price_per_unit_fils) / c.bought_price_per_unit_fils) * 100
      : null;

    const row = ws.addRow([
      c.metal_type,
      c.weight,
      c.weight_unit,
      dateVal(c.purchase_date),
      aedVal(c.bought_price_per_unit_fils),
      aedVal(e.costFils),
      aedVal(c.current_price_per_unit_fils > 0 ? c.current_price_per_unit_fils : null),
      e.hasCurrent ? aedVal(e.valueFils) : "N/A",
      aedVal(c.target_sell_price_per_unit_fils),
      pctVal(targetPct),
      e.hasCurrent ? aedVal(e.pl) : "N/A",
      pctVal(e.hasCurrent ? e.plPct : null),
      c.notes ?? "",
    ]);

    fmtDate(row.getCell(4));
    fmtMoney(row.getCell(5));
    fmtMoney(row.getCell(6));
    fmtMoney(row.getCell(7));
    if (e.hasCurrent) fmtMoney(row.getCell(8));
    fmtMoney(row.getCell(9));
    fmtPct(row.getCell(10));
    if (e.hasCurrent) fmtMoney(row.getCell(11));
    fmtPct(row.getCell(12));
  }

  ws.getColumn(1).width = 14;
  ws.getColumn(13).width = 30;
  for (let i = 2; i <= cols.length; i++) {
    const col = ws.getColumn(i);
    if (col) col.width = Math.max(14, (cols[i - 1]?.length ?? 10));
  }

  const buf = await wb.xlsx.writeBuffer();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="commodities-export-${dateStr}.xlsx"`,
    },
  });
}
