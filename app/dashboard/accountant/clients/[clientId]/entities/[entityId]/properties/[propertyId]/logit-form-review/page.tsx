"use client";

import { useParams } from "next/navigation";
import LogitFormReview from "@/app/components/LogitFormReview";

export default function AccountantLogitFormReviewPage() {
  const params = useParams<{
    clientId: string;
    entityId: string;
    propertyId: string;
  }>();
  const clientId = params?.clientId ?? "";
  const entityId = params?.entityId ?? "";
  const propertyId = params?.propertyId ?? "";

  return (
    <LogitFormReview
      propertyId={propertyId}
      backHref={`/dashboard/accountant/clients/${clientId}/entities/${entityId}/properties/${propertyId}`}
    />
  );
}
