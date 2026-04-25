"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AddEntityWizard from "@/app/components/AddEntityWizard";
import { getSession } from "@/src/lib/session";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

interface ClientRecord {
  id: string;
  name: string;
}

export default function NewEntityForClientPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const clientId = params?.id ?? "";
  const [clientName, setClientName] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadClient() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;
        if (!session) {
          router.replace("/login/user");
          return;
        }
        const token = session.getIdToken().getJwtToken();

        const res = await fetch("/api/users/me/clients?scope=all", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;

        const data = (await res.json()) as { clients: ClientRecord[] };
        if (cancelled) return;
        const match = (data.clients || []).find((c) => c.id === clientId);
        setClientName(match?.name || "Client");
      } catch (error) {
        console.error("Failed to load client name:", error);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    }

    if (clientId) loadClient();
    return () => {
      cancelled = true;
    };
  }, [clientId, router]);

  if (!isReady) {
    return (
      <section className="entity-wizard">
        <p>Loading…</p>
      </section>
    );
  }

  return (
    <AddEntityWizard
      createdFor={clientId}
      backLabel={clientName}
      backHref={`/dashboard/accountant/clients/${clientId}`}
      onSuccessHref={`/dashboard/accountant/clients/${clientId}`}
      addAnotherHref={`/dashboard/accountant/clients/${clientId}/entities/new`}
    />
  );
}
