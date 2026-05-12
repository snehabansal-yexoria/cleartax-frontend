"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Skeleton } from "boneyard-js/react";
import AddPropertyWizard from "@/app/components/AddPropertyWizard";
import { EntityWizardSkeleton } from "@/app/components/PortalSkeletons";
import { getSession } from "@/src/lib/session";
import type { CoreEntity, CoreProperty } from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

export default function AccountantEditPropertyPage() {
  const params = useParams<{
    clientId: string;
    entityId: string;
    propertyId: string;
  }>();
  const router = useRouter();
  const clientId = params?.clientId ?? "";
  const entityId = params?.entityId ?? "";
  const propertyId = params?.propertyId ?? "";
  const [entity, setEntity] = useState<CoreEntity | null>(null);
  const [property, setProperty] = useState<CoreProperty | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;
        if (!session) {
          router.replace("/login/user");
          return;
        }
        const token = session.getIdToken().getJwtToken();

        const [entityRes, propertyRes] = await Promise.all([
          fetch(`/api/entities/${encodeURIComponent(entityId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/properties/${encodeURIComponent(propertyId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (cancelled) return;

        if (!entityRes.ok || !propertyRes.ok) {
          setErrorMessage("Failed to load property details.");
          return;
        }

        setEntity((await entityRes.json()) as CoreEntity);
        setProperty((await propertyRes.json()) as CoreProperty);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load property edit page:", error);
          setErrorMessage("Unexpected error loading property details.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (entityId && propertyId) load();
    return () => {
      cancelled = true;
    };
  }, [entityId, propertyId, router]);

  if (isLoading) {
    return (
      <Skeleton
        name="accountant-edit-property-page"
        loading
        fallback={<EntityWizardSkeleton />}
      >
        <EntityWizardSkeleton />
      </Skeleton>
    );
  }

  if (!entity || !property) {
    return (
      <section className="entity-wizard">
        <p className="entity-wizard-error">
          {errorMessage || "Property not found."}
        </p>
      </section>
    );
  }

  return (
    <AddPropertyWizard
      mode="edit"
      entity={entity}
      initialProperty={property}
      backHref={`/dashboard/accountant/clients/${clientId}/entities/${entityId}/properties/${propertyId}`}
      onSuccessHref={`/dashboard/accountant/clients/${clientId}/entities/${entityId}/properties/${propertyId}`}
    />
  );
}
