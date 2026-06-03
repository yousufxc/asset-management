"use client";

/**
 * Off-plan payment-schedule entry (reference for DeepSeek task P1-UI-INSTALL).
 * Adds one installment at a time to a chosen property. Amounts as AED decimals,
 * dates as UAE DD/MM/YYYY (server converts to fils + ISO).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PropertyOption {
  id: number;
  name: string;
  subcategory: string;
}

export default function InstallmentForm({ properties }: { properties: PropertyOption[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (properties.length === 0) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Add payment schedule</h3>
        <p className="muted">Add a property first, then you can attach its installment schedule here.</p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const strOrNull = (k: string) => {
      const v = fd.get(k);
      return v === "" || v === null ? null : String(v);
    };

    const payload = {
      property_id: Number(fd.get("property_id")),
      due_date: String(fd.get("due_date") ?? ""),
      amount_aed: Number(fd.get("amount_aed")),
      milestone_label: strOrNull("milestone_label"),
      status: String(fd.get("status") ?? "upcoming"),
      source: "manual",
    };

    const res = await fetch("/api/installments", {
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
      <h3 style={{ marginTop: 0 }}>Add payment schedule (off-plan installment)</h3>
      <div className="row">
        <div style={{ flex: 2, minWidth: 220 }}>
          <label>Property *</label>
          <select name="property_id" required defaultValue="">
            <option value="" disabled>Select</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.subcategory === "off_plan" ? "(off-plan)" : "(existing)"}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label>Due date *</label>
          <input name="due_date" type="date" required />
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 150 }}>
          <label>Amount (AED) *</label>
          <input name="amount_aed" type="number" step="0.01" required />
        </div>
        <div style={{ flex: 2, minWidth: 220 }}>
          <label>Milestone</label>
          <input name="milestone_label" placeholder="20% on completion of foundation" />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label>Status</label>
          <select name="status" defaultValue="upcoming">
            <option value="" disabled>Select</option>
            <option value="upcoming">Upcoming</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
      </div>
      {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
      <button type="submit" disabled={saving}>{saving ? "Saving…" : "Add installment"}</button>
    </form>
  );
}
