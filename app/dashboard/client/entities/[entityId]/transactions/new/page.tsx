"use client";

import { useParams, useSearchParams } from "next/navigation";
import { isSafeInternalHref } from "@/app/components/clients/backTarget";
import ClientAddTransactionViewNew from "@/app/components/clients/ClientAddTransactionViewNew";

export default function ClientEntityNewTransactionPage() {
  const params = useParams<{ entityId: string }>();
  const entityId = String(params?.entityId || "");
  const searchParams = useSearchParams();
  // Only a same-origin path: this lands in a <Link href>.
  const backHrefParam = searchParams.get("backHref");
  const backHref = isSafeInternalHref(backHrefParam) ? backHrefParam : undefined;
  const backLabel = searchParams.get("backLabel") || undefined;

  return (
    <ClientAddTransactionViewNew
      entityId={entityId}
      backHref={backHref}
      backLabel={backLabel}
    />
  );
}
