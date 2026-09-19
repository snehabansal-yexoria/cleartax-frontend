"use client";

import { useCallback, useEffect, useState } from "react";
import { getSession } from "@/src/lib/session";
import type { CorePnlSummary } from "@/src/lib/coreApi";

/**
 * The Profit & Loss statement on the property page.
 *
 * Reads GET /api/properties/{id}/pnl, which returns a server-side aggregate:
 * one line per category with both financial years already summed, plus the
 * depreciation deduction and the footed totals.
 *
 * This replaces a useMemo that computed the statement in the browser from the
 * page's `transactions` array. That array is one capped page (50 rows) of
 * DISPLAY-grain rows, which made the old statement wrong in four independent
 * ways: it summed the container of a part-private bill and so deducted the
 * private slice, it expensed capital purchases in full in their purchase year,
 * it added expenses to income because the API returns non-negative magnitudes,
 * and it reported a page as a year. It was also seeded with hardcoded FY2026
 * and FY2027 figures, so an empty property rendered a complete fabricated P&L.
 *
 * Like useGstSummary and usePersonalSummary, this invents nothing: on error the
 * data is cleared and the message surfaced. A confident wrong total on a tax
 * screen is worse than an empty one.
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

export type UsePnlSummaryResult = {
  summary: CorePnlSummary | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
};

export function usePnlSummary(
  propertyId: string,
  financialYear: number,
  options: { enabled?: boolean } = {},
): UsePnlSummaryResult {
  const enabled = options.enabled ?? true;

  const [summary, setSummary] = useState<CorePnlSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !propertyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = await bearerToken();
      const res = await fetch(
        `/api/properties/${encodeURIComponent(propertyId)}/pnl?financial_year=${financialYear}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message ||
            `Could not load the profit & loss statement (${res.status}).`,
        );
      }
      setSummary((await res.json()) as CorePnlSummary);
    } catch (err) {
      setSummary(null);
      setError(
        err instanceof Error
          ? err.message
          : "Could not load the profit & loss statement.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [enabled, propertyId, financialYear]);

  useEffect(() => {
    void load();
  }, [load]);

  return { summary, isLoading, error, reload: load };
}

// -----------------------------------------------------------------------------
// Presentation helpers
//
// Kept beside the hook because they encode the response's two conventions, and
// both are easy to get wrong at a call site.
// -----------------------------------------------------------------------------

/**
 * The label for one statement line.
 *
 * Leads with the CATEGORY and appends the subcategory only when it adds
 * something — nine of the seeded categories carry a filler subcategory named
 * "General", and leading with it renders rows that say nothing. Same rule as
 * personalCategoryLabel and the categorize drawer.
 */
export function pnlLineLabel(line: {
  categoryName: string;
  subcategoryName: string;
}): string {
  const category = line.categoryName?.trim();
  const sub = line.subcategoryName?.trim();
  const subIsMeaningful = !!sub && sub.toLowerCase() !== "general";

  if (!category) return subIsMeaningful ? sub : "Other";
  return subIsMeaningful ? `${category} · ${sub}` : category;
}

/**
 * Percentage change against the prior year, or null when there is no baseline.
 *
 * null rather than 0: "no prior-year figure" and "unchanged" are different
 * facts, and the statement renders the first as "—". The old code returned 0
 * for both, so a brand-new category displayed a confident "+0.0%".
 */
export function pnlChangePct(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
