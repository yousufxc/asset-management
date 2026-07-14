import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: 40,
        textAlign: "center",
        background: "#0d1117",
        color: "#e6e8ec",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 48, fontWeight: 700, margin: "0 0 8px", color: "#f0a020" }}>
        404
      </h1>
      <p style={{ fontSize: 16, color: "#9aa3b2", margin: "0 0 24px" }}>
        Page not found
      </p>
      <Link
        href="/dashboard"
        style={{
          padding: "10px 24px",
          fontSize: 14,
          fontWeight: 600,
          border: "1px solid #2a2f3a",
          borderRadius: 8,
          background: "#1f232c",
          color: "#e6e8ec",
          textDecoration: "none",
        }}
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
