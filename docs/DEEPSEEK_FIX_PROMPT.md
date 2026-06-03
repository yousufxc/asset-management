# DeepSeek — Correction Round (paste this whole block)

Send this after the STANDARD PREAMBLE (docs/DEEPSEEK_PROMPTS.md). It fixes the 7
parallel PRs (#2–#8) so they compose, removes Feature 8, and corrects real bugs.

```
===== BEGIN CORRECTION ROUND =====
Your 7 feature PRs (#2 commodities, #3 installment-actions, #4 pdf-ingestion,
#5 runway-core, #6 runway-ui, #7 liquidity-warning, #8 metals-spot) each work in
isolation and typecheck, BUT you cut every branch from the same main, so they do NOT
compose: wherever two features touch the same file they conflict, and one feature
silently deletes another's work. `main` has also moved (Feature 8 removed + schema
reset). Fix everything below. Verify after each step. The owner cannot read code —
your tests + live runs are the only safety net.

FIRST, re-read (they changed): docs/SHARED_MEMORY.md (Decision Log + §6),
docs/TASKS.md, CLAUDE.md, lib/db/schema.sql, lib/types.ts, lib/db/queries.ts.

──────────────────────────────────────────────────────────────────────────────
PART A — Make the PRs compose: rebuild them as a LINEAR STACK, one PR at a time.
──────────────────────────────────────────────────────────────────────────────
Process the features IN THIS ORDER. For each: rebase its branch onto the latest
main, apply that feature's fixes (Part B), resolve conflicts using the RULES below,
run `npm run typecheck` + `npm test` + a live `npm run dev` check, then force-push and
update its PR. The owner merges it; then you do the next one rebased on the NEW main.
Order: commodities → installment-actions → pdf-ingestion → runway-core → runway-ui
→ liquidity-warning → metals-spot.

CONFLICT-RESOLUTION RULES (never lose a feature, never break the money/date logic):
- docs/SHARED_MEMORY.md, docs/TASKS.md: keep BOTH sides' entries (union). Never drop
  an existing Decision Log / Handoff entry.
- lib/db/queries.ts: KEEP ALL added helpers from every feature (getInstallment,
  markInstallmentPaid, updateInstallment, deleteInstallment, installmentExistsByKey,
  …). They are disjoint — include them all. Do NOT reintroduce any `gocardless`
  reference (removed on main).
- app/(dashboard)/properties/page.tsx: KEEP BOTH the installment actions UI (live
  status pill + edit/mark-paid/delete) AND the PDF IngestPdfForm. Losing either is a bug.
- lib/core/runway.ts: there must be exactly ONE computeRunway. runway-core defines it.
  runway-ui must NOT modify runway.ts at all (it is a UI-only PR — its only job is the
  dashboard). liquidity-warning ADDS checkLiquidityWarning to the same file. End state:
  computeRunway (from core, WITH its comments) + checkLiquidityWarning. No duplicates.
- app/(dashboard)/commodities/page.tsx: the commodities PR provides the page WITH
  <CommodityForm/> + the list. metals-spot ADDS the live-value column on top and MUST
  keep <CommodityForm/> and the full list (see Part B, CRITICAL).

──────────────────────────────────────────────────────────────────────────────
PART B — Per-feature fixes (apply while rebasing each branch)
──────────────────────────────────────────────────────────────────────────────

[commodities] No code bug. Just rebase onto main and confirm the form still adds a
commodity live (purity presets → fraction). Keep as-is otherwise.

[installment-actions] No logic bug found (overdue-on-read is correct: due==asOf is
upcoming, paid wins). After rebase, confirm mark-paid/edit/delete persist live and the
overdue pill appears WITHOUT mutating stored status.

[pdf-ingestion] Two hardening fixes in app/api/ingest/spa/route.ts:
  1. SECURITY: do NOT use the raw uploaded file.name in the save path (path-traversal /
     overwrite risk). Derive a safe name: strip directories (basename only), allow only
     [A-Za-z0-9._-], and prefix a timestamp or random id to avoid collisions. Keep the
     ORIGINAL name only as the stored `source_file` label.
  2. Verify the property exists before the pipeline (use getProperty(propertyId));
     return 400 "Unknown property" if not, instead of letting a DB FK error surface as a
     generic 422. Keep the "write nothing on failure" guarantee. Idempotency rule
     (skip on (property_id, due_date, amount_fils)) is correct — keep it.

[runway-core] One correctness bug: the headline runway must NOT be capped at the
90-day warning window. Today computeRunway breaks the event walk at horizonEnd, so
"days until shortfall" can never exceed 90 even with years of runway — wrong for the
core question "how many days do I have."
  FIX: in computeRunway, walk and detect the first/worst shortfall over ALL provided
  events (remove the `if (event.date > horizonEndIso) break;` cap). Keep horizonDays
  ONLY to derive a `withinHorizon` boolean (shortfallDate !== null AND
  daysUntilShortfall <= horizonDays). daysUntilShortfall/shortfallDate must be the TRUE
  values. Add/adjust a hand-checked test: a shortfall at day 200 is reported (not null)
  with daysUntilShortfall = 200, and withinHorizon = false for a 90-day window.

[runway-ui] After the core fix, the dashboard headline shows the TRUE days of runway
(uncapped); keep the show-your-work timeline expansion. This PR must not touch
lib/core/runway.ts. ALSO replace the rent assumption per the next item (it lives in the
dashboard's inflow construction).

[runway-ui + schema] RENT TIMING — replace the wrong monthly-spread assumption.
Current code does annual_rent ÷ 12 every month from next month. WRONG. Owner decision:
model real cheques.
  1. Schema (lib/db/schema.sql) + lib/types.ts + v_properties view: add to properties
     `rent_cheques_per_year INTEGER CHECK (rent_cheques_per_year IN (1,2,4,12))` and
     `next_rent_date TEXT` (ISO). Both nullable. (Schema change → say "owner must run
     npm run db:reset" loudly in the PR.)
  2. Zod (PropertyInputSchema): add rent_cheques_per_year (optional enum 1|2|4|12) and
     next_rent_date (optional UAE date). insertProperty: store them (UAE→ISO). Only
     meaningful when is_rental; force null when not rental.
  3. Property form: when "rented out" is ticked, show "Cheques per year" (1/2/4) and
     "Next rent date (DD/MM/YYYY)" next to Yearly rent.
  4. Runway inflows: for each rental property with annual_rent_fils, cheques_per_year
     and next_rent_date, generate inflow events starting at next_rent_date, spaced
     (12 / cheques_per_year) months apart, each = round(annual_rent_fils /
     cheques_per_year), covering the runway horizon (generate enough to reach past the
     last liability date). Each appears as a positive item in the timeline labelled
     "Rent: <property> (cheque)". If a rental is missing cheques/next-date, SKIP its
     rent (don't invent timing) and note it.
  5. Tests: a 4-cheque property places 4 inflows/year on the right dates with the right
     per-cheque fils; a rental missing next_rent_date contributes no inflow.

[liquidity-warning] checkLiquidityWarning is fine once it consumes the corrected
computeRunway. Ensure "breached" uses the 90-day window (withinHorizon), not the
uncapped shortfall. Keep the banner + show-your-work.

[metals-spot] CRITICAL + hardening:
  1. CRITICAL REGRESSION: your commodities/page.tsx was branched off the stub and has
     NO <CommodityForm/> and a reduced list — merging it removes the ability to ADD
     commodities. Rebuild the page on TOP of the commodities PR: keep <CommodityForm/>,
     the full table (Name|Metal|Weight|Purity|Qty|Storage), AND add the live-value
     column.
  2. FX: don't hardcode AED_PER_USD = 3.673. Metals.dev supports currency=AED directly —
     request prices in AED (currency=AED) and drop the USD→AED conversion entirely. If
     you must keep a peg, name it AED_PER_USD_PEG = 3.6725 (the official peg) and comment
     it. Either way no silent FX guess.
  3. API key: keep it out of logs. Prefer an auth header if Metals.dev supports it; if
     the key must go in the query string, never console.log the URL.
  4. NETWORK ON EVERY RENDER: the page is an async server component calling the API with
     cache:no-store on every load → an API hit per page view. Add light caching: fetch
     per metal at most once per few minutes (Next route segment `revalidate`, or a small
     module-level {value, fetchedAt} cache with a TTL). Still show the "as of <time>" +
     staleness so the owner sees freshness.
  5. RESILIENCE: if the spot fetch fails, the page must still render (show the list +
     "spot price unavailable" + any manual_value), not crash.
  6. The value cell must expand to the commodityValueFils lineage: weight→grams,
     purity_fraction, spot fils/gram, quantity.

──────────────────────────────────────────────────────────────────────────────
PART C — Global checks before each PR is reopened
──────────────────────────────────────────────────────────────────────────────
- NO `gocardless` / `gocardless_account_id` / bank-sync anywhere (removed on main).
- Money is integer fils end-to-end; AED↔fils only via lib/core/units.ts.
- Dates ISO in DB, UAE at edges via lib/core/units.ts.
- Every displayed computed number expands to its inputs.
- `npm run typecheck` clean, `npm test` green (with the new tests above), and you ran
  it live and CONFIRMED the numbers. State all of this in each PR body, and whether the
  PR needs `npm run db:reset` (the rent-timing schema change does).
- Update docs/TASKS.md status + append a one-line docs/SHARED_MEMORY.md Handoff note per
  feature, in the same PR.

When done, post a summary comment: the 7 PRs in stack order, what to click to QA each,
and confirmation that Feature 8 is absent.
===== END CORRECTION ROUND =====
```
