"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { numeralOnly } from "./numeralOnly";

export default function CashForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isFixedDeposit, setIsFixedDeposit] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const numOrNull = (k: string) => {
      const v = fd.get(k);
      return v === "" || v === null ? null : Number(v);
    };
    const strOrNull = (k: string) => {
      const v = fd.get(k);
      return v === "" || v === null ? null : String(v);
    };

    const payload = {
      label: String(fd.get("label") ?? ""),
      current_balance_aed: numOrNull("current_balance_aed") ?? 0,
      interest_rate: numOrNull("interest_rate"),
      is_fixed_deposit: isFixedDeposit,
      fixed_deposit_period_months: isFixedDeposit ? numOrNull("fixed_deposit_period_months") : null,
      notes: strOrNull("notes"),
    };

    const res = await fetch("/api/cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(
        data?.error
          ? JSON.stringify(data.error) +
              (data.issues ? " " + JSON.stringify(data.issues.fieldErrors) : "")
          : "Save failed",
      );
      return;
    }
    (e.target as HTMLFormElement).reset();
    setIsFixedDeposit(false);
    setIsOpen(false);
    router.refresh();
  }

  if (!isOpen) {
    return (
      <div style={{ marginBottom: 18, display: "flex", justifyContent: "flex-end" }}>
        <button type="button" style={{ marginTop: 0 }} onClick={() => setIsOpen(true)}>
          + Add Cash Balance
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Add cash balance</h3>
        <span style={{ color: "var(--accent)", fontStyle: "italic", fontSize: 13 }}>*Do not add any current accounts</span>
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
          <input
            name="is_fixed_deposit"
            type="checkbox"
            style={{ width: "auto" }}
            checked={isFixedDeposit}
            onChange={(e) => setIsFixedDeposit(e.target.checked)}
          />{" "}
          Fixed Deposit
        </label>
      </div>

      <div className="row">
        <div style={{ flex: 2, minWidth: 220 }}>
          <label>Bank account *</label>
          <input name="label" required placeholder="Emirates NBD Savings" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Cash balance (AED)</label>
          <input
            name="current_balance_aed"
            type="number"
            step="0.01"
            defaultValue={0}
            placeholder="Enter Cash Balance"
            onKeyDown={numeralOnly}
          />
        </div>
      </div>

      <div className="row">
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Interest Rate</label>
          <input
            name="interest_rate"
            type="number"
            step="0.01"
            placeholder="Enter Interest Rate"
            onKeyDown={numeralOnly}
          />
        </div>
        {isFixedDeposit && (
          <div style={{ flex: 1, minWidth: 160 }}>
            <label>Fixed Deposit Period</label>
            <input
              name="fixed_deposit_period_months"
              type="number"
              step="1"
              placeholder="Enter Contract Period in Months"
              onKeyDown={numeralOnly}
            />
          </div>
        )}
      </div>

      <label>Notes</label>
      <textarea name="notes" rows={2} placeholder="Optional notes about this account" />
      {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button type="submit" disabled={saving}>{saving ? "Saving…" : "Add balance"}</button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          style={{ marginTop: 14, background: "var(--panel-2)", color: "var(--muted)" }}
        >
          Close
        </button>
      </div>
    </form>
  );
}
