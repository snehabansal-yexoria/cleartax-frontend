"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Skeleton } from "boneyard-js/react";
import AddEntityWizard from "@/app/components/AddEntityWizard";
import { EntityWizardSkeleton } from "@/app/components/PortalSkeletons";
import { getSession } from "@/src/lib/session";
import type { CoreEntity } from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

export default function ClientEditEntityPage() {
  const params = useParams<{ entityId: string }>();
  const router = useRouter();
  const entityId = params?.entityId ?? "";
  const [entity, setEntity] = useState<CoreEntity | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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
          const data = await res.json().catch(() => ({}));
          setErrorMessage(data.error || "Failed to load entity.");
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
      <Skeleton
        name="client-edit-entity-page"
        loading
        fallback={<EntityWizardSkeleton />}
      >
        <EntityWizardSkeleton />
      </Skeleton>
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
    <AddEntityWizard
      mode="edit"
      initialEntity={entity}
      createdFor={entity.createdFor}
      backLabel={entity.name || "Entity"}
      backHref={`/dashboard/client/entities/${entityId}`}
      onSuccessHref={`/dashboard/client/entities/${entityId}`}
      defaultBeneficiaryName={entity.name}
    />
  );
}
