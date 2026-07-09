"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { parseDateToIso } from "@/lib/core/units";
import { numeralOnly } from "./numeralOnly";
import AnimateOnScroll from "@/app/components/AnimateOnScroll";

function RentalFields({ rentalType, setRentalType }: { rentalType: string; setRentalType: (v: string) => void }) {
  const [cheques, setCheques] = useState(1);

  function dateInput(n: number) {
    return (
      <div style={{ maxWidth: 220 }} key={n}>
        <label>Cheque {n} Deposit date</label>
        <input name={`rent_date_${n}`} type="date" />
      </div>
    );
  }

  return (
    <>
      <div className="row" style={{ gap: 20 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            name="rental_type"
            type="radio"
            value="long_term"
            style={{ width: "auto" }}
            checked={rentalType === "long_term"}
            onChange={(e) => setRentalType(e.target.value)}
          />{" "}
          Long-term Rent
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            name="rental_type"
            type="radio"
            value="short_term"
            style={{ width: "auto" }}
            checked={rentalType === "short_term"}
            onChange={(e) => setRentalType(e.target.value)}
          />{" "}
          Short-term Rent
        </label>
      </div>
      {rentalType === "long_term" && (
        <>
          <div className="row">
            <div style={{ maxWidth: 240 }}>
              <label>Yearly rent (AED)</label>
              <input name="annual_rent_aed" type="number" step="0.01" placeholder="annual rent" />
            </div>
            <div style={{ maxWidth: 200 }}>
              <label>Cheques per year</label>
              <select
                name="rent_cheques_per_year"
                value={cheques}
                onChange={(e) => setCheques(Number(e.target.value))}
              >
                <option value="" disabled>Select</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={4}>4</option>
                <option value={12}>12</option>
              </select>
            </div>
          </div>
          {cheques === 12 ? (
            <div className="row">
              {dateInput(1)}
              <div style={{ maxWidth: 300, paddingTop: 28 }}>
                <span className="muted" style={{ fontSize: 13 }}>
                  The remaining 11 monthly dates are calculated automatically.
                </span>
              </div>
            </div>
          ) : (
            <div className="row">
              {Array.from({ length: cheques }, (_, i) => dateInput(i + 1))}
            </div>
          )}
        </>
      )}
      {rentalType === "short_term" && (
        <>
          <div className="row">
            <div style={{ flex: 1, minWidth: 220 }}>
              <label>Property Management Company Name</label>
              <input name="pm_company_name" placeholder="Enter name of property management company" />
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label>Percentage of Company Commission (%)</label>
              <input name="pm_commission_pct" type="number" step="0.01" min="0" max="100" onKeyDown={numeralOnly} placeholder="Enter commission percent of the property management" />
            </div>
          </div>
          <div className="row">
            <div style={{ flex: 1, minWidth: 220 }}>
              <label>Expected Annual Rent (AED)</label>
              <input name="short_term_annual_rent_aed" type="number" step="0.01" onKeyDown={numeralOnly} placeholder="Enter expected annual rent" />
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label>Frequency of Annual Return</label>
              <select name="short_term_return_frequency" defaultValue="">
                <option value="" disabled>Select</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
          </div>
          <div className="row">
            <div style={{ maxWidth: 220 }}>
              <label>Final rental deposit date</label>
              <input name="short_term_rent_deposit_date" type="date" />
            </div>
          </div>
        </>
      )}
    </>
  );
}

function MortgageFields({ rateType, setRateType }: { rateType: string; setRateType: (v: string) => void }) {
  const today = new Date().toISOString().split("T")[0];

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginTop: 12 }}>
      <h4 style={{ marginTop: 0, marginBottom: 12 }}>Mortgage details</h4>
      <div className="row">
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Loan amount (AED) *</label>
          <input name="mortgage_loan_amount_aed" type="number" step="0.01" onKeyDown={numeralOnly} required placeholder="e.g. 1200000" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Annual interest rate (%) *</label>
          <input name="mortgage_interest_rate_pct" type="number" step="0.01" onKeyDown={numeralOnly} required placeholder="e.g. 3.99" />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Rate type *</label>
          <select
            name="mortgage_rate_type"
            value={rateType}
            onChange={(e) => setRateType(e.target.value)}
          >
            <option value="fixed">Fixed</option>
            <option value="variable">Variable</option>
          </select>
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Loan start date *</label>
          <input name="mortgage_loan_start_date" type="date" max={today} required />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label>Loan term (years) *</label>
          <input name="mortgage_loan_term_years" type="number" min="1" max="40" step="1" required placeholder="e.g. 25" />
        </div>
        <div style={{ flex: 2, minWidth: 220 }}>
          <label>Lender / bank name *</label>
          <input name="mortgage_lender_name" required placeholder="e.g. Emirates NBD" />
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1 }}>
          <label>Notes</label>
          <textarea name="mortgage_notes" rows={2} placeholder="Any additional details about this mortgage" />
        </div>
      </div>
    </div>
  );
}

export default function PropertyForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isRental, setIsRental] = useState(false);
  const [rentalType, setRentalType] = useState("long_term");
  const [isMortgage, setIsMortgage] = useState(false);
  const [mortgageRateType, setMortgageRateType] = useState("fixed");
  const [subcategory, setSubcategory] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [installments, setInstallments] = useState<{ key: number }[]>([]);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [instPercentages, setInstPercentages] = useState<Record<number, string>>({});
  const instKey = useRef(0);
  const today = new Date().toISOString().split("T")[0];

  function addInstallment() {
    setInstallments((prev) => [...prev, { key: instKey.current++ }]);
  }

  function removeInstallment(key: number) {
    setInstallments((prev) => prev.filter((inst) => inst.key !== key));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
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

    const selectedSubcategory = String(fd.get("subcategory") ?? "");

    const payload = {
      name: String(fd.get("name") ?? ""),
      subcategory: selectedSubcategory,
      property_type: strOrNull("property_type"),
      bedrooms: strOrNull("bedrooms"),
      city: strOrNull("city"),
      area: strOrNull("area"),
      developer: strOrNull("developer"),
      size_sqft: numOrNull("size_sqft"),
      annual_service_charge_aed: numOrNull("annual_service_charge_aed"),
      purchase_price_aed: numOrNull("purchase_price_aed"),
      purchased_at: strOrNull("purchased_at"),
      current_value_aed: numOrNull("current_value_aed"),
      valued_at: strOrNull("valued_at"),
      is_rental: isRental,
      rental_type: isRental ? rentalType : null,
      annual_rent_aed: isRental ? numOrNull("annual_rent_aed") : null,
      rent_cheques_per_year: isRental ? numOrNull("rent_cheques_per_year") : null,
      rent_date_1: isRental ? strOrNull("rent_date_1") : null,
      rent_date_2: isRental ? strOrNull("rent_date_2") : null,
      rent_date_3: isRental ? strOrNull("rent_date_3") : null,
      rent_date_4: isRental ? strOrNull("rent_date_4") : null,
      pm_company_name: isRental && rentalType === "short_term" ? strOrNull("pm_company_name") : null,
      pm_commission_pct: isRental && rentalType === "short_term" ? numOrNull("pm_commission_pct") : null,
      short_term_annual_rent_aed: isRental && rentalType === "short_term" ? numOrNull("short_term_annual_rent_aed") : null,
      short_term_return_frequency: isRental && rentalType === "short_term" ? strOrNull("short_term_return_frequency") : null,
      short_term_rent_deposit_date: isRental && rentalType === "short_term" ? strOrNull("short_term_rent_deposit_date") : null,
      notes: strOrNull("notes"),
    };

    // Gather + VALIDATE installment rows BEFORE creating the property, so bad
    // input fails fast and never leaves a property with missing installments.
    // (Installments are the core liability data behind the runway — a silently
    // dropped one looks identical to a saved one to the owner.)
    const purchasePriceAed = numOrNull("purchase_price_aed");
    const instRows: { due_date: string; amount_aed: number; milestone_label: string | null }[] = [];
    if (selectedSubcategory === "off_plan") {
      const rowErrors: string[] = [];
      if (purchasePriceAed === null) {
        setSaving(false);
        setError("Payment schedule requires 'Value when bought (AED)' to calculate instalment amounts.");
        return;
      }
      for (let i = 0; i < installments.length; i++) {
        const due = String(fd.get(`inst_due_date_${i}`) ?? "").trim();
        const percentage = Number(fd.get(`inst_percentage_${i}`));
        try {
          parseDateToIso(due);
        } catch {
          rowErrors.push(`Installment ${i + 1}: invalid date "${due}"`);
          continue;
        }
        if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
          rowErrors.push(`Installment ${i + 1}: percentage must be 0–100`);
          continue;
        }
        const amount = Math.round((percentage / 100) * purchasePriceAed * 100) / 100;
        instRows.push({ due_date: due, amount_aed: amount, milestone_label: strOrNull(`inst_milestone_${i}`) });
      }
      if (rowErrors.length > 0) {
        setSaving(false);
        setError(rowErrors.join(" · ") + " — nothing was saved.");
        return;
      }
    }

    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setSaving(false);
      const data = await res.json().catch(() => ({}));
      setError(data?.error ? JSON.stringify(data.error) + (data.issues ? " " + JSON.stringify(data.issues.fieldErrors) : "") : "Save failed");
      return;
    }

    const { property } = await res.json();
    const propertyId = property.id;

    if (isMortgage) {
      const termYears = numOrNull("mortgage_loan_term_years");
      const mortgagePayload = {
        property_id: propertyId,
        loan_amount_aed: numOrNull("mortgage_loan_amount_aed"),
        interest_rate_pct: numOrNull("mortgage_interest_rate_pct"),
        rate_type: mortgageRateType,
        loan_start_date: strOrNull("mortgage_loan_start_date"),
        loan_term_months: termYears != null ? termYears * 12 : null,
        lender_name: strOrNull("mortgage_lender_name"),
        notes: strOrNull("mortgage_notes"),
      };
      const mtgRes = await fetch("/api/mortgages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mortgagePayload),
      });
      if (!mtgRes.ok) {
        setSaving(false);
        const data = await mtgRes.json().catch(() => ({}));
        setError(`Property saved but mortgage failed: ${data?.error || "Unknown error"}`);
        router.refresh();
        return;
      }
    }

    // Save each installment and CHECK the result — never swallow a failure.
    const failed: string[] = [];
    for (const row of instRows) {
      const instRes = await fetch("/api/installments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_id: propertyId, status: "upcoming", source: "manual", ...row }),
      });
      if (!instRes.ok) {
        const d = await instRes.json().catch(() => ({}));
        const reason = d?.error ? `${d.error}` : `HTTP ${instRes.status}`;
        failed.push(`${row.due_date} / AED ${row.amount_aed} (${reason})`);
      }
    }

    if (failed.length > 0) {
      // Property saved but some installments did not. Surface loudly — do NOT
      // report success. (Rare after the upfront validation above.)
      setSaving(false);
      setError(
        `Property "${payload.name}" was saved, but these installments did NOT save and must be re-added (delete the property and re-create if needed): ${failed.join(" · ")}`,
      );
      router.refresh();
      return;
    }

    setSaving(false);
    (e.target as HTMLFormElement).reset();
    setIsRental(false);
    setRentalType("long_term");
    setIsMortgage(false);
    setMortgageRateType("fixed");
    setSubcategory("");
    setInstallments([]);
    setInstPercentages({});
    setPurchasePrice("");
    setIsOpen(false);
    router.refresh();
  }

  if (!isOpen) {
    return (
      <div style={{ marginBottom: 18, display: "flex", justifyContent: "flex-end" }}>
        <button type="button" style={{ marginTop: 0 }} onClick={() => setIsOpen(true)}>
          + Add Property
        </button>
      </div>
    );
  }

  return (
    <AnimateOnScroll><div className="card">
      <form onSubmit={onSubmit}>
        <h3 style={{ marginTop: 0 }}>Add property</h3>
        <div className="row">
          <div style={{ flex: 2, minWidth: 220 }}>
            <label>Name *</label>
            <input name="name" required placeholder="Marina Tower 1204" />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label>Existing / Off-plan *</label>
            <select
              name="subcategory"
              value={subcategory}
              onChange={(e) => {
                setSubcategory(e.target.value);
                if (e.target.value === "off_plan") setIsRental(false);
              }}
            >
              <option value="">Select</option>
              <option value="off_plan">Off-plan</option>
              <option value="existing">Existing</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label>Property type</label>
            <select name="property_type" defaultValue="">
              <option value="">Select</option>
              <option value="apartment">Apartment</option>
              <option value="penthouse">Penthouse</option>
              <option value="townhouse">Townhouse</option>
              <option value="villa">Villa</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label># of Bedrooms</label>
            <select name="bedrooms" defaultValue="">
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
            <input name="city" placeholder="Dubai" />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label>Area</label>
            <input name="area" placeholder="Dubai Marina" />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label>Developer</label>
            <input name="developer" placeholder="Emaar" />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label>Size (sqft)</label>
            <input name="size_sqft" type="number" step="any" onKeyDown={numeralOnly} placeholder="Enter size of property" />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label>Annual Service Charge (AED)</label>
            <input name="annual_service_charge_aed" type="number" step="0.01" onKeyDown={numeralOnly} placeholder="Enter annual service charge" />
          </div>
        </div>
        <div className="row">
          <div style={{ flex: 1, minWidth: 160 }}>
            <label>Value when bought (AED)</label>
            <input name="purchase_price_aed" type="number" step="0.01" placeholder="purchase price" onKeyDown={numeralOnly} value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label>Date of purchase</label>
            <input name="purchased_at" type="date" max={today} />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label>Current value (AED)</label>
            <input name="current_value_aed" type="number" step="0.01" onKeyDown={numeralOnly} placeholder="Enter current value of property" />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label>Valued on</label>
            <input name="valued_at" type="date" max={today} />
          </div>
        </div>
        {subcategory === "existing" && (
          <>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                name="is_rental"
                type="checkbox"
                style={{ width: "auto" }}
                checked={isRental}
                onChange={(e) => setIsRental(e.target.checked)}
              />{" "}
              This property is rented out
            </label>
            {isRental && <RentalFields rentalType={rentalType} setRentalType={setRentalType} />}
          </>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            name="is_mortgage"
            type="checkbox"
            style={{ width: "auto" }}
            checked={isMortgage}
            onChange={(e) => setIsMortgage(e.target.checked)}
          />{" "}
          This property is on a mortgage
        </label>
        {isMortgage && <MortgageFields rateType={mortgageRateType} setRateType={setMortgageRateType} />}

        {subcategory === "off_plan" && installments.length > 0 && (
          <>
            <h4 style={{ marginTop: 16, marginBottom: 0 }}>Payment schedule</h4>
            {installments.map((inst, i) => {
              const perc = Number(instPercentages[inst.key] ?? "");
              const ppNum = Number(purchasePrice);
              const computedAmount = ppNum && perc >= 0 && perc <= 100
                ? ((perc / 100) * ppNum).toFixed(2)
                : null;
              return (
                <div className="row" key={inst.key} style={{ alignItems: "flex-end" }}>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <label>Due date *</label>
                    <input name={`inst_due_date_${i}`} type="date" required />
                  </div>
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <label>Instalment percentage *</label>
                    <input
                      name={`inst_percentage_${i}`}
                      type="text"
                      inputMode="decimal"
                      required
                      value={instPercentages[inst.key] ?? ""}
                      onKeyDown={numeralOnly}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          setInstPercentages((prev) => ({ ...prev, [inst.key]: "" }));
                          return;
                        }
                        if (/^\d+(\.\d*)?$/.test(val)) {
                          const num = Number(val);
                          if (num >= 0 && num <= 100) {
                            setInstPercentages((prev) => ({ ...prev, [inst.key]: val }));
                          }
                        }
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <label>Instalment amount</label>
                    <span style={{
                      display: "inline-block",
                      padding: "9px 10px",
                      color: computedAmount !== null ? "var(--text)" : "var(--muted)",
                    }}>
                      {computedAmount !== null ? `AED ${Number(computedAmount).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                    </span>
                  </div>
                  <div style={{ flex: 2, minWidth: 200 }}>
                    <label>Milestone</label>
                    <input name={`inst_milestone_${i}`} placeholder="20% on completion of foundation" />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => removeInstallment(inst.key)}
                      style={{ background: "transparent", color: "var(--muted)", padding: "9px 10px", marginTop: 0 }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {subcategory === "off_plan" && (
          <button type="button" onClick={addInstallment} style={{ background: "var(--panel-2)", color: "var(--text)", marginTop: 8 }}>
            + Add installment
          </button>
        )}

        <label>Notes</label>
        <textarea name="notes" rows={2} />
        {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
        <button type="submit" disabled={saving}>{saving ? "Saving…" : "Add property"}</button>
      </form>

      <hr style={{ margin: "20px 0 12px", borderColor: "var(--border)" }} />
      <button
        type="button"
        onClick={() => setIsOpen(false)}
        style={{ marginTop: 0, background: "var(--panel-2)", color: "var(--muted)" }}
      >
        Close
      </button>
    </div></AnimateOnScroll>
  );
}
