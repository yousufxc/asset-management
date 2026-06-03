# CLAUDE.md — Liquidity & Asset Orchestration Platform

This file governs how you (Claude Code) build and maintain this project. Read it fully before writing any code. It is the source of truth for architecture, constraints, and working style. When something here conflicts with your default instincts, this file wins.

---

## 0. What this is

A **private, local-first, single-user** tool for managing a personal multi-asset portfolio with a **liquidity-first** lens. The owner holds 30+ assets, ~70%+ of which are UAE property (rental + off-plan), plus physical precious metals and cash across bank accounts. Everything is denominated in **AED (single currency)**.

The system exists to answer **one core question** above all others:

> *"On a given future date, do I have enough liquid cash to cover what I owe — and if not, how far short am I and how many days do I have?"*

Net-worth tracking, concentration analysis, and "which asset to sell" optimization are all **secondary** to that runway question. Build in that priority order. Do not let breadth dilute the core.

---

## 1. The owner cannot read code

This is the single most important fact about this project. The owner is directing the build through **product decisions and visual QA only**. They will not review diffs, read functions, or catch logic bugs by eye.

This has hard consequences you must internalize:

- **Visual QA cannot catch invisible bugs.** A dashboard that displays a wrong number looks identical to one that displays a right number. The dangerous failures here are silent: a dropped transaction, a date parsed as MM/DD instead of DD/MM, money double-counted, a dedup hash collision. You are the only line of defense against these.
- **You are author AND reviewer.** There is no second human checking you. Compensate with discipline: small changes, tests first, and verifying your own work by running it — not by reasoning about it.
- **When you are uncertain about a financial calculation, stop and ask the owner in plain language**, framed as a product question, never as a code question. Example: "When an off-plan installment is overdue, should it still count against current liquidity, or move to a separate 'overdue' bucket?" — not "should `status === 'PENDING'` include past-due rows?"

---

## 2. Non-negotiable rules

These are hard rules. Do not relax them to make progress faster.

### 2.1 Every number must be explainable ("show your work")
Any computed figure shown in the UI — runway, net worth, liquidation value, runway gap — **must be expandable to reveal the raw inputs that produced it.** This is both a UX feature and your debugging safety net. If you compute `runway = 47 days`, the user must be able to click and see: current cash, the list of upcoming liabilities with dates and amounts, and the arithmetic. No number appears without a traceable lineage.

### 2.2 Data-integrity tests are mandatory before moving on
No feature that touches money is "done" until it has automated tests. At minimum:
- **Double-entry balance check**: for any ingested statement, `opening + sum(credits) − sum(debits) == closing` (within 0.01 tolerance).
- **Dedup correctness**: re-ingesting the same statement adds zero new rows.
- **Date parsing**: explicit tests that DD/MM vs MM/DD is handled correctly for the owner's locale (UAE → DD/MM/YYYY).
- **Pure-function math**: every valuation/runway formula has unit tests with hand-checked expected values.
Run the test suite after every change. Do not report a feature complete if tests fail.

### 2.3 Pure core, thin shell
All real logic — valuation math, runway calculation, dedup hashing, currency-unit conversion — lives in **pure functions** in `lib/core/` with no database access and no network calls. They take inputs, return outputs, and are trivially testable. The database layer and API routes are thin wrappers that call these functions. This separation is what makes the tests meaningful and what lets you verify your own work.

### 2.4 Financial data never leaves the machine except where explicitly required
The only outbound calls permitted are: (a) Claude API for PDF parsing, (b) Metals.dev for spot prices, (c) the chosen UAE valuation source. Never log full account numbers, never put financial data in URL query strings, never send portfolio data anywhere not on this list. (Automated bank-balance sync via GoCardless was removed 2026-06-02 — cash is entered manually.)

### 2.5 The chatbot is read-only, structurally
When the conversational query feature is built, the database connection it uses **must be physically incapable of writing.** Open a separate read-only SQLite handle for it. Additionally, parse every generated SQL string through a validator that rejects anything but SELECT (block DROP/DELETE/UPDATE/ALTER/INSERT/ATTACH/PRAGMA). Never expose tables holding API keys or credentials to the query layer — use sanitized views.

---

## 3. Architecture

**Single Next.js app (App Router, TypeScript). One process. SQLite in-process.** No separate backend, no DuckDB, no Postgres.

Why each choice (so you don't "improve" it into complexity):
- **SQLite only** — the dataset is ~30 assets and a few thousand transactions. DuckDB and Postgres earn their keep at millions of rows and multi-user concurrency; neither applies. A second engine would only add a place for bugs to hide. If this ever becomes multi-user SaaS, migrate to Postgres *then*, not now.
- **Next.js single codebase** — fewer moving parts than a split frontend/backend for a local single-user tool: one process to run, one dependency tree, no CORS, computation lives next to display (which serves rule 2.1).
- **Validation: Zod** (the TypeScript equivalent of the Pydantic models in the research). Every parsed/ingested object is validated against a Zod schema before any DB write. No exceptions.

```
asset-platform/
├── CLAUDE.md                  # this file
├── README.md                  # human-facing setup + run instructions
├── .env.local                 # API keys (gitignored, never committed)
├── .env.example               # template showing required keys, no values
├── package.json
├── data/
│   └── portfolio.db           # SQLite file (gitignored)
├── lib/
│   ├── core/                  # PURE functions only — no db, no network
│   │   ├── valuation.ts       # metals, property, net liquidation value
│   │   ├── runway.ts          # liquidity coverage horizon, gap calc
│   │   ├── dedup.ts           # stable transaction hashing
│   │   └── units.ts           # weight + currency-unit conversions
│   ├── db/
│   │   ├── client.ts          # SQLite connection (WAL mode)
│   │   ├── readonly.ts        # separate read-only handle for chatbot
│   │   ├── schema.sql         # table definitions
│   │   └── queries.ts         # parameterized query helpers
│   ├── ingest/
│   │   ├── pdf-to-markdown.ts # strip PDF → clean .md locally (pre-LLM)
│   │   ├── parse-claude.ts    # send markdown to Claude → structured JSON
│   │   └── validate.ts        # Zod schemas + double-entry check
│   └── integrations/
│       ├── metals.ts          # Metals.dev spot prices
│       └── uae-valuation.ts   # property AVM (see §5)
├── app/
│   ├── api/                   # thin routes — call lib/, return JSON
│   ├── (dashboard)/           # the daily-driver UI
│   └── ...
└── __tests__/                 # mirrors lib/core and lib/ingest
```

---

## 4. Build phases (ship in this order)

Build **incrementally, one feature per branch/PR.** Do not start a phase until the previous one is tested and the owner has visually signed off. There is no throwaway v0 — every phase ships something the owner can actually use.

**Phase 1 — Foundation & data in**
- Repo, project scaffold, Next.js app running locally, SQLite schema + WAL.
- Manual data-entry UI for all four asset classes (functional before pretty).
- PDF → markdown → Claude → Zod-validated installment schedule for off-plan SPAs.
- Tests: schema integrity, dedup, double-entry, date parsing.

**Phase 2 — The core dashboard (the reason this exists)**
- **Cash runway**: the headline number, with full show-your-work expansion.
- **Installment timeline**: what's due, when, how much, across all properties.
- **Liquidity warning**: flag when liquid cash + expected inflows < scheduled liabilities over the next 90 days.
- Metals spot integration (Metals.dev). (Cash balances are entered manually — no bank sync.)

**Phase 3 — Intelligence layer**
- Read-only Text-to-SQL chatbot (see §2.5 — read-only is non-negotiable).
- Health diagnostics: concentration warnings, valuation staleness alerts.
- Action-items panel: e.g. "AED 180k due in 6 weeks; current liquid position covers 60%."
- UAE approximate AVM (see §5).

**Phase 4 — Post-MVP**
- "Which asset should I sell?" liquidation optimizer.
- RAG over SPA documents for contract-term questions.
- Net-worth-over-time and trend charts.

---

## 5. UAE-specific reality (do not assume US tooling)

The original research assumed **RentCast**, which is **US-only and useless here.** Do not use it. For UAE property valuation:

- **Phase 1–2**: property values are **manual inputs**, each stamped with a "last valued" date. The UI must surface staleness ("last updated 47 days ago"). Cash-flow and installment tracking — the core of this tool — do **not** depend on valuation accuracy, so this is not a blocker.
- **Phase 3**: add approximate automated AVM. Preferred source is **Dubai Land Department (DLD) / Dubai REST** open transaction data — compute a rough estimate as (median price per sqft for the area) × (property sqft). It is official and free but lags by weeks; label it as approximate. Property Monitor offers a paid professional UAE AVM if manual updates become painful — flag this to the owner as a decision, do not subscribe to anything autonomously.
- Dates are **DD/MM/YYYY**. Test for this explicitly (§2.2).

---

## 6. The PDF ingestion pipeline (specific)

1. **Local strip**: parse the PDF and convert to clean markdown locally (e.g. `pdf-parse`), discarding layout noise, repeated headers/footers, and page furniture. This minimizes tokens and improves parse accuracy. Never send a raw PDF when clean markdown will do.
2. **Parse**: send the markdown to the Claude API with a strict schema instruction. Ask for valid JSON only, no prose, no markdown fences.
3. **Validate**: parse the JSON against a Zod schema. Reject and surface for manual review on failure — never write unvalidated data.
4. **Dedup**: assign each transaction a stable hash (SHA-256 of `date | normalized-description | signed-amount`). Re-ingesting must add zero duplicates.
5. **Balance check**: run the double-entry check; flag discrepancies for the owner rather than silently accepting.

---

## 7. Working style for you (Claude Code)

- **One feature per branch, one concern per PR.** Small and incremental. The owner's git history is their audit trail since they can't read diffs.
- **Tests before "done."** Write the test, watch it fail, make it pass, run the full suite.
- **Run it, don't reason about it.** Start the dev server, hit the endpoint, check the actual number. Self-verification by execution is your substitute for the missing human reviewer.
- **Conventional commits** (`feat:`, `fix:`, `test:`, `chore:`) so the history is legible to the owner at a glance.
- **Ask product questions in plain language** when financial logic is ambiguous (§1). Never ask the owner a code question.
- **Never commit secrets.** `.env.local` is gitignored; `.env.example` documents required keys with no values.
- **Don't gold-plate.** Resist adding caching, queues, extra engines, or abstractions the current phase doesn't need. Simplicity is a safety feature here, not a compromise.

---

## 8. Definition of done for any money-touching feature

A feature is complete only when **all** of these are true:
1. The pure-function logic lives in `lib/core/` and has unit tests with hand-verified expected values.
2. Every displayed number is expandable to its raw inputs (§2.1).
3. The full test suite passes.
4. You have run it live and confirmed the actual output, not inferred it.
5. The owner has visually signed off.
