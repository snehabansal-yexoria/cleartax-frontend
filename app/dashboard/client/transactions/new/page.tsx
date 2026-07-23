import ClientAddTransactionView from "@/app/components/clients/ClientAddTransactionView";

export default function ClientNewTransactionPage() {
  return (
    <ClientAddTransactionView
      backHref="/dashboard/client/transactions"
      backLabel="Back to transactions"
    />
  );
}
