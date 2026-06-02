# Architecture (Phase 1 scaffold)

> Authoritative source of *intent*. CLAUDE.md is the source of *rules*. Where this
> doc and CLAUDE.md disagree, CLAUDE.md wins.

## Shape
Single Next.js 15 app (App Router, TypeScript), one process, **SQLite in-process**
via Node's built-in `node:sqlite` (synchronous, WAL). No separate backend, no
second DB engine, and **no native module to compile** — chosen over better-sqlite3
because it works on Node 26 out of the box and can't break on a Node upgrade.

```
lib/core/    PURE functions only — no DB, no network. The testable heart.
lib/db/      thin SQLite layer: client (RW), readonly (chatbot), schema.sql, queries
lib/ingest/  PDF -> markdown -> Claude -> Zod-validated JSON -> dedup -> balance check
lib/integrations/  outbound APIs (metals, gocardless, uae-valuation) — Phase 2/3
app/(dashboard)/   the daily-driver UI (Dashboard, Property, Cash, Commodities)
app/api/     thin routes: parse body with Zod -> call lib/db/queries -> JSON
__tests__/   mirrors lib/core + DB integrity tests
```

## The five load-bearing decisions

1. **Money is integer fils, never floats.** 1 AED = 100 fils. Every `*_fils`
   column is an INTEGER. Convert AED↔fils only at the edges via
   `lib/core/units.ts`. This makes the double-entry check exact and kills an
   entire class of silent rounding bugs the owner cannot see.

2. **Dates are ISO `YYYY-MM-DD` in the DB; UAE `DD/MM/YYYY` only at the edges.**
   `parseUaeDateToIso` / `formatIsoToUae` are the single guard against the
   DD/MM-vs-MM/DD bug. There is an explicit test for it.

3. **Pure core, thin shell (rule 2.3).** All math (valuation, runway, dedup,
   units, ledger) lives in `lib/core/` and is unit-tested with hand-checked
   numbers. DB/API/UI are dumb wrappers. This is what makes self-verification
   possible without a human code reviewer.

4. **Zod gates every write (rule §3).** API routes and the PDF pipeline parse
   input through schemas in `lib/ingest/validate.ts` before any DB call. Invalid
   data is rejected, never written.

5. **Read-only chatbot is structural (rule 2.5).** `lib/db/readonly.ts` opens a
   `readonly: true` handle; the chatbot only ever sees the `v_*` sanitized VIEWS;
   API keys live in `.env.local`, never in the DB. Three independent layers.

## Data model (3 asset classes)
- **Property** (`properties`) — subcategory `off_plan` | `existing`; `is_rental` flag.
  - **Installments** (`installments`) — shared schedule fed by manual form AND the
    PDF pipeline. Status: `upcoming` | `paid` | `overdue` (explicit, stored).
- **Cash** (`cash_accounts`) — the liquid pool for runway; `is_liquid` flag.
- **Commodities** (`commodities`) — physical metals by weight + unit + purity_fraction + type.
- **Ingestion** (`statements`, `transactions`) — `transactions.dedup_hash` is UNIQUE.

## Show your work (rule 2.1)
Every displayed computed number must expand to its raw inputs. The pattern is the
`<details class="work">` block — see `app/(dashboard)/properties/page.tsx` (installment
schedule) and the dashboard runway-inputs block. Valuation/runway functions return
a lineage object alongside the number for exactly this reason.

## What's implemented vs stubbed in this scaffold
- **Implemented + tested:** units, dedup, ledger (double-entry), commodity valuation,
  schema + WAL client, read-only handle, query layer, Zod schemas, properties
  vertical slice (API + form + list), dashboard snapshot.
- **Stubbed (throw "not implemented"):** runway, liquidation, PDF pipeline steps,
  all integrations, cash & commodities UI. These are DeepSeek's tasks — see
  `docs/TASKS.md`.

## Run
```
npm install
npm run dev        # http://localhost:3000
npm test           # vitest
npm run typecheck
npm run db:reset   # wipe + recreate local DB from schema.sql
```
