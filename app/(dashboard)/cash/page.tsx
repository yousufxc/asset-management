/**
 * DEEPSEEK IMPLEMENTATION TARGET — Task P1-UI-CASH (see docs/TASKS.md).
 * Mirror the /properties reference slice:
 *   - client form -> POST /api/cash (validate with CashAccountInputSchema)
 *   - server list with show-your-work (rule 2.1) + "last updated N days ago" staleness
 * Contract already exists: CashAccountInputSchema, insertCashAccount, listCashAccounts.
 */

import { listCashAccounts } from "@/lib/db/queries";
import { formatAed } from "@/lib/core/units";

export const dynamic = "force-dynamic";

export default function CashPage() {
  const accounts = listCashAccounts();
  const total = accounts.reduce((s, a) => s + a.current_balance_fils, 0);

  return (
    <>
      <h2>Cash</h2>
      <div className="stub">
        <strong>Form not built yet.</strong> DeepSeek to implement per{" "}
        <code>docs/TASKS.md</code> task <code>P1-UI-CASH</code>, mirroring{" "}
        <code>app/(dashboard)/properties/</code>. Backend contract is ready:{" "}
        <code>CashAccountInputSchema</code> + <code>insertCashAccount</code>.
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Accounts ({accounts.length}) — total {formatAed(total)}</h3>
        {accounts.length === 0 ? (
          <p className="muted">No accounts yet.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Label</th><th>Bank</th><th>Balance</th><th>Liquid?</th></tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td>{a.label}</td>
                  <td>{a.bank_name ?? "—"}</td>
                  <td>{formatAed(a.current_balance_fils)}</td>
                  <td>{a.is_liquid ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
