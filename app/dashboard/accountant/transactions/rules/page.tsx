import { TransactionRulesView } from "@/app/components/TransactionsFeature";

export default async function AccountantTransactionRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ entityId?: string }>;
}) {
  const { entityId } = await searchParams;
  return <TransactionRulesView entityId={entityId} />;
}
