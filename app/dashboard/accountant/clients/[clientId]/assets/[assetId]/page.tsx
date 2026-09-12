"use client";

import { useParams } from "next/navigation";
import AssetDepreciationDetailPage from "@/app/components/AssetDepreciationDetailPage";

/**
 * Client-level entry point to an asset's depreciation report.
 *
 * The client, entity and property names used to be fetched (or invented —
 * "Smith & Co.", "Heaven Villa") and passed down. They now come back with the
 * schedule itself, so this page only has to say which asset.
 */
export default function ClientAssetDepreciationPage() {
  const params = useParams<{ clientId: string; assetId: string }>();
  const clientId = params?.clientId ?? "";
  const assetId = params?.assetId ?? "";

  return (
    <AssetDepreciationDetailPage
      assetId={assetId}
      clientId={clientId}
      backHref={`/dashboard/accountant/clients/${clientId}`}
    />
  );
}
