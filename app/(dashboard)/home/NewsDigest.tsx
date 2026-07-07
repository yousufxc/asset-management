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
