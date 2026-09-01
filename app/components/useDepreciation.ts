"use client";

import { useCallback, useEffect, useState } from "react";
import { getSession } from "@/src/lib/session";
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

interface SessionWithIdToken {
  getIdToken(): { getJwtToken(): string };
}

async function bearerToken(): Promise<string> {
  const session = (await getSession()) as SessionWithIdToken | null;
  const token = session?.getIdToken().getJwtToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  return token;
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
    default:
      return `/api/properties/${encoded}/depreciation`;
  }
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !id) return;
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
  const [isLoading, setIsLoading] = useState(false);
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
