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

## Open Questions (for the OWNER — plain language; do not guess)
1. **(P1-OVERDUE)** When an installment's due date passes and it isn't marked paid,
   should the app automatically flip it to "overdue", or only show it as overdue
   when you're looking (computed live)? Both look the same to you; it affects
   whether old data changes by itself.
2. **(P2-RUNWAY)** For the runway calculation, should expected **rental income**
   count as cash coming in on the rent date, or do you prefer runway to ignore
   future income and only count cash you already hold? (Conservative vs realistic.)
3. **(P2-METALS)** Should commodity value use live spot prices automatically, or
   do you want to confirm/freeze a price before it changes your net worth?

## Handoff Notes (append-only, most recent last)
- **2026-06-02 — Claude → DeepSeek.** Scaffold complete on branch
  `phase-1-scaffold`. Properties slice is the reference implementation. Your next
  tasks: P1-API-CASH, P1-UI-CASH, then commodities, then installments, then the
  PDF pipeline. Copy the properties pattern; keep money in fils; run tests. Put
  questions under Open Questions and ping Claude for review when a task hits 🟨.
