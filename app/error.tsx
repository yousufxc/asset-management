"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("KYNZi runtime error:", error);
  }, [error]);

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
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: "#9aa3b2", margin: "0 0 8px", maxWidth: 480, lineHeight: 1.6 }}>
            An unexpected error occurred while loading this page.
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 24px", fontFamily: "monospace" }}>
              ID: {error.digest}
            </p>
          )}
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
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
