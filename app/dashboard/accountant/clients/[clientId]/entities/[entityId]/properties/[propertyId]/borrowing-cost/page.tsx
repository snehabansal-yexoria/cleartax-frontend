"use client";

import { useParams } from "next/navigation";
import BorrowingCostView from "@/app/components/BorrowingCostView";

export default function AccountantBorrowingCostPage() {
  const params = useParams<{
    clientId: string;
    entityId: string;
    propertyId: string;
  }>();
  const clientId = params?.clientId ?? "";
  const entityId = params?.entityId ?? "";
  const propertyId = params?.propertyId ?? "";

  return (
    <BorrowingCostView
      propertyId={propertyId}
      backHref={`/dashboard/accountant/clients/${clientId}/entities/${entityId}/properties/${propertyId}`}
    />
  );
}
