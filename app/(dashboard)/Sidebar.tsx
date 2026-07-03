"use client";

import { useState } from "react";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/dashboard", label: "My Dashboard" },
  { href: "/properties", label: "Property" },
  { href: "/cash", label: "Saving Accounts" },
  { href: "/commodities", label: "Commodities" },
  { href: "/chat", label: "Chat" },
];

const BOTTOM_ITEMS = [
  { href: "/about", label: "About Us" },
  { href: "/settings", label: "Settings" },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <div className="sidebar-header">
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
        <h1 className="sidebar-logo">KYNZi</h1>
      </div>
      <div className="sidebar-nav-wrap">
        <nav>
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <nav>
          {BOTTOM_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
