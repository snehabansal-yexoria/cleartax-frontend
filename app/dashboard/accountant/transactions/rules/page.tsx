import { TransactionRulesView } from "@/app/components/TransactionsFeature";

function safeBackHref(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

export default async function AccountantTransactionRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ entityId?: string; returnTo?: string }>;
}) {
  const { entityId, returnTo } = await searchParams;
  const backHref = safeBackHref(returnTo);
  return (
    <TransactionRulesView
      entityId={entityId}
      backHref={backHref}
      showBackLink={Boolean(backHref)}
    />
  );
}
