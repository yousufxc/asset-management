"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface IngestPdfFormProps {
  properties: { id: number; name: string; subcategory: string }[];
}

export default function IngestPdfForm({ properties }: IngestPdfFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (properties.length === 0) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Ingest SPA payment schedule (PDF)</h3>
        <p className="muted">
          Add a property first, then upload its SPA document here.
        </p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);

    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/ingest/spa", {
      method: "POST",
      body: fd,
    });
    setBusy(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.reason ?? data?.error ?? "Ingestion failed");
      return;
    }

    const data = await res.json();
    setResult(
      `Done: ${data.inserted} inserted, ${data.skipped} skipped (already existed), ${data.total} total from PDF.`,
    );
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <h3 style={{ marginTop: 0 }}>Ingest SPA payment schedule (PDF)</h3>
      <div className="row">
        <div style={{ flex: 2, minWidth: 220 }}>
          <label>Property *</label>
          <select name="property_id" required defaultValue={properties[0]?.id}>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.subcategory === "off_plan" ? "(off-plan)" : "(existing)"}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 2, minWidth: 220 }}>
          <label>SPA document (PDF) *</label>
          <input name="file" type="file" accept=".pdf" required />
        </div>
      </div>
      {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
      {result && <p style={{ color: "var(--good)" }}>{result}</p>}
      <button type="submit" disabled={busy}>
        {busy ? "Processing…" : "Upload & ingest"}
      </button>
    </form>
  );
}
