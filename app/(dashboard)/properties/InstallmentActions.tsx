"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface InstallmentActionsProps {
  installmentId: number;
}

export function MarkPaidButton({ installmentId }: InstallmentActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleMarkPaid() {
    setBusy(true);
    const res = await fetch(`/api/installments/${installmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });
    setBusy(false);
    if (!res.ok) return;
    router.refresh();
  }

  return (
    <button onClick={handleMarkPaid} disabled={busy} className="link" style={{ marginLeft: 8 }}>
      {busy ? "…" : "Mark paid"}
    </button>
  );
}

export function DeleteButton({ installmentId }: InstallmentActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this installment?")) return;
    setBusy(true);
    const res = await fetch(`/api/installments/${installmentId}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) return;
    router.refresh();
  }

  return (
    <button onClick={handleDelete} disabled={busy} className="link" style={{ marginLeft: 8 }}>
      {busy ? "…" : "Delete"}
    </button>
  );
}

export function MarkUnpaidButton({ installmentId }: InstallmentActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleMarkUnpaid() {
    setBusy(true);
    const res = await fetch(`/api/installments/${installmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "upcoming" }),
    });
    setBusy(false);
    if (!res.ok) return;
    router.refresh();
  }

  return (
    <button onClick={handleMarkUnpaid} disabled={busy} className="link" style={{ marginLeft: 8 }}>
      {busy ? "…" : "Mark unpaid"}
    </button>
  );
}
