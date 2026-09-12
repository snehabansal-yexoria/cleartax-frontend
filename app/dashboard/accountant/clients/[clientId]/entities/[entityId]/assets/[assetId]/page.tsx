"use client";

import { useParams } from "next/navigation";
import AssetDepreciationDetailPage from "@/app/components/AssetDepreciationDetailPage";

export default function EntityAssetDepreciationPage() {
  const params = useParams<{ clientId: string; entityId: string; assetId: string }>();
  const clientId = params?.clientId ?? "";
  const entityId = params?.entityId ?? "";
  const assetId = params?.assetId ?? "";

  return (
    <AssetDepreciationDetailPage
      assetId={assetId}
      clientId={clientId}
      entityId={entityId}
      backHref={`/dashboard/accountant/clients/${clientId}/entities/${entityId}`}
    />
  );
}
