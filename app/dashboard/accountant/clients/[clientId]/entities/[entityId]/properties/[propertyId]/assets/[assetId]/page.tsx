"use client";

import { useParams } from "next/navigation";
import AssetDepreciationDetailPage from "@/app/components/AssetDepreciationDetailPage";

export default function PropertyAssetDepreciationPage() {
  const params = useParams<{
    clientId: string;
    entityId: string;
    propertyId: string;
    assetId: string;
  }>();
  const clientId = params?.clientId ?? "";
  const entityId = params?.entityId ?? "";
  const propertyId = params?.propertyId ?? "";
  const assetId = params?.assetId ?? "";

  return (
    <AssetDepreciationDetailPage
      assetId={assetId}
      clientId={clientId}
      entityId={entityId}
      propertyId={propertyId}
      backHref={`/dashboard/accountant/clients/${clientId}/entities/${entityId}/properties/${propertyId}`}
    />
  );
}
