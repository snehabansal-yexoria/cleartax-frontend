"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "boneyard-js/react";
import AddJournalEntryView from "@/app/components/AddJournalEntryView";
import { JournalEntrySkeleton } from "@/app/components/PortalSkeletons";
import { getSession } from "@/src/lib/session";
import type { CoreEntity, CoreProperty } from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

interface ClientRecord {
  id: string;
  name: string;
  email: string;
}

export default function AccountantAddJournalEntryPage() {
  const params = useParams<{ clientId: string; entityId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const clientId = params?.clientId ?? "";
  const entityId = params?.entityId ?? "";
  
  const fromTab = searchParams?.get("from") || "reconciliation";
  const fromName = searchParams?.get("fromName") || "";

  const [entity, setEntity] = useState<CoreEntity | null>(null);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [properties, setProperties] = useState<CoreProperty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;
        if (!session) {
          router.replace("/login/user");
          return;
        }
        const token = session.getIdToken().getJwtToken();
        const headers = { Authorization: `Bearer ${token}` };

        // Fetch Entity, Client, and Properties in parallel
        const [entityRes, clientRes, propertiesRes] = await Promise.all([
          fetch(`/api/entities/${encodeURIComponent(entityId)}`, { headers }),
          fetch(`/api/users/me/clients/${encodeURIComponent(clientId)}`, { headers }),
          fetch(`/api/entities/${encodeURIComponent(entityId)}/properties`, { headers }),
        ]);

        if (cancelled) return;

        if (entityRes.ok && clientRes.ok) {
          const entityData = (await entityRes.json()) as CoreEntity;
          const clientData = (await clientRes.json()) as ClientRecord;
          
          let propList: CoreProperty[] = [];
          if (propertiesRes.ok) {
            const propData = await propertiesRes.json();
            propList = propData.items || [];
          }

          setEntity(entityData);
          setClient(clientData);
          setProperties(propList);
        } else {
          setErrorMessage("Failed to load client or entity information.");
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load page data:", error);
          setErrorMessage("Unexpected error loading page data.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (entityId && clientId) loadData();
    return () => {
      cancelled = true;
    };
  }, [clientId, entityId, router]);

  if (isLoading) {
    return (
      <Skeleton
        name="accountant-add-journal-entry-page"
        loading
        fallback={<JournalEntrySkeleton />}
      >
        <JournalEntrySkeleton />
      </Skeleton>
    );
  }

  if (!entity || !client) {
    return (
      <section className="entity-wizard" style={{ padding: "40px", textAlign: "center" }}>
        <p className="entity-wizard-error" style={{ color: "#e11d48", fontWeight: 500 }}>
          {errorMessage || "Entity or client not found."}
        </p>
        <button
          onClick={() => router.push(`/dashboard/accountant/clients/${clientId}/entities/${entityId}`)}
          style={{
            marginTop: "16px",
            padding: "8px 16px",
            borderRadius: "6px",
            border: "1px solid #cbd5e1",
            cursor: "pointer",
          }}
        >
          Go Back
        </button>
      </section>
    );
  }

  // Dynamic back path & label detection
  const backLabel = fromName || entity.name || "Entity";
  const backHref = `/dashboard/accountant/clients/${clientId}/entities/${entityId}?tab=${fromTab}`;

  return (
    <AddJournalEntryView
      clientId={clientId}
      entityId={entityId}
      client={client}
      entity={entity}
      properties={properties}
      backHref={backHref}
      backLabel={backLabel}
    />
  );
}
