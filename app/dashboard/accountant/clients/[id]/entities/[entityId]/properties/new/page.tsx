"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AddPropertyWizard from "@/app/components/AddPropertyWizard";
import { getSession } from "@/src/lib/session";
import type { CoreEntity } from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

export default function AccountantAddPropertyPage() {
  const params = useParams<{ id: string; entityId: string }>();
  const router = useRouter();
  const clientId = params?.id ?? "";
  const entityId = params?.entityId ?? "";
  const [entity, setEntity] = useState<CoreEntity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadEntity() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;
        if (!session) {
          router.replace("/login/user");
          return;
        }
        const token = session.getIdToken().getJwtToken();

        const res = await fetch(`/api/entities/${encodeURIComponent(entityId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;

        if (res.ok) {
          setEntity((await res.json()) as CoreEntity);
        } else {
          setErrorMessage("Failed to load entity.");
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load entity:", error);
          setErrorMessage("Unexpected error loading entity.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (entityId) loadEntity();
    return () => {
      cancelled = true;
    };
  }, [entityId, router]);

  if (isLoading) {
    return (
      <section className="entity-wizard">
        <p>Loading entity...</p>
      </section>
    );
  }

  if (!entity) {
    return (
      <section className="entity-wizard">
        <p className="entity-wizard-error">
          {errorMessage || "Entity not found."}
        </p>
      </section>
    );
  }

  return (
    <AddPropertyWizard
      entity={entity}
      backHref={`/dashboard/accountant/clients/${clientId}/entities/${entityId}`}
      onSuccessHref={`/dashboard/accountant/clients/${clientId}/entities/${entityId}`}
    />
  );
}
