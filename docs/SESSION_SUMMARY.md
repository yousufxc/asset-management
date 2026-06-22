# Session Summary: KYNZi Platform Enhancements

**Session date:** 2026-06-22  
**Commits:** 16 (from `3edd2e4` to `b6b0a97`)  
**Files changed:** ~40 files across all layers (schema, types, core, queries, API, frontend, CSS, tests)

---

## 1. Rental Deposits + Contract Lifecycle + Rental History (commit `147b740`)

**What:** Added deposit tracking per rental cheque, contract lifecycle management, and rental history view.

**Rationale:** The user wanted "Mark deposited" buttons for rental cheques (like instalment "Mark paid"), overdue warnings, and the ability to cancel/renew/vacant tenancy contracts while preserving rental income history for ROI calculations.

**Implementation:**
- New tables: `rental_deposits` (per-cheque status tracking) and `rental_history` (immutable contract snapshots)
- Pure core: `lib/core/rental-deposits.ts` — `generateDepositSchedule` (fils-safe remainder distribution, slot-based cheque numbers), `depositStatus`
- Dedicated lifecycle API: `POST /api/properties/[id]/rental-lifecycle` with actions `cancel`, `renew`, `vacant`
- Upsert-based deposit sync preserves `deposited` status across rental edits — never silently deletes received money records
- Frontend: `DepositActions.tsx` (MarkDepositedButton), rental history table, contract action buttons in detail panel
- Claude-reviewed through 7 rounds (19 issues caught, 6 blocking)
- 175 tests pass, TypeScript clean

---

## 2. Cash Composition Chart + Fixed Deposit Maturity (commit `446f438`)

**What:** Added a donut chart (Fixed vs Regular split) and a "Balance at Maturity" row for fixed deposits.

**Rationale:** User wanted graphs for the Cash section. I proposed 4 options; user chose the minimal approach. The maturity projection helps users see what their fixed deposit will be worth at contract end.

**Implementation:**
- Pure core: `lib/core/cash-analytics.ts` — `splitFixedVsRegular`, `fixedDepositMaturityValueFils`
- Chart: `CashCompositionChart.tsx` — donut following existing `PortfolioCompositionChart` pattern
- Detail panel: "Balance at Maturity" row computed as `principal + simple interest`

---

## 3. Cash Detail Panel Below Table (commit within `446f438`)

**What:** Moved the cash detail panel from a sticky sidebar to below the accounts table.

**Rationale:** Same layout pattern as the Properties section — detail window below table for full-width view.

---

## 4. Commodity Charts — 5 Charts (commit `921634e`)

**What:** Added 5 charts to the Commodities section: Portfolio by Metal (donut), Weight by Metal (bar), P&L by Holding (horizontal bar), Cost vs Current Value (grouped bar), ROI % by Holding (bar).

**Rationale:** User wanted graphs for commodities similar to Properties. I proposed 3 options; user chose Option 2 (4 charts) + Weight by Metal.

**Implementation:**
- Pure core: `lib/core/commodity-analytics.ts` — `enrichCommodities`, `groupByMetal`, `EnrichedCommodity` type
- 5 chart components in `commodities/charts/`, all following existing recharts patterns with `AnimateOnScroll` + `AnimateChartOnScroll`
- Detail panel moved below table (same as cash/properties)
- Refactored `CommodityContent` to use shared enrichment from pure core instead of inline useMemo

---

## 5. Target Sell Price + Dashboard Sell Alerts (commit `45912a6`)

**What:** Added a target sell price field to commodities, with dashboard alerts when the current price reaches the target.

**Rationale:** User wanted to set a sell target and be notified when it's reached — "time to sell that specific holding."

**Implementation:**
- Schema: `target_sell_price_per_unit_fils` on commodities (nullable, same unit as bought/current)
- Pure core: `shouldSellAlert(c)` — returns true when `current >= target`
- Dashboard: "Time to sell" section showing holdings that hit their target with metal, weight, target/now price, and total gain
- Detail panel: "Target sell price" row with green "Target reached" badge when met
- Wire through all layers: schema, types, validate, queries, forms

---

## 6. Target Price Columns in Holdings Table (commit `867226d`)

**What:** Added "Target /unit" and "Target %" (expected profit at target) columns to the commodities holdings table, plus horizontal scroll.

**Rationale:** User wanted to see target prices at a glance in the table, not just in the detail panel.

**Implementation:**
- Two new columns with `nowrap` and `minWidth` styling
- Target % = `((target - bought) / bought) × 100`, shown in green
- Horizontal scroll wrapper (`overflowX: auto`, `minWidth: 1100px`)
- Column headers shortened for density

---

## 7. Sticky Type Column + Fix (commits `b7a2ec7`, `d19c643`)

**What:** Made the Type column sticky on horizontal scroll (like the Name column in Properties). Fixed inline `position: relative` overriding CSS `position: sticky`.

**Rationale:** The Type column is the primary identifier — should stay visible while scrolling.

---

## 8. Dark/Light Theme Toggle (commit `3bd5a65`)

**What:** Added a theme toggle in Settings (Dark/Light radio buttons). Persists in settings DB. Instant DOM update on toggle.

**Rationale:** User wanted both dark and light modes. Dark is default (existing). Light uses a clean white-panel palette.

**Implementation:**
- CSS: `[data-theme="light"]` overrides all 10 `--bg`, `--panel`, `--text`, etc. variables with a light palette
- `layout.tsx`: reads `theme` from settings DB, sets `data-theme` on `<html>` server-side
- `settings.ts`: adds `"theme": "dark"` to DEFAULTS
- Settings page: Dark/Light radio buttons with instant DOM attribute update + API persist
- Pill badges and KPI totals converted from hardcoded hex to CSS variable-based colors (`color-mix`)
- Button text changed from `#06121f` to `#ffffff` for readability on blue accent (commit `d970a82`)

---

## 9. Branding Changes (commits `054d30c`, `1bb55b1`)

**What:** Renamed platform from "Liquidity Platform" to "KYNZi". Removed "Local · single-user · AED" tag line from sidebar. Updated browser tab title.

---

## 10. About Us Page (commits `6f0da9e`, `e2a7dfc`, `27d55a6`, `2d47cb6`, `b6b0a97`)

**What:** New "About Us" section in sidebar navigation with a dedicated page containing the KYNZi story, philosophy, and digital vault description.

**Rationale:** User provided the full text content. Iterated on styling: removed blue accent, centered the welcome card, added scroll transitions.

**Implementation:**
- New route: `/about` with `"use client"` page
- Four cards: Welcome, Story of KYNZi, Our Philosophy, The Digital Vault
- Each wrapped in `AnimateOnScroll` for fade-in transitions
- Welcome card constrained to 400px, centered with auto margins
- Nav link added above Settings in sidebar

---

## Key Architectural Decisions

1. **All analytics in `lib/core/`** — Pure functions, no DB, no network. Every chart and computation goes through tested pure functions first.
2. **Zod gates every write** — No data enters the DB without passing a Zod schema.
3. **Fils/integer money everywhere** — Never float, never AED in logic. Only convert at display edges.
4. **Claude-reviewed** — Every major feature went through Claude validation. 19 issues caught in the rental feature alone (6 blocking). All subsequent features were smaller and clean.
5. **Follow existing patterns** — Charts follow `PortfolioCompositionChart` style, forms follow existing forms, API routes follow the thin-shell pattern.
6. **CSS variables for theming** — Dark/light mode uses `[data-theme]` selector with 10 CSS custom properties. All components inherit. Pills use `color-mix()` for dynamic backgrounds.
