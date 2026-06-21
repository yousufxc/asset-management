"use client";

import { useState } from "react";

interface Props {
  runwayHorizonDays: number;
  version: string;
  dbPath: string;
  tableCounts: Record<string, number>;
}

export default function SettingsContent({
  runwayHorizonDays: initialHorizon,
  version,
  dbPath,
  tableCounts,
}: Props) {
  const [horizonDays, setHorizonDays] = useState(initialHorizon);
  const [horizonSaving, setHorizonSaving] = useState(false);
  const [horizonSaved, setHorizonSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const saveHorizon = async () => {
    setHorizonSaving(true);
    setHorizonSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "runwayHorizonDays", value: String(horizonDays) }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to save");
        return;
      }
      setHorizonSaved(true);
      setTimeout(() => setHorizonSaved(false), 2000);
    } finally {
      setHorizonSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/settings/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `asset-platform-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Export failed: " + String(e));
    } finally {
      setExporting(false);
    }
  };

  const handleReset = async () => {
    if (resetConfirm !== "DELETE") return;
    setResetting(true);
    setResetResult(null);
    setResetError(null);
    try {
      const res = await fetch("/api/settings/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResetError(data.error || "Reset failed");
        return;
      }
      setResetResult(`All data cleared. Backup saved to: ${data.backupPath}`);
    } catch (e) {
      setResetError("Reset failed: " + String(e));
    } finally {
      setResetting(false);
    }
  };

  const horizonValid = horizonDays >= 7 && horizonDays <= 365 && Number.isInteger(horizonDays);

  return (
    <>
      {/* ─── DASHBOARD ──────────────────────────────────────────────────── */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Dashboard</h3>

        <label htmlFor="runwayHorizon">Runway horizon (days)</label>
        <p className="muted" style={{ fontSize: 13, margin: "0 0 8px" }}>
          Days of liquidity the runway calculation and warning cover (7–365).
          Reducing this makes warnings arrive earlier.
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            id="runwayHorizon"
            type="number"
            min={7}
            max={365}
            step={1}
            value={horizonDays}
            onChange={(e) => setHorizonDays(parseInt(e.target.value, 10) || 0)}
            style={{ maxWidth: 100 }}
          />
          <button
            onClick={saveHorizon}
            disabled={horizonSaving || !horizonValid}
            style={{ marginTop: 0 }}
          >
            {horizonSaving ? "Saving..." : horizonSaved ? "Saved" : "Save"}
          </button>
        </div>
        {!horizonValid && (
          <p style={{ color: "var(--bad)", fontSize: 13, marginTop: 6 }}>
            Must be between 7 and 365 days.
          </p>
        )}
      </div>

      {/* ─── DATA ───────────────────────────────────────────────────────── */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Data</h3>

        <div style={{ marginBottom: 20 }}>
          <p className="muted" style={{ fontSize: 13, margin: "0 0 8px" }}>
            Download all your data (properties, cash accounts, commodities,
            installments, and settings) as a JSON file for backup.
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{ marginTop: 0 }}
          >
            {exporting ? "Exporting..." : "Export all data"}
          </button>
        </div>

        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: 16,
          }}
        >
          <p
            className="muted"
            style={{ fontSize: 13, margin: "0 0 8px", color: "var(--bad)" }}
          >
            Delete all assets, installments, and settings. A JSON backup is
            automatically saved to disk before the wipe.
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="text"
              placeholder="Type DELETE to confirm"
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              style={{ maxWidth: 220 }}
            />
            <button
              onClick={handleReset}
              disabled={resetting || resetConfirm !== "DELETE"}
              style={{
                marginTop: 0,
                background:
                  resetConfirm === "DELETE"
                    ? "var(--bad)"
                    : "var(--panel-2)",
                color:
                  resetConfirm === "DELETE" ? "#fff" : "var(--muted)",
              }}
            >
              {resetting ? "Wiping..." : "Reset all data"}
            </button>
          </div>
          {resetResult && (
            <p style={{ color: "var(--good)", fontSize: 13, marginTop: 8 }}>
              {resetResult}
            </p>
          )}
          {resetError && (
            <p style={{ color: "var(--bad)", fontSize: 13, marginTop: 8 }}>
              {resetError}
            </p>
          )}
        </div>
      </div>

      {/* ─── ABOUT ──────────────────────────────────────────────────────── */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>About</h3>
        <div className="detail-row">
          <span className="detail-label">Version</span>
          <span>{version}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Database</span>
          <span style={{ fontSize: 13, wordBreak: "break-all" }}>{dbPath}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Properties</span>
          <span>{tableCounts.properties ?? 0}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Saving Accounts</span>
          <span>{tableCounts.cash_accounts ?? 0}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Commodities</span>
          <span>{tableCounts.commodities ?? 0}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Installments</span>
          <span>{tableCounts.installments ?? 0}</span>
        </div>
      </div>
    </>
  );
}
