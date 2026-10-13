"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * The report's URL state, shared by the Reports page and the entity/property
 * pages' Reporting tab: `tab`, `fy` (end-year convention), `entity` and
 * `property`. In the URL so a printed or shared link reopens the same report,
 * and so the year survives a round trip to edit a transaction.
 *
 * Writes use replace, not push: switching a tab or a year is not a navigation
 * the Back button should step through.
 */

export type ReportTab = "overview" | "reporting";

type ReportParam = "tab" | "fy" | "entity" | "property";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseFinancialYear(raw: string | null): number | null {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 1900 && parsed <= 2999 ? parsed : null;
}

function parseUuid(raw: string | null): string | null {
  const value = (raw ?? "").trim();
  return UUID_RE.test(value) ? value : null;
}

export function useReportSearchParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab: ReportTab = searchParams.get("tab") === "reporting" ? "reporting" : "overview";
  const financialYear = parseFinancialYear(searchParams.get("fy"));
  const entityId = parseUuid(searchParams.get("entity"));
  const propertyId = parseUuid(searchParams.get("property"));

  /** Set or clear (null / "") params, keeping every other one. */
  const update = useCallback(
    (patch: Partial<Record<ReportParam, string | number | null>>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const setTab = useCallback(
    (value: ReportTab) => update({ tab: value === "reporting" ? "reporting" : null }),
    [update],
  );
  const setFinancialYear = useCallback((value: number) => update({ fy: value }), [update]);

  return { tab, financialYear, entityId, propertyId, update, setTab, setFinancialYear };
}

/** Deep link to the Reports page for one scope. Targets the report directly:
 * /dashboard/client/reports is a server redirect that drops the query. */
export function clientReportHref(scope: { entityId?: string | null; propertyId?: string | null }): string {
  const params = new URLSearchParams();
  if (scope.entityId) params.set("entity", scope.entityId);
  if (scope.propertyId) params.set("property", scope.propertyId);
  const qs = params.toString();
  return `/dashboard/client/reports/portfolio-summary${qs ? `?${qs}` : ""}`;
}
