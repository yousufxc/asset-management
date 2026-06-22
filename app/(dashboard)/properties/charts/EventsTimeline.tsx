"use client";

import { useMemo } from "react";
import type { Property, Installment } from "@/lib/types";
import { formatAed, formatIsoToUae } from "@/lib/core/units";

interface Event {
  date: string;
  label: string;
  amountFils: number;
  type: "inflow" | "outflow";
  propertyName: string;
}

interface Props { properties: Property[]; installments: Installment[] }

export default function EventsTimeline({ properties, installments }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() + 30);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  const events = useMemo(() => {
    const evts: Event[] = [];

    for (const p of properties) {
      if (!p.is_rental || p.subcategory === "off_plan") continue;

      if (p.rental_type === "long_term") {
        const cheques = p.rent_cheques_per_year ?? 0;
        const annual = p.annual_rent_fils ?? 0;
        if (cheques > 0 && annual > 0) {
          const perCheque = Math.round(annual / cheques);
          for (const n of [1, 2, 3, 4] as const) {
            if (n > cheques) break;
            const dateKey = `rent_date_${n}` as keyof Property;
            const date = p[dateKey] as string | null;
            if (date && date >= today && date <= cutoffIso) {
              evts.push({ date, label: "Rent cheque", amountFils: perCheque, type: "inflow", propertyName: p.name });
            }
          }
        }
      }

      if (p.rental_type === "short_term") {
        const annual = p.short_term_annual_rent_fils ?? 0;
        if (annual > 0) {
          const freq = p.short_term_return_frequency ?? "monthly";
          const periodsPerYear = freq === "monthly" ? 12 : 4;
          const perPeriod = Math.round(annual / periodsPerYear);
          const startIso = p.short_term_rent_deposit_date ?? today;
          const start = new Date(startIso + "T00:00:00Z");

          for (let i = 0; i < (freq === "monthly" ? 2 : 1); i++) {
            const periodDate = new Date(start);
            periodDate.setUTCMonth(periodDate.getUTCMonth() + (freq === "monthly" ? i : i * 3));
            const iso = periodDate.toISOString().slice(0, 10);
            if (iso >= today && iso <= cutoffIso) {
              evts.push({ date: iso, label: "ST rental return", amountFils: perPeriod, type: "inflow", propertyName: p.name });
            }
          }
        }
      }
    }

    for (const inst of installments) {
      if (inst.status === "paid" || inst.paid_date !== null) continue;
      if (inst.due_date >= today && inst.due_date <= cutoffIso) {
        const p = properties.find((p) => p.id === inst.property_id);
        evts.push({
          date: inst.due_date,
          label: inst.milestone_label ?? "Instalment due",
          amountFils: inst.amount_fils,
          type: "outflow",
          propertyName: p?.name ?? `Property #${inst.property_id}`,
        });
      }
    }

    evts.sort((a, b) => a.date.localeCompare(b.date));
    return evts;
  }, [properties, installments, today, cutoffIso]);

  if (events.length === 0) {
    return <p className="muted">No upcoming events in the next 30 days.</p>;
  }

  return (
    <div style={{ maxHeight: 260, overflowY: "auto" }}>
      {events.map((e, i) => (
        <div key={i} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 13, alignItems: "center" }}>
          <span style={{ minWidth: 75, color: "var(--muted)", fontSize: 11 }}>{formatIsoToUae(e.date)}</span>
          <span style={{
            display: "inline-block",
            width: 8, height: 8, borderRadius: "50%",
            backgroundColor: e.type === "inflow" ? "var(--good)" : "var(--bad)",
            flexShrink: 0,
          }} />
          <span style={{ flex: 1 }}>{e.propertyName} — {e.label}</span>
          <span style={{ fontWeight: 600, whiteSpace: "nowrap", color: e.type === "inflow" ? "var(--good)" : "var(--bad)" }}>
            {e.type === "inflow" ? "+" : "−"}{formatAed(e.amountFils)}
          </span>
        </div>
      ))}
    </div>
  );
}
