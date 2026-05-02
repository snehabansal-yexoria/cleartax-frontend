"use client";

import { useParams } from "next/navigation";
import { AddTransactionView } from "@/app/components/TransactionsFeature";

export default function AccountantAddTransactionPage() {
  const params = useParams<{ clientId: string; entityId: string }>();
  const clientId = String(params?.clientId || "");
  const entityId = String(params?.entityId || "");

  return (
    <AddTransactionView
      backHref={`/dashboard/accountant/clients/${clientId}/entities/${entityId}`}
      backLabel="Back"
    />
  );
}
