"use client";

import { useState } from "react";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/dashboard", label: "My Dashboard", short: "D" },
  { href: "/properties", label: "Property", short: "P" },
  { href: "/cash", label: "Saving Accounts", short: "SA" },
  { href: "/commodities", label: "Commodities", short: "Co" },
  { href: "/chat", label: "Chat", short: "Ch" },
];

const BOTTOM_ITEMS = [
  { href: "/about", label: "About Us", short: "Ab" },
  { href: "/settings", label: "Settings", short: "Se" },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <div className="sidebar-header">
        <h1>KYNZi</h1>
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
      <nav>
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined}>
            {collapsed ? item.short : item.label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-divider" />
      <nav>
        {BOTTOM_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined}>
            {collapsed ? item.short : item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
