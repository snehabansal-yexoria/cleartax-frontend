"use client";

import { Suspense } from "react";
import Link from "next/link";
import ClientScopedReport from "@/app/components/reports/portfolio/ClientScopedReport";
import ReportScopePicker from "@/app/components/reports/portfolio/ReportScopePicker";
import { useReportSearchParams } from "@/app/components/reports/portfolio/useReportSearchParams";
import { currentFinancialYear } from "@/app/components/clients/portfolioDashboard";
import { useClientHoldings } from "@/app/components/useClientHoldings";

/**
 * Client portal → Reports → Portfolio Summary, for the whole portfolio or
 * narrowed to one entity or property.
 *
 * Everything that picks the report lives in the URL (`?fy=2026&entity=…
 * &property=…`, end-year convention) so a printed or shared link reopens the
 * same statement, and the entity and property pages can deep-link here. FY
 * defaults to the current one.
 */
function PortfolioSummaryPageInner() {
  const { financialYear, entityId, propertyId, update, setFinancialYear } = useReportSearchParams();
  const holdings = useClientHoldings();
  const entities = holdings.data ?? [];

  // Back link to the page the report is about, when narrowed.
  const backEntity = entities.find((e) => e.id === entityId);
  const backProperty = propertyId
    ? entities.flatMap((e) => e.properties).find((p) => p.id === propertyId)
    : undefined;
  const back = propertyId
    ? { href: `/dashboard/client/properties/${propertyId}`, label: backProperty?.name ?? "property" }
    : entityId
      ? { href: `/dashboard/client/entities/${entityId}`, label: backEntity?.name ?? "entity" }
      : null;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pt-4 md:px-1 md:pt-0 pb-24 md:pb-10">
      {back && (
        <Link
          href={back.href}
          className="print-hide mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <span aria-hidden="true">←</span> Back to {back.label}
        </Link>
      )}
      <ClientScopedReport
        entityId={entityId}
        propertyId={propertyId}
        financialYear={financialYear ?? currentFinancialYear()}
        onFinancialYearChange={setFinancialYear}
        headerControls={
          holdings.status === "error" ? null : (
            <ReportScopePicker
              entities={entities}
              entityId={entityId}
              propertyId={propertyId}
              disabled={holdings.status !== "ready"}
              onChange={(next) => update({ entity: next.entityId, property: next.propertyId })}
            />
          )
        }
      />
    </div>
  );
}

export default function PortfolioSummaryPage() {
  return (
    <Suspense fallback={null}>
      <PortfolioSummaryPageInner />
    </Suspense>
  );
}
