"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

  return (
    <button onClick={handle} disabled={busy} className="link" style={{ marginLeft: 8 }}>
      {busy ? "…" : "Mark deposited"}
    </button>
  );
}

export function MarkPendingButton({ depositId }: { depositId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handle() {
    setBusy(true);
    const res = await fetch(`/api/rental-deposits/${depositId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pending" }),
    });
    setBusy(false);
    if (!res.ok) return;
    router.refresh();
  }

  return (
    <button onClick={handle} disabled={busy} className="link" style={{ marginLeft: 8 }}>
      {busy ? "…" : "Mark pending"}
    </button>
  );
}
