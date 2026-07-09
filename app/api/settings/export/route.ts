import { NextResponse, NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getAllData } from "@/lib/db/settings";
import { enrichCommodities } from "@/lib/core/commodity-analytics";
import { fixedDepositMaturityValueFils } from "@/lib/core/cash-analytics";
import { appreciationPct, netAnnualRentFils, rentalYieldPct, totalROIPct, annualizedROIPct, effectiveAnnualRentFils } from "@/lib/core/property-analytics";
import type { Property, CashAccount, Commodity } from "@/lib/types";
import {
  addTitleRow, styleHeaderRow,
  aedVal, dateVal, pctVal, bool, formatIsoDateToUae,
  fmtMoney, fmtDate, fmtPct,
} from "@/lib/core/excel-utils";

const TODAY = new Date().toISOString().slice(0, 10);

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format");

  if (format === "xlsx") {
    return exportXlsx();
  }

  let data;
  try {
    data = getAllData();
  } catch (e) {
    console.error("settings export (json): getAllData failed", e);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
  const json = JSON.stringify(data, null, 2);
  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="asset-platform-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}

async function exportXlsx(): Promise<NextResponse> {
  let data;
  try {
    data = getAllData();
  } catch (e) {
    console.error("settings export (xlsx): getAllData failed", e);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
  const wb = new ExcelJS.Workbook();

  buildPropertiesOverview(wb, data.properties);
  buildCommoditiesSheet(wb, data.commodities);
  buildCashSheet(wb, data.cashAccounts);

  const buf = await wb.xlsx.writeBuffer();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="all-export-${dateStr}.xlsx"`,
    },
  });
}

function buildPropertiesOverview(wb: ExcelJS.Workbook, properties: Property[]): void {
  const ws = wb.addWorksheet("Properties Overview");
  const cols = [
    "Name", "Type", "Subcategory", "Area", "Bedrooms", "City", "Developer",
    "Size (sqft)", "Purchase Price (AED)", "Current Value (AED)", "Valuation Date",
    "Capital Appreciation", "Is Rental", "Rental Type", "Gross Annual Rent (AED)",
    "Net Annual Rent (AED)", "Rental Yield", "Total ROI", "Annualized ROI", "Notes",
  ];
  addTitleRow(ws, cols.length);
  const hRow = ws.addRow(cols);
  styleHeaderRow(ws, hRow.number);

  for (const p of properties) {
    const appr = appreciationPct(p);
    const netRent = netAnnualRentFils(p);
    const yieldPct = rentalYieldPct(p);
    const totalROI = totalROIPct(p);
    const annROI = annualizedROIPct(p, TODAY);
    const grossRent = effectiveAnnualRentFils(p);

    const row = ws.addRow([
      p.name, p.property_type ?? "",
      p.subcategory === "off_plan" ? "Off-plan" : "Existing",
      p.area ?? "", p.bedrooms ?? "", p.city ?? "", p.developer ?? "",
      p.size_sqft ?? "",
      aedVal(p.purchase_price_fils),
      aedVal(p.current_value_fils),
      dateVal(p.valued_at),
      pctVal(appr),
      bool(p.is_rental),
      p.rental_type ?? "",
      aedVal(grossRent),
      aedVal(netRent),
      pctVal(yieldPct),
      pctVal(totalROI),
      pctVal(annROI),
      p.notes ?? "",
    ]);
    fmtMoney(row.getCell(9));
    fmtMoney(row.getCell(10));
    fmtDate(row.getCell(11));
    fmtPct(row.getCell(12));
    fmtMoney(row.getCell(15));
    fmtMoney(row.getCell(16));
    fmtPct(row.getCell(17));
    fmtPct(row.getCell(18));
    fmtPct(row.getCell(19));
  }
  ws.getColumn(1).width = 28;
  ws.getColumn(20).width = 30;
  for (let i = 2; i <= cols.length; i++) {
    const col = ws.getColumn(i);
    if (col) col.width = Math.max(12, (cols[i - 1]?.length ?? 10));
  }
}

function buildCommoditiesSheet(wb: ExcelJS.Workbook, commodities: Commodity[]): void {
  const ws = wb.addWorksheet("Commodities");
  const enriched = enrichCommodities(commodities);
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
      c.metal_type, c.weight, c.weight_unit,
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
}

function buildCashSheet(wb: ExcelJS.Workbook, cashAccounts: CashAccount[]): void {
  const ws = wb.addWorksheet("Saving Accounts");
  const cols = [
    "Label", "Balance (AED)", "Is Fixed Deposit", "Interest Rate %",
    "Contract Period (mo)", "Start Date", "FD Maturity Value (AED)", "Notes",
  ];
  addTitleRow(ws, cols.length);
  const hRow = ws.addRow(cols);
  styleHeaderRow(ws, hRow.number);

  for (const a of cashAccounts) {
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
}
