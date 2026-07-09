"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Land, LandMortgage } from "@/lib/types";
import { filsToAed, formatAed, formatIsoToUae } from "@/lib/core/units";
import { computeMonthlyPayment, computeOutstandingBalance, computeLoanEndDate, monthsElapsed } from "@/lib/core/mortgage";
import { numeralOnly } from "./numeralOnly";
import AnimateOnScroll from "@/app/components/AnimateOnScroll";

const LAND_TYPE_LABEL: Record<string, string> = {
  residential: "Residential",
  commercial: "Commercial",
  agricultural: "Agricultural",
  industrial: "Industrial",
  mixed_use: "Mixed Use",
  other: "Other",
};

function aedInputOrEmpty(fils: number | null): string {
  return fils != null ? filsToAed(fils).toString() : "";
}

function formatIsoDisplay(iso: string | null): string {
  if (!iso) return "—";
  try {
    return formatIsoToUae(iso);
  } catch {
    return iso;
  }
}

const today = new Date().toLocaleDateString("en-CA");

export default function LandDetailPanel({ land }: { land: Land }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [mortgage, setMortgage] = useState<LandMortgage | null>(null);
  const [editIsMortgage, setEditIsMortgage] = useState(false);
  const [editMortgageRateType, setEditMortgageRateType] = useState<string>("fixed");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/land-mortgages?land_id=${land.id}`);
      if (cancelled) return;
      if (res.ok) {
        const data = await res.json();
        setMortgage(data.mortgage ?? null);
        setEditIsMortgage(data.mortgage != null);
        setEditMortgageRateType(data.mortgage?.rate_type ?? "fixed");
      }
    }
    load();
    return () => { cancelled = true; };
  }, [land.id]);

  const todayIso = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    setEditing(false);
    setError(null);
  }, [land]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const fd = new FormData(e.currentTarget);

    const numOrNull = (k: string) => {
      const v = fd.get(k);
      return v === "" || v === null ? null : Number(v);
    };
    const strOrNull = (k: string) => {
      const v = fd.get(k);
      return v === "" || v === null ? null : String(v);
    };

    const payload: Record<string, unknown> = {};

    const nameVal = String(fd.get("name") ?? "");
    if (nameVal !== land.name) payload.name = nameVal;

    const landTypeVal = strOrNull("land_type");
    if (landTypeVal !== (land.land_type ?? null)) payload.land_type = landTypeVal;

    const cityVal = strOrNull("city");
    if (cityVal !== (land.city ?? null)) payload.city = cityVal;

    const areaVal = strOrNull("area");
    if (areaVal !== (land.area ?? null)) payload.area = areaVal;

    const sizeVal = numOrNull("size_sqft");
    if (sizeVal !== (land.size_sqft ?? null)) payload.size_sqft = sizeVal;

    const priceVal = numOrNull("purchase_price_aed");
    if (priceVal !== (land.purchase_price_fils != null ? filsToAed(land.purchase_price_fils) : null)) {
      payload.purchase_price_aed = priceVal;
    }

    const valueVal = numOrNull("current_value_aed");
    if (valueVal !== (land.current_value_fils != null ? filsToAed(land.current_value_fils) : null)) {
      payload.current_value_aed = valueVal;
    }

    const purchasedVal = strOrNull("purchased_at");
    if (purchasedVal !== (land.purchased_at ?? null)) payload.purchased_at = purchasedVal;

    const valuedVal = strOrNull("valued_at");
    if (valuedVal !== (land.valued_at ?? null)) payload.valued_at = valuedVal;

    const notesVal = strOrNull("notes");
    if (notesVal !== (land.notes ?? null)) payload.notes = notesVal;

    if (Object.keys(payload).length === 0) {
      // No land changes — skip the PATCH but still handle mortgage below
    } else {
      const res = await fetch(`/api/lands/${land.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setSaving(false);
        const data = await res.json().catch(() => ({}));
        setError(data?.error ? JSON.stringify(data.error) + (data.issues ? " " + JSON.stringify(data.issues.fieldErrors) : "") : "Save failed");
        return;
      }
    }

    const mortgageNeedsSave = editIsMortgage !== (mortgage != null) ||
      (editIsMortgage && (
        Number(fd.get("land_mortgage_loan_amount_aed") || 0) !== (mortgage ? filsToAed(mortgage.loan_amount_fils) : 0) ||
        Number(fd.get("land_mortgage_interest_rate_pct") || 0) !== (mortgage?.interest_rate_pct ?? 0) ||
        editMortgageRateType !== (mortgage?.rate_type ?? "fixed") ||
        String(fd.get("land_mortgage_loan_start_date") ?? "") !== (mortgage?.loan_start_date ?? "") ||
        (Number(fd.get("land_mortgage_loan_term_years") || 0) * 12) !== (mortgage?.loan_term_months ?? 0) ||
        String(fd.get("land_mortgage_lender_name") ?? "") !== (mortgage?.lender_name ?? "") ||
        String(fd.get("land_mortgage_notes") ?? "") !== (mortgage?.notes ?? "")
      ));

    if (mortgageNeedsSave) {
      if (editIsMortgage && !mortgage) {
        const termYears = Number(fd.get("land_mortgage_loan_term_years"));
        const mtgPayload = {
          land_id: land.id,
          loan_amount_aed: Number(fd.get("land_mortgage_loan_amount_aed")),
          interest_rate_pct: Number(fd.get("land_mortgage_interest_rate_pct")),
          rate_type: editMortgageRateType,
          loan_start_date: String(fd.get("land_mortgage_loan_start_date") ?? ""),
          loan_term_months: termYears * 12,
          lender_name: String(fd.get("land_mortgage_lender_name") ?? ""),
          notes: strOrNull("land_mortgage_notes"),
        };
        const mtgRes = await fetch("/api/land-mortgages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mtgPayload),
        });
        if (!mtgRes.ok) {
          setSaving(false);
          setError("Land saved but mortgage creation failed");
          return;
        }
      } else if (editIsMortgage && mortgage) {
        const mtgPayload: Record<string, unknown> = {};
        const newAmount = Number(fd.get("land_mortgage_loan_amount_aed"));
        const oldAmount = filsToAed(mortgage.loan_amount_fils);
        if (newAmount !== oldAmount) mtgPayload.loan_amount_aed = newAmount;

        const newRate = Number(fd.get("land_mortgage_interest_rate_pct"));
        if (newRate !== mortgage.interest_rate_pct) mtgPayload.interest_rate_pct = newRate;

        if (editMortgageRateType !== mortgage.rate_type) mtgPayload.rate_type = editMortgageRateType;

        const newStart = String(fd.get("land_mortgage_loan_start_date") ?? "");
        if (newStart !== mortgage.loan_start_date) mtgPayload.loan_start_date = newStart;

        const newTerm = Number(fd.get("land_mortgage_loan_term_years")) * 12;
        if (newTerm !== mortgage.loan_term_months) mtgPayload.loan_term_months = newTerm;

        const newLender = String(fd.get("land_mortgage_lender_name") ?? "");
        if (newLender !== mortgage.lender_name) mtgPayload.lender_name = newLender;

        const newNotes = strOrNull("land_mortgage_notes");
        if (newNotes !== (mortgage.notes ?? null)) mtgPayload.notes = newNotes;

        if (Object.keys(mtgPayload).length > 0) {
          const mtgRes = await fetch(`/api/land-mortgages/${mortgage.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mtgPayload),
          });
          if (!mtgRes.ok) {
            setSaving(false);
            setError("Land saved but mortgage update failed");
            return;
          }
        }
      } else if (!editIsMortgage && mortgage) {
        const mtgRes = await fetch(`/api/land-mortgages/${mortgage.id}`, { method: "DELETE" });
        if (!mtgRes.ok) {
          setSaving(false);
          setError("Land saved but mortgage removal failed");
          return;
        }
      }
    }

    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  function handleCancel() {
    setEditing(false);
    setError(null);
    setEditIsMortgage(mortgage != null);
    setEditMortgageRateType(mortgage?.rate_type ?? "fixed");
  }

  async function handleRemove() {
    if (!confirm("Remove this land? This cannot be undone.")) return;
    setRemoving(true);
    const res = await fetch(`/api/lands/${land.id}`, { method: "DELETE" });
    if (!res.ok) {
      setRemoving(false);
      setError("Failed to remove land");
      return;
    }
    router.push("/lands");
    router.refresh();
  }

  const renderReadOnly = () => (
    <>
      <div className="detail-row">
        <span className="detail-label">Name</span>
        <span>{land.name}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Type</span>
        <span>{land.land_type ? (LAND_TYPE_LABEL[land.land_type] ?? land.land_type) : "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">City</span>
        <span>{land.city ?? "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Area</span>
        <span>{land.area ?? "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Size</span>
        <span>{land.size_sqft != null ? `${land.size_sqft.toLocaleString()} sqft` : "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Purchase price</span>
        <span>{land.purchase_price_fils != null ? formatAed(land.purchase_price_fils) : "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Current value</span>
        <span>{land.current_value_fils != null ? formatAed(land.current_value_fils) : "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Date of purchase</span>
        <span>{formatIsoDisplay(land.purchased_at)}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Date of valuation</span>
        <span>{formatIsoDisplay(land.valued_at)}</span>
      </div>
      {mortgage ? (
        (() => {
          const monthlyPayment = computeMonthlyPayment(mortgage.loan_amount_fils, mortgage.interest_rate_pct, mortgage.loan_term_months);
          const elapsed = monthsElapsed(mortgage.loan_start_date, todayIso);
          const outstanding = computeOutstandingBalance(mortgage.loan_amount_fils, mortgage.interest_rate_pct, mortgage.loan_term_months, elapsed);
          const endDate = computeLoanEndDate(mortgage.loan_start_date, mortgage.loan_term_months);
          return (
            <>
              <div className="detail-row">
                <span className="detail-label">Mortgage</span>
                <span style={{ fontWeight: 600 }}>{mortgage.lender_name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Loan amount</span>
                <span>{mortgage.loan_amount_fils != null ? formatAed(mortgage.loan_amount_fils) : "—"}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Interest rate</span>
                <span>{mortgage.interest_rate_pct}% ({mortgage.rate_type})</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Monthly payment</span>
                <span>{formatAed(monthlyPayment)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Outstanding balance</span>
                <span>{formatAed(outstanding)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Loan period</span>
                <span>{formatIsoDisplay(mortgage.loan_start_date)} — {formatIsoToUae(endDate)} ({mortgage.loan_term_months / 12} years)</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Payments made</span>
                <span>{elapsed} of {mortgage.loan_term_months}</span>
              </div>
              {mortgage.notes && (
                <div className="detail-row">
                  <span className="detail-label">Mortgage notes</span>
                  <span style={{ whiteSpace: "pre-wrap" }}>{mortgage.notes}</span>
                </div>
              )}
            </>
          );
        })()
      ) : (
        <div className="detail-row">
          <span className="detail-label">Mortgage</span>
          <span className="muted">No mortgage</span>
        </div>
      )}
      <div className="detail-row">
        <span className="detail-label">Created</span>
        <span className="muted">{formatIsoDisplay(land.created_at)}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Updated</span>
        <span className="muted">{formatIsoDisplay(land.updated_at)}</span>
      </div>
      {land.notes ? (
        <div className="detail-row">
          <span className="detail-label">Notes</span>
          <span style={{ whiteSpace: "pre-wrap" }}>{land.notes}</span>
        </div>
      ) : (
        <div className="detail-row">
          <span className="detail-label">Notes</span>
          <span className="muted">No notes added</span>
        </div>
      )}
    </>
  );

  const renderEditForm = () => (
    <form onSubmit={handleSave} className="detail-edit-form">
      <div className="row">
        <div style={{ flex: 2, minWidth: 200 }}>
          <label>Name *</label>
          <input
            name="name"
            type="text"
            required
            defaultValue={land.name}
            placeholder="e.g. Emirates Hills Plot 42"
          />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Type</label>
          <select name="land_type" defaultValue={land.land_type ?? ""}>
            <option value="">Select</option>
            {Object.entries(LAND_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>City</label>
          <input name="city" type="text" defaultValue={land.city ?? ""} placeholder="e.g. Dubai" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Area</label>
          <input name="area" type="text" defaultValue={land.area ?? ""} placeholder="e.g. Emirates Hills" />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label>Size (sqft)</label>
          <input
            name="size_sqft"
            type="number"
            step="any"
            defaultValue={land.size_sqft ?? ""}
            placeholder="e.g. 5000"
            onKeyDown={numeralOnly}
          />
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Purchase price (AED)</label>
          <input
            name="purchase_price_aed"
            type="number"
            step="0.01"
            defaultValue={aedInputOrEmpty(land.purchase_price_fils)}
            placeholder="Enter purchase price"
            onKeyDown={numeralOnly}
          />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Current value (AED)</label>
          <input
            name="current_value_aed"
            type="number"
            step="0.01"
            defaultValue={aedInputOrEmpty(land.current_value_fils)}
            placeholder="Enter current value"
            onKeyDown={numeralOnly}
          />
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Date of purchase</label>
          <input
            name="purchased_at"
            type="date"
            max={today}
            defaultValue={land.purchased_at ?? ""}
          />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Date of valuation</label>
          <input
            name="valued_at"
            type="date"
            max={today}
            defaultValue={land.valued_at ?? ""}
          />
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        <input
          name="is_land_mortgage"
          type="checkbox"
          style={{ width: "auto" }}
          checked={editIsMortgage}
          onChange={(e) => setEditIsMortgage(e.target.checked)}
        />{" "}
        This land is on a mortgage
      </label>
      {editIsMortgage && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginTop: 12 }}>
          <h4 style={{ marginTop: 0, marginBottom: 12 }}>Mortgage details</h4>
          <div className="row">
            <div style={{ flex: 1, minWidth: 160 }}>
              <label>Loan amount (AED) *</label>
              <input
                name="land_mortgage_loan_amount_aed"
                type="number"
                step="0.01"
                onKeyDown={numeralOnly}
                required
                defaultValue={mortgage ? filsToAed(mortgage.loan_amount_fils) : ""}
                placeholder="e.g. 500000"
              />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label>Annual interest rate (%) *</label>
              <input
                name="land_mortgage_interest_rate_pct"
                type="number"
                step="0.01"
                onKeyDown={numeralOnly}
                required
                defaultValue={mortgage?.interest_rate_pct ?? ""}
                placeholder="e.g. 3.99"
              />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label>Rate type *</label>
              <select
                name="land_mortgage_rate_type"
                value={editMortgageRateType}
                onChange={(e) => setEditMortgageRateType(e.target.value)}
              >
                <option value="fixed">Fixed</option>
                <option value="variable">Variable</option>
              </select>
            </div>
          </div>
          <div className="row">
            <div style={{ flex: 1, minWidth: 160 }}>
              <label>Loan start date *</label>
              <input
                name="land_mortgage_loan_start_date"
                type="date"
                max={todayIso}
                required
                defaultValue={mortgage?.loan_start_date ?? ""}
              />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label>Loan term (years) *</label>
              <input
                name="land_mortgage_loan_term_years"
                type="number"
                min="1"
                max="40"
                step="1"
                required
                defaultValue={mortgage ? mortgage.loan_term_months / 12 : ""}
                placeholder="e.g. 25"
              />
            </div>
            <div style={{ flex: 2, minWidth: 220 }}>
              <label>Lender / bank name *</label>
              <input
                name="land_mortgage_lender_name"
                required
                defaultValue={mortgage?.lender_name ?? ""}
                placeholder="e.g. Emirates NBD"
              />
            </div>
          </div>
          <div className="row">
            <div style={{ flex: 1 }}>
              <label>Notes</label>
              <textarea
                name="land_mortgage_notes"
                rows={2}
                defaultValue={mortgage?.notes ?? ""}
                placeholder="Any additional details about this mortgage"
              />
            </div>
          </div>
        </div>
      )}
      <label>Notes</label>
      <textarea
        name="notes"
        rows={3}
        defaultValue={land.notes ?? ""}
        placeholder="Optional notes about this land"
      />
      {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
        <button
          type="button"
          onClick={handleRemove}
          disabled={removing}
          style={{ marginTop: 0, background: "var(--bad)", color: "#fff", fontSize: 12, padding: "6px 12px" }}
        >
          {removing ? "Removing..." : "Remove Land"}
        </button>
        <div className="row" style={{ gap: 8 }}>
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            style={{
              marginTop: 0,
              background: "var(--panel-2)",
              color: "var(--muted)",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );

  return (
    <AnimateOnScroll><div className="card">
      <div className="detail-header">
        <h3 style={{ margin: 0 }}>{land.name}</h3>
        <button
          type="button"
          onClick={() => router.push("/lands")}
          style={{
            marginTop: 0,
            background: "transparent",
            color: "var(--muted)",
            padding: "4px 10px",
            fontSize: 18,
            fontWeight: 400,
            lineHeight: 1,
            flexShrink: 0,
          }}
          title="Close"
        >
          ×
        </button>
      </div>
      {editing ? renderEditForm() : renderReadOnly()}
      {!editing && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{ marginTop: 0, fontSize: 13 }}
          >
            Edit Land Info
          </button>
        </div>
      )}
    </div></AnimateOnScroll>
  );
}
