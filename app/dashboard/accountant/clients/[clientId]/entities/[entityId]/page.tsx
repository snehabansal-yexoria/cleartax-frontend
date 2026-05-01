"use client";

import { useParams } from "next/navigation";
import EntityDetailView from "@/app/components/EntityDetailView";

export default function AccountantEntityDetailPage() {
  const params = useParams<{ clientId: string; entityId: string }>();
  const clientId = params?.clientId ?? "";
  const entityId = params?.entityId ?? "";

  return (
    <EntityDetailView
      entityId={entityId}
      backHref={`/dashboard/accountant/clients/${clientId}`}
      backLabel="Client"
      addPropertyHref={`/dashboard/accountant/clients/${clientId}/entities/${entityId}/properties/new`}
      propertyDetailHrefBase={`/dashboard/accountant/clients/${clientId}/entities/${entityId}/properties`}
    />
  );
}
