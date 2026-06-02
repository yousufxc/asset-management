"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CashForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isLiquid, setIsLiquid] = useState(true);
  const [accountType, setAccountType] = useState("current");

  function handleAccountTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    setAccountType(value);
    if (value === "fixed_deposit") {
      setIsLiquid(false);
    }
  }

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
      bank_name: strOrNull("bank_name"),
      account_type: strOrNull("account_type"),
      current_balance_aed: numOrNull("current_balance_aed") ?? 0,
      is_liquid: isLiquid,
      last_updated: strOrNull("last_updated"),
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
      setError(data?.error ? JSON.stringify(data.error) + (data.issues ? " " + JSON.stringify(data.issues.fieldErrors) : "") : "Save failed");
      return;
    }
    (e.target as HTMLFormElement).reset();
    setIsLiquid(true);
    setAccountType("current");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <h3 style={{ marginTop: 0 }}>Add account</h3>
      <div className="row">
        <div style={{ flex: 2, minWidth: 220 }}>
          <label>Label *</label>
          <input name="label" required placeholder="Emirates NBD Current" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Bank name</label>
          <input name="bank_name" placeholder="Emirates NBD" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Account type</label>
          <select
            name="account_type"
            value={accountType}
            onChange={handleAccountTypeChange}
          >
            <option value="current">Current</option>
            <option value="savings">Savings</option>
            <option value="fixed_deposit">Fixed deposit</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Current balance (AED)</label>
          <input name="current_balance_aed" type="number" step="0.01" defaultValue={0} />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Last updated (DD/MM/YYYY)</label>
          <input name="last_updated" placeholder="07/03/2026" />
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          name="is_liquid"
          type="checkbox"
          style={{ width: "auto" }}
          checked={isLiquid}
          onChange={(e) => setIsLiquid(e.target.checked)}
        />{" "}
        Counts as liquid cash for runway
      </label>
      <label>Notes</label>
      <textarea name="notes" rows={2} />
      {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
      <button type="submit" disabled={saving}>{saving ? "Saving…" : "Add account"}</button>
    </form>
  );
}
