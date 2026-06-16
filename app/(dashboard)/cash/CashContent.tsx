"use client";

import { useRouter } from "next/navigation";
import type { CashAccount } from "@/lib/types";
import { formatAed } from "@/lib/core/units";
import CashForm from "./CashForm";
import CashDetailPanel from "./CashDetailPanel";

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

      <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
        <div className="card" style={{ flex: selectedAccount ? 1 : undefined }}>
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
                    <th>Interest Rate</th>
                    <th>Contract Period</th>
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
        </div>

        {selectedAccount && (
          <div style={{ flex: 1, position: "sticky", top: 28 }}>
            <CashDetailPanel key={selectedAccount.id} account={selectedAccount} />
          </div>
        )}
      </div>
    </>
  );
}
