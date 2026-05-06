import { AllTransactionsView } from "@/app/components/TransactionsFeature";

export default function ClientTransactionsPage() {
  return (
    <AllTransactionsView
      context={{ kind: "none" }}
      addTransactionHref="/dashboard/client/transactions/new"
    />
  );
}
