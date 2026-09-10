"use client";

import { useParams } from "next/navigation";
import AssetDepreciationDetailPage from "@/app/components/AssetDepreciationDetailPage";

/**
 * The client's view of one asset's depreciation schedule, reached from the
 * entity page rather than from a property.
 *
 * The entity-scope card lists assets across every property the entity owns, so
 * its rows cannot link into the property-scoped route without first knowing
 * which property each asset sits under. This mirrors the accountant's
 * entities/[entityId]/assets/[assetId] for the same reason.
 *
 * Deliberately the same component the accountant sees — see the note on the
 * property-scoped page: the numbers are the same stored rows either way, and
 * the backend already scopes a client to their own entities.
 */
export default function ClientEntityAssetDepreciationPage() {
  const params = useParams<{ entityId: string; assetId: string }>();
  const entityId = params?.entityId ?? "";
  const assetId = params?.assetId ?? "";

  return (
    <AssetDepreciationDetailPage
      assetId={assetId}
      clientId=""
      entityId={entityId}
      backHref={`/dashboard/client/entities/${entityId}`}
    />
  );
}
