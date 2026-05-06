"use client";

import { useParams } from "next/navigation";
import EntityDetailView from "@/app/components/EntityDetailView";

export default function ClientEntityDetailPage() {
  const params = useParams<{ entityId: string }>();
  const entityId = params?.entityId ?? "";

  return (
    <EntityDetailView
      entityId={entityId}
      backHref="/dashboard/client"
      backLabel="My Workspace"
      addPropertyHref={`/dashboard/client/entities/${entityId}/properties/new`}
      addTransactionHref={`/dashboard/client/entities/${entityId}/transactions/new`}
      propertyDetailHrefBase={`/dashboard/client/entities/${entityId}/properties`}
    />
  );
}
