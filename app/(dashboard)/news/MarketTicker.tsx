"use client";

import { useEffect, useState } from "react";

interface MetalPrice {
  metal: string;
  pricePerGramAed: number;
}

const METAL_LABELS: Record<string, string> = {
  gold: "Gold",
  silver: "Silver",
  platinum: "Platinum",
  palladium: "Palladium",
};

export default function MarketTicker() {
  const [prices, setPrices] = useState<MetalPrice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/home/market-prices")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setPrices(data.prices ?? []);
      })
      .catch(() => setError("Market data unavailable"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Live Spot Prices</h3>
        <span className="muted">Loading market data...</span>
      </div>
    );
  }

  if (error || prices.length === 0) {
    return (
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Live Spot Prices</h3>
        <span className="muted">Market data temporarily unavailable</span>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: 12 }}>Live Spot Prices</h3>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
        {prices.map((p) => (
          <div key={p.metal} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              {METAL_LABELS[p.metal] ?? p.metal}
            </span>
            <span style={{ fontWeight: 700, fontSize: 16 }}>
              AED {p.pricePerGramAed.toFixed(2)}<span className="muted" style={{ fontSize: 12 }}>/g</span>
            </span>
          </div>
        ))}
        <span className="muted" style={{ fontSize: 11, marginLeft: "auto" }}>
          Live spot via gold-api.com
        </span>
      </div>
    </div>
  );
}
