"use client";

import { useParams } from "next/navigation";
import ClientAddPropertyView from "@/app/components/clients/ClientAddPropertyView";

export default function ClientAddPropertyPage() {
  const params = useParams<{ entityId: string }>();
  const entityId = params?.entityId ?? "";

  return (
    <ClientAddPropertyView
      entityId={entityId}
      backUrl={`/dashboard/client/entities/${entityId}`}
      backText="Entity"
      onSuccessUrl={`/dashboard/client/entities/${entityId}`}
    />
  );
}
