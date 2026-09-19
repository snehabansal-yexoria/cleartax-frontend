"use client";

import { useSearchParams } from "next/navigation";
import ClientAddPropertyView from "@/app/components/clients/ClientAddPropertyView";

export default function NewPropertyPage() {
  const searchParams = useSearchParams();
  const backUrl = searchParams.get("backUrl") || undefined;
  const backText = searchParams.get("backText") || undefined;

  return <ClientAddPropertyView backUrl={backUrl} backText={backText} />;
}
