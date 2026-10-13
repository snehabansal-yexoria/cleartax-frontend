"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Skeleton } from "boneyard-js/react";
import ClientAddPropertyView from "@/app/components/clients/ClientAddPropertyView";
import { PropertyWizardSkeleton } from "@/app/components/PortalSkeletons";
import { getSession } from "@/src/lib/session";
import type { CoreProperty } from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

// Lives under /properties/[propertyid] (lowercase slug, matching the detail
// page beside it) — a sibling [propertyId] folder would make Next refuse to
// build. The entity comes from the loaded property, so the URL needs only the
// property id.
export default function ClientEditPropertyPage() {
  const params = useParams<{ propertyid: string }>();
  const router = useRouter();
  const propertyId = params?.propertyid ?? "";
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

        const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;

        if (!res.ok) {
          setErrorMessage("Failed to load property details.");
          return;
        }

        setProperty((await res.json()) as CoreProperty);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load property edit page:", error);
          setErrorMessage("Unexpected error loading property details.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (propertyId) load();
    return () => {
      cancelled = true;
    };
  }, [propertyId, router]);

  if (isLoading) {
    return (
      <Skeleton
        name="client-edit-property-page"
        loading
        fallback={<PropertyWizardSkeleton />}
      >
        <PropertyWizardSkeleton />
      </Skeleton>
    );
  }

  if (!property) {
    return (
      <section className="entity-wizard">
        <div className="entity-wizard-error">
          {errorMessage || "Property not found."}
        </div>
      </section>
    );
  }

  const detailHref = `/dashboard/client/properties/${propertyId}`;

  return (
    <ClientAddPropertyView
      mode="edit"
      propertyId={propertyId}
      initialProperty={property}
      entityId={property.entityId}
      backUrl={detailHref}
      backText="Property Details"
      onSuccessUrl={detailHref}
    />
  );
}
