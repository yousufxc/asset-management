import CashForm from "./CashForm";
import { listCashAccounts } from "@/lib/db/queries";
import { formatAed } from "@/lib/core/units";

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  current: "Current",
  savings: "Savings",
  fixed_deposit: "Fixed deposit",
  other: "Other",
};

export const dynamic = "force-dynamic";

function daysSince(iso: string | null): string {
  if (!iso) return "never updated";
  const then = new Date(`${iso}T00:00:00Z`).getTime();
  const days = Math.floor((Date.now() - then) / 86_400_000);
  return `last updated ${days} day${days === 1 ? "" : "s"} ago`;
}

export default function CashPage() {
  const accounts = listCashAccounts();
  const totalBalance = accounts.reduce((s, a) => s + a.current_balance_fils, 0);
  const liquidTotal = accounts
    .filter((a) => a.is_liquid)
    .reduce((s, a) => s + a.current_balance_fils, 0);

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
                  <th>Label</th>
                  <th>Bank</th>
                  <th>Type</th>
                  <th>Balance</th>
                  <th>Liquid?</th>
                  <th>Freshness</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.label}
                      {a.notes && (
                        <details className="work">
                          <summary>Notes</summary>
                          <div className="work-body">{a.notes}</div>
                        </details>
                      )}
                    </td>
                    <td>{a.bank_name ?? "—"}</td>
                    <td>
                      {a.account_type
                        ? ACCOUNT_TYPE_LABEL[a.account_type] ?? a.account_type
                        : "—"}
                    </td>
                    <td>{formatAed(a.current_balance_fils)}</td>
                    <td>{a.is_liquid ? "Yes" : "No"}</td>
                    <td className="muted">{daysSince(a.last_updated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <hr />
            <details className="work">
              <summary>
                Total balance: {formatAed(totalBalance)} · Liquid total:{" "}
                {formatAed(liquidTotal)}
              </summary>
              <div className="work-body">
                <p>
                  <strong>Total balance ({formatAed(totalBalance)}) = </strong>
                  {accounts.length === 0
                    ? "no accounts"
                    : accounts
                        .map((a) => `${a.label}: ${formatAed(a.current_balance_fils)}`)
                        .join(" + ")}
                </p>
                <p>
                  <strong>Liquid total ({formatAed(liquidTotal)}) = </strong>
                  {accounts.filter((a) => a.is_liquid).length === 0
                    ? "no liquid accounts"
                    : accounts
                        .filter((a) => a.is_liquid)
                        .map((a) => `${a.label}: ${formatAed(a.current_balance_fils)}`)
                        .join(" + ")}
                </p>
                <p className="muted">
                  Non-liquid:{" "}
                  {accounts.filter((a) => !a.is_liquid).length === 0
                    ? "none"
                    : accounts
                        .filter((a) => !a.is_liquid)
                        .map((a) => `${a.label}: ${formatAed(a.current_balance_fils)}`)
                        .join(", ")}
                </p>
              </div>
            </details>
          </>
        )}
      </div>
    </>
  );
}
