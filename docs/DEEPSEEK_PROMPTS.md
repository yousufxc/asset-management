# DeepSeek Prompts (copy-paste, one task at a time)

How to use this file:
1. Send the **STANDARD PREAMBLE** once at the start of a DeepSeek session.
2. Then paste **one task prompt** (everything between `===== BEGIN =====` and
   `===== END =====`). Do one task per branch/PR. Wait for it to finish, then
   Claude reviews before you send the next.
3. Order: **Task 1 (Cash) → Task 2 (Commodities) → Task 3 (PDF pipeline).**
   Task 4 (Overdue) is **blocked** until the owner answers a question — don't send it yet.

---

## STANDARD PREAMBLE (send first, every session)

```
You are the implementer on a local-first, single-user personal finance app
(AED currency). An architect (Claude) has scaffolded the project and frozen the
contracts you must build against. You CANNOT change the contracts; if one seems
wrong, stop and say so instead of changing it.

Before writing any code, read these files in full:
- CLAUDE.md                  (project rules — these override everything)
- docs/ARCHITECTURE.md       (the 5 load-bearing decisions)
- docs/SHARED_MEMORY.md      (invariants, frozen contracts, decision log)
- docs/TASKS.md              (task tracker)
- The reference implementation you will mirror:
    app/api/properties/route.ts
    app/(dashboard)/properties/PropertyForm.tsx
    app/(dashboard)/properties/page.tsx
    app/(dashboard)/properties/InstallmentForm.tsx

Hard rules (non-negotiable):
- Money is INTEGER FILS everywhere (1 AED = 100 fils). Never do money math in
  floats. Convert AED<->fils only via lib/core/units.ts. The DB columns are *_fils.
- Dates: store ISO YYYY-MM-DD; accept UAE DD/MM/YYYY at the edges via
  lib/core/units.ts (parseUaeDateToIso / formatIsoToUae). Never hand-roll dates.
- Validate EVERY write with the Zod schema in lib/ingest/validate.ts before any DB
  call. Reject invalid input (HTTP 400); never persist unvalidated data.
- Use the parameterized helpers in lib/db/queries.ts. Never string-build SQL.
- Every displayed computed number must be expandable to its raw inputs
  ("show your work") — use the <details class="work"> pattern from the reference.
- Pure logic goes in lib/core/ (no DB, no network) with hand-checked unit tests.

Workflow:
- One concern per branch (feat:/fix:/test:). Small commits; the owner reads git
  history and cannot read code.
- Run `npm test` and `npm run typecheck` after every change; both must pass.
- Run the app live (`npm run dev`) and confirm the ACTUAL output before saying done.
- If a financial behavior is ambiguous, STOP and write a plain-language product
  question under "Open Questions" in docs/SHARED_MEMORY.md. Do not guess.

Reply "ready" when you have read everything, and I'll send the first task.
```

---

## TASK 1 — Cash accounts (data entry)  [TASKS: P1-API-CASH + P1-UI-CASH]

```
===== BEGIN TASK 1: CASH =====
Goal: ship the Cash data-entry page, mirroring the Property reference slice exactly.

Frozen contract (already exists — do not modify):
- Zod:   CashAccountInputSchema in lib/ingest/validate.ts
         fields: label (req), bank_name?, account_type? (current|savings|fixed_deposit|other),
                 current_balance_aed (number, default 0), is_liquid (bool, default true),
                 last_updated? (UAE date), notes?
- Query: insertCashAccount(input), listCashAccounts() in lib/db/queries.ts
- Type:  CashAccount in lib/types.ts (balance stored as current_balance_fils)

Build:
1. app/api/cash/route.ts
   - Copy app/api/properties/route.ts EXACTLY in structure.
   - GET -> { accounts: listCashAccounts() }.
   - POST -> parse body with CashAccountInputSchema; 400 with issues on failure;
     else insertCashAccount(parsed.data); return { account } status 201.

2. app/(dashboard)/cash/CashForm.tsx  (client component, mirror PropertyForm.tsx)
   - Fields: label*, bank_name, account_type (dropdown: Current/Savings/Fixed deposit/Other),
     current_balance_aed (number step 0.01), last_updated (DD/MM/YYYY), is_liquid checkbox
     (default checked; label "Counts as liquid cash for runway"), notes.
   - UX detail: when account_type = "fixed_deposit", default is_liquid to UNCHECKED
     (FDs are usually not instantly liquid) — but let the user override.
   - POST to /api/cash; surface server validation errors; router.refresh() on success.

3. app/(dashboard)/cash/page.tsx  (replace the current stub)
   - Server component, `export const dynamic = "force-dynamic"`.
   - Render <CashForm/> then a table: Label | Bank | Type | Balance | Liquid? | Freshness.
   - Format money with formatAed (lib/core/units.ts). Show "last updated N days ago"
     staleness (reuse the daysSince helper pattern from properties/page.tsx).
   - Header card "show your work": total balance = sum of all; liquid total = sum where
     is_liquid; render both with an expandable <details class="work"> listing each account's
     contribution. (This is the figure the runway will consume later.)

Acceptance criteria:
- Adding an account persists and appears in the list with correct AED formatting.
- A fixed-deposit defaults to non-liquid; user can re-check it.
- Bad input (e.g. missing label) returns 400 and the form shows the error.
- npm test + npm run typecheck pass; you ran it live and confirmed the totals.
- No new pure math is needed; if you add any, put it in lib/core/ with a unit test.
===== END TASK 1: CASH =====
```

---

## TASK 2 — Commodities (data entry)  [TASKS: P1-API-COMMODITIES + P1-UI-COMMODITIES]

```
===== BEGIN TASK 2: COMMODITIES =====
Goal: ship the Commodities data-entry page (physical precious metals), mirroring
the Property reference slice.

Frozen contract (already exists — do not modify):
- Zod:   CommodityInputSchema in lib/ingest/validate.ts
         fields: name*, metal_type* (gold|silver|platinum|palladium|other),
                 weight* (>0), weight_unit* (gram|kg|troy_oz|tola),
                 purity_fraction* (0..1), form? (bar|coin|jewelry|other),
                 quantity (int>=1, default 1), storage_location?,
                 acquisition_price_aed?, manual_value_aed?, valued_at? (UAE date), notes?
- Query: insertCommodity(input), listCommodities() in lib/db/queries.ts
- Helper: karatToFraction(karat) in lib/core/units.ts
- Math (already implemented + tested): commodityValueFils(...) in lib/core/valuation.ts
  (live spot pricing is Phase 2; do NOT call a network here).

Build:
1. app/api/commodities/route.ts — same pattern as properties route (GET list, POST validated).

2. app/(dashboard)/commodities/CommodityForm.tsx (client, mirror PropertyForm.tsx)
   - name*, metal_type dropdown*, weight* + weight_unit dropdown*, form dropdown,
     quantity (default 1), storage_location, acquisition_price_aed, valued_at (DD/MM/YYYY), notes.
   - PURITY input UX (important): the contract stores purity_fraction (0..1). Let the user
     enter purity the natural way and CONVERT before sending:
       * Provide a "Purity" dropdown with common presets that map to a fraction:
         24K (1.0), 22K (0.9167), 21K (0.875), 18K (0.75), .999 (0.999), .925 sterling (0.925),
         plus "Custom…".
       * On "Custom…", show a number input for a fraction 0–1.
     The payload must send purity_fraction as a number in (0,1]. Use karatToFraction
     for the karat presets so the mapping is consistent with core.
   - POST to /api/commodities; surface errors; refresh on success.

3. app/(dashboard)/commodities/page.tsx (replace stub)
   - Table: Name | Metal | Weight | Purity (% ) | Qty | Storage.
   - Until the Phase-2 spot feed exists there is NO live value; do NOT invent a price.
     If manual_value_fils is set, you MAY show it labeled "manual value (AED)".
   - Where you later show a computed value, it must expand to show:
     weight→grams, purity_fraction, spot, quantity (the commodityValueFils lineage).

Acceptance criteria:
- Adding e.g. "1kg PAMP gold bar", gold, 1 kg, 24K -> stored with purity_fraction = 1.0.
- A 22K entry stores ~0.9167 (via karatToFraction), NOT 22.
- Bad input returns 400; npm test + typecheck pass; verified live.
===== END TASK 2: COMMODITIES =====
```

---

## TASK 3 — PDF → installment-schedule ingestion  [TASKS: P1-PDF-1/2/3 + P1-TEST-PDF]

```
===== BEGIN TASK 3: PDF INGESTION =====
Goal: implement the SPA-PDF pipeline that turns an off-plan Sale & Purchase
Agreement into validated installments. Follow CLAUDE.md §6 exactly.

Dependencies to add: `pdf-parse` (local PDF text extraction) and
`@anthropic-ai/sdk` (Claude parsing). ANTHROPIC_API_KEY comes from .env.local.

Implement the existing stubs:
1. lib/ingest/pdf-to-markdown.ts -> pdfToMarkdown(filePath): read the PDF LOCALLY with
   pdf-parse, return clean markdown. Strip repeated headers/footers/page numbers and
   collapse whitespace. NO network here. Never send a raw PDF downstream.

2. lib/ingest/parse-claude.ts -> parseScheduleFromMarkdown(markdown): call the Claude API
   with a STRICT instruction to return JSON ONLY (no prose, no code fences) matching
   ParsedScheduleSchema { property_name?, developer?, installments:[{due_date(ISO),
   amount_aed, milestone_label?}] }. Parse the response with ParsedScheduleSchema
   (lib/ingest/validate.ts). On parse/validation failure, throw with the raw text
   attached for manual review — NEVER write unvalidated data. (This is a permitted
   outbound call per CLAUDE.md rule 2.4.)

3. app/api/ingest/spa/route.ts (new): multipart upload of one PDF + a property_id.
   Steps: save file to uploads/ -> pdfToMarkdown -> parseScheduleFromMarkdown ->
   for each parsed installment, convert amount_aed->fils and insert as an installment
   for that property (source='pdf', source_file=<filename>). Return a summary:
   { inserted, skipped, property_id }. On any failure, return 422 with the reason and
   write nothing.

4. IDEMPOTENCY (ask Claude to confirm the rule before coding): re-uploading the same SPA
   must NOT duplicate installments. Proposed rule: skip an installment if one already
   exists with the same (property_id, due_date, amount_fils). If you think a different
   key is better, raise it in docs/SHARED_MEMORY.md Open Questions first.
   NOTE: this differs from bank-statement dedup (transactions.dedup_hash), which already
   exists — do not confuse the two.

5. A minimal upload UI: a file input + property selector on the Property page (or a new
   /ingest page) that POSTs to /api/ingest/spa and shows the inserted/skipped summary.

Tests (P1-TEST-PDF), MOCK the Claude call (no real network in tests):
- ParsedScheduleSchema rejects malformed JSON / missing fields.
- Given a known parsed schedule, amounts convert to correct fils and dates stay ISO.
- Re-running the same insert is idempotent (0 duplicates) per the agreed rule.
- A DD/MM date anywhere in the path resolves correctly (regression guard).

Acceptance criteria:
- A sample SPA PDF produces a correct installment schedule visible on the Property page.
- Re-uploading the same PDF adds 0 installments.
- Malformed model output is rejected and surfaced, never written.
- npm test + typecheck pass; verified live with a real PDF.
===== END TASK 3: PDF INGESTION =====
```

---

## TASK 4 — Overdue status  [TASKS: P1-OVERDUE]  ⛔ BLOCKED

Do **not** send this until the owner answers Open Question #1 in
`docs/SHARED_MEMORY.md` (auto-flip to "overdue" vs compute-on-read). The prompt
will be written once the behavior is decided, because the two answers produce
materially different code (a scheduled/loading mutation vs a pure read-time helper).
