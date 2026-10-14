"use client";

import { useSearchParams } from "next/navigation";
import { isSafeInternalHref } from "@/app/components/clients/backTarget";
import ClientAddTransactionViewNew from "@/app/components/clients/ClientAddTransactionViewNew";

export default function ClientNewTransactionPage() {
  const searchParams = useSearchParams();
  // Only a same-origin path: this lands in a <Link href>.
  const backHrefParam = searchParams.get("backHref");
  const backHref = isSafeInternalHref(backHrefParam) ? backHrefParam : undefined;
  const backLabel = searchParams.get("backLabel") || undefined;

  return (
    <ClientAddTransactionViewNew
      backHref={backHref}
      backLabel={backLabel}
    />
  );
}
