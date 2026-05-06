import { AddTransactionView } from "@/app/components/TransactionsFeature";

export default function ClientNewTransactionPage() {
  return (
    <AddTransactionView
      backHref="/dashboard/client/transactions"
      backLabel="Back to transactions"
    />
  );
}
