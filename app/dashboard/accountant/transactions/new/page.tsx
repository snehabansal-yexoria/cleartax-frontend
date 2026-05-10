import { AddTransactionView } from "@/app/components/TransactionsFeature";

export default function AccountantNewTransactionPage() {
  return (
    <AddTransactionView
      requireClientSelection
      backHref="/dashboard/accountant/transactions"
    />
  );
}
