"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import EntityDetailView from "@/app/components/EntityDetailView";
import { EntityDetailSkeleton } from "@/app/components/PortalSkeletons";

export default function AccountantEntityDetailPage() {
  const params = useParams<{ clientId: string; entityId: string }>();
  const clientId = params?.clientId ?? "";
  const entityId = params?.entityId ?? "";
  const base = `/dashboard/accountant/clients/${clientId}/entities/${entityId}`;

  return (
    // useSearchParams inside the view needs a boundary during prerender.
    <Suspense fallback={<EntityDetailSkeleton />}>
      <EntityDetailView
        entityId={entityId}
        backHref={`/dashboard/accountant/clients/${clientId}`}
        backLabel="Client"
        editEntityHref={`${base}/edit`}
        addPropertyHref={`${base}/properties/new`}
        addTransactionHref={`${base}/transactions/new`}
        // Same page, different tab: a soft navigation instead of the
        // redirecting /reconciliation route, which remounted everything.
        transactionRulesHref={`${base}?tab=reconciliation`}
        transactionRulesLabel="Reconcile Transaction"
        transactionRulesClassName="transaction-reconcile-button"
        transactionRulesIcon="reconcile"
        propertyDetailHrefBase={`${base}/properties`}
        reconciliationHref={`${base}/reconciliation`}
      />
    </Suspense>
  );
}
