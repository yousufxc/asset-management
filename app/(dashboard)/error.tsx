"use client";

import { useEffect } from "react";

export default function DashboardErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("KYNZi dashboard error:", error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 20px",
        textAlign: "center",
      }}
    >
      <h2 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 12px", color: "var(--bad)" }}>
        Something went wrong
      </h2>
      <p className="muted" style={{ maxWidth: 480, lineHeight: 1.6, margin: "0 0 24px" }}>
        An error occurred while loading this section. Your data is safe.
      </p>
      <button
        type="button"
        onClick={reset}
        style={{ marginTop: 0 }}
      >
        Try again
      </button>
    </div>
  );
}
