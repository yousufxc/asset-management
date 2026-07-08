"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/home", label: "Home",
    icon: <svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2"/><polygon points="12,3 14,9 20,9 15,13 17,19 12,15 7,19 9,13 4,9 10,9" fill="currentColor"/></svg>,
  },
  { href: "/dashboard", label: "My Dashboard",
    icon: <svg width="18" height="18" viewBox="0 0 24 24"><rect x="2" y="2" width="8" height="8" rx="1" fill="currentColor"/><rect x="14" y="2" width="8" height="8" rx="1" fill="currentColor"/><rect x="2" y="14" width="8" height="8" rx="1" fill="currentColor"/><rect x="14" y="14" width="8" height="8" rx="1" fill="currentColor"/></svg>,
  },
];

const CHAT_ITEMS = [
  { href: "/chat", label: "Chat",
    icon: <svg width="18" height="18" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="currentColor"/></svg>,
  },
];

const MY_ASSETS_ITEMS = [
  { href: "/properties", label: "Property", key: "properties",
    icon: <svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 3L2 12h3v9h6v-6h2v6h6v-9h3L12 3z" fill="currentColor"/></svg>,
  },
  { href: "/commodities", label: "Commodities", key: "commodities",
    icon: <svg width="18" height="18" viewBox="0 0 24 24"><rect x="8" y="4" width="8" height="5" rx="1" fill="currentColor"/><rect x="4" y="11" width="7" height="5" rx="1" fill="currentColor"/><rect x="13" y="11" width="7" height="5" rx="1" fill="currentColor"/></svg>,
  },
  { href: "/cash", label: "Saving Accounts", key: "cash",
    icon: <svg width="18" height="18" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" fill="currentColor"/><rect x="1" y="9" width="22" height="2" fill="var(--panel)"/></svg>,
  },
  { href: "/lands", label: "Land", key: "lands",
    icon: <svg width="18" height="18" viewBox="0 0 24 24"><path d="M3 21h18v-2H3v2zm2-4h14l-3-7-2 3-3-5-6 9z" fill="currentColor"/></svg>,
  },
];

const BOTTOM_ITEMS = [
  { href: "/about", label: "About Us",
    icon: <svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/><text x="12" y="17" textAnchor="middle" fontSize="14" fontWeight="bold" fill="var(--panel)">?</text></svg>,
  },
  { href: "/settings", label: "Settings",
    icon: <svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="currentColor"/><rect x="9" y="1" width="6" height="4" rx="1" fill="currentColor" transform="rotate(0 12 12)"/><rect x="9" y="1" width="6" height="4" rx="1" fill="currentColor" transform="rotate(60 12 12)"/><rect x="9" y="1" width="6" height="4" rx="1" fill="currentColor" transform="rotate(120 12 12)"/><rect x="9" y="1" width="6" height="4" rx="1" fill="currentColor" transform="rotate(180 12 12)"/><rect x="9" y="1" width="6" height="4" rx="1" fill="currentColor" transform="rotate(240 12 12)"/><rect x="9" y="1" width="6" height="4" rx="1" fill="currentColor" transform="rotate(300 12 12)"/><circle cx="12" cy="12" r="3" fill="var(--panel)"/></svg>,
  },
];

const BRIEFCASE_ICON = <svg width="18" height="18" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" fill="currentColor"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" fill="none" stroke="currentColor" strokeWidth="2"/></svg>;

const CHEVRON_ICON = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6,9 12,15 18,9"/></svg>;

export default function Sidebar({ assetSelection }: { assetSelection: string[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const pathname = usePathname();

  const visibleAssets = assetSelection.length > 0
    ? MY_ASSETS_ITEMS.filter((item) => assetSelection.includes(item.key))
    : MY_ASSETS_ITEMS;

  const assetRoutes = visibleAssets.map((item) => item.href);
  const isMyAssetsActive = assetRoutes.some((r) => pathname.startsWith(r));
  const myAssetsOpen = hoverOpen || isMyAssetsActive;

  function isActive(href: string) {
    if (href === "/home") return pathname === "/home";
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

        {collapsed ? (
          <div className="my-assets-collapsed">
            <span className="sidebar-icon">{BRIEFCASE_ICON}</span>
          </div>
        ) : (
          <div
            className={`my-assets-section${isMyAssetsActive ? " my-assets-active" : ""}`}
            onMouseEnter={() => setHoverOpen(true)}
            onMouseLeave={() => setHoverOpen(false)}
          >
            <div className={`my-assets-parent${isMyAssetsActive ? " active" : ""}`}>
              <span className="sidebar-icon">{BRIEFCASE_ICON}</span>
              <span className="sidebar-label">My Assets</span>
              <span className={`my-assets-arrow${myAssetsOpen ? " open" : ""}`}>{CHEVRON_ICON}</span>
            </div>
            <div className={`my-assets-dropdown${myAssetsOpen ? " open" : ""}`}>
              {visibleAssets.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={isActive(item.href) ? "active" : ""}
                >
                  <span className="sidebar-icon">{item.icon}</span>
                  <span className="sidebar-label">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <nav>
          {CHAT_ITEMS.map((item) => (
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
