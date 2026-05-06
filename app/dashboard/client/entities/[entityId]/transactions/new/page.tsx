"use client";

import { useParams } from "next/navigation";
import { AddTransactionView } from "@/app/components/TransactionsFeature";

export default function ClientEntityNewTransactionPage() {
  const params = useParams<{ entityId: string }>();
  const entityId = String(params?.entityId || "");

  return (
    <AddTransactionView
      entityId={entityId}
      backHref={`/dashboard/client/entities/${entityId}`}
      backLabel="Back"
    />
  );
}
