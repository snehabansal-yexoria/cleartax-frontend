"use client";

import { useParams } from "next/navigation";
import PropertyDetailView from "@/app/components/PropertyDetailView";

export default function ClientPropertyDetailPage() {
  const params = useParams<{ entityId: string; propertyId: string }>();
  const entityId = params?.entityId ?? "";
  const propertyId = params?.propertyId ?? "";

  return (
    <PropertyDetailView
      propertyId={propertyId}
      backHref={`/dashboard/client/entities/${entityId}`}
      backLabel="Entity"
    />
  );
}
