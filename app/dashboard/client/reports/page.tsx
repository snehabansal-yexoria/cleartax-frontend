"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReportHub from "@/app/components/reports/client/ReportHub";
import { CLIENT_REPORTS_PATH, clientReportsHubHref } from "@/app/components/reports/client/reportLinks";
import { allProperties, useIsPhone } from "@/app/components/reports/client/reportScope";
import { parseUuid } from "@/app/components/reports/portfolio/useReportSearchParams";
import { useClientHoldings } from "@/app/components/useClientHoldings";

/**
 * Client portal → Reports: the list of reports. `?entity=` / `?property=`
 * (from an entity or property page's Reports button) carry through to
 * whichever report is opened.
 *
 * Phones have no sidebar; their Reports list is the Insights screen's
 * Reports tab, so a phone landing here is sent there with the same scope.
 */
function ClientReportsHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPhone = useIsPhone();
  const holdings = useClientHoldings();

  const scope = {
    entityId: parseUuid(searchParams.get("entity")),
    propertyId: parseUuid(searchParams.get("property")),
  };

  useEffect(() => {
    if (!isPhone) return;
    const target = {
      entityId: parseUuid(searchParams.get("entity")),
      propertyId: parseUuid(searchParams.get("property")),
    };
    router.replace(clientReportsHubHref(target, { mobile: true }));
  }, [isPhone, router, searchParams]);

  const list = holdings.data ?? [];
  const scopeName = scope.propertyId
    ? allProperties(list).find((p) => p.id === scope.propertyId)?.name
    : scope.entityId
      ? list.find((e) => e.id === scope.entityId)?.name
      : null;

  return (
    <div className="cp-report cp-page-wrap">
      <div className="cp-page">
        <div className="cp-phead">
          <div>
            <div className="cp-eyebrow">Clear Portfolio · Client portal · Reports</div>
            <h1>Reports</h1>
            <div className="cp-lede">
              Pick a report, then choose the entity, property and financial year. You can download any report as a PDF.
            </div>
          </div>
        </div>
        <ReportHub variant="cards" scope={scope} scopeName={scopeName} clearHref={CLIENT_REPORTS_PATH} />
      </div>
    </div>
  );
}

export default function ClientReportsPage() {
  return (
    <Suspense fallback={null}>
      <ClientReportsHub />
    </Suspense>
  );
}
