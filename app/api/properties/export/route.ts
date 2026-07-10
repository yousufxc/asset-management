import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { listProperties, listAllInstallments, listAllRentalHistory, listAllRentalDeposits } from "@/lib/db/queries";
import {
  addTitleRow, styleHeaderRow, styleSectionTitle,
  aedVal, dateVal, pctVal, str, bool, safeSheetName,
  fmtMoney, fmtDate, fmtPct, formatIsoDateToUae,
} from "@/lib/core/excel-utils";
import { appreciationPct, netAnnualRentFils, rentalYieldPct, totalROIPct, annualizedROIPct, effectiveAnnualRentFils } from "@/lib/core/property-analytics";

const TODAY = new Date().toISOString().slice(0, 10);

export async function GET() {
  let properties, installments, history, deposits;
  try {
    properties = listProperties();
    installments = listAllInstallments();
    history = listAllRentalHistory();
    deposits = listAllRentalDeposits();
  } catch (e) {
    console.error("properties export: DB query failed", e);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }

  const wb = new ExcelJS.Workbook();

  // --- Overview sheet ---
  const overview = wb.addWorksheet("Properties Overview");
  const overviewCols = [
    "Name", "Type", "Subcategory", "Area", "Bedrooms", "City", "Developer",
    "Size (sqft)", "Size Unit", "Purchase Price (AED)", "Current Value (AED)", "Valuation Date",
    "Capital Appreciation", "Is Rental", "Rental Type", "Gross Annual Rent (AED)",
    "Service Charge (AED)", "PM Commission %", "Net Annual Rent (AED)",
    "Rental Yield", "Total ROI", "Annualized ROI", "Notes",
  ];
  addTitleRow(overview, overviewCols.length);

  const hRow = overview.addRow(overviewCols);
  styleHeaderRow(overview, hRow.number);

  for (const p of properties) {
    const appr = appreciationPct(p);
    const netRent = netAnnualRentFils(p);
    const grossRent = effectiveAnnualRentFils(p);
    const yieldPct = rentalYieldPct(p);
    const totalROI = totalROIPct(p);
    const annROI = annualizedROIPct(p, TODAY);

    const row = overview.addRow([
      p.name,
      p.property_type ?? "",
      p.subcategory === "off_plan" ? "Off-plan" : "Existing",
      p.area ?? "",
      p.bedrooms ?? "",
      p.city ?? "",
      p.developer ?? "",
      p.size_sqft ?? "",
      p.size_unit ?? "sqft",
      aedVal(p.purchase_price_fils),
      aedVal(p.current_value_fils),
      dateVal(p.valued_at),
      pctVal(appr),
      bool(p.is_rental),
      p.rental_type ?? "",
      aedVal(grossRent),
      aedVal(p.annual_service_charge_fils),
      p.pm_commission_pct ?? "",
      aedVal(netRent),
      pctVal(yieldPct),
      pctVal(totalROI),
      pctVal(annROI),
      p.notes ?? "",
    ]);

    fmtMoney(row.getCell(10));
    fmtMoney(row.getCell(11));
    fmtDate(row.getCell(12));
    fmtPct(row.getCell(13));
    fmtMoney(row.getCell(16));
    fmtMoney(row.getCell(17));
    fmtMoney(row.getCell(19));
    fmtPct(row.getCell(20));
    fmtPct(row.getCell(21));
    fmtPct(row.getCell(22));
  }

  overview.getColumn(1).width = 28;
  overview.getColumn(23).width = 30;
  for (let i = 2; i <= overviewCols.length; i++) {
    const col = overview.getColumn(i);
    if (col) col.width = Math.max(12, (overviewCols[i - 1]?.length ?? 10));
  }

  // --- Per-property sheets ---
  const usedNames = new Set<string>(["Properties Overview"]);

  for (const p of properties) {
    const sheetName = safeSheetName(p.name, usedNames);
    usedNames.add(sheetName);
    const ws = wb.addWorksheet(sheetName);

    addTitleRow(ws, 2);

    const grossRent = effectiveAnnualRentFils(p);
    const netRent = netAnnualRentFils(p);

    const fields: [string, string][] = [
      ["Name", p.name],
      ["Subcategory", p.subcategory === "off_plan" ? "Off-plan" : "Existing"],
      ["Type", p.property_type ?? ""],
      ["Bedrooms", p.bedrooms ?? ""],
      ["City", p.city ?? ""],
      ["Area", p.area ?? ""],
      ["Developer", p.developer ?? ""],
      ["Size (sqft)", p.size_sqft?.toString() ?? ""],
      ["Size Unit", p.size_unit ?? "sqft"],
      ["Purchase Date", formatIsoDateToUae(p.purchased_at)],
      ["Purchase Price", p.purchase_price_fils != null ? (p.purchase_price_fils / 100).toFixed(2) : ""],
      ["Current Value", p.current_value_fils != null ? (p.current_value_fils / 100).toFixed(2) : ""],
      ["Valuation Date", formatIsoDateToUae(p.valued_at)],
      ["Is Rental", bool(p.is_rental)],
      ["Rental Type", p.rental_type ?? ""],
      ["PM Company", p.pm_company_name ?? ""],
      ["PM Commission %", p.pm_commission_pct?.toString() ?? ""],
      ["Contract Start", formatIsoDateToUae(p.contract_start_date)],
      ["Notes", p.notes ?? ""],
    ];
    if (p.is_rental) {
      fields.push(
        ["Gross Annual Rent", grossRent != null ? (grossRent / 100).toFixed(2) : ""],
        ["Service Charge", p.annual_service_charge_fils != null ? (p.annual_service_charge_fils / 100).toFixed(2) : ""],
        ["Net Annual Rent", netRent != null ? (netRent / 100).toFixed(2) : ""],
        ["Rental Yield", rentalYieldPct(p) != null ? `${rentalYieldPct(p)!.toFixed(2)}%` : ""],
        ["Total ROI", totalROIPct(p) != null ? `${totalROIPct(p)!.toFixed(2)}%` : ""],
        ["Capital Appreciation", appreciationPct(p) != null ? `${appreciationPct(p)!.toFixed(2)}%` : ""],
      );
    }

    const hRow2 = ws.addRow(["Field", "Value"]);
    styleHeaderRow(ws, hRow2.number);

    for (const [label, val] of fields) {
      ws.addRow([label, val]);
    }
    ws.getColumn(1).width = 22;
    ws.getColumn(2).width = 30;

    // --- Installments section ---
    const propInsts = installments.filter((i) => i.property_id === p.id);
    if (propInsts.length > 0) {
      ws.addRow([]);
      const secRow = ws.addRow(["Installments"]);
      styleSectionTitle(ws, secRow.number, 8);

      const iHdr = ws.addRow(["Due Date", "Amount", "Milestone", "Status", "Paid Date", "Paid Amount", "Source", "Notes"]);
      styleHeaderRow(ws, iHdr.number);

      for (const inst of propInsts) {
        const ir = ws.addRow([
          dateVal(inst.due_date),
          aedVal(inst.amount_fils),
          inst.milestone_label ?? "",
          inst.status,
          dateVal(inst.paid_date),
          aedVal(inst.paid_amount_fils),
          inst.source,
          inst.notes ?? "",
        ]);
        fmtDate(ir.getCell(1));
        fmtMoney(ir.getCell(2));
        fmtDate(ir.getCell(5));
        fmtMoney(ir.getCell(6));
      }
    }

    // --- Rental History section ---
    const propHistory = history.filter((h) => h.property_id === p.id);
    if (propHistory.length > 0) {
      ws.addRow([]);
      const secRow = ws.addRow(["Rental History"]);
      styleSectionTitle(ws, secRow.number, 12);

      const hHdr = ws.addRow([
        "Type", "Annual Rent", "Cheques/Year", "Rent Date 1", "Rent Date 2",
        "Rent Date 3", "Rent Date 4", "PM Company", "PM Commission %",
        "Contract Start", "Contract End", "End Reason",
      ]);
      styleHeaderRow(ws, hHdr.number);

      for (const h of propHistory) {
        const hr = ws.addRow([
          h.rental_type,
          aedVal(h.annual_rent_fils),
          h.rent_cheques_per_year ?? "",
          dateVal(h.rent_date_1),
          dateVal(h.rent_date_2),
          dateVal(h.rent_date_3),
          dateVal(h.rent_date_4),
          h.pm_company_name ?? "",
          h.pm_commission_pct ?? "",
          formatIsoDateToUae(h.contract_start_date),
          formatIsoDateToUae(h.contract_end_date),
          h.end_reason ?? "",
        ]);
        fmtMoney(hr.getCell(2));
        fmtDate(hr.getCell(4));
        fmtDate(hr.getCell(5));
        fmtDate(hr.getCell(6));
        fmtDate(hr.getCell(7));
      }
    }

    // --- Rental Deposits section ---
    const propDeposits = deposits.filter((d) => d.property_id === p.id);
    if (propDeposits.length > 0) {
      ws.addRow([]);
      const secRow = ws.addRow(["Rental Deposits"]);
      styleSectionTitle(ws, secRow.number, 5);

      const dHdr = ws.addRow(["Cheque #", "Deposit Date", "Amount", "Status", "Deposited Date"]);
      styleHeaderRow(ws, dHdr.number);

      for (const d of propDeposits) {
        const dr = ws.addRow([
          d.cheque_number,
          dateVal(d.deposit_date),
          aedVal(d.amount_fils),
          d.status,
          dateVal(d.deposited_date),
        ]);
        fmtDate(dr.getCell(2));
        fmtMoney(dr.getCell(3));
        fmtDate(dr.getCell(5));
      }
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="properties-export-${dateStr}.xlsx"`,
    },
  });
}
