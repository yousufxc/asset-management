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
  { href: "/cash", label: "Saving Accounts",
    icon: <svg width="18" height="18" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" fill="currentColor"/><rect x="1" y="9" width="22" height="2" fill="var(--panel)"/></svg>,
  },
  { href: "/commodities", label: "Commodities",
    icon: <svg width="18" height="18" viewBox="0 0 24 24"><rect x="8" y="4" width="8" height="5" rx="1" fill="currentColor"/><rect x="4" y="11" width="7" height="5" rx="1" fill="currentColor"/><rect x="13" y="11" width="7" height="5" rx="1" fill="currentColor"/></svg>,
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
    icon: <svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="var(--panel)"/><path fillRule="evenodd" d="M12 2c-.5 0-.9.3-1 .8l-.5 1.9c-.7.2-1.3.5-1.9.9l-1.7-.7c-.4-.2-.9-.1-1.2.2l-1 1c-.3.3-.4.8-.2 1.2l.7 1.7c-.4.6-.7 1.2-.9 1.9l-1.9.5c-.4.1-.8.5-.8 1v1.4c0 .5.3.9.8 1l1.9.5c.2.7.5 1.3.9 1.9l-.7 1.7c-.2.4-.1.9.2 1.2l1 1c.3.3.8.4 1.2.2l1.7-.7c.6.4 1.2.7 1.9.9l.5 1.9c.1.4.5.7.9.7h1.4c.5 0 .9-.3 1-.8l.5-1.9c.7-.2 1.3-.5 1.9-.9l1.7.7c.4.2.9.1 1.2-.2l1-1c.3-.3.4-.8.2-1.2l-.7-1.7c.4-.6.7-1.2.9-1.9l1.9-.5c.4-.1.8-.5.8-1v-1.4c0-.5-.3-.9-.8-1l-1.9-.5c-.2-.7-.5-1.3-.9-1.9l.7-1.7c.2-.4.1-.9-.2-1.2l-1-1c-.3-.3-.8-.4-1.2-.2l-1.7.7c-.6-.4-1.2-.7-1.9-.9l-.5-1.9c-.2-.5-.5-.8-1-.8H12zm0 2h1.2l.4 1.7c.9.3 1.7.7 2.4 1.3l1.5-.6.8.8-.6 1.5c.6.7 1 1.5 1.3 2.4L21 12v1.2l-1.7.4c-.3.9-.7 1.7-1.3 2.4l.6 1.5-.8.8-1.5-.6c-.7.6-1.5 1-2.4 1.3l-.4 1.7H12l-.4-1.7c-.9-.3-1.7-.7-2.4-1.3l-1.5.6-.8-.8.6-1.5c-.6-.7-1-1.5-1.3-2.4L4 12v-1.2l1.7-.4c.3-.9.7-1.7 1.3-2.4l-.6-1.5.8-.8 1.5.6c.7-.6 1.5-1 2.4-1.3L12 4z" fill="currentColor"/></svg>,
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
