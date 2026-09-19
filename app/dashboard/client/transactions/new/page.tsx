"use client";

import { useSearchParams } from "next/navigation";
import ClientAddTransactionViewNew from "@/app/components/clients/ClientAddTransactionViewNew";

export default function ClientNewTransactionPage() {
  const searchParams = useSearchParams();
  const backHref = searchParams.get("backHref") || undefined;
  const backLabel = searchParams.get("backLabel") || undefined;

  return (
    <ClientAddTransactionViewNew
      backHref={backHref}
      backLabel={backLabel}
    />
  );
}
