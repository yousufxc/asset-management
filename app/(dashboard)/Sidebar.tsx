"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "My Dashboard",
    icon: <svg width="18" height="18" viewBox="0 0 24 24"><rect x="2" y="2" width="8" height="8" rx="1" fill="currentColor"/><rect x="14" y="2" width="8" height="8" rx="1" fill="currentColor"/><rect x="2" y="14" width="8" height="8" rx="1" fill="currentColor"/><rect x="14" y="14" width="8" height="8" rx="1" fill="currentColor"/></svg>,
  },
  { href: "/properties", label: "Property",
    icon: <svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 3L2 12h3v9h6v-6h2v6h6v-9h3L12 3z" fill="currentColor"/></svg>,
  },
  { href: "/commodities", label: "Commodities",
    icon: <svg width="18" height="18" viewBox="0 0 24 24"><rect x="8" y="4" width="8" height="5" rx="1" fill="currentColor"/><rect x="4" y="11" width="7" height="5" rx="1" fill="currentColor"/><rect x="13" y="11" width="7" height="5" rx="1" fill="currentColor"/></svg>,
  },
  { href: "/cash", label: "Saving Accounts",
    icon: <svg width="18" height="18" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" fill="currentColor"/><rect x="1" y="9" width="22" height="2" fill="var(--panel)"/></svg>,
  },
  { href: "/chat", label: "Chat",
    icon: <svg width="18" height="18" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="currentColor"/></svg>,
  },
];

const BOTTOM_ITEMS = [
  { href: "/about", label: "About Us",
    icon: <svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/><rect x="10.5" y="7" width="3" height="8" rx="1.5" fill="var(--panel)"/><circle cx="12" cy="17" r="1.2" fill="var(--panel)"/></svg>,
  },
  { href: "/settings", label: "Settings",
    icon: <svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="currentColor"/><rect x="9" y="1" width="6" height="4" rx="1" fill="currentColor" transform="rotate(0 12 12)"/><rect x="9" y="1" width="6" height="4" rx="1" fill="currentColor" transform="rotate(60 12 12)"/><rect x="9" y="1" width="6" height="4" rx="1" fill="currentColor" transform="rotate(120 12 12)"/><rect x="9" y="1" width="6" height="4" rx="1" fill="currentColor" transform="rotate(180 12 12)"/><rect x="9" y="1" width="6" height="4" rx="1" fill="currentColor" transform="rotate(240 12 12)"/><rect x="9" y="1" width="6" height="4" rx="1" fill="currentColor" transform="rotate(300 12 12)"/><circle cx="12" cy="12" r="3" fill="var(--panel)"/></svg>,
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

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
            <Link
              key={item.href}
              href={item.href}
              className={isActive(item.href) ? "active" : ""}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <nav>
          {BOTTOM_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={isActive(item.href) ? "active" : ""}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
