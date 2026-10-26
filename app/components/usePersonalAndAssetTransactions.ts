"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getIdToken } from "@/src/lib/authToken";
import { GST_FULL_YEAR } from "./useGstSummary";
import type {
  CoreGstScopeLevel,
  CorePersonalSummary,
  CoreTransactionListItem,
} from "@/src/lib/coreApi";

/**
 * The Personal Transactions and Asset Transactions panels, for the property,
 * entity and client pages.
 *
 * These panels were previously hardcoded on all three pages — the same
 * invented categories ("Advertising for Tenants", "Rental Income") and the same
 * two invented asset rows, shown as if they were the client's real figures.
 * The entity page had begun deriving the personal breakdown from its own
 * `transactions` array, which is wrong in three separate ways:
 *
 *   - it filters `type === "personal"` over a DISPLAY-grain list, where the
 *     personal child of a part-private bill is hidden and the container is
 *     typed 'expense', so every partial private-use split is missed;
 *   - it totals one capped page rather than the whole set;
 *   - it split expense from revenue on `amount < 0`, but gross_amount is a
 *     non-negative column, so nothing ever landed in expenses and the invented
 *     fallback was always what got rendered.
 *
 * Both panels now read the server. Neither invents a fallback: an empty result
 * renders as empty, because a fabricated total on a tax screen is worse than a
 * blank one.
 */

// One memoised, deduplicated token for every panel on a page — see authToken.ts.
function bearerToken(): Promise<string> {
  return getIdToken();
}

function scopePath(level: CoreGstScopeLevel, id: string): string {
  switch (level) {
    case "entity":
      return `/api/entities/${encodeURIComponent(id)}`;
    case "client":
      return `/api/clients/${encodeURIComponent(id)}`;
    default:
      return `/api/properties/${encodeURIComponent(id)}`;
  }
}

// -----------------------------------------------------------------------------
// Personal Transactions
// -----------------------------------------------------------------------------

export type UsePersonalSummaryResult = {
  summary: CorePersonalSummary | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
};

/**
 * Private, non-deductible spending totalled by category.
 *
 * The server aggregates at money grain, so a bill that was 40% private
 * contributes its personal child here — which is the whole point: the panel is
 * where partial private use becomes visible, and the grid cannot show it.
 */
export function usePersonalSummary(
  level: CoreGstScopeLevel,
  id: string,
  options: {
    enabled?: boolean;
    /**
     * Narrow to a BAS period (the GST card's). Omitted = all time, which is
     * what the accountant panels show. quarter 0 (GST_FULL_YEAR) is the whole
     * financial year.
     */
    period?: { financialYear: number; quarter: number };
  } = {},
): UsePersonalSummaryResult {
  const enabled = options.enabled ?? true;
  // Primitives, not the object, so a fresh literal each render doesn't refetch.
  const periodYear = options.period?.financialYear ?? null;
  const periodQuarter = options.period?.quarter ?? null;
  const [summary, setSummary] = useState<CorePersonalSummary | null>(null);
  // Loading from the first frame whenever a fetch will happen (see useGstSummary).
  const [isLoading, setIsLoading] = useState(() => enabled && !!id);
  const [error, setError] = useState<string | null>(null);
  // A period change aborts the previous request (see useGstSummary).
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
      const token = await bearerToken();
      const params = new URLSearchParams();
      if (periodYear !== null) {
        params.set("financial_year", String(periodYear));
        if (periodQuarter !== null && periodQuarter !== GST_FULL_YEAR) {
          params.set("quarter", String(periodQuarter));
        }
      }
      const qs = params.toString();
      const res = await fetch(`${scopePath(level, id)}/personal-summary${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message ||
            `Could not load personal transactions (${res.status}).`,
        );
      }
      const data = (await res.json()) as CorePersonalSummary;
      if (controller.signal.aborted) return;
      setSummary(data);
    } catch (err) {
      if (controller.signal.aborted) return;
      // Cleared rather than left stale — a wrong total shown confidently is
      // worse than none, the same rule useGstSummary follows.
      setSummary(null);
      setError(
        err instanceof Error ? err.message : "Could not load personal transactions.",
      );
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [enabled, level, id, periodYear, periodQuarter]);

  useEffect(() => {
    void load();
    return () => inFlight.current?.abort();
  }, [load]);

  return { summary, isLoading, error, reload: load };
}

// -----------------------------------------------------------------------------
// Asset Transactions
// -----------------------------------------------------------------------------

export type UseAssetTransactionsResult = {
  rows: CoreTransactionListItem[];
  total: number;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
};

/** Default page size for the panel — enough to fill it without a scrollbar. */
const ASSET_PANEL_LIMIT = 10;

/**
 * Expenses flagged as asset purchases, newest first.
 *
 * A list rather than an aggregate, because the panel shows rows (entity,
 * property, asset name, date, amount). Read at display grain: a part-private
 * asset appears once as its bill, not twice as its two slices.
 *
 * `total` is the server's count for the whole filter, so the panel can say how
 * many were not shown rather than implying the first ten are all of them.
 */
export function useAssetTransactions(
  level: CoreGstScopeLevel,
  id: string,
  options: { enabled?: boolean; limit?: number } = {},
): UseAssetTransactionsResult {
  const enabled = options.enabled ?? true;
  const limit = options.limit ?? ASSET_PANEL_LIMIT;

  const [rows, setRows] = useState<CoreTransactionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(() => enabled && !!id);
  const [error, setError] = useState<string | null>(null);
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
      const token = await bearerToken();
      // Always the org-scoped list with a narrowing filter, never
      // /properties/{id}/transactions: that endpoint returns split-level rows
      // (one per property slice, with transaction_* / split_* amounts), a
      // different shape from the other two scopes. Filtering the org list keeps
      // one row type for all three panels.
      const params = new URLSearchParams({
        asset_purchase: "true",
        sort: "date",
        dir: "desc",
        limit: String(limit),
      });
      params.set(
        level === "entity"
          ? "entity_id"
          : level === "client"
            ? "client_id"
            : "property_id",
        id,
      );
      const res = await fetch(`/api/transactions?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message || `Could not load asset transactions (${res.status}).`,
        );
      }
      const data = (await res.json()) as {
        items?: CoreTransactionListItem[];
        total?: number;
      };
      if (controller.signal.aborted) return;
      setRows(data.items ?? []);
      setTotal(data.total ?? data.items?.length ?? 0);
    } catch (err) {
      if (controller.signal.aborted) return;
      setRows([]);
      setTotal(0);
      setError(
        err instanceof Error ? err.message : "Could not load asset transactions.",
      );
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [enabled, level, id, limit]);

  useEffect(() => {
    void load();
    return () => inFlight.current?.abort();
  }, [load]);

  return { rows, total, isLoading, error, reload: load };
}

/**
 * The asset's name for the panel's "Asset Name" column.
 *
 * Reads the `asset_name` COLUMN first. Migration 0037 promoted the name out of
 * metadata into a real column and then stripped `metadata.asset_item_name` from
 * every row, so a helper that only looked at metadata has returned nothing
 * since — every asset panel silently fell through to the description, or to a
 * dash when there was none.
 *
 * The metadata key is still checked second, because 0037 was a one-off UPDATE
 * rather than a trigger: any row written by a client that still posts the old
 * shape carries it again. Description stays as the last resort so a row with no
 * name at all reads sensibly instead of rendering blank.
 */
export function assetItemName(row: CoreTransactionListItem): string {
  const column = row.assetName;
  if (typeof column === "string" && column.trim()) return column.trim();

  const legacy = row.metadata?.asset_item_name;
  if (typeof legacy === "string" && legacy.trim()) return legacy.trim();

  return row.description?.trim() || "—";
}

/**
 * The label for one line of the private-spending breakdown.
 *
 * Leads with the CATEGORY, not the subcategory. The panel previously did
 * `subcategoryName || categoryName`, which put the subcategory first — and nine
 * of the seeded categories carry a filler subcategory literally named "General"
 * (Council rates/General, Cleaning/General, …). Every one of those rendered as
 * "General", telling the reader nothing.
 *
 * The subcategory is appended only when it adds something, which is the same
 * rule the rest of the app already applies: the categorize drawer hides the
 * subcategory picker when "General" is the only option, and the transaction
 * detail view omits a "General" subcategory line.
 */
export function personalCategoryLabel(c: {
  categoryName: string;
  subcategoryName: string;
}): string {
  const category = c.categoryName?.trim();
  const sub = c.subcategoryName?.trim();
  const subIsMeaningful = !!sub && sub.toLowerCase() !== "general";

  if (!category) return subIsMeaningful ? sub : "Other";
  return subIsMeaningful ? `${category} · ${sub}` : category;
}
