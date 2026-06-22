"use client";

import { useRouter } from "next/navigation";
import type { CashAccount } from "@/lib/types";
import { formatAed } from "@/lib/core/units";
import CashForm from "./CashForm";
import CashDetailPanel from "./CashDetailPanel";
import CashCompositionChart from "./charts/CashCompositionChart";
import AnimateOnScroll from "@/app/components/AnimateOnScroll";
import AnimateChartOnScroll from "@/app/components/AnimateChartOnScroll";

export default function CashContent({
  accounts,
  selectedAccount,
}: {
  accounts: CashAccount[];
  selectedAccount: CashAccount | null;
}) {
  const router = useRouter();
  const totalBalance = accounts.reduce((s, a) => s + a.current_balance_fils, 0);

  function handleSelect(id: number) {
    router.push(`/cash?selected=${id}`);
  }

  return (
    <>
      <h2>Saving Accounts</h2>
      <CashForm />

      {accounts.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 24 }}>
          <AnimateOnScroll>
            <div className="card">
              <h4 style={{ marginTop: 0 }}>Fixed vs Regular</h4>
              <AnimateChartOnScroll>
                <CashCompositionChart accounts={accounts} />
              </AnimateChartOnScroll>
            </div>
          </AnimateOnScroll>
        </div>
      )}

      <div>
        <AnimateOnScroll><div className="card">
          <h3 style={{ marginTop: 0 }}>Accounts ({accounts.length})</h3>
          {accounts.length === 0 ? (
            <p className="muted">No accounts yet. Add one above.</p>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Bank account</th>
                    <th>Balance</th>
                    <th>Fixed Deposit</th>
                    <th>Interest Rate (%)</th>
                    <th>Contract Period</th>
                    <th>Start Date</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => {
                    const isSelected = selectedAccount?.id === a.id;
                    return (
                      <tr
                        key={a.id}
                        className={isSelected ? "selected-row" : undefined}
                      >
                        <td>
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              handleSelect(a.id);
                            }}
                            className="property-link"
                          >
                            {a.label}
                          </a>
                        </td>
                        <td>{formatAed(a.current_balance_fils)}</td>
                        <td>{a.is_fixed_deposit ? "Yes" : "—"}</td>
                        <td>{a.interest_rate != null ? `${a.interest_rate}%` : "—"}</td>
                        <td>{a.fixed_deposit_period_months != null ? `${a.fixed_deposit_period_months} mo` : "—"}</td>
                        <td>{a.fixed_deposit_start_date ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <hr />
              <details className="work">
                <summary>Total cash: {formatAed(totalBalance)}</summary>
                <div className="work-body">
                  <p>
                    <strong>Total cash ({formatAed(totalBalance)}) = </strong>
                    {accounts
                      .map((a) => `${a.label}: ${formatAed(a.current_balance_fils)}`)
                      .join(" + ")}
                  </p>
                  <p className="muted">
                    All cash counts as liquid for the runway calculation.
                  </p>
                </div>
              </details>
            </>
          )}
        </div></AnimateOnScroll>

        {selectedAccount && (
          <div style={{ marginTop: 18 }}>
            <CashDetailPanel key={selectedAccount.id} account={selectedAccount} />
          </div>
        )}
      </div>
    </>
  );
}
