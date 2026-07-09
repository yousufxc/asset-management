"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/app/components/ConfirmModal";

interface Props {
  runwayHorizonDays: number;
  theme: string;
  anthropicApiKey: string;
  version: string;
  dbPath: string;
  tableCounts: Record<string, number>;
  assetSelection: string[];
}

const CHEVRON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6,9 12,15 18,9" />
  </svg>
);

const ALL_ASSETS = [
  { key: "properties", label: "Property" },
  { key: "commodities", label: "Commodities" },
  { key: "cash", label: "Saving Accounts" },
  { key: "lands", label: "Land" },
] as const;

export default function SettingsContent({
  runwayHorizonDays: initialHorizon,
  theme: initialTheme,
  anthropicApiKey: initialApiKey,
  version,
  dbPath,
  tableCounts,
  assetSelection: initialSelection,
}: Props) {
  const [openSection, setOpenSection] = useState<string | null>(null);

  const [horizonDays, setHorizonDays] = useState(initialHorizon);
  const [horizonSaving, setHorizonSaving] = useState(false);
  const [horizonSaved, setHorizonSaved] = useState(false);
  const [theme, setTheme] = useState(initialTheme);
  const [themeSaving, setThemeSaving] = useState(false);

  useEffect(() => {
    setTheme(initialTheme);
  }, [initialTheme]);
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [excelCategory, setExcelCategory] = useState("all");
  const [exportingExcel, setExportingExcel] = useState(false);
  const [pendingExport, setPendingExport] = useState<"json" | "excel" | null>(null);

  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(
    new Set(initialSelection.length > 0 ? initialSelection : ALL_ASSETS.map((a) => a.key)),
  );
  const [assetSaving, setAssetSaving] = useState(false);
  const [assetSaved, setAssetSaved] = useState(false);
  const router = useRouter();

  const toggleSection = (section: string) => {
    setOpenSection((prev) => (prev === section ? null : section));
  };

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

  const toggleTheme = async () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    setThemeSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "theme", value: next }),
      });
    } finally {
      setThemeSaving(false);
    }
  };

  const saveApiKey = async () => {
    setApiKeySaving(true);
    setApiKeySaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "anthropicApiKey", value: apiKey }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to save");
        return;
      }
      setApiKeySaved(true);
      setTimeout(() => setApiKeySaved(false), 2000);
    } finally {
      setApiKeySaving(false);
    }
  };

  const toggleAsset = (key: string) => {
    const next = new Set(selectedAssets);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedAssets(next);
    setAssetSaved(false);
  };

  const saveAssetSelection = async () => {
    setAssetSaving(true);
    setAssetSaved(false);
    try {
      const arr = Array.from(selectedAssets);
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "assetSelection", value: JSON.stringify(arr) }),
      });
      setAssetSaved(true);
      setTimeout(() => setAssetSaved(false), 2000);
      router.refresh();
    } catch (e) {
      alert("Failed to save: " + String(e));
    } finally {
      setAssetSaving(false);
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

  async function handleExportExcel() {
    setExportingExcel(true);
    try {
      const apiPath =
        excelCategory === "properties" ? "/api/properties/export" :
        excelCategory === "commodities" ? "/api/commodities/export" :
        excelCategory === "cash" ? "/api/cash/export" :
        excelCategory === "lands" ? "/api/lands/export" :
        "/api/settings/export?format=xlsx";
      const res = await fetch(apiPath);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const catLabel = excelCategory === "all" ? "all" : excelCategory;
      a.download = `${catLabel}-export-${dateStr}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Export failed: " + String(e));
    } finally {
      setExportingExcel(false);
    }
  }

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

  function SectionHeader({ id, title }: { id: string; title: string }) {
    const isOpen = openSection === id;
    return (
      <button
        type="button"
        onClick={() => toggleSection(id)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "transparent",
          border: "none",
          color: "var(--text)",
          padding: "16px 20px",
          margin: 0,
          cursor: "pointer",
          borderRadius: 0,
          fontWeight: 600,
          fontSize: 16,
        }}
      >
        <span>{title}</span>
        <span
          style={{
            display: "inline-flex",
            transition: "transform 0.35s ease",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          {CHEVRON}
        </span>
      </button>
    );
  }

  return (
    <>
      {/* ─── MY ASSET SELECTION ───────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <SectionHeader id="assets" title="My Asset Selection" />
        <div
          style={{
            maxHeight: openSection === "assets" ? "380px" : "0",
            opacity: openSection === "assets" ? 1 : 0,
            overflow: "hidden",
            transition: "max-height 0.35s ease, opacity 0.35s ease",
          }}
        >
          <div style={{ padding: "0 20px 20px" }}>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
              Select which asset categories appear in the sidebar. Click Save to apply changes.
            </p>
            {ALL_ASSETS.map(({ key, label }) => (
              <label
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                  margin: "0 0 8px",
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "var(--panel-2)",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedAssets.has(key)}
                  onChange={() => toggleAsset(key)}
                  style={{ width: "auto", margin: 0, cursor: "pointer" }}
                />
                <span>{label}</span>
              </label>
            ))}
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
              <button
                type="button"
                onClick={saveAssetSelection}
                disabled={assetSaving}
                style={{ marginTop: 0 }}
              >
                {assetSaving ? "Saving..." : assetSaved ? "Saved" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── DASHBOARD ────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <SectionHeader id="dashboard" title="Dashboard" />
        <div
          style={{
            maxHeight: openSection === "dashboard" ? "800px" : "0",
            opacity: openSection === "dashboard" ? 1 : 0,
            overflow: "hidden",
            transition: "max-height 0.35s ease, opacity 0.35s ease",
          }}
        >
          <div style={{ padding: "0 20px 20px" }}>
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

            <div style={{ borderTop: "1px solid var(--border)", marginTop: 20, paddingTop: 16 }}>
              <label>Theme</label>
              <p className="muted" style={{ fontSize: 13, margin: "0 0 8px" }}>
                Switch between dark and light mode.
              </p>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", margin: 0 }}>
                  <input
                    type="radio"
                    name="theme"
                    value="dark"
                    checked={theme === "dark"}
                    onChange={toggleTheme}
                    style={{ width: "auto", margin: 0, cursor: "pointer" }}
                  />
                  Dark
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", margin: 0 }}>
                  <input
                    type="radio"
                    name="theme"
                    value="light"
                    checked={theme === "light"}
                    onChange={toggleTheme}
                    style={{ width: "auto", margin: 0, cursor: "pointer" }}
                  />
                  Light
                </label>
                {themeSaving && <span className="muted" style={{ fontSize: 12 }}>Saving...</span>}
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border)", marginTop: 20, paddingTop: 16 }}>
              <label htmlFor="anthropicApiKey">Anthropic API Key</label>
              <p className="muted" style={{ fontSize: 13, margin: "0 0 8px" }}>
                Required for the Chat feature. Create a key at{" "}
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">
                  console.anthropic.com
                </a>.
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  id="anthropicApiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  style={{ maxWidth: 420 }}
                />
                <button
                  onClick={saveApiKey}
                  disabled={apiKeySaving}
                  style={{ marginTop: 0 }}
                >
                  {apiKeySaving ? "Saving..." : apiKeySaved ? "Saved" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── DATA ─────────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <SectionHeader id="data" title="Data" />
        <div
          style={{
            maxHeight: openSection === "data" ? "800px" : "0",
            opacity: openSection === "data" ? 1 : 0,
            overflow: "hidden",
            transition: "max-height 0.35s ease, opacity 0.35s ease",
          }}
        >
          <div style={{ padding: "0 20px 20px" }}>
            <div style={{ marginBottom: 20 }}>
              <p className="muted" style={{ fontSize: 13, margin: "0 0 8px" }}>
                Download all your data (properties, cash accounts, commodities,
                lands, installments, and settings) as a JSON file for backup.
              </p>
              <button
                onClick={() => setPendingExport("json")}
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
              <p className="muted" style={{ fontSize: 13, margin: "0 0 8px" }}>
                Export to Excel by category.
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  value={excelCategory}
                  onChange={(e) => setExcelCategory(e.target.value)}
                  style={{ maxWidth: 200 }}
                >
                  <option value="all">All categories</option>
                  <option value="properties">Properties only</option>
                  <option value="commodities">Commodities only</option>
                  <option value="cash">Saving Accounts only</option>
                  <option value="lands">Lands only</option>
                </select>
                <button
                  onClick={() => setPendingExport("excel")}
                  disabled={exportingExcel}
                  style={{ marginTop: 0 }}
                >
                  {exportingExcel ? "Exporting..." : "Export to Excel"}
                </button>
              </div>
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
        </div>
      </div>

      {/* ─── ABOUT ────────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <SectionHeader id="about" title="About" />
        <div
          style={{
            maxHeight: openSection === "about" ? "500px" : "0",
            opacity: openSection === "about" ? 1 : 0,
            overflow: "hidden",
            transition: "max-height 0.35s ease, opacity 0.35s ease",
          }}
        >
          <div style={{ padding: "0 20px 20px" }}>
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
              <span className="detail-label">Lands</span>
              <span>{tableCounts.lands ?? 0}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Installments</span>
              <span>{tableCounts.installments ?? 0}</span>
            </div>
          </div>
        </div>
      </div>
      {pendingExport && (
        <ConfirmModal
          title="Export Data"
          message={
            pendingExport === "json"
              ? "Are you sure you want to export all data as JSON?"
              : "Are you sure you want to export to Excel?"
          }
          confirmLabel="Export"
          onConfirm={() => {
            if (pendingExport === "json") {
              handleExport();
            } else {
              handleExportExcel();
            }
            setPendingExport(null);
          }}
          onCancel={() => setPendingExport(null)}
        />
      )}
    </>
  );
}
