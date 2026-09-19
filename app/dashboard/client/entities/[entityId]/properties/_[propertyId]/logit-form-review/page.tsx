"use client";

import { useParams } from "next/navigation";
import LogitFormReview from "@/app/components/LogitFormReview";

export default function ClientLogitFormReviewPage() {
  const params = useParams<{ entityId: string; propertyId: string }>();
  const entityId = params?.entityId ?? "";
  const propertyId = params?.propertyId ?? "";

  return (
    <LogitFormReview
      propertyId={propertyId}
      backHref={`/dashboard/client/entities/${entityId}/properties/${propertyId}`}
    />
  );
}
