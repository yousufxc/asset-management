import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { listLands } from "@/lib/db/queries";
import {
  addTitleRow, styleHeaderRow,
  aedVal, fmtMoney, formatIsoDateToUae,
} from "@/lib/core/excel-utils";

const LAND_TYPE_LABEL: Record<string, string> = {
  residential: "Residential",
  commercial: "Commercial",
  agricultural: "Agricultural",
  industrial: "Industrial",
  mixed_use: "Mixed Use",
  other: "Other",
};

export async function GET() {
  let lands;
  try {
    lands = listLands();
  } catch (e) {
    console.error("lands export: DB query failed", e);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Lands");

  const cols = [
    "Name", "Type", "City", "Area", "Size (sqft)",
    "Purchase Price (AED)", "Current Value (AED)",
    "Purchased", "Valued", "Notes",
  ];
  addTitleRow(ws, cols.length);

  const hRow = ws.addRow(cols);
  styleHeaderRow(ws, hRow.number);

  for (const l of lands) {
    const row = ws.addRow([
      l.name,
      l.land_type ? (LAND_TYPE_LABEL[l.land_type] ?? l.land_type) : "",
      l.city ?? "",
      l.area ?? "",
      l.size_sqft ?? "",
      aedVal(l.purchase_price_fils) ?? "",
      aedVal(l.current_value_fils) ?? "",
      l.purchased_at ? formatIsoDateToUae(l.purchased_at) : "",
      l.valued_at ? formatIsoDateToUae(l.valued_at) : "",
      l.notes ?? "",
    ]);
    fmtMoney(row.getCell(6));
    fmtMoney(row.getCell(7));
  }

  ws.getColumn(1).width = 28;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 20;
  ws.getColumn(10).width = 30;
  for (let i = 2; i <= cols.length; i++) {
    const col = ws.getColumn(i);
    if (col) col.width = Math.max(14, (cols[i - 1]?.length ?? 10));
  }

  const buf = await wb.xlsx.writeBuffer();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lands-export-${dateStr}.xlsx"`,
    },
  });
}
