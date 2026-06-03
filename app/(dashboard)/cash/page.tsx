import CashForm from "./CashForm";
import { listCashAccounts } from "@/lib/db/queries";
import { formatAed } from "@/lib/core/units";

export const dynamic = "force-dynamic";

export default function CashPage() {
  const accounts = listCashAccounts();
  const totalBalance = accounts.reduce((s, a) => s + a.current_balance_fils, 0);

  return (
    <>
      <h2>Cash</h2>
      <CashForm />

      <div className="card">
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
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.label}</td>
                    <td>{formatAed(a.current_balance_fils)}</td>
                  </tr>
                ))}
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
    </>
  );
}
