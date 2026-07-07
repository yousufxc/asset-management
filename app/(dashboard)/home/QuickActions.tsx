import Link from "next/link";

const ACTIONS = [
  {
    label: "Add Property",
    href: "/properties",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24">
        <path d="M12 3L2 12h3v9h6v-6h2v6h6v-9h3L12 3z" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "Add Saving Account",
    href: "/cash",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24">
        <rect x="1" y="4" width="22" height="16" rx="2" fill="currentColor" />
        <rect x="1" y="9" width="22" height="2" fill="var(--panel)" />
      </svg>
    ),
  },
  {
    label: "Add Commodity",
    href: "/commodities",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24">
        <rect x="8" y="4" width="8" height="5" rx="1" fill="currentColor" />
        <rect x="4" y="11" width="7" height="5" rx="1" fill="currentColor" />
        <rect x="13" y="11" width="7" height="5" rx="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "Record Installment",
    href: "/properties",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24">
        <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" />
        <line x1="12" y1="10" x2="12" y2="19" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    label: "Chat with AI",
    href: "/chat",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="currentColor" />
      </svg>
    ),
  },
];

export default function QuickActions() {
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Quick Actions</h3>
      <div className="row" style={{ gap: 12 }}>
        {ACTIONS.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="card"
            style={{
              flex: "1 1 150px",
              minWidth: 140,
              maxWidth: 200,
              padding: "16px",
              textAlign: "center",
              textDecoration: "none",
              cursor: "pointer",
              transition: "border-color 0.2s",
            }}
          >
            <div style={{ color: "var(--accent)", marginBottom: 8 }}>{action.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              {action.label}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
