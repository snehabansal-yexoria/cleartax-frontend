"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AssetDepreciationDetailPage from "@/app/components/AssetDepreciationDetailPage";
import { getSession } from "@/src/lib/session";

export default function EntityAssetDepreciationPage() {
  const params = useParams<{ clientId: string; entityId: string; assetId: string }>();
  const clientId = params?.clientId ?? "";
  const entityId = params?.entityId ?? "";
  const assetId = params?.assetId ?? "";
  
  const [clientName, setClientName] = useState<string>("Satnam Singh");
  const [entityName, setEntityName] = useState<string>("Smith & Co.");

  useEffect(() => {
    async function loadNames() {
      try {
        const session = await getSession();
        if (!session) return;
        const token = (session as any).getIdToken().getJwtToken();
        const headers = { Authorization: `Bearer ${token}` };

        const [clientRes, entityRes] = await Promise.all([
          fetch(`/api/users/me/clients/${encodeURIComponent(clientId)}`, { headers }).catch(() => null),
          fetch(`/api/entities/${encodeURIComponent(entityId)}`, { headers }).catch(() => null),
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
      } catch (err) {
        console.error("Failed to load names:", err);
      }
    }
    if (clientId && entityId) {
      loadNames();
    }
  }, [clientId, entityId]);

  return (
    <AssetDepreciationDetailPage
      assetId={assetId}
      clientId={clientId}
      entityId={entityId}
      clientName={clientName}
      entityName={entityName}
      propertyName="Heaven Villa"
      backHref={`/dashboard/accountant/clients/${clientId}/entities/${entityId}`}
    />
  );
}
