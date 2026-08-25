"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AssetDepreciationDetailPage from "@/app/components/AssetDepreciationDetailPage";
import { getSession } from "@/src/lib/session";

export default function ClientAssetDepreciationPage() {
  const params = useParams<{ clientId: string; assetId: string }>();
  const clientId = params?.clientId ?? "";
  const assetId = params?.assetId ?? "";
  const [clientName, setClientName] = useState<string>("Satnam Singh");

  useEffect(() => {
    async function loadClientName() {
      try {
        const session = await getSession();
        if (!session) return;
        const token = (session as any).getIdToken().getJwtToken();
        const res = await fetch(`/api/users/me/clients/${encodeURIComponent(clientId)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.client?.name) {
            setClientName(data.client.name);
          }
        }
      } catch (err) {
        console.error("Failed to load client name:", err);
      }
    }
    if (clientId) {
      loadClientName();
    }
  }, [clientId]);

  return (
    <AssetDepreciationDetailPage
      assetId={assetId}
      clientId={clientId}
      clientName={clientName}
      entityName="Smith & Co."
      propertyName="Heaven Villa"
      backHref={`/dashboard/accountant/clients/${clientId}`}
    />
  );
}
