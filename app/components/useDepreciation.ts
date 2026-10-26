"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getIdToken } from "@/src/lib/authToken";
import type {
  CoreDepreciationList,
  CoreDepreciationSchedule,
  CoreDepreciationScopeLevel,
} from "@/src/lib/coreApi";

/**
 * Depreciation schedules, read from the server.
 *
 * There is no client-side calculation here on purpose. AssetDepreciationDetailPage
 * used to carry its own 90-line engine, which disagreed with the backend in two
 * ways that changed the numbers on a tax document: it counted days inclusively
 * so a full financial year came out at 366 days rather than taking the annual
 * amount, and it ended the schedule `life` calendar years after purchase rather
 * than at the end of the effective life. The schedule is computed once, in Go,
 * and stored — the same rows the generated PDF is rendered from.
 */

// One memoised, deduplicated token for every panel on a page — see authToken.ts.
function bearerToken(): Promise<string> {
  return getIdToken();
}

function scopePath(level: CoreDepreciationScopeLevel, id: string): string {
  const encoded = encodeURIComponent(id);
  switch (level) {
    case "transaction":
      return `/api/transactions/${encoded}/depreciation`;
    case "entity":
      return `/api/entities/${encoded}/depreciation`;
    case "client":
      return `/api/clients/${encoded}/depreciation`;
    // Org-wide takes no id — the backend reads the org from the claims.
    case "org":
      return `/api/depreciation`;
    default:
      return `/api/properties/${encoded}/depreciation`;
  }
}

/**
 * The July side of the current Australian financial year: 2026 means FY2026-27.
 *
 * The backend's ?fy= parameter uses the same convention (parseFYParam), and the
 * financial year turns over on 1 July, so anything from July onwards belongs to
 * the year that just started.
 */
export function currentAuFyStartYear(now: Date = new Date()): number {
  // getMonth() is 0-based, so 6 is July.
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

export type UseDepreciationResult = {
  data: CoreDepreciationList | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
};

/**
 * Every schedule in a scope, optionally narrowed to one financial year.
 *
 * `fy` is the July side of an Australian financial year: 2025 means FY 2025-26.
 * Passing it changes only the claim figures in `totals` and each item's
 * `fyDepreciation` — the lifetime amounts stay lifetime amounts, so filtering
 * cannot make an asset look nearly written off.
 */
export function useDepreciation(
  level: CoreDepreciationScopeLevel,
  id: string,
  options: { enabled?: boolean; fy?: number | null } = {},
): UseDepreciationResult {
  const enabled = options.enabled ?? true;
  const fy = options.fy ?? null;

  const [data, setData] = useState<CoreDepreciationList | null>(null);
  // Loading from the first frame whenever a fetch will happen (see useGstSummary).
  const [isLoading, setIsLoading] = useState(
    () => enabled && (!!id || level === "org"),
  );
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Org scope carries no id, so an empty one is legitimate there and only
    // there — every other level would otherwise fetch "/api/entities//…".
    if (!enabled || (!id && level !== "org")) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = await bearerToken();
      const qs = fy == null ? "" : `?fy=${encodeURIComponent(String(fy))}`;
      const res = await fetch(`${scopePath(level, id)}${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message || `Could not load depreciation schedules (${res.status}).`,
        );
      }
      setData((await res.json()) as CoreDepreciationList);
    } catch (err) {
      // Cleared rather than left stale, the same rule the GST and personal
      // panels follow: a wrong figure shown confidently on a tax screen is
      // worse than none.
      setData(null);
      setError(
        err instanceof Error ? err.message : "Could not load depreciation schedules.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [enabled, level, id, fy]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, reload: load };
}

export type FirstYearDeduction = {
  /** Year-one depreciation. Positive; the caller applies the sign. */
  amount: number;
  /** e.g. "FY 2026-27" — which year the figure belongs to. */
  fyLabel: string;
};

export type UseFirstYearDepreciationResult = {
  /** Keyed by the asset purchase's transaction id. */
  byTransactionId: Map<string, FirstYearDeduction>;
  isLoading: boolean;
  error: string | null;
};

/**
 * Year-one depreciation for every asset in a scope, keyed by transaction id.
 *
 * The asset panels list asset PURCHASES (transactions) but need to show the
 * DEDUCTION, which lives on the schedule. One scope-level call resolves the
 * whole panel — the alternative, GET /transactions/{id}/depreciation per row,
 * would be one request per asset.
 *
 * An asset split across two properties has one schedule per property (each
 * property's return needs its own figures), so at entity and client level a
 * transaction id can appear more than once. The amounts are summed: the panel
 * quotes the deduction for the whole asset at those levels, and the property
 * panel is already filtered to a single property so nothing is double-counted
 * there.
 *
 * Schedules with no generated years are skipped rather than counted as zero, so
 * a missing schedule shows as "—" and not as a $0 claim.
 *
 * Keyed on `displayTransactionId`, not `transactionId`. The panels list
 * transactions at display grain; a schedule hangs off the asset at money grain,
 * which on a part-private purchase is the business CHILD. Keying on the
 * schedule's own transaction id meant those rows never matched a panel row and
 * always rendered "—", which reads as "no schedule" rather than "looked up
 * under the wrong id".
 */
export function useFirstYearDepreciation(
  level: CoreDepreciationScopeLevel,
  id: string,
  options: { enabled?: boolean } = {},
): UseFirstYearDepreciationResult {
  // No ?fy= here: `first_yr` is projected by scheduleSelect regardless, and
  // nothing on the grid reads a current-year figure any more (the This FY
  // Depreciation column was removed 2026-09-12).
  const { data, isLoading, error } = useDepreciation(level, id, {
    enabled: options.enabled ?? true,
  });

  const byTransactionId = useMemo(() => {
    const out = new Map<string, FirstYearDeduction>();
    for (const item of data?.items ?? []) {
      // A schedule with no year-one row has not been generated yet. Skipped
      // rather than counted as zero, so it renders "—" and not a $0 claim.
      if (item.firstYearDepreciation == null) continue;
      const key = item.displayTransactionId || item.transactionId;
      const existing = out.get(key);

      // Summed across schedules: an asset split over two properties has one
      // schedule each, and the panels quote the whole asset at entity and
      // client level.
      out.set(key, {
        amount: (existing?.amount ?? 0) + item.firstYearDepreciation,
        fyLabel: existing?.fyLabel || item.firstYearFyLabel,
      });
    }
    return out;
  }, [data]);

  return { byTransactionId, isLoading, error };
}

export type UseDepreciationScheduleResult = {
  schedule: CoreDepreciationSchedule | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
};

/** One schedule with all of its year rows, for the per-asset report. */
export function useDepreciationSchedule(
  scheduleId: string,
  options: { enabled?: boolean } = {},
): UseDepreciationScheduleResult {
  const enabled = options.enabled ?? true;

  const [schedule, setSchedule] = useState<CoreDepreciationSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(() => enabled && !!scheduleId);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !scheduleId) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = await bearerToken();
      const res = await fetch(
        `/api/depreciation/${encodeURIComponent(scheduleId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message || `Could not load the depreciation schedule (${res.status}).`,
        );
      }
      setSchedule((await res.json()) as CoreDepreciationSchedule);
    } catch (err) {
      setSchedule(null);
      setError(
        err instanceof Error ? err.message : "Could not load the depreciation schedule.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [enabled, scheduleId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { schedule, isLoading, error, reload: load };
}

/**
 * Downloads the generated PDF through the authenticated proxy.
 *
 * A plain <a href> cannot carry the bearer token, so the bytes are fetched and
 * handed to the browser as a blob.
 */
export async function downloadDepreciationDocument(
  scheduleId: string,
  fileName: string,
): Promise<void> {
  const token = await bearerToken();
  const res = await fetch(
    `/api/depreciation/${encodeURIComponent(scheduleId)}/document`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || `Could not download the schedule (${res.status}).`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Formats a financial year the way the schedule prints it: "FY 2025-26". */
export function fyLabel(fyStartYear: number): string {
  return `FY ${fyStartYear}–${String(fyStartYear + 1).slice(-2)}`;
}

/**
 * The financial years a set of schedules spans, newest first — the options for
 * the report's year filter. Derived from the data rather than from a fixed
 * range so the picker never offers a year with nothing in it.
 */
export function financialYearsIn(schedules: CoreDepreciationSchedule[]): number[] {
  const years = new Set<number>();
  for (const s of schedules) {
    for (const y of s.years) years.add(y.fyStartYear);
  }
  return [...years].sort((a, b) => b - a);
}

export function formatCurrency(value: number): string {
  return `A$ ${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
