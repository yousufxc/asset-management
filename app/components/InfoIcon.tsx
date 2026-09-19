"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  title: string;
  text: string;
}

export default function InfoIcon({ title, text }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <span
      ref={wrapRef}
      style={{ position: "relative", display: "inline-flex", verticalAlign: "middle" }}
    >
      <button
        type="button"
        aria-label={`About ${title}`}
        aria-expanded={open}
        onClick={() => setOpen((p) => !p)}
        style={{
          border: "none",
          background: "transparent",
          color: "var(--muted)",
          cursor: "pointer",
          padding: "0 0 0 6px",
          margin: 0,
          fontSize: 13,
          lineHeight: 1,
          fontWeight: 400,
        }}
      >
        ⓘ
      </button>
      {open && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 40,
            width: 300,
            maxWidth: "min(300px, calc(100vw - 48px))",
            background: "var(--panel-2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "12px 14px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
          <div style={{ color: "var(--muted)" }}>{text}</div>
        </div>
      )}
    </span>
  );
}
