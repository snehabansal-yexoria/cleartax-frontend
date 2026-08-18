"use client";

import { useParams, useSearchParams } from "next/navigation";
import ClientAddTransactionViewNew from "@/app/components/clients/ClientAddTransactionViewNew";

export default function ClientEntityNewTransactionPage() {
  const params = useParams<{ entityId: string }>();
  const entityId = String(params?.entityId || "");
  const searchParams = useSearchParams();
  const backHref = searchParams.get("backHref") || undefined;
  const backLabel = searchParams.get("backLabel") || undefined;

  return (
    <ClientAddTransactionViewNew
      entityId={entityId}
      backHref={backHref}
      backLabel={backLabel}
    />
  );
}
