"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "boneyard-js/react";
import ClientAddEntityWizard from "@/app/components/clients/ClientAddEntityWizard";
import { ClientEntityWizardSkeleton } from "@/app/components/PortalSkeletons";
import { getSession } from "@/src/lib/session";
import {
  isSafeInternalHref,
  resolveBackTarget,
  backLabelFor,
} from "@/app/components/clients/backTarget";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

function ClientAddEntityContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selfUserId, setSelfUserId] = useState<string | null>(null);
  const [selfName, setSelfName] = useState("");

  const backUrlParam =
    searchParams.get("backUrl") ||
    searchParams.get("backHref") ||
    searchParams.get("from") ||
    searchParams.get("returnTo");
  const queryBackHref = isSafeInternalHref(backUrlParam) ? backUrlParam : null;
  const queryBackLabel =
    searchParams.get("backLabel") || searchParams.get("backText");

  const [backHref, setBackHref] = useState<string>(
    queryBackHref || "/dashboard/client/entities",
  );
  const [backLabel, setBackLabel] = useState<string>(
    queryBackLabel || (queryBackHref ? backLabelFor(queryBackHref) : "Entities"),
  );

  useEffect(() => {
    if (queryBackHref) {
      setBackHref(queryBackHref);
      setBackLabel(queryBackLabel || backLabelFor(queryBackHref));
      return;
    }

    const target = resolveBackTarget(window.location.pathname);
    if (target) {
      setBackHref(target.href);
      setBackLabel(target.label);
    }
  }, [queryBackHref, queryBackLabel]);

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
      const data = (await res.json()) as {
        id?: string;
        fullName?: string;
        email?: string;
      };
      if (cancelled) return;
      if (!data.id) {
        router.replace("/login/user");
        return;
      }
      setSelfUserId(data.id);
      setSelfName(data.fullName || data.email || "Client");
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
        fallback={<ClientEntityWizardSkeleton />}
      >
        <ClientEntityWizardSkeleton />
      </Skeleton>
    );
  }

  const onSuccessHref =
    backHref && backHref !== "/dashboard/client/entities/new"
      ? backHref
      : "/dashboard/client/entities";

  return (
    <ClientAddEntityWizard
      createdFor={selfUserId}
      backLabel={backLabel}
      backHref={backHref}
      onSuccessHref={onSuccessHref}
      defaultBeneficiaryName={selfName}
    />
  );
}

export default function ClientAddEntityPage() {
  return (
    <Suspense fallback={<ClientEntityWizardSkeleton />}>
      <ClientAddEntityContent />
    </Suspense>
  );
}
