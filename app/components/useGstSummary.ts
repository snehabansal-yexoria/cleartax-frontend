"use client";

import { useCallback, useEffect, useState } from "react";
import { getSession } from "@/src/lib/session";
import type { CoreGstScopeLevel, CoreGstSummary } from "@/src/lib/coreApi";

/**
 * Single source of truth for GST figures across the property, entity and client
 * pages.
 *
 * This exists because the same GST maths was previously copy-pasted into all
 * three pages, each with hardcoded placeholder fallbacks. A fix applied to one
 * page silently left the other two fabricating numbers. Keeping the fetch in
 * one hook means the bucketing rules (1B counts cost_base but not personal;
 * rejected rows excluded; period-scoped) live server-side in one aggregate and
 * are rendered identically everywhere.
 *
 * Never derive these numbers from a page's `transactions` array: the API caps
 * those lists at 100 rows and they carry no period filter, so totalling them
 * client-side under-reports a BAS without any visible error.
 */

/** Whole-financial-year option in the period selector. */
export const GST_FULL_YEAR = 0;

export const GST_QUARTER_LABELS: Record<number, string> = {
  1: "Q1 · Jul–Sep",
  2: "Q2 · Oct–Dec",
  3: "Q3 · Jan–Mar",
  4: "Q4 · Apr–Jun",
};

/**
 * Australian financial year a date falls in: FY2026 = 1 Jul 2025 – 30 Jun 2026.
 * July onwards belongs to the next FY.
 */
export function auFinancialYearOf(date: Date): number {
  return date.getMonth() >= 6 ? date.getFullYear() + 1 : date.getFullYear();
}

/** BAS quarter (1-4) a date falls in. Q1 is Jul–Sep. */
export function auQuarterOf(date: Date): number {
  const m = date.getMonth();
  if (m >= 6 && m <= 8) return 1; // Jul–Sep
  if (m >= 9) return 2; // Oct–Dec
  if (m <= 2) return 3; // Jan–Mar
  return 4; // Apr–Jun
}

/** Six years back covers any period still amendable with the ATO. */
export function gstAvailableYears(now = new Date()): number[] {
  const current = auFinancialYearOf(now);
  return Array.from({ length: 6 }, (_, i) => current - i);
}

interface SessionWithIdToken {
  getIdToken(): { getJwtToken(): string };
}

function endpointFor(level: CoreGstScopeLevel, id: string): string {
  switch (level) {
    case "entity":
      return `/api/entities/${encodeURIComponent(id)}/gst-summary`;
    case "client":
      return `/api/clients/${encodeURIComponent(id)}/gst-summary`;
    default:
      return `/api/properties/${encodeURIComponent(id)}/gst-summary`;
  }
}

export type UseGstSummaryResult = {
  summary: CoreGstSummary | null;
  isLoading: boolean;
  error: string | null;
  financialYear: number;
  setFinancialYear: (value: number) => void;
  quarter: number;
  setQuarter: (value: number) => void;
  /** Period label from the server, e.g. "Q2 FY2026". Empty until first load. */
  periodLabel: string;
  /** 1A — GST collected on sales. 0 while loading or on error, never invented. */
  gstOnSales: number;
  /** 1B — GST paid on purchases. */
  gstOnPurchases: number;
  reload: () => void;
};

/**
 * Fetches the GST summary for one scope, with BAS period selection.
 *
 * Loads on mount rather than on modal open, because the GST stat cards sit
 * above the fold on these pages and must be populated before any modal is
 * opened. Pass `enabled: false` to defer until an id is known.
 */
export function useGstSummary(
  level: CoreGstScopeLevel,
  id: string,
  options: { enabled?: boolean } = {},
): UseGstSummaryResult {
  const enabled = options.enabled ?? true;

  const [summary, setSummary] = useState<CoreGstSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [financialYear, setFinancialYear] = useState(() =>
    auFinancialYearOf(new Date()),
  );
  const [quarter, setQuarter] = useState(() => auQuarterOf(new Date()));

  const load = useCallback(async () => {
    if (!enabled || !id) return;
    setIsLoading(true);
    setError(null);
    try {
      const session = (await getSession()) as SessionWithIdToken | null;
      const token = session?.getIdToken().getJwtToken();
      if (!token) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const params = new URLSearchParams({
        financial_year: String(financialYear),
      });
      if (quarter !== GST_FULL_YEAR) params.set("quarter", String(quarter));

      const res = await fetch(`${endpointFor(level, id)}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message || `Could not load the GST summary (${res.status}).`,
        );
      }
      setSummary((await res.json()) as CoreGstSummary);
    } catch (err) {
      // Clear rather than keep stale figures: a wrong GST number shown
      // confidently is worse than none.
      setSummary(null);
      setError(
        err instanceof Error ? err.message : "Could not load the GST summary.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [enabled, level, id, financialYear, quarter]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    summary,
    isLoading,
    error,
    financialYear,
    setFinancialYear,
    quarter,
    setQuarter,
    periodLabel: summary?.period.label ?? "",
    gstOnSales: summary?.gstOnSales ?? 0,
    gstOnPurchases: summary?.gstOnPurchases ?? 0,
    reload: () => void load(),
  };
}
