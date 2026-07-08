import Sidebar from "./Sidebar";
import { getSetting } from "@/lib/db/settings";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  let assetSelection: string[] = [];
  try {
    const raw = getSetting("assetSelection");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((s: unknown) => typeof s === "string")) {
        assetSelection = parsed;
      }
    }
  } catch {}

  return (
    <div className="app-shell">
      <Sidebar assetSelection={assetSelection} />
      <main className="content">{children}</main>
    </div>
  );
}
