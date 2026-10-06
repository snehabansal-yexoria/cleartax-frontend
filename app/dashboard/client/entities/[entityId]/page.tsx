"use client";

import { useParams } from "next/navigation";
import ClientEntityDetailView from "@/app/components/clients/ClientEntityDetailView";

export default function ClientEntityDetailPage() {
  const params = useParams<{ entityId: string }>();
  const entityId = params?.entityId ?? "";

  return (
    <ClientEntityDetailView
      entityId={entityId}
      backHref="/dashboard/client"
      backLabel="My Workspace"
      addPropertyHref={`/dashboard/client/entities/${entityId}/properties/new`}
      addTransactionHref={`/dashboard/client/entities/${entityId}/transactions/new`}
      editEntityHref={`/dashboard/client/entities/${entityId}/edit`}
      propertyDetailHrefBase={`/dashboard/client/entities/${entityId}/properties`}
    />
  );
}
