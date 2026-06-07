"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { numeralOnly } from "./numeralOnly";

export default function CashForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <h3 style={{ marginTop: 0 }}>Add cash balance</h3>
      <div className="row">
        <div style={{ flex: 2, minWidth: 220 }}>
          <label>Bank account *</label>
          <input name="label" required placeholder="Emirates NBD Current" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Cash balance (AED)</label>
          <input
            name="current_balance_aed"
            type="number"
            step="0.01"
            defaultValue={0}
            placeholder="Enter cash balance here"
            onKeyDown={numeralOnly}
          />
        </div>
      </div>
      <label>Notes</label>
      <textarea name="notes" rows={2} placeholder="Optional notes about this account" />
      {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
      <button type="submit" disabled={saving}>{saving ? "Saving…" : "Add balance"}</button>
    </form>
  );
}
