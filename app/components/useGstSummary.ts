"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getIdToken } from "@/src/lib/authToken";
import type {
  CoreGstOutcome,
  CoreGstScopeLevel,
  CoreGstSummary,
} from "@/src/lib/coreApi";

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

/**
 * BAS label 9 in words, from the SERVER's outcome. Never re-derive it from the
 * sign of (purchases - sales) on the client: that reads a nil period as a
 * refund.
 */
export function gstOutcomeLabel(outcome: CoreGstOutcome): string {
  switch (outcome) {
    case "payment_due":
      return "Payment due to ATO";
    case "refund_due":
      return "Refund due from ATO";
    default:
      return "Nil — nothing to pay or claim";
  }
}

/** Six years back covers any period still amendable with the ATO. */
export function gstAvailableYears(now = new Date()): number[] {
  const current = auFinancialYearOf(now);
  return Array.from({ length: 6 }, (_, i) => current - i);
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
 *
 * `initialQuarter` picks the opening period: the current BAS quarter by
 * default, or GST_FULL_YEAR for the whole current financial year.
 */
export function useGstSummary(
  level: CoreGstScopeLevel,
  id: string,
  options: { enabled?: boolean; initialQuarter?: number } = {},
): UseGstSummaryResult {
  const enabled = options.enabled ?? true;

  const [summary, setSummary] = useState<CoreGstSummary | null>(null);
  // Starts as loading whenever a fetch is going to happen, so the first frame
  // renders a skeleton rather than "A$ 0.00" for the tick before the effect.
  const [isLoading, setIsLoading] = useState(() => enabled && !!id);
  const [error, setError] = useState<string | null>(null);
  const [financialYear, setFinancialYear] = useState(() =>
    auFinancialYearOf(new Date()),
  );
  const [quarter, setQuarter] = useState(
    () => options.initialQuarter ?? auQuarterOf(new Date()),
  );

  // Every period change fires a request. Each new one aborts the last, so a
  // slow answer for the previous period can never land after — and overwrite —
  // the figures for the period now shown in the pickers.
  const inFlight = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    inFlight.current?.abort();
    if (!enabled || !id) {
      inFlight.current = null;
      setIsLoading(false);
      return;
    }
    const controller = new AbortController();
    inFlight.current = controller;
    setIsLoading(true);
    setError(null);
    try {
      const token = await getIdToken();

      const params = new URLSearchParams({
        financial_year: String(financialYear),
      });
      if (quarter !== GST_FULL_YEAR) params.set("quarter", String(quarter));

      const res = await fetch(`${endpointFor(level, id)}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message || `Could not load the GST summary (${res.status}).`,
        );
      }
      const data = (await res.json()) as CoreGstSummary;
      if (controller.signal.aborted) return;
      setSummary(data);
    } catch (err) {
      if (controller.signal.aborted) return;
      // Clear rather than keep stale figures: a wrong GST number shown
      // confidently is worse than none.
      setSummary(null);
      setError(
        err instanceof Error ? err.message : "Could not load the GST summary.",
      );
    } finally {
      // A superseded request leaves the loading flag to its successor.
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [enabled, level, id, financialYear, quarter]);

  useEffect(() => {
    void load();
    return () => inFlight.current?.abort();
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
