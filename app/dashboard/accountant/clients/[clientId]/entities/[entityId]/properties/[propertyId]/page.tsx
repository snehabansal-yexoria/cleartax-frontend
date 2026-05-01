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
      backHref={`/dashboard/accountant/clients/${clientId}/entities/${entityId}`}
      backLabel="Entity"
    />
  );
}
