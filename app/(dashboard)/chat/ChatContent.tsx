"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatContent() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorPopup, setErrorPopup] = useState<string | null>(null);
  const [imageRejected, setImageRejected] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (imageRejected) {
      const t = setTimeout(() => setImageRejected(false), 4000);
      return () => clearTimeout(t);
    }
  }, [imageRejected]);

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item?.type?.startsWith("image/")) {
        e.preventDefault();
        setImageRejected(true);
        return;
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setErrorPopup(
          err?.error ||
            err?.detail ||
            "Unable to reach the AI. Please check your Anthropic API key in Settings.",
        );
        setLoading(false);
        return;
      }

      const assistantMsg: Message = { role: "assistant", content: "" };
      setMessages([...updatedMessages, assistantMsg]);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Anthropic SDK stream returns SSE format: event: content_block_delta, data: {...}
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const json = JSON.parse(line.slice(6));
              if (json.type === "content_block_delta" && json.delta?.text) {
                accumulated += json.delta.text;
                setMessages((prev) => {
                  const next = [...prev];
                  next[next.length - 1] = { role: "assistant", content: accumulated };
                  return next;
                });
              }
            } catch {
              // Ignore malformed SSE chunks
            }
          }
        }
      }
    } catch {
      setErrorPopup("Unable to reach the AI. Please check your Anthropic API key in Settings.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {errorPopup && (
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
          onClick={() => setErrorPopup(null)}
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
              onClick={() => setErrorPopup(null)}
              style={{
                position: "absolute",
                top: 8,
                right: 12,
                margin: 0,
                padding: "2px 8px",
                background: "transparent",
                color: "var(--muted)",
                fontSize: 20,
                fontWeight: 400,
                lineHeight: 1,
              }}
            >
              ×
            </button>
            <h3 style={{ margin: "0 0 12px", color: "var(--warn)" }}>
              Unable to connect
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.6 }}>
              {errorPopup}
            </p>
            <button
              type="button"
              onClick={() => router.push("/settings")}
              style={{ marginTop: 0 }}
            >
              Go to Settings
            </button>
          </div>
        </div>
      )}

    <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: "60vh" }}>
      {imageRejected && (
        <div
          style={{
            padding: "8px 14px",
            marginBottom: 12,
            borderRadius: 8,
            background: "var(--warn-bg, rgba(255,193,7,0.12))",
            color: "var(--warn)",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>Images are not supported — please describe what you see in text instead.</span>
          <button
            type="button"
            onClick={() => setImageRejected(false)}
            style={{
              margin: "0 0 0 auto",
              padding: "2px 6px",
              background: "transparent",
              color: "var(--warn)",
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", maxHeight: "55vh", paddingBottom: 12 }}>
        {messages.length === 0 ? (
          <p className="muted" style={{ textAlign: "center", padding: "40px 0" }}>
            Ask something about your portfolio. For example:<br />
            <em>&ldquo;How many days of runway do I have?&rdquo;</em> or{" "}
            <em>&ldquo;Which commodity has the best return?&rdquo;</em>
          </p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              style={{
                marginBottom: 16,
                padding: "10px 14px",
                borderRadius: 10,
                background: m.role === "user" ? "var(--panel-2)" : "var(--panel)",
                border: m.role === "assistant" ? "1px solid var(--border)" : "none",
                maxWidth: "95%",
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                fontSize: 14,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                {m.role === "user" ? "You" : "KYNZi"}
              </div>
              {m.content || (loading && i === messages.length - 1 ? (
                <span className="muted">Thinking...</span>
              ) : null)}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          gap: 8,
          paddingTop: 12,
          borderTop: "1px solid var(--border)",
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={handlePaste}
          placeholder={loading ? "Waiting for response..." : "Ask about your portfolio..."}
          disabled={loading}
          style={{ flex: 1, marginBottom: 0 }}
        />
        <button type="submit" disabled={loading || !input.trim()} style={{ marginTop: 0, flexShrink: 0 }}>
          {loading ? "..." : "Send"}
        </button>
      </form>
    </div>
    </>
  );
}
