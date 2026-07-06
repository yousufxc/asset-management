# Plan: Category-Level Excel Export

## Overview

Add per-category Excel (.xlsx) export buttons to Properties, Commodities, and Saving Accounts pages, plus a unified category-selector export on the Settings page. Each export includes a styled "KYNZi" title header.

---

## Library

Install `exceljs` (no existing Excel dependency in the project):

```bash
npm install exceljs
```

---

## API Routes (3 new)

### 1. `GET /api/properties/export`

**Server component read** — queries all properties + their installments, rental history, and rental deposits. Returns an `.xlsx` buffer.

**Sheets:**
- **"Properties Overview"** — one row per property. Columns: Name, Type, Subcategory, Area, Bedrooms, City, Developer, Size (sqft), Purchase Price, Current Value, Valuation Date, Capital Appreciation %, Is Rental, Rental Type, Gross Annual Rent, Service Charge, PM Commission %, Net Annual Rent, Rental Yield %, Total ROI %, Annualized ROI %, Notes.
- For each property: **"<Name>"** (truncated to 31 chars for Excel sheet name limit) with 3 sections:
  - **Installments** table: Due Date, Amount, Milestone, Status, Paid Date, Paid Amount, Source
  - **Rental History** table: Type, Annual Rent, Cheques/Year, Rent Dates 1-4, PM Company, PM Commission %, Short-Term Rent, Frequency, Deposit Date, Contract Start, Contract End, End Reason
  - **Rental Deposits** table: Cheque #, Deposit Date, Amount, Status, Deposited Date

**Data flow:** `listProperties()` + `listAllInstallments()` + `listAllRentalHistory()` + `listAllRentalDeposits()` → format → `exceljs` workbook → buffer → Response.

**Dependencies:** `exceljs`, `@/lib/db/queries`, `@/lib/core/property-analytics`, `@/lib/core/units`

---

### 2. `GET /api/commodities/export`

**Server component read** — queries all commodities, enriches them (cost, value, P&L, P&L%), writes one sheet.

**Sheets:**
- **"Commodities"** — one row per holding. Columns: Metal Type, Weight, Unit, Purchase Date, Bought Price/Unit, Cost (total), Current Price/Unit, Current Value, Target Sell Price/Unit, Target %, P/L, P/L %, Notes.

**Data flow:** `listCommodities()` → `enrichCommodities()` → format → `exceljs` workbook → buffer → Response.

**Dependencies:** `exceljs`, `@/lib/db/queries`, `@/lib/core/commodity-analytics`, `@/lib/core/units`

---

### 3. `GET /api/cash/export`

**Server component read** — queries all cash accounts, computes FD maturity values.

**Sheets:**
- **"Saving Accounts"** — one row per account. Columns: Label, Balance, Is Fixed Deposit, Interest Rate %, Contract Period (mo), Start Date, FD Maturity Value, Notes.

**Data flow:** `listCashAccounts()` → `splitFixedVsRegular()` + `fixedDepositMaturityValueFils()` → format → `exceljs` workbook → buffer → Response.

**Dependencies:** `exceljs`, `@/lib/db/queries`, `@/lib/core/cash-analytics`, `@/lib/core/units`

---

### 4. Updated `GET /api/settings/export`

Add `?category=` query parameter. When present (`properties`, `commodities`, `cash`), delegate to the appropriate category export route's logic. When absent or `all`, export everything as before (JSON, or optionally as a multi-sheet Excel).

**Decision:** Keep Settings export as JSON for backward compatibility. Add a new `?format=xlsx` for Excel. When `category` is specified and `format=xlsx`, delegate to category export.

Actually — simpler approach: Update `GET /api/settings/export` to accept `?category=properties|commodities|cash|all&format=xlsx|json`. When `format=xlsx`, generate a multi-sheet workbook (if `all`) or a single-category workbook.

---

## UI Changes

### Properties Page (`PropertyContent.tsx`)
- Add a small "Export" button at the **top-right of the `<h3>Your properties ({sorted.length})</h3>`** card header, inside a flex container.
- On click: fetch `/api/properties/export`, download as `properties-export-YYYYMMDD.xlsx`.

### Commodities Page (`CommodityContent.tsx`)
- Add "Export" button at **top-right of `<h3>Holdings ({commodities.length})</h3>`** card header.
- On click: fetch `/api/commodities/export`, download as `commodities-export-YYYYMMDD.xlsx`.

### Cash Page (`CashContent.tsx`)
- Add "Export" button at **top-right of `<h3>Accounts ({accounts.length})</h3>`** card header.
- On click: fetch `/api/cash/export`, download as `accounts-export-YYYYMMDD.xlsx`.

### Settings Page (`SettingsContent.tsx`)
- Replace single "Export all data" button with a **dropdown + single Export button**:
  - Dropdown options: All categories, Properties only, Commodities only, Saving Accounts only
  - Plus a radio/checkbox for format: Excel (.xlsx) | JSON (JSON only for "All categories" since Excel supports multi-sheet)
  - Actually — keep it simple: dropdown selects category, format is always Excel. Keep the existing JSON export as a separate "Export all data (JSON)" button for backward compatibility.

**Revised approach (simpler):**
- Keep existing "Export all data" JSON button
- Add a new row: dropdown (All / Properties / Commodities / Saving Accounts) + "Export to Excel" button
- This avoids breaking existing functionality

---

## Excel Formatting (per `exceljs`)

### Title Header
- Row 1: Merged cells across all columns, bold, 16pt, centered, value = `"KYNZi"`.
- Row 2: Subtitle, merged, 11pt, gray, value = `"Exported: DD/MM/YYYY HH:MM"`.
- Row 3: Empty separator row.
- Data starts at row 4 (header row), row 5+ (data).

### Column Headers
- Bold, bottom border, light gray background fill.

### Data Cells
- **Money columns**: Cell value = raw AED number (fils / 100), number format: `#,##0.00` with "AED" in the header label. This allows Excel users to sort/sum.
- **Date columns**: Cell value = JS Date object, number format: `DD/MM/YYYY`.
- **Percentage columns**: Cell value = decimal (e.g., 0.054 for 5.4%), number format: `0.00%` with conditional coloring? No — keep it simple, just % format.
- **Boolean columns** (is_rental, is_fixed_deposit): "Yes" / "No" as strings.
- **Nulls**: empty string `""`.

### Column Widths
- Auto-sized using `worksheet.columns[].width` based on header + content length, or set reasonable defaults (name=30, money=18, date=15, etc.).

---

## Files Changed / Created

| File | Action | Description |
|---|---|---|
| `package.json` | Edit | Add `exceljs` dependency |
| `app/api/properties/export/route.ts` | **Create** | Properties Excel export endpoint |
| `app/api/commodities/export/route.ts` | **Create** | Commodities Excel export endpoint |
| `app/api/cash/export/route.ts` | **Create** | Cash accounts Excel export endpoint |
| `app/api/settings/export/route.ts` | Edit | Add Excel support with category + format params |
| `app/(dashboard)/properties/PropertyContent.tsx` | Edit | Add Export button to card header |
| `app/(dashboard)/commodities/CommodityContent.tsx` | Edit | Add Export button to card header |
| `app/(dashboard)/cash/CashContent.tsx` | Edit | Add Export button to card header |
| `app/(dashboard)/settings/SettingsContent.tsx` | Edit | Add category dropdown + Excel export button |
| `lib/core/excel-utils.ts` | **Create** | Shared Excel formatting helpers (KYNZi title, column styling, download trigger) |

---

## Architecture Notes

- **No DB writes** — all exports are read-only GETs.
- **Pure core functions** for computed fields — already exist in `lib/core/property-analytics.ts`, `lib/core/commodity-analytics.ts`, `lib/core/cash-analytics.ts`.
- **Zod validation** — not needed for read-only export routes, but route handlers follow the thin-wrapper pattern.
- **Money stays fils in logic** — converted to AED (÷100) only at the Excel cell level.
- **Dates stored ISO in DB** — formatted to UAE (DD/MM/YYYY) only in Excel display.
- **No secrets** — exports contain no API keys or credentials.
- **Read-only chatbot** unaffected — no views or schemas changed.

---

## Test Plan

- Manual verification: click each export button, open .xlsx, verify:
  - KYNZi title present
  - All properties rows in overview
  - Per-property sheets exist with all installments/rental history/deposits
  - Commodities all rows with computed P&L
  - Saving accounts all rows with FD maturity
  - Dates in DD/MM/YYYY, money as numbers
- Verify Settings page dropdown + Export to Excel works for each category
- Verify existing JSON export still works (untouched)
- `npm run typecheck` passes
- Existing tests pass (`npx vitest run`)

---

## Edge Cases

1. **No data** — empty category → still generate workbook with title + "No data" note row.
2. **Property name too long for sheet name** — Excel sheet names max 31 chars. Truncate with `...` if needed, ensure no duplicates.
3. **No current_value** — show "N/A" for computed columns that depend on it (appreciation%, yield%, etc.).
4. **Commodity with current_price=0** — P/L and P/L% show "N/A".
5. **FD with missing start_date** — maturity value shows "N/A".
6. **Large datasets** — workbook built in memory, streamed as buffer. Fine for ~30 properties, ~100 commodities, ~10 accounts.
