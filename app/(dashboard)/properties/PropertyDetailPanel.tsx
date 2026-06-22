"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Property, Installment, RentalDeposit, RentalHistory } from "@/lib/types";
import { filsToAed, formatIsoToUae, formatAed, parseDateToIso } from "@/lib/core/units";
import { pricePerSqftFils, rentalYieldPct, equityFils, instalmentProgressPct, daysUntilContractExpiry, totalROIPct, annualizedROIPct } from "@/lib/core/property-analytics";
import { installmentStatus } from "@/lib/core/installments";
import { depositStatus } from "@/lib/core/rental-deposits";
import { numeralOnly } from "./numeralOnly";
import InstallmentTimelineChart from "./charts/InstallmentTimelineChart";
import { MarkPaidButton, MarkUnpaidButton } from "./InstallmentActions";
import { MarkDepositedButton, MarkPendingButton } from "./DepositActions";
import AnimateOnScroll from "@/app/components/AnimateOnScroll";
import AnimateChartOnScroll from "@/app/components/AnimateChartOnScroll";

const TYPE_LABEL: Record<string, string> = {
  apartment: "Apartment",
  penthouse: "Penthouse",
  townhouse: "Townhouse",
  villa: "Villa",
};

const BEDROOMS_LABEL: Record<string, string> = {
  Studio: "Studio",
  "1BR": "1BR",
  "2BR": "2BR",
  "3BR": "3BR",
  "4BR": "4BR",
  "5BR": "5BR",
  "+5BR": "+5BR",
};

function formatAedValue(fils: number | null): string {
  if (fils === null || fils === undefined) return "—";
  return formatAed(fils); // app-standard "AED 1,234.00"
}

function formatIsoDisplay(iso: string | null): string {
  if (!iso) return "—";
  try {
    return formatIsoToUae(iso);
  } catch {
    return iso;
  }
}

function aedInputOrEmpty(fils: number | null): string {
  if (fils === null || fils === undefined) return "";
  return filsToAed(fils).toString();
}


export default function PropertyDetailPanel({ property, installments, deposits, history }: { property: Property; installments: Installment[]; deposits: RentalDeposit[]; history: RentalHistory[] }) {
  const router = useRouter();
  const todayIso = new Date().toISOString().slice(0, 10);
  const hasPendingInsts = installments.some((i) => i.status !== "paid" && i.paid_date === null);
  const [editing, setEditing] = useState(false);
  const [renewMode, setRenewMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [removing, setRemoving] = useState(false);

  const [editInsts, setEditInsts] = useState<Record<number, { due_date: string; amount_aed: string; milestone_label: string }>>({});

  useEffect(() => {
    if (editing && property.subcategory === "off_plan") {
      const map: Record<number, { due_date: string; amount_aed: string; milestone_label: string }> = {};
      for (const inst of installments) {
        map[inst.id] = {
          due_date: inst.due_date,
          amount_aed: inst.amount_fils != null ? filsToAed(inst.amount_fils).toString() : "",
          milestone_label: inst.milestone_label ?? "",
        };
      }
      setEditInsts(map);
    }
  }, [editing, property.subcategory]); // eslint-disable-line react-hooks/exhaustive-deps

  const [editSubcategory, setEditSubcategory] = useState<string>(property.subcategory);
  const [editIsRental, setEditIsRental] = useState(!!property.is_rental);
  const [editRentalType, setEditRentalType] = useState<string>(property.rental_type ?? "long_term");
  const [editCheques, setEditCheques] = useState<number>(property.rent_cheques_per_year ?? 1);

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

    const selectedSubcategory = String(fd.get("subcategory") ?? property.subcategory);
    const isRental = selectedSubcategory === "existing" && fd.get("is_rental") === "on";
    const formRentalType = isRental ? (String(fd.get("rental_type") ?? "long_term")) : null;

    if (renewMode) {
      const payload: Record<string, unknown> = { action: "renew" };
      if (formRentalType) payload.rental_type = formRentalType;

      const annualRent = isRental ? numOrNull("annual_rent_aed") : null;
      if (annualRent !== null) payload.annual_rent_aed = annualRent;

      const cheques = isRental ? numOrNull("rent_cheques_per_year") : null;
      if (cheques !== null) payload.rent_cheques_per_year = cheques;

      for (const n of [1, 2, 3, 4] as const) {
        const key = `rent_date_${n}`;
        const dateVal = isRental ? strOrNull(key) : null;
        if (dateVal !== null) payload[key] = dateVal;
      }

      if (formRentalType === "short_term") {
        const pmCompany = strOrNull("pm_company_name");
        if (pmCompany !== null) payload.pm_company_name = pmCompany;
        const pmCommission = numOrNull("pm_commission_pct");
        if (pmCommission !== null) payload.pm_commission_pct = pmCommission;
        const shortTermRent = numOrNull("short_term_annual_rent_aed");
        if (shortTermRent !== null) payload.short_term_annual_rent_aed = shortTermRent;
        const freq = strOrNull("short_term_return_frequency");
        if (freq !== null) payload.short_term_return_frequency = freq;
        const depositDate = strOrNull("short_term_rent_deposit_date");
        if (depositDate !== null) payload.short_term_rent_deposit_date = depositDate;
      }

      const contractStart = strOrNull("contract_start_date");
      if (contractStart !== null) payload.contract_start_date = contractStart;

      const res = await fetch(`/api/properties/${property.id}/rental-lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSaving(false);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ? JSON.stringify(data.error) + (data.issues ? " " + JSON.stringify(data.issues.fieldErrors) : "") : "Renew failed");
        return;
      }
      setEditing(false);
      setRenewMode(false);
      router.refresh();
      return;
    }

    const payload: Record<string, unknown> = {};

    const nameVal = String(fd.get("name") ?? "");
    if (nameVal !== property.name) payload.name = nameVal;

    const subVal = selectedSubcategory;
    if (subVal !== property.subcategory) payload.subcategory = subVal;

    const ptype = strOrNull("property_type");
    if (ptype !== (property.property_type ?? null)) payload.property_type = ptype;

    const bedrooms = strOrNull("bedrooms");
    if (bedrooms !== (property.bedrooms ?? null)) payload.bedrooms = bedrooms;

    const city = strOrNull("city");
    if (city !== (property.city ?? null)) payload.city = city;

    const area = strOrNull("area");
    if (area !== (property.area ?? null)) payload.area = area;

    const developer = strOrNull("developer");
    if (developer !== (property.developer ?? null)) payload.developer = developer;

    const sizeSqft = numOrNull("size_sqft");
    if (sizeSqft !== (property.size_sqft ?? null)) payload.size_sqft = sizeSqft;

    const serviceCharge = numOrNull("annual_service_charge_aed");
    const existingCharge = property.annual_service_charge_fils != null ? filsToAed(property.annual_service_charge_fils) : null;
    if (serviceCharge !== existingCharge) payload.annual_service_charge_aed = serviceCharge;

    const purchasePrice = numOrNull("purchase_price_aed");
    const existingPurchase = property.purchase_price_fils != null ? filsToAed(property.purchase_price_fils) : null;
    if (purchasePrice !== existingPurchase) payload.purchase_price_aed = purchasePrice;

    const purchasedAt = strOrNull("purchased_at");
    if (purchasedAt !== (property.purchased_at ?? null)) payload.purchased_at = purchasedAt;

    const currentValue = numOrNull("current_value_aed");
    const existingValue = property.current_value_fils != null ? filsToAed(property.current_value_fils) : null;
    if (currentValue !== existingValue) payload.current_value_aed = currentValue;

    const valuedAt = strOrNull("valued_at");
    if (valuedAt !== (property.valued_at ?? null)) payload.valued_at = valuedAt;

    if (isRental !== !!property.is_rental) payload.is_rental = isRental;
    if (formRentalType !== (property.rental_type ?? "long_term")) payload.rental_type = formRentalType;

    const annualRent = isRental ? numOrNull("annual_rent_aed") : null;
    const existingAnnual = property.annual_rent_fils != null ? filsToAed(property.annual_rent_fils) : null;
    if (annualRent !== existingAnnual) payload.annual_rent_aed = annualRent;

    const cheques = isRental ? numOrNull("rent_cheques_per_year") : null;
    if (cheques !== (property.rent_cheques_per_year ?? null)) payload.rent_cheques_per_year = cheques;

    for (const n of [1, 2, 3, 4] as const) {
      const key = `rent_date_${n}` as const;
      const dateVal = isRental ? strOrNull(key) : null;
      const existing = property[`rent_date_${n}` as keyof Property];
      if (dateVal !== (existing ?? null)) payload[key] = dateVal;
    }

    const pmCompanyName = isRental && formRentalType === "short_term" ? strOrNull("pm_company_name") : null;
    if (pmCompanyName !== (property.pm_company_name ?? null)) payload.pm_company_name = pmCompanyName;

    const pmCommission = isRental && formRentalType === "short_term" ? numOrNull("pm_commission_pct") : null;
    if (pmCommission !== (property.pm_commission_pct ?? null)) payload.pm_commission_pct = pmCommission;

    const shortTermAnnualRent = isRental && formRentalType === "short_term" ? numOrNull("short_term_annual_rent_aed") : null;
    const existingShortTermAnnual = property.short_term_annual_rent_fils != null ? filsToAed(property.short_term_annual_rent_fils) : null;
    if (shortTermAnnualRent !== existingShortTermAnnual) payload.short_term_annual_rent_aed = shortTermAnnualRent;

    const returnFreq = isRental && formRentalType === "short_term" ? strOrNull("short_term_return_frequency") : null;
    if (returnFreq !== (property.short_term_return_frequency ?? null)) payload.short_term_return_frequency = returnFreq;

    const depositDate = isRental && formRentalType === "short_term" ? strOrNull("short_term_rent_deposit_date") : null;
    if (depositDate !== (property.short_term_rent_deposit_date ?? null)) payload.short_term_rent_deposit_date = depositDate;

    const contractStart = isRental ? strOrNull("contract_start_date") : null;
    if (contractStart !== (property.contract_start_date ?? null)) payload.contract_start_date = contractStart;

    const notes = strOrNull("notes");
    if (notes !== (property.notes ?? null)) payload.notes = notes;

    if (Object.keys(payload).length === 0) {
      setSaving(false);
      setEditing(false);
      return;
    }

    const res = await fetch(`/api/properties/${property.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ? JSON.stringify(data.error) + (data.issues ? " " + JSON.stringify(data.issues.fieldErrors) : "") : "Save failed");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function handleRemove() {
    if (!confirm(`Remove "${property.name}"? This cannot be undone.`)) return;
    setRemoving(true);
    const res = await fetch(`/api/properties/${property.id}`, { method: "DELETE" });
    if (!res.ok) {
      setRemoving(false);
      setError("Failed to remove property");
      return;
    }
    router.push("/properties");
    router.refresh();
  }

  async function handleCancelContract() {
    if (!confirm("Cancel this tenancy contract? The property will be marked as Vacant. All rental history will be preserved.")) return;
    const res = await fetch(`/api/properties/${property.id}/rental-lifecycle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    if (res.ok) router.refresh();
    else setError("Failed to cancel contract");
  }

  async function handleMarkVacant() {
    if (!confirm("Mark property as Vacant? Current contract data will be preserved in rental history.")) return;
    const res = await fetch(`/api/properties/${property.id}/rental-lifecycle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "vacant" }),
    });
    if (res.ok) router.refresh();
    else setError("Failed to mark as vacant");
  }

  function handleRenewContract() {
    setRenewMode(true);
    setEditing(true);
  }

  function handleCancel() {
    setEditing(false);
    setRenewMode(false);
    setError(null);
    setEditSubcategory(property.subcategory);
    setEditIsRental(!!property.is_rental);
    setEditRentalType(property.rental_type ?? "long_term");
    setEditCheques(property.rent_cheques_per_year ?? 1);
  }

  async function handleSaveInstalment(instId: number) {
    const data = editInsts[instId];
    if (!data) return;
    try {
      parseDateToIso(data.due_date);
    } catch {
      setError("Invalid date format for instalment.");
      return;
    }
    const amount = Number(data.amount_aed);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Invalid amount for instalment.");
      return;
    }
    const res = await fetch(`/api/installments/${instId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        due_date: data.due_date,
        amount_aed: amount,
        milestone_label: data.milestone_label || null,
      }),
    });
    if (!res.ok) {
      setError("Failed to save instalment.");
      return;
    }
    setError(null);
    router.refresh();
  }

  async function handleDeleteInstalment(instId: number) {
    if (!confirm("Delete this instalment?")) return;
    const res = await fetch(`/api/installments/${instId}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to delete instalment.");
      return;
    }
    router.refresh();
  }

  async function handleAddInstalment() {
    const res = await fetch("/api/installments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        property_id: property.id,
        due_date: new Date().toISOString().slice(0, 10),
        amount_aed: 0,
        status: "upcoming",
        source: "manual",
      }),
    });
    if (!res.ok) {
      setError("Failed to add instalment.");
      return;
    }
    router.refresh();
  }

  const renderReadOnly = () => {
    const sqftFils = pricePerSqftFils(property);
    const ryPct = rentalYieldPct(property);
    const equity = equityFils(property, installments);
    const instProgress = instalmentProgressPct(installments);
    const contractDays = daysUntilContractExpiry(property, todayIso);
    const snapshotROI = totalROIPct(property);
    const annualizedROI = annualizedROIPct(property, todayIso);
    return (
    <>
      <div className="detail-row">
        <span className="detail-label">Name</span>
        <span>{property.name}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Category</span>
        <span>{property.subcategory === "off_plan" ? "Off-plan" : "Existing"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Property type</span>
        <span>{property.property_type ? TYPE_LABEL[property.property_type] : "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label"># of Bedrooms</span>
        <span>{property.bedrooms ? BEDROOMS_LABEL[property.bedrooms] : "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">City</span>
        <span>{property.city ?? "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Area</span>
        <span>{property.area ?? "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Developer</span>
        <span>{property.developer ?? "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Size (sqft)</span>
        <span>{property.size_sqft ?? "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Annual Service Charge</span>
        <span>{formatAedValue(property.annual_service_charge_fils)}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Purchase price</span>
        <span>{formatAedValue(property.purchase_price_fils)}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Date of purchase</span>
        <span>{formatIsoDisplay(property.purchased_at)}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Current value</span>
        <span>{formatAedValue(property.current_value_fils)}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Valued on</span>
        <span>{formatIsoDisplay(property.valued_at)}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Price per Sqft</span>
        <span>{sqftFils !== null ? formatAed(sqftFils) : "—"}</span>
      </div>
      <div className="detail-row">
        <span className="detail-label">Rental Yield</span>
        <span>{ryPct !== null ? `${ryPct.toFixed(1)}%` : "—"}</span>
      </div>
      {equity !== null && (
        <div className="detail-row">
          <span className="detail-label">Equity</span>
          <span style={{ fontWeight: 600, color: equity >= 0 ? "var(--good)" : "var(--bad)" }}>
            {formatAed(equity)}
          </span>
        </div>
      )}
      {property.purchase_price_fils != null && property.current_value_fils != null && property.purchase_price_fils > 0 && (
        <>
          <div className="detail-row">
            <span className="detail-label">Total ROI (snapshot)</span>
            <span>{snapshotROI !== null ? `${snapshotROI >= 0 ? "+" : ""}${snapshotROI.toFixed(1)}%` : "—"}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Total ROI (annualized)</span>
            <span>{annualizedROI !== null ? `${annualizedROI >= 0 ? "+" : ""}${annualizedROI.toFixed(1)}%` : "—"}</span>
          </div>
        </>
      )}
      {instProgress !== null && (
        <div className="detail-row">
          <span className="detail-label">Instalment Progress</span>
          <span style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, height: 10, background: "var(--panel-2)", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(instProgress, 100)}%`, background: "var(--accent)", borderRadius: 5, transition: "width 0.3s" }} />
              </div>
              <span style={{ fontSize: 12, whiteSpace: "nowrap" }}>{instProgress.toFixed(1)}%</span>
            </div>
          </span>
        </div>
      )}
      {contractDays !== null && (
        <div className="detail-row">
          <span className="detail-label">Contract</span>
          <span style={{ color: contractDays <= 60 ? "var(--warn)" : "var(--text)" }}>
            {contractDays <= 0
              ? "Expired"
              : contractDays <= 60
                ? `Expires in ${contractDays} days`
                : `${contractDays} days remaining`}
          </span>
        </div>
      )}
       {property.is_rental ? (
        <>
          <div className="detail-row">
            <span className="detail-label">Rental type</span>
            <span>{property.rental_type === "short_term" ? "Short-term" : "Long-term"}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Contract start</span>
            <span>{formatIsoDisplay(property.contract_start_date)}</span>
          </div>
          {((property.rental_type ?? "long_term") === "long_term") ? (
            <>
              <div className="detail-row">
                <span className="detail-label">Yearly rent</span>
                <span>{formatAedValue(property.annual_rent_fils)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Cheques per year</span>
                <span>{property.rent_cheques_per_year}</span>
              </div>
              {Array.from({ length: property.rent_cheques_per_year ?? 0 }, (_, i) => {
                const key = `rent_date_${i + 1}` as keyof Property;
                const date = property[key] as string | null;
                return (
                  <div className="detail-row" key={i}>
                    <span className="detail-label">Cheque {i + 1} date</span>
                    <span>{formatIsoDisplay(date)}</span>
                  </div>
                );
              })}
            </>
          ) : (
            <>
              <div className="detail-row">
                <span className="detail-label">PM company</span>
                <span>{property.pm_company_name ?? "—"}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Commission (%)</span>
                <span>{property.pm_commission_pct != null ? `${property.pm_commission_pct}%` : "—"}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Expected annual rent</span>
                <span>{formatAedValue(property.short_term_annual_rent_fils)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Return frequency</span>
                <span>{property.short_term_return_frequency ? `${property.short_term_return_frequency.charAt(0).toUpperCase()}${property.short_term_return_frequency.slice(1)}` : "—"}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Final deposit date</span>
                <span>{formatIsoDisplay(property.short_term_rent_deposit_date)}</span>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="detail-row">
          <span className="detail-label">Rental</span>
          <span>Not rented</span>
        </div>
      )}
      {property.notes && (
        <div className="detail-row">
          <span className="detail-label">Notes</span>
          <span style={{ whiteSpace: "pre-wrap" }}>{property.notes}</span>
        </div>
      )}
      {property.is_rental && deposits.length > 0 && (
        <details className="work" style={{ marginTop: 12 }}>
          <summary>{deposits.length} rental deposit(s) — show schedule</summary>
          <div className="work-body">
            {deposits.map((d) => {
              const liveStatus = depositStatus(d, todayIso);
              return (
                <div key={d.id} style={{ marginBottom: 8 }}>
                  Cheque {d.cheque_number} — {formatIsoToUae(d.deposit_date)} — {formatAed(d.amount_fils)}{" "}
                  <span className={`pill ${liveStatus}`}>{liveStatus}</span>
                  {liveStatus === "overdue" && (
                    <span style={{ color: "var(--warn)", marginLeft: 8, fontSize: 12 }}>
                      Overdue — deposit not yet received
                    </span>
                  )}
                  {liveStatus !== "deposited" ? (
                    <MarkDepositedButton depositId={d.id} />
                  ) : (
                    <MarkPendingButton depositId={d.id} />
                  )}
                </div>
              );
            })}
          </div>
        </details>
      )}
      {property.is_rental && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={handleRenewContract} style={{ marginTop: 0, fontSize: 12, padding: "6px 12px" }}>
            Renew Contract
          </button>
          <button type="button" onClick={handleCancelContract} style={{ marginTop: 0, fontSize: 12, padding: "6px 12px", background: "var(--warn)", color: "#fff" }}>
            Cancel Contract
          </button>
          <button type="button" onClick={handleMarkVacant} style={{ marginTop: 0, fontSize: 12, padding: "6px 12px", background: "var(--panel-2)", color: "var(--text)" }}>
            Mark as Vacant
          </button>
        </div>
      )}
      <button type="button" onClick={() => setShowHistory(!showHistory)} style={{ marginTop: 8, fontSize: 12, background: "var(--panel-2)", color: "var(--text)", padding: "6px 12px" }}>
        {showHistory ? "Hide Rental History" : "View Rental History"}
      </button>
      {showHistory && (
        <div style={{ marginTop: 12 }}>
          {history.length === 0 ? (
            <p className="muted">No rental history.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Rental Value</th>
                    <th>Contract Period</th>
                    <th>Cheques</th>
                    <th>Type</th>
                    <th>End Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{formatAed(h.annual_rent_fils ?? h.short_term_annual_rent_fils ?? 0)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{formatIsoToUae(h.contract_start_date)} — {h.contract_end_date ? formatIsoToUae(h.contract_end_date) : "Active"}</td>
                      <td>{h.rent_cheques_per_year ?? "—"}</td>
                      <td>{h.rental_type === "short_term" ? "Short-term" : "Long-term"}</td>
                      <td>{h.end_reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  ); }; 

  const renderEditForm = () => (
    <form onSubmit={handleSave} className="detail-edit-form">
      <div className="row">
        <div style={{ flex: 2, minWidth: 220 }}>
          <label>Name *</label>
          <input name="name" required defaultValue={property.name} />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Existing / Off-plan *</label>
          <select
            name="subcategory"
            value={editSubcategory}
            onChange={(e) => {
              setEditSubcategory(e.target.value);
              if (e.target.value === "off_plan") setEditIsRental(false);
            }}
          >
            <option value="">Select</option>
            <option value="off_plan">Off-plan</option>
            <option value="existing">Existing</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Property type</label>
          <select name="property_type" defaultValue={property.property_type ?? ""}>
            <option value="">Select</option>
            <option value="apartment">Apartment</option>
            <option value="penthouse">Penthouse</option>
            <option value="townhouse">Townhouse</option>
            <option value="villa">Villa</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label># of Bedrooms</label>
          <select name="bedrooms" defaultValue={property.bedrooms ?? ""}>
            <option value="">Select</option>
            <option value="Studio">Studio</option>
            <option value="1BR">1BR</option>
            <option value="2BR">2BR</option>
            <option value="3BR">3BR</option>
            <option value="4BR">4BR</option>
            <option value="5BR">5BR</option>
            <option value="+5BR">+5BR</option>
          </select>
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>City</label>
          <input name="city" defaultValue={property.city ?? ""} placeholder="Dubai" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Area</label>
          <input name="area" defaultValue={property.area ?? ""} placeholder="Dubai Marina" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Developer</label>
          <input name="developer" defaultValue={property.developer ?? ""} placeholder="Emaar" />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label>Size (sqft)</label>
          <input name="size_sqft" type="number" step="any" onKeyDown={numeralOnly} defaultValue={property.size_sqft ?? ""} placeholder="Enter size of property" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Annual Service Charge (AED)</label>
          <input name="annual_service_charge_aed" type="number" step="0.01" onKeyDown={numeralOnly} defaultValue={aedInputOrEmpty(property.annual_service_charge_fils)} placeholder="Enter annual service charge" />
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Value when bought (AED)</label>
          <input name="purchase_price_aed" type="number" step="0.01" onKeyDown={numeralOnly} defaultValue={aedInputOrEmpty(property.purchase_price_fils)} placeholder="purchase price" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Date of purchase</label>
          <input name="purchased_at" type="date" max={todayIso} defaultValue={property.purchased_at ?? ""} />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Current value (AED)</label>
          <input name="current_value_aed" type="number" step="0.01" onKeyDown={numeralOnly} defaultValue={aedInputOrEmpty(property.current_value_fils)} placeholder="Enter current value of property" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Valued on</label>
          <input name="valued_at" type="date" max={todayIso} defaultValue={property.valued_at ?? ""} />
        </div>
      </div>
      {editSubcategory === "existing" && (
        <>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              name="is_rental"
              type="checkbox"
              style={{ width: "auto" }}
              checked={editIsRental}
              onChange={(e) => setEditIsRental(e.target.checked)}
            />{" "}
            This property is rented out
          </label>
          {editIsRental && (
            <>
              <div className="row" style={{ gap: 20 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    name="rental_type"
                    type="radio"
                    value="long_term"
                    style={{ width: "auto" }}
                    checked={editRentalType === "long_term"}
                    onChange={(e) => setEditRentalType(e.target.value)}
                  />{" "}
                  Long-term Rent
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    name="rental_type"
                    type="radio"
                    value="short_term"
                    style={{ width: "auto" }}
                    checked={editRentalType === "short_term"}
                    onChange={(e) => setEditRentalType(e.target.value)}
                  />{" "}
                  Short-term Rent
                </label>
              </div>
              {editRentalType === "long_term" && (
                <>
                  <div className="row">
                    <div style={{ maxWidth: 240 }}>
                      <label>Yearly rent (AED)</label>
                      <input name="annual_rent_aed" type="number" step="0.01" defaultValue={aedInputOrEmpty(property.annual_rent_fils)} placeholder="annual rent" />
                    </div>
                    <div style={{ maxWidth: 200 }}>
                      <label>Cheques per year</label>
                      <select
                        name="rent_cheques_per_year"
                        value={editCheques}
                        onChange={(e) => setEditCheques(Number(e.target.value))}
                      >
                        <option value="" disabled>Select</option>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={4}>4</option>
                        <option value={12}>12</option>
                      </select>
                    </div>
                  </div>
                  <div className="row">
                    {Array.from({ length: editCheques }, (_, i) => {
                      const key = `rent_date_${i + 1}` as keyof Property;
                      const date = property[key] as string | null;
                      return (
                        <div style={{ maxWidth: 220 }} key={i}>
                          <label>Cheque {i + 1} Deposit date</label>
                          <input name={`rent_date_${i + 1}`} type="date" defaultValue={date ?? ""} />
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              {editRentalType === "short_term" && (
                <>
                  <div className="row">
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <label>Property Management Company Name</label>
                      <input name="pm_company_name" defaultValue={property.pm_company_name ?? ""} placeholder="Enter name of property management company" />
                    </div>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <label>Percentage of Company Commission (%)</label>
                      <input name="pm_commission_pct" type="number" step="0.01" min="0" max="100" onKeyDown={numeralOnly} defaultValue={property.pm_commission_pct != null ? String(property.pm_commission_pct) : ""} placeholder="Enter commission percent of the property management" />
                    </div>
                  </div>
                  <div className="row">
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <label>Expected Annual Rent (AED)</label>
                      <input name="short_term_annual_rent_aed" type="number" step="0.01" onKeyDown={numeralOnly} defaultValue={aedInputOrEmpty(property.short_term_annual_rent_fils)} placeholder="Enter expected annual rent" />
                    </div>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <label>Frequency of Annual Return</label>
                      <select name="short_term_return_frequency" defaultValue={property.short_term_return_frequency ?? ""}>
                        <option value="" disabled>Select</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                      </select>
                    </div>
                  </div>
                  <div className="row">
                    <div style={{ maxWidth: 220 }}>
                      <label>Final rental deposit date</label>
                      <input name="short_term_rent_deposit_date" type="date" defaultValue={property.short_term_rent_deposit_date ?? ""} />
                    </div>
                  </div>
                </>
              )}
              <div className="row" style={{ marginTop: 8 }}>
                <div style={{ maxWidth: 220 }}>
                  <label>Contract start date</label>
                  <input name="contract_start_date" type="date" defaultValue={property.contract_start_date ?? ""} />
                </div>
              </div>
            </>
          )}
        </>
      )}
      <label>Notes</label>
      <textarea name="notes" rows={2} defaultValue={property.notes ?? ""} />
      {editSubcategory === "off_plan" && (
        <>
          <h4 style={{ marginTop: 16, marginBottom: 8 }}>Payment schedule</h4>
          {installments.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>No instalments yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {installments.map((inst) => {
                const ed = editInsts[inst.id] ?? { due_date: inst.due_date, amount_aed: inst.amount_fils != null ? filsToAed(inst.amount_fils).toString() : "", milestone_label: inst.milestone_label ?? "" };
                return (
                  <div key={inst.id} style={{ display: "flex", gap: 8, alignItems: "flex-end", padding: "6px 0", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
                    <div style={{ minWidth: 130 }}>
                      <label style={{ fontSize: 11, margin: "0 0 2px" }}>Due date</label>
                      <input
                        type="date"
                        value={ed.due_date}
                        onChange={(e) => setEditInsts((prev) => ({ ...prev, [inst.id]: { ...prev[inst.id] ?? ed, due_date: e.target.value } }))}
                        style={{ fontSize: 12, padding: "4px 6px" }}
                      />
                    </div>
                    <div style={{ minWidth: 110 }}>
                      <label style={{ fontSize: 11, margin: "0 0 2px" }}>Amount (AED)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={ed.amount_aed ?? ""}
                        onKeyDown={numeralOnly}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "" || /^\d+(\.\d*)?$/.test(val)) {
                            setEditInsts((prev) => ({ ...prev, [inst.id]: { ...prev[inst.id] ?? ed, amount_aed: val } }));
                          }
                        }}
                        style={{ fontSize: 12, padding: "4px 6px" }}
                      />
                    </div>
                    <div style={{ minWidth: 140, flex: 1 }}>
                      <label style={{ fontSize: 11, margin: "0 0 2px" }}>Milestone</label>
                      <input
                        type="text"
                        value={ed.milestone_label ?? ""}
                        onChange={(e) => setEditInsts((prev) => ({ ...prev, [inst.id]: { ...prev[inst.id] ?? ed, milestone_label: e.target.value } }))}
                        style={{ fontSize: 12, padding: "4px 6px" }}
                      />
                    </div>
                    <span className={`pill ${inst.status}`} style={{ alignSelf: "center", marginBottom: 0 }}>{inst.status}</span>
                    <button
                      type="button"
                      onClick={() => handleSaveInstalment(inst.id)}
                      style={{ marginTop: 0, fontSize: 11, padding: "4px 10px" }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteInstalment(inst.id)}
                      style={{ marginTop: 0, fontSize: 11, padding: "4px 10px", background: "var(--bad)", color: "#fff" }}
                    >
                      Del
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={handleAddInstalment}
            style={{ marginTop: 8, fontSize: 12, background: "var(--panel-2)", color: "var(--text)", padding: "6px 12px" }}
          >
            + Add instalment
          </button>
        </>
      )}
      {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
        <button
          type="button"
          onClick={handleRemove}
          disabled={removing}
          style={{ marginTop: 0, background: "var(--bad)", color: "#fff", fontSize: 12, padding: "6px 12px" }}
        >
          {removing ? "Removing…" : "Remove Property"}
        </button>
        <div className="row" style={{ gap: 8 }}>
          <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
          <button
            type="button"
            onClick={handleCancel}
            style={{ marginTop: 0, background: "var(--panel-2)", color: "var(--muted)" }}
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
        <h3 style={{ margin: 0 }}>{property.name}</h3>
        <button
          type="button"
          onClick={() => router.push("/properties")}
          style={{ marginTop: 0, background: "transparent", color: "var(--muted)", padding: "4px 10px", fontSize: 18, fontWeight: 400, lineHeight: 1, flexShrink: 0 }}
          title="Close"
        >
          ×
        </button>
      </div>
      {editing ? renderEditForm() : renderReadOnly()}
      {!editing && installments.length > 0 && (
        <>
          {hasPendingInsts && (
            <div style={{ marginTop: 20, marginBottom: 8 }}>
              <h4 style={{ margin: "0 0 8px" }}>Instalment Timeline</h4>
              <AnimateChartOnScroll><InstallmentTimelineChart installments={installments} /></AnimateChartOnScroll>
            </div>
          )}
          <details className="work" style={{ marginTop: 12 }}>
            <summary>{installments.length} installment(s) — show schedule</summary>
            <div className="work-body">
              {installments.map((i) => {
                const live = installmentStatus(i, todayIso);
                return (
                  <div key={i.id} style={{ marginBottom: 8 }}>
                    {formatIsoToUae(i.due_date)} — {formatAed(i.amount_fils)}{" "}
                    <span className={`pill ${live}`}>{live}</span>
                    {i.milestone_label ? ` · ${i.milestone_label}` : ""}
                    {live !== "paid" ? (
                      <MarkPaidButton installmentId={i.id} />
                    ) : (
                      <MarkUnpaidButton installmentId={i.id} />
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        </>
      )}
      {!editing && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{ marginTop: 0, fontSize: 13 }}
          >
            Edit Property Info
          </button>
        </div>
      )}
    </div></AnimateOnScroll>
  );
}
