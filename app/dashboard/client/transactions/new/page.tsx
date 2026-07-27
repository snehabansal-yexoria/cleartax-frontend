import ClientAddTransactionViewNew from "@/app/components/clients/ClientAddTransactionViewNew";

export default function ClientNewTransactionPage() {
  return (
    <ClientAddTransactionViewNew
      backHref="/dashboard/client/transactions"
      backLabel="Back to transactions"
    />
  );
}
