import { getAllSettings, getTableCounts } from "@/lib/db/settings";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import SettingsContent from "./SettingsContent";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  let settings: Record<string, string>;
  let counts: Record<string, number>;
  try {
    settings = getAllSettings();
  } catch (e) {
    console.error("settings page: getAllSettings failed", e);
    settings = {};
  }
  try {
    counts = getTableCounts();
  } catch (e) {
    console.error("settings page: getTableCounts failed", e);
    counts = {};
  }

  let version = "0.1.0";
  try {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    );
    version = pkg.version ?? version;
  } catch {}

  const dbPath = process.env.PORTFOLIO_DB_PATH ?? join(process.cwd(), "data", "portfolio.db");

  let assetSelection: string[] = [];
  try {
    const raw = settings.assetSelection;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((s: unknown) => typeof s === "string")) {
        assetSelection = parsed;
      }
    }
  } catch {}

  return (
    <>
      <h2>Settings</h2>
      <SettingsContent
        runwayHorizonDays={Number(settings.runwayHorizonDays) || 90}
        theme={settings.theme ?? "dark"}
        anthropicApiKey={settings.anthropicApiKey ?? ""}
        version={version}
        dbPath={dbPath}
        tableCounts={counts}
        assetSelection={assetSelection}
      />
    </>
  );
}
