# Excel Export Feature — Implementation Summary

**Date:** 2026-07-06
**Branch:** feat/excel-export (merged to main, pushed to GitHub)
**Commit:** 68bfa2d

---

## 1. Discovery & Requirements Gathering

### Initial Question
User asked: *"Can the user export all the information from each of the 3 categories (Property, Commodities, Saving Accounts) in an Excel sheet, with a small button on each category page?"*

### Codebase Exploration
Read the full project — Next.js 15 App Router, SQLite, Zod validation, pure-function core (`lib/core/`). Existing export was JSON-only from the Settings page via `/api/settings/export`.

### Clarification Questions Asked (13 total)
1. **Format**: Excel or PDF? → **Excel (.xlsx)**
2. **Scope per category**: All information should be included. Properties: overview sheet + per-property sheets. Commodities/Saving Accounts: one sheet each.
3. **Raw vs formatted**: Formatted (AED, DD/MM/YYYY)
4. **Computed fields**: Include them (appreciation%, yield%, P&L, FD maturity)
5. **Button placement**: Top-right of "Your Properties" / "Holdings" / "Accounts" card headers
6. **File naming**: `{category}-export-YYYYMMDD.xlsx`
7. **Settings page**: Dropdown (All/Properties/Commodities/Saving Accounts) + "Export to Excel" button
8. **Platform branding**: Include "KYNZi" as title in every Excel file

---

## 2. Technical Design Decisions & Rationales

### Library: `exceljs` (not `xlsx`/SheetJS)
**Rationale:** `exceljs` supports cell-level number formatting (`numFmt`), merged cells, column styling, and auto-width — all needed for the KYNZi title header and formatted data. SheetJS (`xlsx`) is lighter but lacks robust styling APIs.

### Architecture: Separate API routes per category
**Rationale:** Follows existing pattern (`/api/properties/`, `/api/cash/`, `/api/commodities/`). Each category has its own export route (`/api/properties/export`, etc.) so each page's Export button hits its own endpoint. The Settings page's "All categories" option uses `/api/settings/export?format=xlsx` for a consolidated multi-sheet workbook.

### Shared utilities in `lib/core/excel-utils.ts`
**Rationale:** Rule 2.3 from CLAUDE.md — pure functions in `lib/core/`. All formatting logic (KYNZi title, header styling, AED/date/percentage cell helpers) is centralized here to avoid duplication across 4 route files. Functions are pure (no DB, no network), making them trivially testable.

### Money representation in Excel
**Rationale:** Cell values are raw AED numbers (fils ÷ 100) with Excel `#,##0.00` format. This allows users to sort, sum, and chart in Excel — unlike formatted strings like `"AED 1,234.56"`. The column headers include "(AED)" to indicate currency. This keeps money as integer fils in all logic (rule 2.2) and converts only at the display edge.

### Date representation in Excel
**Rationale:** Cell values are JavaScript `Date` objects with Excel `dd/mm/yyyy` format. This preserves UAE locale convention (DD/MM/YYYY vs US MM/DD/YYYY) and allows date sorting/filtering in Excel.

### Percentage representation
**Rationale:** Cell values are decimals (e.g., 0.054 for 5.4%) with Excel `0.00%` format. This allows arithmetic and charting in Excel.

---

## 3. Files Created

### 3.1 `lib/core/excel-utils.ts` (121 lines)
Shared pure formatting module. Key exports:
| Export | Purpose |
|---|---|
| `addTitleRow(ws, colCount)` | Adds "KYNZi" (bold 16pt) + timestamp subtitle, merged across columns |
| `styleHeaderRow(ws, row)` | Bold + gray fill + bottom border for column headers |
| `styleSectionTitle(ws, row, colCount)` | Bold 12pt section headers (e.g., "Installments") with light fill |
| `aedVal(fils)` | fils → AED number (÷100), returns null for null |
| `dateVal(iso)` | ISO string → Date object, returns null for null |
| `pctVal(pct)` | percentage → decimal (÷100), returns null for null |
| `fmtMoney(cell)`, `fmtDate(cell)`, `fmtPct(cell)` | Apply Excel number formats to cells |
| `safeSheetName(name, existing)` | Truncate to 31 chars, deduplicate for Excel sheet name rules |
| `formatIsoDateToUae(iso)` | `2026-07-06` → `06/07/2026` |
| `str(v)`, `bool(v)` | Null-safe string/boolean helpers |

### 3.2 `app/api/properties/export/route.ts` (238 lines)
**Sheets generated:**
- **"Properties Overview"** — one row per property with 22 columns: Name, Type, Subcategory, Area, Bedrooms, City, Developer, Size, Purchase Price, Current Value, Valuation Date, Capital Appreciation%, Is Rental, Rental Type, Gross Annual Rent, Service Charge, PM Commission%, Net Annual Rent, Rental Yield%, Total ROI%, Annualized ROI%, Notes.
- **N per-property sheets** named after each property (truncated to 31 chars) — each contains:
  - Property detail (field/value pairs)
  - Installments table (Due Date, Amount, Milestone, Status, Paid Date, Paid Amount, Source, Notes)
  - Rental History table (Type, Annual Rent, Cheques/Year, 4 rent dates, PM Company, PM Commission%, Contract Start, Contract End, End Reason)
  - Rental Deposits table (Cheque #, Deposit Date, Amount, Status, Deposited Date)

**Data flow:** `listProperties()` + `listAllInstallments()` + `listAllRentalHistory()` + `listAllRentalDeposits()` → pure analytics functions (`appreciationPct`, `netAnnualRentFils`, etc.) → `exceljs` workbook → `Buffer` → `NextResponse`.

### 3.3 `app/api/commodities/export/route.ts` (77 lines)
**Sheets generated:** Single "Commodities" sheet with 13 columns: Metal Type, Weight, Unit, Purchase Date, Bought Price/Unit, Cost, Current Price/Unit, Current Value, Target Sell/Unit, Target %, P/L, P/L %, Notes.

**Data flow:** `listCommodities()` → `enrichCommodities()` → format → workbook → buffer → Response. Enriched fields (costFils, valueFils, pl, plPct) come from `lib/core/commodity-analytics.ts`.

### 3.4 `app/api/cash/export/route.ts` (56 lines)
**Sheets generated:** Single "Saving Accounts" sheet with 8 columns: Label, Balance, Is Fixed Deposit, Interest Rate%, Contract Period, Start Date, FD Maturity Value, Notes.

**Data flow:** `listCashAccounts()` → `fixedDepositMaturityValueFils()` → format → workbook → buffer → Response.

### 3.5 `docs/plans/excel-export.md`
Implementation plan document used for Claude review (Claude was unavailable — review done manually).

---

## 4. Files Modified

### 4.1 `app/(dashboard)/properties/PropertyContent.tsx`
- Added `useState` for `exporting` state
- Added `handleExport()` async function — fetches `/api/properties/export`, creates blob, triggers download
- Replaced `<h3>Your properties ({sorted.length})</h3>` with a flex container:
  - Left: `<h3>` title
  - Right: "Export" button (disabled while exporting, shows "Exporting...")

### 4.2 `app/(dashboard)/commodities/CommodityContent.tsx`
- Added `useState` for `exporting` state
- Added `handleExport()` → fetches `/api/commodities/export`
- Same flex container pattern around `<h3>Holdings ({commodities.length})</h3>`

### 4.3 `app/(dashboard)/cash/CashContent.tsx`
- Added `useState` import (was not previously imported)
- Added `useState` for `exporting` state
- Added `handleExport()` → fetches `/api/cash/export`
- Same flex container pattern around `<h3>Accounts ({accounts.length})</h3>`

### 4.4 `app/(dashboard)/settings/SettingsContent.tsx`
- Added `excelCategory` state (dropdown value: "all" | "properties" | "commodities" | "cash")
- Added `exportingExcel` state
- Added `handleExportExcel()` — maps category to the correct API route, fetches, downloads .xlsx
- Added new UI section (separated by border) between existing JSON export and data reset:
  - Description: "Export to Excel by category."
  - `<select>` dropdown with 4 options
  - "Export to Excel" button

### 4.5 `app/api/settings/export/route.ts`
- Added `?format=xlsx` query parameter support
- When `format=xlsx`: generates a multi-sheet workbook (Properties Overview + Commodities + Saving Accounts)
- Uses same `buildPropertiesOverview()`, `buildCommoditiesSheet()`, `buildCashSheet()` helper functions
- Existing JSON export preserved when format is not specified (backward compatible)

### 4.6 `package.json` / `package-lock.json`
- Added `exceljs` dependency (97 transitive packages)

---

## 5. Verification Results

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | Clean, zero errors |
| Tests (`npx vitest run`) | 14 files, 190 tests — all pass |
| Build (`npm run build`) | Successful, zero new errors or warnings |
| Runtime: GET /api/properties/export | 200, content-type: xlsx |
| Runtime: GET /api/commodities/export | 200, content-type: xlsx |
| Runtime: GET /api/cash/export | 200, content-type: xlsx |
| Runtime: GET /api/settings/export?format=xlsx | 200, content-type: xlsx |
| Runtime: pages (properties, commodities, cash, settings) | All 200 |

---

## 6. Issues Encountered & Resolved

### 6.1 TypeScript: `{ value, numFmt }` not iterable (`TS2488`)
**Cause:** Used `...aedCell(...)` spread operator on objects `{ value, numFmt }` in `ws.addRow([...])`. TypeScript cannot spread plain objects into arrays.

**Fix:** Rewrote approach — `addRow` takes primitive values (number, Date, string, null). After creating the row, apply `fmtMoney()`, `fmtDate()`, `fmtPct()` on individual cells via `row.getCell(n)`. Changed helpers from `aedCell()` → `aedVal()` (value only) + `fmtMoney()` (formatting).

### 6.2 TypeScript: `Buffer` not assignable to `BodyInit` (`TS2345`)
**Cause:** `wb.xlsx.writeBuffer()` returns `Buffer` type that doesn't match Next.js `NextResponse`'s expected `BodyInit`.

**Fix:** Cast `buf as unknown as BodyInit` — safe because `Buffer` extends `Uint8Array` at runtime.

### 6.3 ESLint: `any` type in function parameters
**Cause:** Used `Property[]`, `Commodity[]`, `CashAccount[]` typed as `any[]` in settings export route helper functions.

**Fix:** Imported `Property`, `CashAccount`, `Commodity` types from `@/lib/types` and used them in function signatures.

### 6.4 Runtime: "Cannot find module './613.js'" (webpack cache corruption)
**Cause:** Installing `exceljs` (new dependency with 97 transitive packages) while the `.next` build cache still referenced old webpack chunk IDs. The stale cache had chunk references to files that no longer existed.

**Fix:** `rm -rf .next && npm run build` — cleared the build cache and rebuilt from scratch.

### 6.5 Runtime: "missing required error components, refreshing..." (white screen)
**Cause:** Next.js dev server had stale HMR (Hot Module Replacement) state after `.next` was cleared. The error overlay components couldn't be found because they were in the now-deleted cache.

**Fix:** Stopped and restarted the dev server. All pages returned 200 after restart.

---

## 7. Conventions Compliance (CLAUDE.md)

| Rule | Compliance |
|---|---|
| §2.1 Show your work | N/A — exports are raw data, not computed summaries |
| §2.2 Money as fils, dates as ISO | ✅ All money stays fils in logic, converted to AED only at cell level. Dates stored ISO, formatted UAE only in Excel display |
| §2.3 Pure core, thin shell | ✅ `lib/core/excel-utils.ts` — pure formatting functions, no DB/network. API routes are thin wrappers |
| §2.4 Financial data never leaves machine | ✅ Exports are user-initiated downloads, no external calls |
| §2.5 Read-only chatbot intact | ✅ No schema changes, no view changes, no DB writes |
| §3 Zod validation | N/A — read-only GET routes, no input to validate |
| §7 Conventional commits | ✅ `feat: per-category Excel export with KYNZi branding` |
