"use client";

import { useEffect, useState, useCallback } from "react";
import type { WatchlistItem } from "@/lib/types";
import { formatAed, formatIsoToUae } from "@/lib/core/units";

export default function Watchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<"property" | "commodity">("property");
  const [saving, setSaving] = useState(false);

  const [label, setLabel] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [targetPricePerUnit, setTargetPricePerUnit] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [metalType, setMetalType] = useState("gold");
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState("gram");

  const fetchItems = useCallback(() => {
    fetch("/api/watchlist")
      .then((res) => res.json())
      .then((data) => setItems(data.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  function resetForm() {
    setLabel("");
    setTargetPrice("");
    setTargetPricePerUnit("");
    setPropertyType("");
    setCity("");
    setArea("");
    setMetalType("gold");
    setWeight("");
    setWeightUnit("gram");
    setShowForm(false);
  }

  async function handleAdd() {
    if (!label.trim()) return;
    setSaving(true);
    const body: Record<string, unknown> = {
      type: formType,
      label: label.trim(),
    };

    if (formType === "property") {
      if (targetPrice) body.target_price_aed = parseFloat(targetPrice);
      if (propertyType) body.property_type = propertyType;
      if (city.trim()) body.city = city.trim();
      if (area.trim()) body.area = area.trim();
    } else {
      if (targetPricePerUnit) body.target_price_per_unit_aed = parseFloat(targetPricePerUnit);
      body.metal_type = metalType;
      if (weight) body.weight = parseFloat(weight);
      body.weight_unit = weightUnit;
    }

    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        resetForm();
        fetchItems();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
    fetchItems();
  }

  if (loading) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Watchlist</h3>
        <span className="muted">Loading...</span>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Watchlist</h3>
        {!showForm && (
          <button style={{ margin: 0, fontSize: 13, padding: "6px 14px" }} onClick={() => setShowForm(true)}>
            + Add
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ marginTop: 16, padding: 16, background: "var(--panel-2)", borderRadius: 8 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <label style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input
                type="radio"
                checked={formType === "property"}
                onChange={() => setFormType("property")}
                style={{ width: "auto", margin: 0 }}
              />
              Property
            </label>
            <label style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input
                type="radio"
                checked={formType === "commodity"}
                onChange={() => setFormType("commodity")}
                style={{ width: "auto", margin: 0 }}
              />
              Commodity
            </label>
          </div>

          <label>Name / Label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={formType === "property" ? "e.g. Palm Jumeirah Villa" : "e.g. Gold bar"} />

          {formType === "property" ? (
            <>
              <label>Target Purchase Price (AED)</label>
              <input type="number" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} placeholder="e.g. 2500000" />
              <label>Property Type</label>
              <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>
                <option value="">Select...</option>
                <option value="apartment">Apartment</option>
                <option value="penthouse">Penthouse</option>
                <option value="townhouse">Townhouse</option>
                <option value="villa">Villa</option>
                <option value="farm">Farm</option>
                <option value="commercial">Commercial</option>
              </select>
              <label>City</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Dubai" />
              <label>Area / Community</label>
              <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Palm Jumeirah" />
            </>
          ) : (
            <>
              <label>Target Buy Price (AED per unit)</label>
              <input type="number" value={targetPricePerUnit} onChange={(e) => setTargetPricePerUnit(e.target.value)} placeholder="e.g. 320" />
              <label>Metal Type</label>
              <select value={metalType} onChange={(e) => setMetalType(e.target.value)}>
                <option value="gold">Gold</option>
                <option value="silver">Silver</option>
                <option value="platinum">Platinum</option>
                <option value="palladium">Palladium</option>
                <option value="other">Other</option>
              </select>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 2 }}>
                  <label>Weight</label>
                  <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 50" />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Unit</label>
                  <select value={weightUnit} onChange={(e) => setWeightUnit(e.target.value)}>
                    <option value="gram">Gram</option>
                    <option value="kg">Kg</option>
                    <option value="troy_oz">Troy oz</option>
                    <option value="tola">Tola</option>
                  </select>
                </div>
              </div>
            </>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={handleAdd} disabled={saving} style={{ margin: 0 }}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={resetForm}
              style={{ margin: 0, background: "var(--panel-2)", color: "var(--text)", border: "1px solid var(--border)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !showForm && (
        <p className="muted" style={{ marginTop: 12 }}>No items yet. Add properties or commodities you&apos;re considering.</p>
      )}

      {items.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {item.label}
                  <span className="pill upcoming" style={{ marginLeft: 8, fontSize: 10 }}>
                    {item.type}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {item.type === "property" && (
                    <>
                      {item.property_type && `${item.property_type} · `}
                      {item.city && `${item.city}`}
                      {item.area && `, ${item.area}`}
                      {item.target_price_fils != null && ` · Target: ${formatAed(item.target_price_fils)}`}
                    </>
                  )}
                  {item.type === "commodity" && (
                    <>
                      {item.metal_type && `${item.metal_type.charAt(0).toUpperCase()}${item.metal_type.slice(1)}`}
                      {item.weight != null && item.weight_unit && ` · ${item.weight} ${item.weight_unit}`}
                      {item.target_price_per_unit_fils != null && ` · Target: ${formatAed(item.target_price_per_unit_fils)}/${item.weight_unit ?? "unit"}`}
                    </>
                  )}
                  {!item.property_type && !item.city && !item.metal_type && !item.target_price_fils && !item.target_price_per_unit_fils && (
                    `Added ${formatIsoToUae(item.created_at.slice(0, 10))}`
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(item.id)}
                style={{
                  margin: 0,
                  background: "transparent",
                  color: "var(--muted)",
                  padding: "4px 8px",
                  fontSize: 12,
                }}
                title="Remove from watchlist"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
