/**
 * Dashboard placeholder. The headline cash-runway number is PHASE 2
 * (lib/core/runway.ts computeRunway). For Phase 1 this shows the portfolio
 * snapshot from manually-entered data and points to the data-entry pages.
 */

import Link from "next/link";
import { listProperties, listCashAccounts, listCommodities, listAllInstallments } from "@/lib/db/queries";
import { formatAed } from "@/lib/core/units";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const properties = listProperties();
  const accounts = listCashAccounts();
  const commodities = listCommodities();
  const installments = listAllInstallments();

  const liquidFils = accounts
    .filter((a) => a.is_liquid === 1)
    .reduce((sum, a) => sum + a.current_balance_fils, 0);
  const upcomingFils = installments
    .filter((i) => i.status !== "paid")
    .reduce((sum, i) => sum + i.amount_fils, 0);

  return (
    <>
      <h2>Dashboard</h2>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Cash runway</h3>
        <p className="muted">
          The headline runway number lands in <strong>Phase 2</strong> (
          <code>lib/core/runway.ts</code>). It will answer: on any future date, is
          there enough liquid cash to cover what is owed?
        </p>
        <details className="work" open>
          <summary>Show the inputs it will use (already live)</summary>
          <div className="work-body">
            <div>Liquid cash now: <strong>{formatAed(liquidFils)}</strong> across {accounts.filter((a) => a.is_liquid === 1).length} account(s)</div>
            <div>Unpaid installments total: <strong>{formatAed(upcomingFils)}</strong> across {installments.filter((i) => i.status !== "paid").length} item(s)</div>
          </div>
        </details>
      </div>

      <div className="row">
        <div className="card" style={{ flex: 1, minWidth: 200 }}>
          <div className="muted">Properties</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{properties.length}</div>
          <Link href="/properties">Manage →</Link>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 200 }}>
          <div className="muted">Cash accounts</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{accounts.length}</div>
          <Link href="/cash">Manage →</Link>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 200 }}>
          <div className="muted">Commodities</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{commodities.length}</div>
          <Link href="/commodities">Manage →</Link>
        </div>
      </div>
    </>
  );
}
