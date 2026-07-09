"use client";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onCancel}
    >
      <div
        className="card"
        style={{
          maxWidth: 420,
          width: "90%",
          padding: "28px 24px",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          style={{
            position: "absolute",
            top: 8,
            right: 12,
            background: "transparent",
            border: "none",
            fontSize: 20,
            color: "var(--muted)",
            cursor: "pointer",
            padding: 0,
            lineHeight: 1,
          }}
        >
          ×
        </button>
        <h3 style={{ margin: "0 0 12px" }}>{title}</h3>
        <p style={{ margin: "0 0 20px", color: "var(--muted)" }}>{message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ marginTop: 0, background: "var(--panel-2)", color: "var(--muted)" }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{ marginTop: 0 }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
