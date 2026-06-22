import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>KYNZi</h1>
        <nav>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/properties">Property</Link>
          <Link href="/cash">Saving Accounts</Link>
          <Link href="/commodities">Commodities</Link>
        </nav>
        <div className="sidebar-divider" />
        <nav>
          <Link href="/about">About Us</Link>
          <Link href="/settings">Settings</Link>
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
