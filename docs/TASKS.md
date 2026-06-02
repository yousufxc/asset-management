# Task Tracker

Single source of truth for who-does-what. **DeepSeek implements; owner reviews at the end.**
Update the Status column in your PR. Keep tasks atomic (one concern each).

> **WORKING MODE (2026-06-02):** DeepSeek now implements the **full remaining plan
> autonomously** — one feature per branch/PR, in the fixed build order — and the owner
> reviews all PRs at the end. See `docs/SHARED_MEMORY.md §6` for the rules and
> `docs/DEEPSEEK_PROMPTS.md` for the single big prompt. All blocking product questions
> are answered (Decision Log). Contracts remain frozen.

Status legend: ⬜ todo · 🟦 in progress · 🟨 in review · ✅ done · ⛔ blocked

Roles:
- **Claude** = architecture, scaffolding, contracts (schema/Zod/types/pure-fn signatures), review.
- **DeepSeek** = implementation against the fixed contracts below.

---

## Phase 1 — Foundation & data in

| ID | Task | Owner | Status | Acceptance criteria |
|----|------|-------|--------|---------------------|
| P1-ARCH | Scaffold app, schema+WAL, pure core, tests, properties reference slice | Claude | ✅ | App boots, `npm test` green, `npm run typecheck` clean |
| P1-UI-CASH | Cash data-entry form + list page | DeepSeek | 🟨 | Mirror `/properties`. POST `/api/cash` gated by `CashAccountInputSchema`. Show-your-work + "last updated N days ago" staleness. No raw SQL; use `insertCashAccount`/`listCashAccounts`. **Done — PR #1, reviewed by Claude.** |
| P1-API-CASH | `app/api/cash/route.ts` (GET+POST) | DeepSeek | 🟨 | Copy `app/api/properties/route.ts` pattern exactly. 400 on Zod failure. **Done — PR #1, reviewed by Claude.** |
| P1-UI-COMMODITIES | Commodities form + list page | DeepSeek | ⬜ | Capture metal_type, weight+unit, purity (accept karat → `karatToFraction`), form, quantity, storage. POST `/api/commodities` gated by `CommodityInputSchema`. |
| P1-API-COMMODITIES | `app/api/commodities/route.ts` | DeepSeek | ⬜ | Same pattern as properties route. |
| P1-UI-INSTALL | Installment entry form (payment schedule) | Claude | ✅ | Reference built: `InstallmentForm.tsx` on the Property page. DeepSeek follow-up: add edit / mark-paid / delete. |
| P1-API-INSTALL | `app/api/installments/route.ts` | Claude | ✅ | Built. Zod-gated, validates `property_id` exists, returns 400 otherwise. |
| P1-OVERDUE | Derive `overdue` status on read | DeepSeek | ⬜ | **RESOLVED: compute on read, never mutate.** Pure helper `lib/core/installments.ts → installmentStatus(installment, asOfIso)` returns `upcoming\|paid\|overdue` (overdue = due_date < asOf AND not paid). Unit-tested. Wire it into the property page schedule + dashboard so overdue shows live. No jobs. |
| P1-PDF-1 | `pdfToMarkdown` (local strip, `pdf-parse`) | DeepSeek | ⬜ | Local only, no network. Strips headers/footers/page furniture. |
| P1-PDF-2 | `parseScheduleFromMarkdown` (Claude API) | DeepSeek | ⬜ | Uses `ANTHROPIC_API_KEY`. Returns JSON validated by `ParsedScheduleSchema`. No prose/fences. |
| P1-PDF-3 | Ingest endpoint: upload → md → parse → validate → dedup → balance check → write | DeepSeek | ⬜ | Re-ingest adds 0 rows. Failures surfaced for manual review, never written. |
| P1-TEST-PDF | Tests for the PDF pipeline (mock the Claude call) | DeepSeek | ⬜ | Validation rejects bad JSON; dedup proven; date parsing proven. |

## Phase 2 — Core dashboard (DO NOT START until Phase 1 signed off)

| ID | Task | Owner | Status | Acceptance criteria |
|----|------|-------|--------|---------------------|
| P2-RUNWAY | Implement `computeRunway` (`lib/core/runway.ts`) | DeepSeek | ⬜ | Pure, deterministic (no `Date.now()` inside; `asOf` is an input). **RESOLVED: count rental income as an inflow** on its due date; rent events appear as positive items in `RunwayResult.timeline`. Hand-checked unit tests: no shortfall, exact-zero, shortfall date+amount, with rent inflows. |
| P2-RUNWAY-UI | Headline runway card + show-your-work timeline | DeepSeek | ⬜ | Number expands to full event ledger (rule 2.1). |
| P2-WARN | 90-day liquidity warning | DeepSeek | ⬜ | Flags when liquid + inflows < liabilities in window. |
| P2-METALS | Metals.dev `getSpotFilsPerGram` + wire commodity valuation | DeepSeek | 🟨 | Returns fils/gram pure; feeds `commodityValueFils`. **RESOLVED: live spot, stamped.** Always display value with an "as of <timestamp>" label + staleness; store the fetch time; never show a metal value without its as-of time. |
| P2-BANK | GoCardless balance sync | DeepSeek | ⬜ | Verify UAE bank support first; ask owner. |

## Phase 3 / 4
Read-only Text-to-SQL chatbot (rule 2.5), DLD AVM, liquidation optimizer, RAG,
trend charts. Detail these only when Phase 2 is signed off.

---

## Definition of done (every money task) — from CLAUDE.md §8
1. Pure logic in `lib/core/` with hand-verified unit tests.
2. Every displayed number expandable to raw inputs (rule 2.1).
3. Full `npm test` passes.
4. Ran it live and confirmed the actual output.
5. Owner visually signed off.
