"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AssetDepreciationDetailPage from "@/app/components/AssetDepreciationDetailPage";
import { getSession } from "@/src/lib/session";

export default function PropertyAssetDepreciationPage() {
  const params = useParams<{ clientId: string; entityId: string; propertyId: string; assetId: string }>();
  const clientId = params?.clientId ?? "";
  const entityId = params?.entityId ?? "";
  const propertyId = params?.propertyId ?? "";
  const assetId = params?.assetId ?? "";
  
  const [clientName, setClientName] = useState<string>("Satnam Singh");
  const [entityName, setEntityName] = useState<string>("Smith & Co.");
  const [propertyName, setPropertyName] = useState<string>("Heaven Villa");

  useEffect(() => {
    async function loadNames() {
      try {
        const session = await getSession();
        if (!session) return;
        const token = (session as any).getIdToken().getJwtToken();
        const headers = { Authorization: `Bearer ${token}` };

        const [clientRes, entityRes, propertyRes] = await Promise.all([
          fetch(`/api/users/me/clients/${encodeURIComponent(clientId)}`, { headers }).catch(() => null),
          fetch(`/api/entities/${encodeURIComponent(entityId)}`, { headers }).catch(() => null),
          fetch(`/api/properties/${encodeURIComponent(propertyId)}`, { headers }).catch(() => null),
        ]);

        if (clientRes && clientRes.ok) {
          const data = await clientRes.json();
          if (data.client?.name) {
            setClientName(data.client.name);
          }
        }
        if (entityRes && entityRes.ok) {
          const data = await entityRes.json();
          if (data.name) {
            setEntityName(data.name);
          }
        }
        if (propertyRes && propertyRes.ok) {
          const data = await propertyRes.json();
          if (data.name) {
            setPropertyName(data.name);
          }
        }
      } catch (err) {
        console.error("Failed to load names:", err);
      }
    }
    if (clientId && entityId && propertyId) {
      loadNames();
    }
  }, [clientId, entityId, propertyId]);

  return (
    <AssetDepreciationDetailPage
      assetId={assetId}
      clientId={clientId}
      entityId={entityId}
      propertyId={propertyId}
      clientName={clientName}
      entityName={entityName}
      propertyName={propertyName}
      backHref={`/dashboard/accountant/clients/${clientId}/entities/${entityId}/properties/${propertyId}`}
    />
  );
}
