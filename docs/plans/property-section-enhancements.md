# Properties Section Enhancement Plan

## Overview
Extensive enhancements to the Properties section covering input validation, KPI totals, table overhaul (filtering, sorting, new columns, scrolling), chart changes, and detail panel expansion.

---

## 1. Commission Input — Ensure 0-100 Numeric Only

**Current state:** `PropertyForm.tsx:93` and `PropertyDetailPanel.tsx:568` already have `type="number" step="0.01" min="0" max="100" onKeyDown={numeralOnly}`. `numeralOnly` (from `numeralOnly.ts`) blocks all non-numeric keystrokes. HTML5 `min`/`max` attributes provide native range enforcement on form submission.

**Analysis:** The `onKeyDown={numeralOnly}` blocks alphabetic characters, `e`, `E`, `+`, `-`. The `min="0" max="100"` handles range. No changes needed — this works correctly.

**Verdict:** Already compliant. Confirm by visual inspection that both instances have the same guards.

---

## 2. Instalment Percentage — Numeric Only

**Current state:** `PropertyForm.tsx:416` has `onKeyDown={numeralOnly}` AND regex validation in `onChange` (`/^\d+(\.\d*)?$/`) restricting to 0-100. The `type="text"` + `inputMode="decimal"` pattern is deliberate (avoids browser-native number quirks).

**Analysis:** Already blocks alphabetic input. The regex allows decimals but not letters. Range 0-100 is enforced in both onChange and in the submit handler (line 212: `percentage < 0 || percentage > 100`).

**Verdict:** Already compliant.

---

## 3. Net Rental Income — Bold Total Figure

**What:** Add a bold KPI row inside the "Net Rental Income" chart card showing the total net rent across all rented properties.

**Implementation:**
- In `PropertyContent.tsx`, inside the Net Rental Income card (line 62), compute total from filtered properties.
- Use `netAnnualRentFils(p)` from `property-analytics.ts`.
- Sum across all non-off-plan properties where net rent is not null.
- Display as bold text: `**Total Net: AED X,XXX.XX**`.

**Pseudo:**
```tsx
const totalNetRent = properties
  .filter(p => p.subcategory !== "off_plan")
  .map(p => netAnnualRentFils(p))
  .filter((n): n is number => n !== null && n > 0)
  .reduce((a, b) => a + b, 0);
```

**File:** `PropertyContent.tsx` — add inside the Net Rental Income `.card` div.

---

## 4. Portfolio Value — Bold Total Figure

**What:** Add a bold KPI row inside the "Portfolio Value" chart card showing total portfolio value.

**Implementation:**
- Sum `current_value_fils` across all properties where it's non-null and > 0.
- Display as bold text.

**File:** `PropertyContent.tsx` — add inside the Portfolio Value `.card` div.

---

## 5. Capital Appreciation — Bold Total Figure

**What:** Add a bold KPI row inside the "Capital Appreciation" chart card.

**Implementation:**
- Total appreciation in fils = sum of `current_value_fils - purchase_price_fils` for properties where both are non-null and purchase > 0.
- Display both absolute AED and weighted percentage.

**File:** `PropertyContent.tsx` — add inside the Capital Appreciation `.card` div.

---

## 6. Composition by Type — Legend/Key

**What:** Add a color key to the donut chart showing what each color represents.

**Implementation:**
- In `PortfolioCompositionChart.tsx`, add a legend below the donut chart.
- Each legend item shows a colored circle + type label + percentage.
- Use horizontal flex layout wrapping for the legend items.

**File:** `PortfolioCompositionChart.tsx`

---

## 7. Detail Window Below Table

**What:** When clicking a property name, show the detail panel underneath the "Your Properties" table instead of to the right.

**Current:** Flex row: table on left, sticky detail panel on right.
**New:** Column layout: table on top, detail panel below (takes full width).

**Implementation:**
- Change the wrapper from `display: "flex"` to block layout.
- Remove `flex: 1` and `position: sticky` from the detail panel container.
- Make the detail panel a full-width card below the table.
- Close button still clears the selected param.

**File:** `PropertyContent.tsx` lines 72-174 — restructure the layout.

---

## 8. Price per Sqft & Rental Yield in Detail Window

**What:** Add two new detail rows in the read-only view of `PropertyDetailPanel.tsx`.

**Implementation:**
- Import `pricePerSqftFils` and `rentalYieldPct` from `property-analytics.ts`.
- Add rows after "Current value" / "Valued on":
  - **Price per Sqft:** `formatAed(pricePerSqftFils(property))` or "—" if null
  - **Rental Yield:** `rentalYieldPct.toFixed(1)%` or "—" if null

**File:** `PropertyDetailPanel.tsx` — inside `renderReadOnly()`.

---

## 9. Instalment Timeline Graph in Detail Window

**What:** Add an individual property's installment timeline chart inside the detail panel.

**Implementation:**
- Import `InstallmentTimelineChart` into `PropertyDetailPanel.tsx`.
- The component already takes `installments: Installment[]` as props — just pass the property's installments.
- Render inside the read-only view, below the detail rows, in a `{installments.length > 0 && ...}` block.
- Keep it compact (maybe slightly smaller height).

**File:** `PropertyDetailPanel.tsx`

---

## 10. Remove 3 Graphs

**What:** Remove "Value vs Purchase Price", "Service Charge Burden", and "Installment Status" from the main chart grid.

**Implementation:**
- In `PropertyContent.tsx`, remove the three `.card` divs (lines 63, 67, 68).
- Remove their imports (lines 15, 19, 20).
- Keep the source files on disk (don't delete them) — only remove from the grid.

**Files:** `PropertyContent.tsx` only.

---

## 11. Move Instalment Schedule to Detail Section

**What:** Move the inline `<details>` expander with "N installment(s) — show schedule" from the table rows into the `PropertyDetailPanel`.

**Current:** Inside each table row's Name cell (lines 111-131 in PropertyContent.tsx).
**New:** In `PropertyDetailPanel.tsx` read-only view, if the property has installments, show the schedule.

**Implementation:**
- Remove the `<details>` block from `PropertyContent.tsx` table rows.
- Add the installment schedule block into `PropertyDetailPanel.tsx` renderReadOnly() (before the "Edit Property Info" button).
- Use the same `installmentStatus`, `MarkPaidButton`, `DeleteButton` components.
- Pass necessary imports and the `todayIso` date.

**File:** `PropertyContent.tsx` (remove), `PropertyDetailPanel.tsx` (add).

---

## 12. Filter by Type in Table

**What:** Add a type filter dropdown in the "Type" column header, following the same pattern as `CommodityContent.tsx`.

**Implementation:**
- Add state: `typeFilter: Set<string>` initialized to all property types: `["apartment", "penthouse", "townhouse", "villa"]`.
- Add filter toggle button "Type ▾" in the Type column header.
- Dropdown menu with "Select All", "Clear All", and per-type checkboxes.
- Filter: exclude properties whose `property_type` is not in the set. Properties with `null` property_type get categorized as "unspecified" and get their own filter option.
- Click-outside-to-close behavior (same pattern as CommodityContent).

**File:** `PropertyContent.tsx`

---

## 13. Rental Yield Column (Far Left)

**What:** Add a new "Rental Yield" column as the first column in the table (before "Name").

**Implementation:**
- Use `rentalYieldPct(p)` from `property-analytics.ts`.
- Display as `X.X%` with green/red coloring.
- Show "—" for off-plan (no purchase price yet) or properties without rentals.

**File:** `PropertyContent.tsx` — add as first `<th>` and `<td>`.

---

## 14. Sortable Columns

**What:** Make "Bought for", "Current Value", "Capital Appreciation", "Rental Yield", "Annual Profit" sortable ascending/descending.

**Implementation:**
- Add sort state: `sortCol` and `sortDir` (same pattern as CommodityContent).
- Click cycle: asc → desc → remove sort.
- Sort arrow indicators in column headers.
- Sort implementation with `useMemo`:
  - Sort by AED/fils values (purchase_price_fils, current_value_fils)
  - Sort by percentage (appreciation, yield)
  - Sort by annual profit (netAnnualRentFils)
  - Null/missing values pushed to bottom.

**File:** `PropertyContent.tsx`

---

## 15. Table Column Spacing + Horizontal Scroll

**What:** Adjust column widths and enable horizontal scrolling.

**Implementation:**
- Wrap the table in a `<div style={{ overflowX: "auto" }}>`.
- Add `whiteSpace: "nowrap"` to `<th>` and `<td>` to prevent text wrapping.
- Set reasonable `minWidth` constraints per column:
  - Rental Yield: 100px
  - Name: min 180px
  - Type: min 120px
  - Area: min 100px
  - Bought For: min 120px
  - Current Value: min 120px
  - Valuation Freshness: min 140px
  - Capital Appreciation: min 140px
  - Annual Profit: min 120px

**File:** `PropertyContent.tsx`

---

## 16. Brainstorm: Additional Insights/Graphs

Here are insights a property management platform user would want:

1. **Cash Flow Timeline** — Project rental income inflows vs instalment outflows over the next 12-24 months. Shows months where liabilities exceed income.
2. **Total Equity** — Current value minus remaining unpaid instalments. Shows the real net equity position per property.
3. **Portfolio Diversification Dashboard** — Distribution by city, area, developer, and bedroom count. Helps identify concentration risk.
4. **Rental Performance Score** — Composite metric combining yield, occupancy (if tracked), and rent stability. Helps compare properties.
5. **Upcoming Events Timeline** — Next 12 months: rental cheque dates + instalment due dates + service charge due dates. Single unified calendar.
6. **Price Change Tracking** — If value history were stored, a line chart showing how each property's value changed over time.
7. **Income Stability** — For long-term rentals, show contract expiry dates and highlight upcoming renewals/risk of vacancy.
8. **Total Return (IRR-like)** — Combined rental income + capital appreciation as an annualized return percentage.
9. **Instalment Progress** — Per-property progress bar: % of total instalments paid vs remaining.
10. **Service Charge Efficiency** — Service charge as % of gross rent, benchmarked across properties. Identifies high-cost properties.

---

## Files Changed (Summary)

| File | Changes |
|---|---|
| `PropertyContent.tsx` | Restructure layout (detail below table), remove 3 charts, add KPI totals, add filter/sort/horizontal-scroll, add rental-yield column, move instalment schedule out |
| `PropertyDetailPanel.tsx` | Add price/sqft, rental yield, instalment timeline, instalment schedule |
| `PortfolioCompositionChart.tsx` | Add color legend |
| `globals.css` | Styles for legend, scrollable table wrapper, KPI total |

## Unchanged Files (kept but no longer rendered)
- `ValueVsPurchaseChart.tsx`
- `ServiceChargeBurdenChart.tsx`
- `InstallmentStatusChart.tsx`

## Validation

After implementation, run:
- `npx tsc --noEmit` — typecheck
- `npx vitest run` — tests
