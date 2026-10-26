"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import type { AsyncRegion } from "@/app/components/useAsyncRegion";
import { currentFinancialYear } from "@/app/components/clients/portfolioDashboard";
import { useCurrentUserId, usePortfolioSummary } from "@/app/components/usePortfolioSummary";
import type { CorePortfolioSummary } from "@/src/lib/coreApi";
import PortfolioSummaryReport from "./PortfolioSummaryReport";
import { describeReportScope } from "./reportScope";

/**
 * The Portfolio Summary report for the signed-in client, at whichever scope is
 * asked for: the whole portfolio, one entity, or one property.
 *
 * The one place that turns a scope into data — the Reports page and the
 * entity/property pages' Reporting tab both render this, so the figures can
 * never differ between them. The markup is PortfolioSummaryReport's.
 */

export type ClientScopedReportProps = {
  entityId?: string | null;
  /** Wins over entityId; the server derives the property's entity. */
  propertyId?: string | null;
  /** Controlled year (end-year convention). Omit to keep it local. */
  financialYear?: number;
  onFinancialYearChange?: (year: number) => void;
  variant?: "page" | "embedded";
  /**
   * A region the parent already loaded for the same scope (the entity page's
   * own summary). Used while its year is the one shown, so opening the tab
   * costs no second request.
   */
  seed?: { financialYear: number; region: AsyncRegion<CorePortfolioSummary> };
  headerControls?: ReactNode;
};

export default function ClientScopedReport({
  entityId,
  propertyId,
  financialYear: controlledYear,
  onFinancialYearChange,
  variant = "page",
  seed,
  headerControls,
}: ClientScopedReportProps) {
  const current = currentFinancialYear();
  const [localYear, setLocalYear] = useState(current);
  const financialYear = controlledYear ?? localYear;
  const setFinancialYear = onFinancialYearChange ?? setLocalYear;

  const seeded = seed?.financialYear === financialYear;
  const me = useCurrentUserId();
  const own = usePortfolioSummary(
    !seeded && me.status === "ready" ? me.data : null,
    financialYear,
    propertyId ? null : entityId,
    propertyId,
  );

  // One region for the report: identity first, then the summary itself.
  const region: AsyncRegion<CorePortfolioSummary> =
    seeded && seed
      ? seed.region
      : me.status === "error"
        ? { ...own, status: "error", error: me.error, errorKind: me.errorKind, reload: me.reload }
        : me.status !== "ready"
          ? { ...own, status: "loading" }
          : own;

  // Years with data, plus the current year and whichever one is selected, so
  // the picker never hides the year on screen.
  const yearOptions = [
    ...new Set<number>([current, financialYear, ...(region.data?.availableFinancialYears ?? [])]),
  ].sort((a, b) => b - a);

  const scope = describeReportScope(region.data, { entityId, propertyId });

  return (
    <PortfolioSummaryReport
      region={region}
      financialYear={financialYear}
      onFinancialYearChange={setFinancialYear}
      yearOptions={yearOptions}
      scope={scope}
      variant={variant}
      headerControls={headerControls}
    />
  );
}
