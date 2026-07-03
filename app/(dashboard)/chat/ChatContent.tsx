"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatContent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages([...updatedMessages, assistantMsg]);

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
        const err = await res.json();
        throw new Error(err.error || err.detail || "Request failed");
      }

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
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "An error occurred";
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: `Error: ${errMsg}`,
        };
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: "60vh" }}>
      <div style={{ flex: 1, overflowY: "auto", maxHeight: "55vh", paddingBottom: 12 }}>
        {messages.length === 0 ? (
          <p className="muted" style={{ textAlign: "center", padding: "40px 0" }}>
            Ask something about your portfolio. For example:<br />
            <em>"How many days of runway do I have?"</em> or{" "}
            <em>"Which commodity has the best return?"</em>
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
          placeholder={loading ? "Waiting for response..." : "Ask about your portfolio..."}
          disabled={loading}
          style={{ flex: 1, marginBottom: 0 }}
        />
        <button type="submit" disabled={loading || !input.trim()} style={{ marginTop: 0, flexShrink: 0 }}>
          {loading ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}
