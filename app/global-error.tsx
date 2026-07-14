"use client";

export default function GlobalErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
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
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 12px", color: "#dc3545" }}>
            KYNZi encountered a fatal error
          </h1>
          <p style={{ fontSize: 14, color: "#9aa3b2", margin: "0 0 24px", maxWidth: 480, lineHeight: 1.6 }}>
            The application could not load. Please try refreshing the page.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 600,
              border: "1px solid #2a2f3a",
              borderRadius: 8,
              background: "#1f232c",
              color: "#e6e8ec",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
