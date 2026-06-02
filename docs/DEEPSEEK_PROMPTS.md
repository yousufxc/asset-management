# DeepSeek — The Big Prompt (full plan, autonomous, one PR per feature)

**How to use this file:** send the **STANDARD PREAMBLE** once, wait for "ready",
then send **THE BIG PROMPT** (everything from "===== BEGIN FULL PLAN =====" to
"===== END FULL PLAN ====="). DeepSeek then implements the entire remaining plan
itself — one feature per branch/PR, in the fixed build order — and the owner reviews
all the PRs at the end. There is no per-task stop-and-wait anymore.

> Task 1 (Cash) is already done and merged-as-PR #1; it is the live example of the
> pattern every feature below must follow.

---

## STANDARD PREAMBLE (send first)

```
You are the implementer on a local-first, single-user personal finance app
(AED currency). An architect (Claude) has scaffolded the project and frozen the
contracts you must build against. You CANNOT change the contracts; if one seems
wrong, stop THAT feature, write the problem under "Open Questions" in
docs/SHARED_MEMORY.md, and keep building the other features.

Before writing any code, read these files in full:
- CLAUDE.md                  (project rules — these override everything)
- docs/ARCHITECTURE.md       (the 5 load-bearing decisions)
- docs/SHARED_MEMORY.md      (invariants, frozen contracts, decisions, §6 working mode)
- docs/TASKS.md              (task tracker + acceptance criteria)
- The reference slices you will mirror for every data-entry feature:
    app/api/properties/route.ts            (thin Zod-gated API)
    app/(dashboard)/properties/PropertyForm.tsx
    app/(dashboard)/properties/page.tsx
    app/(dashboard)/properties/InstallmentForm.tsx
    app/api/cash/route.ts                  (the most recent worked example)
    app/(dashboard)/cash/CashForm.tsx
    app/(dashboard)/cash/page.tsx

Hard rules (non-negotiable):
- Money is INTEGER FILS everywhere (1 AED = 100 fils). Never do money math in
  floats. Convert AED<->fils only via lib/core/units.ts. DB columns are *_fils.
- Dates: store ISO YYYY-MM-DD; accept UAE DD/MM/YYYY at the edges via
  lib/core/units.ts (parseUaeDateToIso / formatIsoToUae). Never hand-roll dates.
- Validate EVERY write with the Zod schema in lib/ingest/validate.ts before any DB
  call. Reject invalid input (HTTP 400); never persist unvalidated data.
- Use the parameterized helpers in lib/db/queries.ts. Never string-build SQL.
- Every displayed computed number must expand to its raw inputs ("show your work")
  via the <details class="work"> pattern from the reference.
- Pure logic goes in lib/core/ (no DB, no network) with hand-checked unit tests.
  Pure functions take asOf/now as an INPUT — never call Date.now() inside core.

Reply "ready" when you have read everything, and I'll send the full plan.
```

---

## THE BIG PROMPT (send after "ready")

```
===== BEGIN FULL PLAN =====
You will implement the ENTIRE remaining plan yourself, autonomously. The owner
reviews at the end, not between features. That means YOUR self-verification is the
only safety net — a wrong number looks identical to a right number to the owner.

GLOBAL RULES FOR THIS RUN
- ONE major feature = ONE branch = ONE PR. Branch off the latest main each time:
  `git checkout main && git pull && git checkout -b feat/<name>`.
  Never combine two features in one PR.
- Build in the FIXED ORDER below. Do not skip ahead; later features read earlier data.
- Before opening each PR, ALL of these must hold (state them in the PR body):
    1) `npm run typecheck` is clean.
    2) `npm test` is green (and you ADDED tests for any new money/date/pure logic).
    3) You ran `npm run dev` and confirmed the ACTUAL output live (numbers, 400s,
       idempotency) — not reasoned about it.
    4) Every displayed computed number expands to its raw inputs (rule 2.1).
    5) Contracts in lib/ unchanged (or, if blocked, you stopped and logged it).
- PR body format: ## What / ## Contract & integrity / ## Verification (the 5 above)
  / ## Schema change? (say "none" or "YES — owner must run `npm run db:reset`,
  wipes local data"). End with a one-line note that it was implemented by DeepSeek.
- Update docs/TASKS.md Status (🟦→🟨) and append a one-line note to
  docs/SHARED_MEMORY.md Handoff Notes IN THE SAME PR.
- If a feature needs a contract change or a money behavior is ambiguous: STOP that
  feature only, append a plain-language product question to Open Questions in
  docs/SHARED_MEMORY.md, mark that task ⛔ in TASKS.md, and continue with the next
  unblocked feature. Never guess, never silently edit a contract.

All previously-open product questions are ALREADY ANSWERED (see Decision Log):
- Overdue installments: COMPUTE ON READ, never mutate stored status.
- Runway: COUNT rental income as an inflow on its due date.
- Metals: LIVE spot price, always shown with an "as of <timestamp>" + staleness.

--------------------------------------------------------------------------------
BUILD ORDER (one PR each)
--------------------------------------------------------------------------------

==== FEATURE 1 — Commodities data entry ====  branch: feat/commodities
Goal: ship the Commodities page (physical precious metals), mirroring the property/
cash reference slices.
Frozen contract (exists — do not modify):
- Zod: CommodityInputSchema (lib/ingest/validate.ts): name*, metal_type*
  (gold|silver|platinum|palladium|other), weight* (>0), weight_unit*
  (gram|kg|troy_oz|tola), purity_fraction* (0..1], form? (bar|coin|jewelry|other),
  quantity (int>=1, default 1), storage_location?, acquisition_price_aed?,
  manual_value_aed?, valued_at? (UAE date), notes?
- Query: insertCommodity(input), listCommodities() (lib/db/queries.ts)
- Helper: karatToFraction(karat) (lib/core/units.ts)
- Math (already implemented+tested): commodityValueFils(...) (lib/core/valuation.ts).
  Live spot pricing is FEATURE 8 — do NOT call any network here.
Build:
1. app/api/commodities/route.ts — same shape as app/api/cash/route.ts (GET list,
   POST validated by CommodityInputSchema, 400 on failure, 201 on success).
2. app/(dashboard)/commodities/CommodityForm.tsx (client, mirror CashForm.tsx):
   name*, metal_type dropdown*, weight* + weight_unit dropdown*, form dropdown,
   quantity (default 1), storage_location, acquisition_price_aed, valued_at
   (DD/MM/YYYY), notes.
   PURITY UX (important): the contract stores purity_fraction (0..1]. Give a "Purity"
   dropdown of presets that map to a fraction, plus "Custom…":
     24K→1.0, 22K→0.9167, 21K→0.875, 18K→0.75, .999→0.999, .925 sterling→0.925.
   Use karatToFraction for the karat presets so the mapping matches core. On
   "Custom…" show a number input for a fraction in (0,1]. The payload sends
   purity_fraction as a number.
3. app/(dashboard)/commodities/page.tsx (replace the stub): table Name | Metal |
   Weight | Purity (%) | Qty | Storage. NO live value yet — do not invent a price.
   If manual_value_fils is set you MAY show it labeled "manual value (AED)".
Acceptance: "1kg PAMP gold bar", gold, 1 kg, 24K → purity_fraction stored = 1.0;
a 22K entry stores ~0.9167 (NOT 22); bad input → 400; tests+typecheck pass;
verified live. Schema change: none.

==== FEATURE 2 — Installment actions + overdue (compute-on-read) ====
branch: feat/installment-actions
Goal: let the owner manage an installment after creating it, and show "overdue" live.
Build:
1. lib/core/installments.ts (PURE, new): installmentStatus(installment, asOfIso)
   returns "upcoming" | "paid" | "overdue".
     - "paid" if the stored status is "paid" (or paid_date set) — paid always wins.
     - else "overdue" if due_date < asOf.
     - else "upcoming".
   NEVER mutates anything. asOf is an input (no Date.now() inside).
   __tests__/installments.test.ts: hand-checked cases incl. due yesterday/unpaid →
   overdue, due tomorrow → upcoming, paid-but-past → paid, due == asOf → upcoming
   (not overdue), and a DD/MM regression date.
2. Query helpers (lib/db/queries.ts): add markInstallmentPaid(id, paidDateUae?,
   paidAmountAed?), updateInstallment(id, InstallmentInput-ish), deleteInstallment(id).
   Parameterized only; convert AED→fils, UAE→ISO via lib/core. (If you must touch the
   query file's contract surface, you may ADD functions but not change existing ones.)
3. API: app/api/installments/[id]/route.ts → PATCH (edit / mark paid) and DELETE,
   Zod-validated, 400 on bad input, 404 if the installment doesn't exist.
4. UI: on app/(dashboard)/properties/page.tsx schedule, render the LIVE status via
   installmentStatus(i, todayIso) using the <span class="pill ..."> classes, and add
   "Mark paid" / "Edit" / "Delete" controls (a small client component is fine). Pass
   today's ISO date in from the server component (don't compute time inside core).
Acceptance: an unpaid past-due installment shows the red "overdue" pill WITHOUT its
stored status changing in the DB; mark-paid flips it to "paid" and persists; delete
removes it; tests+typecheck pass; verified live. Schema change: none.

==== FEATURE 3 — PDF → installment-schedule ingestion ====
branch: feat/pdf-ingestion   (CLAUDE.md §6)
Goal: turn an off-plan SPA PDF into validated installments.
Deps to add: pdf-parse (local extraction), @anthropic-ai/sdk (Claude parsing).
ANTHROPIC_API_KEY comes from .env.local (never commit it).
Build:
1. lib/ingest/pdf-to-markdown.ts → pdfToMarkdown(filePath): read the PDF LOCALLY with
   pdf-parse, return clean markdown; strip repeated headers/footers/page numbers,
   collapse whitespace. NO network. Never pass a raw PDF downstream.
2. lib/ingest/parse-claude.ts → parseScheduleFromMarkdown(markdown): call Claude with
   a STRICT instruction to return JSON ONLY (no prose, no code fences) matching
   ParsedScheduleSchema. Parse the response with ParsedScheduleSchema. On parse/
   validation failure, throw with the raw text attached for manual review — NEVER
   write unvalidated data. (Permitted outbound call per rule 2.4.)
3. app/api/ingest/spa/route.ts: multipart upload of one PDF + property_id. Steps:
   save to uploads/ (gitignored) → pdfToMarkdown → parseScheduleFromMarkdown → for
   each installment convert amount_aed→fils and insert for that property (source='pdf',
   source_file=<filename>). Return { inserted, skipped, property_id }. On ANY failure
   return 422 with the reason and write nothing.
4. IDEMPOTENCY: re-uploading the same SPA must NOT duplicate installments. Rule
   (confirmed by owner via Claude): skip an installment if one already exists with the
   same (property_id, due_date, amount_fils). NOTE this is different from the bank-
   statement transactions.dedup_hash mechanism — do not conflate them. Add a query
   helper that checks existence by that key before inserting.
5. Minimal upload UI: file input + property selector (on the property page or a new
   /ingest page) that POSTs to /api/ingest/spa and shows the inserted/skipped summary.
Tests (MOCK the Claude call — no real network in tests):
- ParsedScheduleSchema rejects malformed JSON / missing fields.
- A known parsed schedule converts to correct fils and keeps ISO dates.
- Re-running the same insert is idempotent (0 duplicates) per the rule above.
- A DD/MM date anywhere in the path resolves correctly (regression guard).
Acceptance: a sample SPA PDF yields a correct schedule on the property page;
re-upload adds 0; malformed model output is rejected and surfaced, never written;
tests+typecheck pass; verified live with a real PDF. Schema change: none expected
(installments table already exists) — if you need one, flag it loudly.

>>> STOP-AND-CHECK: do not start Phase 2 (below) until Features 1–3 each have an open
>>> PR. Phase 2 reads the data those features capture.

==== FEATURE 4 — Runway core (the reason this app exists) ====
branch: feat/runway-core
Goal: implement computeRunway in lib/core/runway.ts against its existing type contract
(RunwayInput / RunwayResult with the `timeline` lineage). PURE + deterministic; asOf
is an input, NO Date.now() inside.
Model: starting from liquid cash at asOf, walk events in date order. Liabilities
(installments due, unpaid) are outflows; expected rental income is an INFLOW on its
due date (owner decision). Running balance = cash + cumulative inflows − cumulative
outflows. Report: the date the running balance first goes negative (shortfall date),
the shortfall amount, days-of-runway from asOf to that date, and the full ordered
`timeline` of events with their running balance (this IS the show-your-work).
Tests (hand-verified expected values, in __tests__/runway.test.ts):
- no shortfall (cash always covers);
- exact-zero (balance touches 0 but never goes negative);
- shortfall: correct date AND amount;
- with rental inflows shifting/erasing a shortfall.
Acceptance: tests+typecheck pass. No UI in this PR (pure core only). Schema: none.

==== FEATURE 5 — Runway headline card + show-your-work ====
branch: feat/runway-ui
Goal: the dashboard headline. Read liquid cash (cash accounts where is_liquid),
unpaid installments (liabilities), and expected rent (inflows) from the query layer,
feed computeRunway(asOf = today ISO), and render the headline number. It MUST expand
to the full event timeline from RunwayResult.timeline (each event: date, label,
signed amount, running balance) — rule 2.1. Use the existing dashboard page.
Acceptance: headline matches a hand-checked scenario you entered live; the expansion
lists every event with a correct running balance; tests+typecheck pass; verified live.
Schema: none.

==== FEATURE 6 — 90-day liquidity warning ====
branch: feat/liquidity-warning
Goal: flag when liquid cash + expected inflows < scheduled liabilities within the next
90 days. Prefer a small PURE helper in lib/core/ (given events + asOf + windowDays →
{ breached, shortfallFils, byDate }) with unit tests, then a banner/pill on the
dashboard that expands to show the contributing items. Re-use computeRunway output if
cleaner. Acceptance: tests+typecheck; verified live with a scenario that does and one
that doesn't breach. Schema: none.

==== FEATURE 7 — Metals.dev spot integration ====
branch: feat/metals-spot
Goal: getSpotFilsPerGram(metalType) in lib/integrations/metals.ts using Metals.dev
(METALS_DEV_API_KEY from .env.local; permitted outbound call). Returns fils/gram as
an INTEGER, plus the fetch timestamp. Wire it into commodityValueFils so the
commodities page shows a live value — ALWAYS labelled "as of <timestamp>" with a
staleness indicator (owner decision: live-spot-stamped). The value cell must expand to
the commodityValueFils lineage: weight→grams, purity_fraction, spot fils/gram,
quantity. Keep the network call out of lib/core; core stays pure and takes spot as an
input. Mock the network in tests. Acceptance: a known weight/purity/spot yields the
hand-checked fils value; timestamp+staleness visible; tests+typecheck; verified live
(a mocked or real fetch). Schema: none (or add a tiny price-cache table — flag if so).

==== FEATURE 8 — GoCardless bank balance sync ====
branch: feat/bank-sync
Goal: sync cash-account balances from GoCardless (permitted outbound call). FIRST
verify GoCardless supports the owner's UAE bank(s); if uncertain, STOP and add a
plain-language question to Open Questions rather than guessing. Never log full account
numbers; keys live in .env.local only. Map a synced balance to the existing
cash_accounts row (gocardless_account_id) and stamp last_updated. Acceptance: a synced
balance updates the account and shows fresh staleness; secrets never logged or
committed; tests+typecheck; verified live (sandbox if needed). Schema: likely none
(column exists) — flag if not.

--------------------------------------------------------------------------------
After all 8 PRs are open: post a summary comment listing each PR, what to click to QA
it, and any TASKS.md items still ⬜/⛔ with why. Then wait for the owner's review.
===== END FULL PLAN =====
```

---

## Quick reference — branches in order
1. `feat/commodities`
2. `feat/installment-actions`
3. `feat/pdf-ingestion`  ← finish 1–3 before Phase 2
4. `feat/runway-core`
5. `feat/runway-ui`
6. `feat/liquidity-warning`
7. `feat/metals-spot`
8. `feat/bank-sync`
