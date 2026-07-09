"use client";

import { useEffect, useState } from "react";

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

export default function NewsDigest() {
  const [gulf, setGulf] = useState<NewsItem[]>([]);
  const [global, setGlobal] = useState<NewsItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    fetch("/api/home/news")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setGulf(data.gulf ?? []);
          setGlobal(data.global ?? []);
        }
      })
      .catch(() => setError("News unavailable"))
      .finally(() => setLoading(false));

    fetch("/api/home/news-summary")
      .then((res) => res.json())
      .then((data) => setSummary(data.summary ?? null))
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>News</h3>
        <span className="muted">Loading headlines...</span>
      </div>
    );
  }

  if (error && gulf.length === 0 && global.length === 0) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>News</h3>
        <span className="muted">News temporarily unavailable</span>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>News</h3>

      {!summaryLoading && summary && (
        <div style={{
          padding: "12px 14px",
          marginBottom: 16,
          borderLeft: "3px solid var(--accent)",
          backgroundColor: "rgba(0,167,209,0.06)",
          borderRadius: "0 6px 6px 0",
          fontSize: 14,
          lineHeight: 1.6,
        }}>
          <div style={{ fontSize: 11, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            Key Insights
          </div>
          {summary}
        </div>
      )}
      {summaryLoading && (
        <div style={{ padding: "10px 0", color: "var(--muted)", fontSize: 14, marginBottom: 12 }}>
          Generating key insights...
        </div>
      )}

      {gulf.length > 0 && (
        <>
          <h4 style={{ margin: "16px 0 10px", color: "var(--muted)", fontSize: 13, textTransform: "uppercase", letterSpacing: 1 }}>
            Gulf Market News
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {gulf.slice(0, 6).map((item, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 14 }}>
                <span className="pill upcoming" style={{ fontSize: 10, flexShrink: 0 }}>
                  {item.source}
                </span>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--text)", flex: 1 }}
                >
                  {item.title}
                </a>
                {item.pubDate && (
                  <span className="muted" style={{ fontSize: 11, flexShrink: 0 }}>
                    {new Date(item.pubDate).toLocaleDateString("en-AE", { day: "numeric", month: "short" })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {global.length > 0 && (
        <>
          <h4 style={{ margin: "20px 0 10px", color: "var(--muted)", fontSize: 13, textTransform: "uppercase", letterSpacing: 1 }}>
            Global
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {global.slice(0, 6).map((item, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 14 }}>
                <span className="pill upcoming" style={{ fontSize: 10, flexShrink: 0 }}>
                  {item.source}
                </span>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--text)", flex: 1 }}
                >
                  {item.title}
                </a>
                {item.pubDate && (
                  <span className="muted" style={{ fontSize: 11, flexShrink: 0 }}>
                    {new Date(item.pubDate).toLocaleDateString("en-AE", { day: "numeric", month: "short" })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
