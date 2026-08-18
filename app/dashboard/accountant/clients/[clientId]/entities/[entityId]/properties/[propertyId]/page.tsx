"use client";

import { useParams } from "next/navigation";
import PropertyDetailView from "@/app/components/PropertyDetailView";

export default function AccountantPropertyDetailPage() {
  const params = useParams<{ clientId: string; entityId: string; propertyId: string }>();
  const clientId = params?.clientId ?? "";
  const entityId = params?.entityId ?? "";
  const propertyId = params?.propertyId ?? "";

  return (
    <PropertyDetailView
      propertyId={propertyId}
      entityId={entityId}
      backHref={`/dashboard/accountant/clients/${clientId}/entities/${entityId}`}
      backLabel="Entity"
      editPropertyHref={`/dashboard/accountant/clients/${clientId}/entities/${entityId}/properties/${propertyId}/edit`}
      reviewFormHref={`/dashboard/accountant/clients/${clientId}/entities/${entityId}/properties/${propertyId}/logit-form-review`}
    />
  );
}
