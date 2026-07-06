/**
 * Shared Excel (.xlsx) formatting helpers via exceljs.
 * Rule 2.3 — no DB, no network, pure formatting logic.
 */

import type ExcelJS from "exceljs";

const KYNZI_BRAND = "KYNZi";

export function addTitleRow(ws: ExcelJS.Worksheet, colCount: number): void {
  const titleRow = ws.addRow([KYNZI_BRAND]);
  ws.mergeCells(1, 1, 1, colCount);
  titleRow.height = 30;
  titleRow.getCell(1).font = { bold: true, size: 16 };
  titleRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

  const subtitleRow = ws.addRow([`Exported: ${formatDateTime(new Date())}`]);
  ws.mergeCells(2, 1, 2, colCount);
  subtitleRow.getCell(1).font = { size: 10, color: { argb: "FF888888" } };
  subtitleRow.getCell(1).alignment = { horizontal: "center" };

  ws.addRow([]);
}

export function styleHeaderRow(ws: ExcelJS.Worksheet, row: number): void {
  const r = ws.getRow(row);
  r.font = { bold: true };
  r.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFAAAAAA" } },
    };
  });
}

export function styleSectionTitle(ws: ExcelJS.Worksheet, row: number, colCount: number): void {
  const r = ws.getRow(row);
  r.font = { bold: true, size: 12 };
  ws.mergeCells(row, 1, row, colCount);
  r.height = 24;
  r.getCell(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF5F5F5" },
  };
}

export function aedVal(fils: number | null): number | null {
  if (fils === null) return null;
  return fils / 100;
}

export function dateVal(iso: string | null): Date | null {
  if (iso === null) return null;
  return new Date(`${iso}T00:00:00Z`);
}

export function pctVal(pct: number | null): number | null {
  if (pct === null) return null;
  return pct / 100;
}

export function str(v: string | null | undefined): string {
  return v ?? "";
}

export function bool(v: 0 | 1 | null | undefined): string {
  return v === 1 ? "Yes" : "No";
}

export function fmtMoney(cell: ExcelJS.Cell): void {
  cell.numFmt = "#,##0.00";
}

export function fmtDate(cell: ExcelJS.Cell): void {
  cell.numFmt = "dd/mm/yyyy";
}

export function fmtPct(cell: ExcelJS.Cell): void {
  cell.numFmt = "0.00%";
}

export function formatDateTime(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

export function formatIsoDateToUae(iso: string | null): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function safeSheetName(name: string, existingNames: Set<string>): string {
  const sanitized = name.replace(/[\\\/\*\?\[\]:]/g, "-");
  const truncated = sanitized.slice(0, 31);
  if (!existingNames.has(truncated)) return truncated;

  for (let i = 2; i < 100; i++) {
    const suffix = ` (${i})`;
    const candidate = truncated.slice(0, 31 - suffix.length) + suffix;
    if (!existingNames.has(candidate)) return candidate;
  }
  return truncated.slice(0, 28) + "...";
}

export function setColWidths(ws: ExcelJS.Workbook["worksheets"][0], widths: number[]): void {
  for (let i = 0; i < widths.length; i++) {
    const col = ws.getColumn(i + 1);
    if (col) col.width = widths[i];
  }
}
