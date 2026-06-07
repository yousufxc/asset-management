import CashContent from "./CashContent";
import { listCashAccounts } from "@/lib/db/queries";
import type { CashAccount } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CashPage({
  searchParams,
}: {
  searchParams: Promise<{ selected?: string }>;
}) {
  const params = await searchParams;
  const accountsRaw = listCashAccounts();
  const accounts = JSON.parse(JSON.stringify(accountsRaw));
  const selectedId = params.selected ? Number(params.selected) : null;
  const selectedAccount = selectedId
    ? (accounts.find((a: CashAccount) => a.id === selectedId) ?? null)
    : null;

  return (
    <CashContent
      accounts={accounts}
      selectedAccount={selectedAccount}
    />
  );
}
