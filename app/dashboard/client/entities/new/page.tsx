"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "boneyard-js/react";
import AddEntityWizard from "@/app/components/AddEntityWizard";
import { EntityWizardSkeleton } from "@/app/components/PortalSkeletons";
import { getSession } from "@/src/lib/session";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

export default function ClientAddEntityPage() {
  const router = useRouter();
  const [selfUserId, setSelfUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveSelf() {
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) {
        router.replace("/login/user");
        return;
      }
      const token = session.getIdToken().getJwtToken();

      const res = await fetch("/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        router.replace("/login/user");
        return;
      }
      const data = (await res.json()) as { id?: string };
      if (cancelled) return;
      if (!data.id) {
        router.replace("/login/user");
        return;
      }
      setSelfUserId(data.id);
    }

    resolveSelf();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!selfUserId) {
    return (
      <Skeleton
        name="client-add-entity-page"
        loading
        fallback={<EntityWizardSkeleton />}
      >
        <EntityWizardSkeleton />
      </Skeleton>
    );
  }

  return (
    <AddEntityWizard
      createdFor={selfUserId}
      backLabel="My Workspace"
      backHref="/dashboard/client"
      onSuccessHref="/dashboard/client"
    />
  );
}
