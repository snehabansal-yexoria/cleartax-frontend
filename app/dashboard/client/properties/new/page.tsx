"use client";

import { useSearchParams } from "next/navigation";
import { isSafeInternalHref } from "@/app/components/clients/backTarget";
import ClientAddPropertyView from "@/app/components/clients/ClientAddPropertyView";

export default function NewPropertyPage() {
  const searchParams = useSearchParams();
  // Only a same-origin path: this lands in a <Link href>.
  const backUrlParam = searchParams.get("backUrl");
  const backUrl = isSafeInternalHref(backUrlParam) ? backUrlParam : undefined;
  const backText = searchParams.get("backText") || undefined;

  return <ClientAddPropertyView backUrl={backUrl} backText={backText} />;
}
