# Shared Memory — Claude ⇄ DeepSeek

Persistent working agreement and running log between the architect (Claude) and
the implementer (DeepSeek). **Read this top-to-bottom before writing any code.**
Append to the Decision Log and Handoff Notes; do not rewrite history.

---

## 0. How we work together
- **Claude** owns architecture, the data contracts (schema, Zod, types, pure-fn
  signatures), and review. **DeepSeek** implements against those contracts.
- The contracts below are **frozen**. If you (DeepSeek) believe a contract is
  wrong, do NOT silently change it — add an entry under **Open Questions** and
  flag it; Claude adjusts the contract, then you implement.
- One concern per branch/PR (`feat:`, `fix:`, `test:`). The owner reads git
  history as their audit trail and **cannot read code** — keep commits legible.
- Never commit secrets. `.env.local` is gitignored.

## 1. The prime directive (why this project is unusual)
The owner cannot read code and does QA visually. **A wrong number looks identical
to a right number on screen.** You are the last line of defense against silent
financial bugs. Therefore:
- Tests before "done." Run the full suite after every change.
- Run it live; confirm the actual number. Do not infer correctness by reasoning.
- When financial logic is ambiguous, STOP and ask the owner a *product* question
  in plain language (see Open Questions). Never ask the owner a code question.

## 2. Non-negotiable invariants (do not violate, ever)
1. **Money = integer fils.** 1 AED = 100 fils. All `*_fils` columns/vars are
   integers. Convert only at edges via `lib/core/units.ts` (`aedToFils`/`filsToAed`).
   Never do money math in floating-point AED.
2. **Dates: ISO `YYYY-MM-DD` in DB, UAE `DD/MM/YYYY` at edges.** Always go through
   `parseUaeDateToIso` / `formatIsoToUae`. Never hand-roll date parsing.
3. **Pure core, thin shell.** New math goes in `lib/core/` (no DB, no network) and
   gets hand-checked unit tests. API/DB/UI just wire it up.
4. **Zod gates every write.** Parse with the schemas in `lib/ingest/validate.ts`
   before any DB call. Reject invalid input; never persist it.
5. **Parameterized SQL only.** Use the helpers in `lib/db/queries.ts`. Never
   string-interpolate user input into SQL.
6. **Show your work (rule 2.1).** Every displayed computed number must expand to
   its raw inputs. Use the `<details class="work">` pattern.
7. **Chatbot is read-only (Phase 3).** Use `lib/db/readonly.ts`; query only `v_*`
   views; validate SQL is SELECT-only. Never expose secrets.
8. **Outbound calls are whitelisted** (rule 2.4): Claude API, Metals.dev,
   GoCardless, DLD/Dubai REST. Nothing else leaves the machine.

## 3. Frozen contracts (build against these)
- **Types:** `lib/types.ts`
- **Zod input schemas:** `lib/ingest/validate.ts`
  - `PropertyInputSchema`, `InstallmentInputSchema`, `CashAccountInputSchema`,
    `CommodityInputSchema`, `ParsedScheduleSchema`
  - Forms submit **AED decimals** and **UAE dates**; the query layer converts.
- **DB write/read helpers:** `lib/db/queries.ts` (`insertProperty`, `insertInstallment`,
  `insertCashAccount`, `insertCommodity`, `insertTransactionDeduped`, `list*`).
- **Pure math (done):** `units`, `dedup`, `ledger.checkDoubleEntry`,
  `valuation.commodityValueFils`.
- **Pure math (stubbed — implement against signature):** `valuation.liquidationValueFils`,
  `runway.computeRunway` (note the `RunwayResult.timeline` lineage shape).
- **Reference vertical slice to copy:** `app/api/properties/route.ts`,
  `app/(dashboard)/properties/PropertyForm.tsx`, `app/(dashboard)/properties/page.tsx`.

## 4. Data model quick reference
- 3 asset classes: **Property** (`off_plan`|`existing`, `is_rental`), **Cash**
  (`is_liquid`), **Commodities** (weight+unit+`purity_fraction`+type).
- **Installments** are a shared table fed by manual form AND the PDF pipeline.
  Status is explicit: `upcoming` | `paid` | `overdue`.
- `transactions.dedup_hash` is UNIQUE → re-ingest is a no-op.

## 5. Definition of done — see docs/TASKS.md (CLAUDE.md §8). All 5 must hold.

## 6. Autonomous full-plan run (NEW WORKING MODE — read this)
The owner no longer wants a stop-and-review handshake between every task. **You
(DeepSeek) implement the whole remaining plan yourself, one feature at a time, and
the owner reviews everything at the end.** Discipline replaces the per-task gate:

- **One major feature = one branch = one PR.** Never pile two features into one PR.
  Branch names: `feat/<feature>` (e.g. `feat/commodities`, `feat/pdf-ingestion`,
  `feat/runway`). Open the PR, then move to the next feature on a fresh branch off
  the latest `main`. The PR list IS the owner's review queue.
- **Order is fixed** — see "Build order" in `docs/DEEPSEEK_PROMPTS.md`. Do not skip
  ahead; later features depend on earlier ones.
- **Self-verification is now your only safety net** (no per-task human review until
  the end). For every feature, before opening the PR: `npm run typecheck` clean,
  `npm test` green, AND you ran it live (`npm run dev`) and confirmed the actual
  numbers/behavior — not reasoned about them. State this explicitly in the PR body.
- **Contracts are still frozen.** If something forces a contract change, STOP that
  one feature, write it under Open Questions, mark the task ⛔ in TASKS.md, and keep
  building the other features that aren't blocked. Never silently edit a contract.
- **Schema changes need `npm run db:reset`** (no migrations in Phase 1; it wipes the
  local DB). If a feature changes `schema.sql`, say so loudly in the PR body so the
  owner knows their local data resets.
- **Update the tracker as you go:** flip the task's Status in `docs/TASKS.md` within
  the same PR (🟦 in progress → 🟨 in review when the PR opens), and append a one-line
  Handoff Note here per feature so the trail stays legible.
- **Do NOT start Phase 2 features until all Phase 1 features have open PRs.** Phase 1
  is the data-in foundation; Phase 2 (runway/metals/bank) reads that data.

---

## Decision Log (append-only)
- **2026-06-02 — Claude.** 3 asset classes confirmed by owner (not 4): Property
  (off_plan/existing), Cash, Commodities. Off-plan keeps an installment schedule.
- **2026-06-02 — Claude.** Commodities tracked by weight + unit + purity + type
  (owner choice), so live spot valuation is possible later.
- **2026-06-02 — Claude.** Installments come from BOTH manual form and PDF pipeline,
  one shared table (owner choice).
- **2026-06-02 — Claude.** Overdue is an explicit stored status `upcoming|paid|overdue`
  (owner choice). NOTE for P1-OVERDUE: confirm with owner whether status is mutated
  by a job or derived on read before implementing.
- **2026-06-02 — Claude.** Money stored as integer fils; dates ISO in DB. Architectural,
  not owner-facing.
- **2026-06-02 — Owner QA → Claude.** Property form refined: added `property_type`
  enum (`apartment|penthouse|townhouse|villa`; new DB column + view + Zod), surfaced
  "Value when bought" (`purchase_price_aed`), relabeled Subcategory → "Existing / Off-plan".
  Built the off-plan payment-schedule reference slice (InstallmentForm + /api/installments).
  Schema changed → requires `npm run db:reset` (no migrations in Phase 1; wipes local data).
- **2026-06-02 — Owner QA → Claude.** Property form: "Existing" option no longer says
  "(rental)"; added `city` column/field; **renamed `monthly_rent` → `annual_rent` through
  the whole stack** (UAE rents are quoted yearly) — column, type, Zod, query, label
  "Yearly rent (AED)". Rent input is now conditional: only shown after the "rented out"
  checkbox is ticked, and `annual_rent` is forced null when not rented. Schema changed →
  `npm run db:reset` required.
- **2026-06-02 — Claude review.** Cash slice (P1-API-CASH, P1-UI-CASH) implemented by
  DeepSeek, reviewed: faithful to the property reference, contracts unchanged, fils
  conversion correct in the query layer, show-your-work present, typecheck clean, 24
  tests green. Shipped as its own PR (`feat/cash-accounts`, PR #1).
- **2026-06-02 — Owner decision (resolves Open Q#1, P1-OVERDUE): COMPUTE OVERDUE ON
  READ.** Do NOT mutate stored status. `installments.status` holds only `upcoming|paid`
  as set by the user; "overdue" is DERIVED at read time by a pure helper
  (`lib/core/installments.ts → installmentStatus(installment, asOfIso)` →
  `upcoming|paid|overdue`, where overdue = due_date < asOf AND not paid). No jobs, no
  self-changing data. The DB CHECK still allows `overdue` (a user may also set it
  explicitly), but the app never writes it automatically.
- **2026-06-02 — Owner decision (resolves Open Q#2, P2-RUNWAY): COUNT RENTAL INCOME AS
  INFLOW.** Runway = liquid cash + expected inflows (incl. rent arriving on its due
  date) − scheduled liabilities, per CLAUDE.md Phase 2. Rent events MUST appear as
  positive line items in the `RunwayResult.timeline` show-your-work lineage so the owner
  sees exactly which future income was assumed.
- **2026-06-02 — Owner decision (resolves Open Q#3, P2-METALS): LIVE SPOT, STAMPED.**
  Commodity value updates automatically from the latest Metals.dev spot price, always
  displayed with an "as of <timestamp>" label and a staleness indicator. Store the
  fetch timestamp alongside any cached price. Never show a metal value without its
  as-of time.

## Open Questions (for the OWNER — plain language; do not guess)
_All three Phase-1/2 blocking questions have been answered by the owner (2026-06-02)
and moved to the Decision Log above: overdue=compute-on-read, runway=count rent inflow,
metals=live-spot-stamped. No open questions remain. If you hit a NEW ambiguity, append
it here, mark the affected task ⛔ in TASKS.md, and keep going on everything else._

1. ~~(P1-OVERDUE) auto-flip vs compute-on-read~~ → **RESOLVED: compute on read.**
2. ~~(P2-RUNWAY) count rental income as inflow?~~ → **RESOLVED: yes, count it.**
3. ~~(P2-METALS) live spot vs frozen price?~~ → **RESOLVED: live spot, stamped.**

## Handoff Notes (append-only, most recent last)
- **2026-06-02 — Claude → DeepSeek.** Scaffold complete on branch
  `phase-1-scaffold`. Properties slice is the reference implementation. Your next
  tasks: P1-API-CASH, P1-UI-CASH, then commodities, then installments, then the
  PDF pipeline. Copy the properties pattern; keep money in fils; run tests. Put
  questions under Open Questions and ping Claude for review when a task hits 🟨.
- **2026-06-02 — DeepSeek → Claude.** Cash slice delivered (Task 1). Reviewed and
  shipped as PR #1 `feat/cash-accounts`.
- **2026-06-02 — Claude → DeepSeek (MODE CHANGE).** New working mode: implement the
  full remaining plan autonomously, one feature per PR, owner reviews at the end
  (see §6 above). All three blocking product questions are answered (see Decision
  Log). The single big prompt with the fixed build order + per-feature acceptance
  criteria is in `docs/DEEPSEEK_PROMPTS.md`. Build order: Commodities → Installment
  actions (edit/mark-paid/delete) + overdue helper → PDF ingestion → [Phase 2]
  runway core → runway UI → 90-day warning → metals → bank. One PR each. Keep tests
  green and verify live before every PR.
