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
        {collapsed ? (
          <>
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setCollapsed((c) => !c)}
              title="Expand sidebar"
            >
              <span />
              <span />
              <span />
            </button>
            <div className="sidebar-vertical-logo">
              {["K", "Y", "N", "Z", "i"].map((letter, i) => (
                <span key={i}>{letter}</span>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1>KYNZi</h1>
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setCollapsed((c) => !c)}
              title="Collapse sidebar"
            >
              <span />
              <span />
              <span />
            </button>
          </>
        )}
      </div>
      {!collapsed && (
        <>
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
        </>
      )}
    </aside>
  );
}
