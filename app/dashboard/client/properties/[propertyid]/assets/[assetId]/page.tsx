"use client";

import { useParams } from "next/navigation";
import AssetDepreciationDetailPage from "@/app/components/AssetDepreciationDetailPage";

/**
 * The client's view of one asset's depreciation schedule.
 *
 * Deliberately the same component the accountant sees. The report is a
 * statement of what will be claimed, and showing a client a differently-shaped
 * version of it invites the question of which one is real — the numbers are the
 * same stored rows either way, and the backend already scopes a client to their
 * own properties.
 */
export default function ClientAssetDepreciationPage() {
  const params = useParams<{ propertyid: string; assetId: string }>();
  const propertyId = params?.propertyid ?? "";
  const assetId = params?.assetId ?? "";

  return (
    <AssetDepreciationDetailPage
      assetId={assetId}
      clientId=""
      propertyId={propertyId}
      backHref={`/dashboard/client/properties/${propertyId}`}
    />
  );
}
