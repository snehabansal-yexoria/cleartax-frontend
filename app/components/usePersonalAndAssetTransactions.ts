"use client";

import { useCallback, useEffect, useState } from "react";
import { getSession } from "@/src/lib/session";
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

interface SessionWithIdToken {
  getIdToken(): { getJwtToken(): string };
}

async function bearerToken(): Promise<string> {
  const session = (await getSession()) as SessionWithIdToken | null;
  const token = session?.getIdToken().getJwtToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  return token;
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
  options: { enabled?: boolean } = {},
): UsePersonalSummaryResult {
  const enabled = options.enabled ?? true;
  const [summary, setSummary] = useState<CorePersonalSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !id) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = await bearerToken();
      const res = await fetch(`${scopePath(level, id)}/personal-summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message ||
            `Could not load personal transactions (${res.status}).`,
        );
      }
      setSummary((await res.json()) as CorePersonalSummary);
    } catch (err) {
      // Cleared rather than left stale — a wrong total shown confidently is
      // worse than none, the same rule useGstSummary follows.
      setSummary(null);
      setError(
        err instanceof Error ? err.message : "Could not load personal transactions.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [enabled, level, id]);

  useEffect(() => {
    void load();
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !id) return;
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
      setRows(data.items ?? []);
      setTotal(data.total ?? data.items?.length ?? 0);
    } catch (err) {
      setRows([]);
      setTotal(0);
      setError(
        err instanceof Error ? err.message : "Could not load asset transactions.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [enabled, level, id, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, total, isLoading, error, reload: load };
}

/**
 * The asset's name for the panel's "Asset Name" column.
 *
 * Recorded by the Add Transaction form as metadata.asset_item_name; falls back
 * to the transaction description, then to a dash, so a row written before that
 * field existed still reads sensibly instead of rendering blank.
 */
export function assetItemName(row: CoreTransactionListItem): string {
  const named = row.metadata?.asset_item_name;
  if (typeof named === "string" && named.trim()) return named.trim();
  return row.description?.trim() || "—";
}
