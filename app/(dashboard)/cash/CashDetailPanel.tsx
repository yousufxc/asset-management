"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CashAccount } from "@/lib/types";
import { filsToAed, formatAed } from "@/lib/core/units";
import { numeralOnly } from "./numeralOnly";

function aedInputOrEmpty(fils: number): string {
  return filsToAed(fils).toString();
}

function formatIsoDisplay(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export default function CashDetailPanel({ account }: { account: CashAccount }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
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

    const payload: Record<string, unknown> = {};

    const labelVal = String(fd.get("label") ?? "");
    if (labelVal !== account.label) payload.label = labelVal;

    const balanceVal = numOrNull("current_balance_aed");
    const existingBalance = filsToAed(account.current_balance_fils);
    if (balanceVal !== existingBalance) payload.current_balance_aed = balanceVal;

    const notes = strOrNull("notes");
    if (notes !== (account.notes ?? null)) payload.notes = notes;

    if (Object.keys(payload).length === 0) {
      setSaving(false);
      setEditing(false);
      return;
    }

    const res = await fetch(`/api/cash/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ? JSON.stringify(data.error) + (data.issues ? " " + JSON.stringify(data.issues.fieldErrors) : "") : "Save failed");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  function handleCancel() {
    setEditing(false);
    setError(null);
  }

  const renderReadOnly = () => (
    <>
      <div className="detail-row">
        <span className="detail-label">Bank account</span>
        <span>{account.label}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Balance</span>
        <span>{formatAed(account.current_balance_fils)}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Created</span>
        <span className="muted">{formatIsoDisplay(account.created_at)}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Updated</span>
        <span className="muted">{formatIsoDisplay(account.updated_at)}</span>
      </div>
      {account.notes ? (
        <div className="detail-row">
          <span className="detail-label">Notes</span>
          <span style={{ whiteSpace: "pre-wrap" }}>{account.notes}</span>
        </div>
      ) : (
        <div className="detail-row">
          <span className="detail-label">Notes</span>
          <span className="muted">No notes added</span>
        </div>
      )}
    </>
  );

  const renderEditForm = () => (
    <form onSubmit={handleSave} className="detail-edit-form">
      <div className="row">
        <div style={{ flex: 2, minWidth: 220 }}>
          <label>Bank account *</label>
          <input name="label" required defaultValue={account.label} />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Cash balance (AED)</label>
          <input
            name="current_balance_aed"
            type="number"
            step="0.01"
            onKeyDown={numeralOnly}
            defaultValue={aedInputOrEmpty(account.current_balance_fils)}
            placeholder="Enter cash balance here"
          />
        </div>
      </div>
      <label>Notes</label>
      <textarea name="notes" rows={3} defaultValue={account.notes ?? ""} placeholder="Optional notes about this account" />
      {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
      <div className="row" style={{ gap: 8 }}>
        <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
        <button
          type="button"
          onClick={handleCancel}
          style={{ marginTop: 14, background: "var(--panel-2)", color: "var(--muted)" }}
        >
          Cancel
        </button>
      </div>
    </form>
  );

  return (
    <div className="card">
      <div className="detail-header">
        <h3 style={{ margin: 0 }}>{account.label}</h3>
        <button
          type="button"
          onClick={() => router.push("/cash")}
          style={{ marginTop: 0, background: "transparent", color: "var(--muted)", padding: "4px 10px", fontSize: 18, fontWeight: 400, lineHeight: 1, flexShrink: 0 }}
          title="Close"
        >
          ×
        </button>
      </div>
      {editing ? renderEditForm() : renderReadOnly()}
      {!editing && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{ marginTop: 0, fontSize: 13 }}
          >
            Edit Account Info
          </button>
        </div>
      )}
    </div>
  );
}
