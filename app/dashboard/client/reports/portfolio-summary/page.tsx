"use client";

import { Suspense, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import PortfolioSummaryReport from "@/app/components/reports/portfolio/PortfolioSummaryReport";
import type { AsyncRegion } from "@/app/components/useAsyncRegion";
import { currentFinancialYear } from "@/app/components/usePnlTrend";
import { useCurrentUserId, usePortfolioSummary } from "@/app/components/usePortfolioSummary";
import type { CorePortfolioSummary } from "@/src/lib/coreApi";

/**
 * Client portal → Reports → Portfolio Summary.
 *
 * The financial year lives in the URL (`?fy=2026`, end-year convention) so a
 * printed or shared link reopens the same statement; it defaults to the
 * current FY.
 */
function parseFy(raw: string | null): number | null {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 1900 && parsed <= 2999 ? parsed : null;
}

function PortfolioSummaryPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = currentFinancialYear();
  const financialYear = parseFy(searchParams.get("fy")) ?? current;

  const me = useCurrentUserId();
  const summary = usePortfolioSummary(me.status === "ready" ? me.data : null, financialYear);

  // One region for the report: identity first, then the summary itself.
  const region: AsyncRegion<CorePortfolioSummary> =
    me.status === "error"
      ? { ...summary, status: "error", error: me.error, errorKind: me.errorKind, reload: me.reload }
      : me.status !== "ready"
        ? { ...summary, status: "loading" }
        : summary;

  // Years with data, plus the current year and whichever one is selected, so
  // the picker never hides the year on screen.
  const available = summary.data?.availableFinancialYears;
  const yearOptions = useMemo(() => {
    const set = new Set<number>([current, financialYear, ...(available ?? [])]);
    return [...set].sort((a, b) => b - a);
  }, [available, current, financialYear]);

  const setFinancialYear = (year: number) => {
    router.replace(`${pathname}?fy=${year}`, { scroll: false });
  };

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pt-4 md:px-1 md:pt-0 pb-24 md:pb-10">
      <PortfolioSummaryReport
        region={region}
        financialYear={financialYear}
        onFinancialYearChange={setFinancialYear}
        yearOptions={yearOptions}
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
