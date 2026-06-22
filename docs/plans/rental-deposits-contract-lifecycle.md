# Rental Deposits + Contract Lifecycle + Rental History (v3)

## Overview
Add rental deposit tracking (mark-deposited per cheque with overdue warnings), contract lifecycle management (cancel/renew/vacant with automatic history preservation), and a rental history view per property.

All 11 Claude issues from v1 review addressed. Key architectural changes:
- **Dedicated lifecycle endpoint** instead of overloading PATCH (fixes #5)
- **Upsert sync** preserves deposited status across saves (fixes #1)
- **Remainder distribution** on cheque amounts (fixes #2)
- **Pure core** for deposit schedule generation (fixes #3)
- **Full test plan** covering fils reconciliation, date gen, status preservation (fixes #4)

---

## 1. Data Model

### New table: `rental_deposits`

```sql
DROP VIEW IF EXISTS v_rental_deposits;
CREATE TABLE IF NOT EXISTS rental_deposits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  cheque_number INTEGER NOT NULL,
  deposit_date TEXT NOT NULL,
  amount_fils INTEGER NOT NULL CHECK (amount_fils >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','deposited')),
  deposited_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE VIEW IF NOT EXISTS v_rental_deposits AS
  SELECT id, property_id, cheque_number, deposit_date, amount_fils, status, deposited_date
  FROM rental_deposits;
```

### New table: `rental_history`

```sql
DROP VIEW IF EXISTS v_rental_history;
CREATE TABLE IF NOT EXISTS rental_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  rental_type TEXT NOT NULL,
  annual_rent_fils INTEGER,
  rent_cheques_per_year INTEGER,
  rent_date_1 TEXT, rent_date_2 TEXT, rent_date_3 TEXT, rent_date_4 TEXT,
  pm_company_name TEXT, pm_commission_pct REAL,
  short_term_annual_rent_fils INTEGER,
  short_term_return_frequency TEXT, short_term_rent_deposit_date TEXT,
  contract_start_date TEXT NOT NULL,
  contract_end_date TEXT,
  end_reason TEXT CHECK (end_reason IN ('cancelled','vacant','renewed')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE VIEW IF NOT EXISTS v_rental_history AS
  SELECT id, property_id, rental_type, annual_rent_fils, rent_cheques_per_year,
         rent_date_1, rent_date_2, rent_date_3, rent_date_4,
         pm_company_name, pm_commission_pct, short_term_annual_rent_fils,
         short_term_return_frequency, short_term_rent_deposit_date,
         contract_start_date, contract_end_date, end_reason
  FROM rental_history;
```

### New column on `properties`

```sql
ALTER TABLE properties ADD COLUMN contract_start_date TEXT;
```

Added to `v_properties` view (already uses `*`-style projection from base table).

### Rules
- DROP VIEW before CREATE VIEW (existing pattern: schema.sql:176–202)
- Statements split on `;\n` (existing pattern: client.ts:47 reads the SQL file)
- Read-only chatbot: `readonly.ts` already uses `v_*` views; no change needed since the new views sanitize to non-sensitive columns
- ON DELETE CASCADE: deleting a property deletes its deposits + history

---

## 2. Types (`lib/types.ts`)

```ts
export type RentalDepositStatus = "pending" | "deposited";
export type EndReason = "cancelled" | "vacant" | "renewed";

export interface RentalDeposit {
  id: number;
  property_id: number;
  cheque_number: number;
  deposit_date: string;        // ISO
  amount_fils: number;
  status: RentalDepositStatus;
  deposited_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RentalHistory {
  id: number;
  property_id: number;
  rental_type: RentalType;
  annual_rent_fils: number | null;
  rent_cheques_per_year: number | null;
  rent_date_1: string | null;
  rent_date_2: string | null;
  rent_date_3: string | null;
  rent_date_4: string | null;
  pm_company_name: string | null;
  pm_commission_pct: number | null;
  short_term_annual_rent_fils: number | null;
  short_term_return_frequency: ShortTermReturnFrequency | null;
  short_term_rent_deposit_date: string | null;
  contract_start_date: string;     // ISO
  contract_end_date: string | null;
  end_reason: EndReason | null;
  notes: string | null;
  created_at: string;
}
```

Add `contract_start_date: string | null` to `Property` interface.

---

## 3. Validation (`lib/ingest/validate.ts`)

```ts
// New schemas
export const RentalLifecycleSchema = z.object({
  action: z.enum(["cancel", "vacant", "renew"]),
  // For "renew": optional new rental terms (same fields as PropertyInput rental subset)
  rental_type: z.enum(["long_term", "short_term"]).optional(),
  annual_rent_aed: aedAmount.optional().nullable(),
  rent_cheques_per_year: z.number().int().refine(v => [1,2,4,12].includes(v)).optional().nullable(),
  rent_date_1: dateString.optional().nullable(),
  rent_date_2: dateString.optional().nullable(),
  rent_date_3: dateString.optional().nullable(),
  rent_date_4: dateString.optional().nullable(),
  pm_company_name: z.string().optional().nullable(),
  pm_commission_pct: z.number().min(0).max(100).optional().nullable(),
  short_term_annual_rent_aed: aedAmount.optional().nullable(),
  short_term_return_frequency: z.enum(["monthly", "quarterly"]).optional().nullable(),
  short_term_rent_deposit_date: dateString.optional().nullable(),
  contract_start_date: dateString.optional().nullable(),
});
export type RentalLifecycleAction = z.infer<typeof RentalLifecycleSchema>;

export const RentalDepositUpdateSchema = z.object({
  status: z.enum(["pending", "deposited"]),
  deposited_date: dateString.optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type RentalDepositUpdate = z.infer<typeof RentalDepositUpdateSchema>;
```

Add `contract_start_date: dateString.optional().nullable()` to `PropertyInputSchema` and `PropertyUpdateSchema`.

Add types: `PropertyInput`, `PropertyUpdate` (update inferred types).

---

## 4. Pure Core (`lib/core/rental-deposits.ts`) — NEW

```ts
/**
 * PURE functions for rental deposit schedule generation and status derivation.
 * No DB, no network, no mutations.
 */

import type { Property } from "@/lib/types";

export interface DepositScheduleEntry {
  chequeNumber: number;
  depositDate: string;   // ISO
  amountFils: number;    // never null, >= 0
}

/** 
 * Generate the deposit schedule for a property's current rental config.
 * Distributes the annual rent across cheques (long-term) or periods (short-term),
 * absorbing any remainder in the last entry so sum(amountFils) === annual rent.
 * Skips entries whose source date is null (no NOT NULL violation downstream).
 */
export function generateDepositSchedule(p: Property): DepositScheduleEntry[] {
  if (!p.is_rental) return [];

  if (p.rental_type === "short_term") {
    return generateShortTermSchedule(p);
  }
  return generateLongTermSchedule(p);
}

function generateLongTermSchedule(p: Property): DepositScheduleEntry[] {
  const annual = p.annual_rent_fils;
  const cheques = p.rent_cheques_per_year;
  if (annual === null || annual <= 0 || cheques === null || cheques <= 0) return [];

  // Collect valid (slot-index, date) pairs — skip null dates but use original slot index
  // as cheque_number so upsert matching is stable across saves (fixes review #12)
  const dateKeys = ["rent_date_1", "rent_date_2", "rent_date_3", "rent_date_4"] as const;
  const entries: { slot: number; date: string }[] = [];
  for (let i = 0; i < cheques; i++) {
    const date = p[dateKeys[i] as keyof Property] as string | null;
    if (date) entries.push({ slot: i + 1, date });  // slot = 1..4, fixed
  }

  const n = entries.length;
  if (n === 0) return [];

  const perCheque = Math.floor(annual / n);         // truncate, not round
  const remainder = annual - perCheque * n;          // 0..n-1 fils

  return entries.map((e, i) => ({
    chequeNumber: e.slot,                            // stable original position — fixes #12
    depositDate: e.date,
    amountFils: perCheque + (i === n - 1 ? remainder : 0),  // last absorbs remainder — fixes #2
  }));
}

function generateShortTermSchedule(p: Property): DepositScheduleEntry[] {
  // Computed from `short_term_rent_deposit_date` backward by stepMonths.
  // This is the same logic as runway.ts short-term inflow generation.
  // Past deposit dates are intentionally included (they show as "overdue" or can
  // be marked deposited retroactively for audit).
  //
  // NOTE: uses gross annual rent (short_term_annual_rent_fils), NOT net-after-commission.
  // Deposit cheques represent the gross amount received; commission is a later expense.
  // This is a deliberate product choice: runway.ts uses net for liquidity projections,
  // but deposit tracking uses gross since it's what the PM actually remits.
  const annual = p.short_term_annual_rent_fils;
  const freq = p.short_term_return_frequency;
  const endDate = p.short_term_rent_deposit_date;
  if (annual === null || annual <= 0 || freq === null || !endDate) return [];

  const periodsPerYear = freq === "monthly" ? 12 : 4;
  const stepMonths = freq === "monthly" ? 1 : 3;
  const end = new Date(endDate + "T00:00:00Z");

  // Walk backward from end date, mirroring runway.ts:66-109 short-term logic
  const dates: string[] = [];
  for (let i = periodsPerYear - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCMonth(d.getUTCMonth() - i * stepMonths);
    // Clamp to last day of month if needed (same as runway.ts day-clamping fix)
    const lastDayOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    if (d.getUTCDate() > lastDayOfMonth) d.setUTCDate(lastDayOfMonth);
    dates.push(d.toISOString().slice(0, 10));
  }

  const n = dates.length;
  const perPeriod = Math.floor(annual / n);
  const remainder = annual - perPeriod * n;

  return dates.map((date, i) => ({
    chequeNumber: i + 1,
    depositDate: date,
    amountFils: perPeriod + (i === n - 1 ? remainder : 0),
  }));
}

/** Live deposit status — same semantics as liveInstallmentStatus in property-analytics.ts. */
export function depositStatus(
  deposit: { status: string; deposit_date: string; deposited_date: string | null },
  asOfIso: string,
): "deposited" | "overdue" | "pending" {
  if (deposit.status === "deposited" || deposit.deposited_date !== null) return "deposited";
  if (deposit.deposit_date < asOfIso) return "overdue";
  return "pending";
}
```

---

## 5. Database Queries (`lib/db/queries.ts`)

### Add `contract_start_date` to `insertProperty` and `updateProperty`

The plan already adds the column, type, and Zod field — but `insertProperty` and `updateProperty` use explicit column lists and must be extended:

**`insertProperty`** (queries.ts:34–49): add `contract_start_date` to the INSERT column list and VALUES, gated on `is_rental` (matching the existing rental-field gating pattern):
```
contract_start_date: input.is_rental ? dateOrNull(input.contract_start_date) : null,
```

**`updateProperty`** (queries.ts:95–133): add a branch:
```
if (data.contract_start_date !== undefined) {
  sets.push("contract_start_date = @contract_start_date");
  params.contract_start_date = dateOrNull(data.contract_start_date);
}
```

### New query functions

```ts
// ── RENTAL HISTORY ──────────────────────────────────────────────────────────

export function insertRentalHistory(
  property: Property,
  contractStartDate: string,
  endDate: string | null,
  endReason: EndReason | null,
): RentalHistory { /* INSERT INTO rental_history … */ }

export function listRentalHistory(propertyId: number): RentalHistory[] {
  // ORDER BY contract_start_date DESC
}

export function listAllRentalHistory(): RentalHistory[] {
  // ORDER BY contract_start_date DESC
}

// ── RENTAL DEPOSITS ─────────────────────────────────────────────────────────

export function listRentalDeposits(propertyId: number): RentalDeposit[] {
  // ORDER BY cheque_number ASC
}

export function listAllRentalDeposits(): RentalDeposit[] {
  // ORDER BY property_id, cheque_number ASC
}

export function getRentalDeposit(id: number): RentalDeposit | undefined {
  // SELECT * FROM rental_deposits WHERE id = ?
}

export function markRentalDepositDeposited(id: number): RentalDeposit | undefined {
  // UPDATE SET status='deposited', deposited_date=strftime(…), updated_at=…
}

export function markRentalDepositPending(id: number): RentalDeposit | undefined {
  // UPDATE SET status='pending', deposited_date=NULL, updated_at=…
}

export function deleteRentalDepositsForProperty(propertyId: number): void {
  // DELETE FROM rental_deposits WHERE property_id = ?
}

/**
 * UPSERT deposit schedule into rental_deposits.
 * For each entry that matches an existing row on (property_id, cheque_number),
 * update date & amount but PRESERVE status+deposited_date (fixes #1).
 * Insert new entries for cheque numbers not yet in the table.
 * Delete rows whose cheque_number is no longer in the schedule.
 */
export function upsertRentalDepositSchedule(
  propertyId: number,
  schedule: DepositScheduleEntry[],
): void {
  // 1. Get existing cheque numbers for this property
  // 2. For each entry in schedule:
  //    a. If cheque_number exists: UPDATE deposit_date, amount_fils (leave status untouched)
  //    b. If not: INSERT with status='pending'
  // 3. DELETE rows WHERE property_id = ? AND cheque_number NOT IN (…schedule numbers…)
}
```

---

## 6. API Routes

### New: `app/api/rental-deposits/[id]/route.ts`
PATCH only — marks a deposit as deposited or reverted to pending.

```ts
PATCH:
  const existing = getRentalDeposit(id);
  if (!existing) return 404;
  const parsed = RentalDepositUpdateSchema.safeParse(body);
  if (!parsed.success) return 400;
  if (parsed.data.status === "deposited") {
    const result = markRentalDepositDeposited(id);
    return NextResponse.json({ deposit: result });
  }
  const result = markRentalDepositPending(id);
  return NextResponse.json({ deposit: result });
```

No DELETE (deposits are lifecycle-managed by the system).

### New: `app/api/properties/[id]/rental-lifecycle/route.ts`
POST only — dedicated endpoint for contract lifecycle actions (fixes Claude issue #5: no notes-sniffing, no implicit side-effects).

```ts
POST body: { action: "cancel" | "vacant" | "renew", …renew_fields… }

Algorithm:
  const property = getProperty(id);
  if (!property) return 404;
  const parsed = RentalLifecycleSchema.safeParse(body);
  if (!parsed.success) return 400;
  const { action, ...renewFields } = parsed.data;

  if (action === "renew" && property.is_rental === 0) {
    return 400 "Property is not currently rented — cannot renew";
  }

  const today = new Date().toISOString().slice(0, 10);

  // Always snapshot current rental state to history
  if (property.is_rental) {
    insertRentalHistory(property, property.contract_start_date ?? today, today,
      action === "cancel" ? "cancelled"
      : action === "vacant" ? "vacant"
      : "renewed");
  }

  deleteRentalDepositsForProperty(id);

  if (action === "renew") {
    // Apply new rental terms from renewFields
    updateProperty(id, {
      rental_type: renewFields.rental_type ?? property.rental_type,
      annual_rent_aed: renewFields.annual_rent_aed,
      rent_cheques_per_year: renewFields.rent_cheques_per_year,
      rent_date_1: renewFields.rent_date_1,
      rent_date_2: renewFields.rent_date_2,
      rent_date_3: renewFields.rent_date_3,
      rent_date_4: renewFields.rent_date_4,
      pm_company_name: renewFields.pm_company_name,
      pm_commission_pct: renewFields.pm_commission_pct,
      short_term_annual_rent_aed: renewFields.short_term_annual_rent_aed,
      short_term_return_frequency: renewFields.short_term_return_frequency,
      short_term_rent_deposit_date: renewFields.short_term_rent_deposit_date,
      contract_start_date: renewFields.contract_start_date ?? today,
      is_rental: true,
    });
    const updated = getProperty(id)!;
    const schedule = generateDepositSchedule(updated);
    upsertRentalDepositSchedule(id, schedule);
  } else {
    // cancel / vacant: mark as not rented, clear rental fields to null
    // PropertyUpdateSchema fields are .optional().nullable() — passing null works.
    updateProperty(id, {
      is_rental: false,
      rental_type: null,
      annual_rent_aed: null,
      rent_cheques_per_year: null,
      rent_date_1: null, rent_date_2: null, rent_date_3: null, rent_date_4: null,
      pm_company_name: null,
      pm_commission_pct: null,
      short_term_annual_rent_aed: null,
      short_term_return_frequency: null,
      short_term_rent_deposit_date: null,
      contract_start_date: null,
    });
  }

  return NextResponse.json({ property: getProperty(id) });
```

`contract_start_date` wiring: when is_rental is false, `contract_start_date` is nulled. When rental is set up (via property creation or renewal), default to today if not provided.

### New: `app/api/properties/[id]/rental-history/route.ts`
GET only.

```ts
GET:
  const property = getProperty(id);
  if (!property) return 404;
  const history = listRentalHistory(id);
  return NextResponse.json({ history });
```

### Modified: `app/api/properties/route.ts` — POST (create)
When a property is created with `is_rental: true`, generate its deposit schedule.
```ts
// After insertProperty succeeds:
if (result.is_rental) {
  const schedule = generateDepositSchedule(result);
  upsertRentalDepositSchedule(result.id, schedule);
}
```

### Modified: `app/api/properties/[id]/route.ts` — PATCH
No rental lifecycle logic added (fixes #5). The PATCH route remains a simple property field updater. Contract lifecycle goes through the dedicated endpoint.

However: if the user edits rental fields via the normal edit form (e.g., changes annual_rent_aed without renew/cancel), the PATCH should still **sync deposits** to reflect the new cheque amounts/dates. The PATCH handler does NOT snapshot to history (that's only lifecycle actions), but it DOES:

```ts
// After updateProperty(id, data) succeeds:
const updated = getProperty(id)!;
if (updated.is_rental && /* any rental field was in data */) {
  const schedule = generateDepositSchedule(updated);
  upsertRentalDepositSchedule(id, schedule);  // upsert preserves existing statuses — fixes #1
}
```

On `is_rental` change from 1→0 via PATCH (e.g., user unchecks "rented" in edit form): delete deposits for property. This is a non-lifecycle path (no snapshot) — the user should use the lifecycle buttons for audited contract changes.

### New: `app/api/properties/[id]/rental-deposits/route.ts`
GET only (deposits are managed by PATCH on individual deposit IDs, not created here).

```ts
GET:
  const property = getProperty(id);
  if (!property) return 404;
  const deposits = listRentalDeposits(id);
  return NextResponse.json({ deposits });
```

---

## 7. Frontend

### `DepositActions.tsx` (NEW)
```tsx
// Pattern: identical to InstallmentActions.tsx
export function MarkDepositedButton({ depositId }: { depositId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function handle() {
    setBusy(true);
    const res = await fetch(`/api/rental-deposits/${depositId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "deposited" }),
    });
    setBusy(false);
    if (!res.ok) return;
    router.refresh();
  }
  return <button onClick={handle} disabled={busy} className="link">{busy ? "…" : "Mark deposited"}</button>;
}

export function MarkPendingButton({ depositId }: { depositId: number }) {
  // Sends { status: "pending" } to revert
}
```

### `PropertyDetailPanel.tsx` — read-only additions

**Props expand:** `deposits: RentalDeposit[]`, `history: RentalHistory[]` (fetched in page.tsx, passed down).

**Rental Deposits section** (after rental details, before instalment section):
```tsx
{property.is_rental && deposits.length > 0 && (
  <details className="work" style={{ marginTop: 12 }}>
    <summary>{deposits.length} rental deposit(s) — show schedule</summary>
    <div className="work-body">
      {deposits.map((d) => {
        const liveStatus = depositStatus(d, todayIso);
        return (
          <div key={d.id} style={{ marginBottom: 8 }}>
            Cheque {d.cheque_number} — {formatIsoToUae(d.deposit_date)} — {formatAed(d.amount_fils)}{" "}
            <span className={`pill ${liveStatus}`}>{liveStatus}</span>
            {liveStatus === "overdue" && (
              <span style={{ color: "var(--warn)", marginLeft: 8, fontSize: 12 }}>
                ⚠ Overdue — deposit not yet received
              </span>
            )}
            {liveStatus !== "deposited" ? (
              <MarkDepositedButton depositId={d.id} />
            ) : (
              <MarkPendingButton depositId={d.id} />
            )}
          </div>
        );
      })}
    </div>
  </details>
)}
```

**Contract Lifecycle Actions** (only when `is_rental`):
```tsx
<div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
  <button onClick={handleRenewContract}>Renew Contract</button>
  <button onClick={handleCancelContract} style={{ background: "var(--warn)", color: "#fff" }}>
    Cancel Contract
  </button>
  <button onClick={handleMarkVacant} style={{ background: "var(--panel-2)" }}>
    Mark as Vacant
  </button>
</div>
```

**Handler pseudocode:**
```ts
async function handleCancelContract() {
  if (!confirm("Cancel this tenancy contract? The property will be marked as Vacant. All rental history will be preserved.")) return;
  const res = await fetch(`/api/properties/${property.id}/rental-lifecycle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "cancel" }),
  });
  if (res.ok) router.refresh();
}

async function handleMarkVacant() {
  if (!confirm("Mark property as Vacant? Current contract data will be preserved in rental history.")) return;
  const res = await fetch(`/api/properties/${property.id}/rental-lifecycle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "vacant" }),
  });
  if (res.ok) router.refresh();
}

function handleRenewContract() {
  setEditing(true);            // opens edit form pre-populated
  setRenewMode(true);          // flag: save button → lifecycle endpoint with action="renew"
}
```

The edit form's save handler detects `renewMode` and calls the lifecycle endpoint instead of PATCH:
```ts
if (renewMode) {
  // Build payload with action "renew" + new rental fields from form
  const payload = { action: "renew", ...rentalFieldsFromForm };
  const res = await fetch(`/api/properties/${property.id}/rental-lifecycle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
} else {
  // Normal PATCH
}
```

**View Rental History:**
```tsx
<button onClick={() => setShowHistory(true)} style={{ marginTop: 8, fontSize: 12, background: "var(--panel-2)", color: "var(--text)" }}>
  View Rental History
</button>
{showHistory && (
  <div className="card" style={{ marginTop: 12 }}>
    <h4>Rental History — {property.name}</h4>
    <table>
      <thead>
        <tr><th>Rental Value</th><th>Contract Period</th><th>Cheques</th><th>Type</th><th>End Reason</th></tr>
      </thead>
      <tbody>
        {history.map(h => (
          <tr key={h.id}>
            <td>{formatAed(h.annual_rent_fils ?? h.short_term_annual_rent_fils ?? 0)}</td>
            <td>{formatIsoToUae(h.contract_start_date)} — {h.contract_end_date ? formatIsoToUae(h.contract_end_date) : "Active"}</td>
            <td>{h.rent_cheques_per_year ?? "—"}</td>
            <td>{h.rental_type === "short_term" ? "Short-term" : "Long-term"}</td>
            <td>{h.end_reason ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <button onClick={() => setShowHistory(false)} style={{ marginTop: 8, fontSize: 12 }}>Close</button>
  </div>
)}
```

### `add contract_start_date to edit form`
In the rental section of the edit form, add:
```tsx
<div style={{ maxWidth: 220 }}>
  <label>Contract start date</label>
  <input name="contract_start_date" type="date" defaultValue={property.contract_start_date ?? ""} />
</div>
```

### `PropertyContent.tsx` — read-only detail rows
After rental type row, add:
```tsx
<div className="detail-row">
  <span className="detail-label">Contract start</span>
  <span>{formatIsoDisplay(property.contract_start_date)}</span>
</div>
```

### `page.tsx` — server page
Fetch deposits + history alongside properties/installments:
```ts
const allDeposits = listAllRentalDeposits();
const allHistory = listAllRentalHistory();
```
Pass to `PropertyDetailPanel` as `deposits={depositsForProperty}` and `history={historyForProperty}`.

---

## 8. File Change Summary

| # | File | Action |
|---|------|--------|
| 1 | `lib/db/schema.sql` | Edit: +2 tables, +2 views (DROP+CREATE), +1 ALTER column |
| 2 | `lib/types.ts` | Edit: +`RentalDeposit`, +`RentalHistory`, +type aliases, +`contract_start_date` on Property |
| 3 | `lib/ingest/validate.ts` | Edit: +`RentalLifecycleSchema`, +`RentalDepositUpdateSchema`, +`contract_start_date` on PropertyInput/Update |
| 4 | `lib/core/rental-deposits.ts` | **New**: `generateDepositSchedule`, `depositStatus` |
| 5 | `lib/db/queries.ts` | Edit: +history+deps CRUD + `upsertRentalDepositSchedule` |
| 6 | `app/api/rental-deposits/[id]/route.ts` | **New**: PATCH |
| 7 | `app/api/properties/[id]/rental-lifecycle/route.ts` | **New**: POST |
| 8 | `app/api/properties/[id]/rental-history/route.ts` | **New**: GET |
| 9 | `app/api/properties/[id]/rental-deposits/route.ts` | **New**: GET |
| 9 | `app/api/properties/route.ts` | Edit: POST: generate deposits on creation |
| 10 | `app/api/properties/[id]/route.ts` | Edit: PATCH: sync deposits on rental field edits |
| 11 | `app/(dashboard)/properties/DepositActions.tsx` | **New**: `MarkDepositedButton`, `MarkPendingButton` |
| 12 | `app/(dashboard)/properties/PropertyDetailPanel.tsx` | Edit: deposits section, contract actions, history view, contract_start_date |
| 13 | `app/(dashboard)/properties/page.tsx` | Edit: pass deposits + history |
| 14 | `__tests__/rental-deposits.test.ts` | **New**: tests |

---

## 9. Test Plan

File: `__tests__/rental-deposits.test.ts`

### Group A: `generateDepositSchedule` — long-term (fixes Claude #2)
```
Test 1: 100_000 fils / 1 cheque  → [{chequeNumber:1, amountFils:100000}]
Test 2: 100_000 fils / 3 cheques → sum = 100000; last = 33334, others = 33333
Test 3: 100_000 fils / 12 cheques → sum = 100000
Test 4: null annual_rent → []
Test 5: rent_date_2 null for 2-cheque → only cheque 1 at slot=1 (not re-packed)
Test 6: all dates null → []
Test 7: 4 cheques, rent_date_3 null → entries at slots 1,2,4 (slot=3 skipped)
```

### Group B: `generateDepositSchedule` — short-term
```
Test 8: 120_000 fils / monthly / 12 periods → sum = 120000
Test 9: 100_000 fils / quarterly / 4 periods → sum = 100000; last absorbs remainder
Test 10: missing end date → []
Test 11: dates step backward from end date correctly (spot-check)
```

### Group C: `depositStatus`
```
Test 12: status='deposited' + past date → "deposited"
Test 13: status='pending' + past date → "overdue"
Test 14: status='pending' + future date → "pending"
Test 15: deposited_date set + status='pending' → "deposited" (paid_date semantics)
Test 16: status='deposited' + future date → "deposited"
```

### Group D: re-sync status preservation (fixes Claude #1)
```
Test 17: upsert preserves deposited status on matching cheque_number when amount changes
Test 18: upsert adds new cheque numbers with pending status
Test 19: upsert removes cheque numbers no longer in schedule
Test 20: upsert on empty schedule clears all deposits
```

---

## 10. Verification

- `npx tsc --noEmit` — typecheck
- `npx vitest run` — all existing tests + new rental-deposits tests pass
- Manual flows:
  1. Create rented property → deposits auto-generated → mark some deposited → verify status preserved on edit
  2. Overdue deposit shows warning pill
  3. Cancel contract → property vacant → history has entry → ROI unchanged
  4. Renew contract → new terms → history shows old + new active → deposits regenerated
  5. Mark vacant → history preserved
  6. View rental history table shows all past contracts
