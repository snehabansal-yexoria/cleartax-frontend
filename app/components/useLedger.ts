"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSession } from "@/src/lib/session";
import type { CoreLedgerResponse } from "@/src/lib/coreApi";

/**
 * The account ledger for a completed reconciliation.
 *
 * Reads GET /api/entities/{id}/reconciliation-sessions/{sessionId}/ledger,
 * which returns a server-side statement: one row per bank statement line, in
 * statement order, with the running balance already computed over every line so
 * paging cannot break it.
 *
 * This replaces a page seeded with eleven hardcoded rows, a $10,000 opening
 * balance and a "Business Account – ANZ" caption, which rendered a complete,
 * confident, entirely fictional ledger for any reconciliation.
 *
 * Like usePnlSummary and useGstSummary, it invents nothing: on error the data is
 * cleared and the message surfaced. A confident wrong balance on a tax screen is
 * worse than an empty one.
 */

interface SessionWithIdToken {
  getIdToken(): { getJwtToken(): string };
}

export async function ledgerBearerToken(): Promise<string> {
  const session = (await getSession()) as SessionWithIdToken | null;
  const token = session?.getIdToken().getJwtToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  return token;
}

export type LedgerQueryState = {
  reconciliationId?: string;
  from?: string;
  to?: string;
  categoryId?: number;
  type?: string;
  limit: number;
  offset: number;
};

export function ledgerSearchParams(query: LedgerQueryState): URLSearchParams {
  const sp = new URLSearchParams();
  if (query.reconciliationId) sp.set("reconciliation_id", query.reconciliationId);
  if (query.from) sp.set("from", query.from);
  if (query.to) sp.set("to", query.to);
  if (query.categoryId != null) sp.set("category_id", String(query.categoryId));
  if (query.type) sp.set("type", query.type);
  sp.set("limit", String(query.limit));
  sp.set("offset", String(query.offset));
  return sp;
}

export type UseLedgerResult = {
  ledger: CoreLedgerResponse | null;
  isLoading: boolean;
  error: string | null;
  /** Set when the reconciliation is still open, so the page can say so rather
   *  than showing a generic failure. */
  notCompleted: boolean;
  reload: () => void;
  /** Patch one row in place after a successful rename, so the table does not
   *  flash through a full reload for a one-field edit. */
  applyRowName: (bankTxIndex: number, name: string) => void;
};

export function useLedger(
  entityId: string,
  sessionId: string,
  query: LedgerQueryState,
): UseLedgerResult {
  const [ledger, setLedger] = useState<CoreLedgerResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notCompleted, setNotCompleted] = useState(false);

  // Serialised so the effect depends on the query's value, not its identity.
  const queryString = useMemo(
    () => ledgerSearchParams(query).toString(),
    [query],
  );

  const load = useCallback(async () => {
    if (!entityId || !sessionId) return;
    setIsLoading(true);
    setError(null);
    setNotCompleted(false);
    try {
      const token = await ledgerBearerToken();
      const res = await fetch(
        `/api/entities/${encodeURIComponent(entityId)}/reconciliation-sessions/${encodeURIComponent(sessionId)}/ledger?${queryString}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        if (res.status === 409 && body?.code === "session_not_completed") {
          setNotCompleted(true);
        }
        throw new Error(
          body?.message || `Could not load the ledger (${res.status}).`,
        );
      }
      setLedger((await res.json()) as CoreLedgerResponse);
    } catch (err) {
      setLedger(null);
      setError(err instanceof Error ? err.message : "Could not load the ledger.");
    } finally {
      setIsLoading(false);
    }
  }, [entityId, sessionId, queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyRowName = useCallback((bankTxIndex: number, name: string) => {
    setLedger((prev) =>
      prev
        ? {
            ...prev,
            rows: prev.rows.map((row) =>
              row.bankTxIndex === bankTxIndex ? { ...row, name } : row,
            ),
          }
        : prev,
    );
  }, []);

  return { ledger, isLoading, error, notCompleted, reload: load, applyRowName };
}

// -----------------------------------------------------------------------------
// Date presets
//
// The spec's five options, resolved to concrete ISO dates against the real
// clock. The mock resolved them against a hardcoded `new Date(2026, 7, 25)`,
// so every preset filtered around a fixed day in August 2026.
// -----------------------------------------------------------------------------

export type LedgerDatePreset =
  | "All Dates"
  | "Today"
  | "Last 7 Days"
  | "Last Month"
  | "This Month"
  | "Custom Date Range";

export const LEDGER_DATE_PRESETS: LedgerDatePreset[] = [
  "All Dates",
  "Today",
  "Last 7 Days",
  "Last Month",
  "This Month",
  "Custom Date Range",
];

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Resolve a preset to a {from, to} pair. "All Dates" and an incomplete custom
 * range return undefined bounds, which the API reads as unfiltered.
 */
export function resolveLedgerPreset(
  preset: LedgerDatePreset,
  customFrom: string,
  customTo: string,
  now: Date = new Date(),
): { from?: string; to?: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "Today":
      return { from: isoDate(today), to: isoDate(today) };
    case "Last 7 Days": {
      const start = new Date(today);
      start.setDate(start.getDate() - 6); // inclusive of today
      return { from: isoDate(start), to: isoDate(today) };
    }
    case "This Month":
      return {
        from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
        to: isoDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
      };
    case "Last Month":
      return {
        from: isoDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        to: isoDate(new Date(today.getFullYear(), today.getMonth(), 0)),
      };
    case "Custom Date Range":
      return { from: customFrom || undefined, to: customTo || undefined };
    default:
      return {};
  }
}

/** DD/MM/YYYY for display; the API speaks ISO. */
export function formatLedgerDate(iso: string): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

export function formatLedgerRange(
  from: string | null,
  to: string | null,
): string {
  if (!from && !to) return "All dates";
  if (from && to) return `${formatLedgerDate(from)} – ${formatLedgerDate(to)}`;
  return from ? `From ${formatLedgerDate(from)}` : `Up to ${formatLedgerDate(to!)}`;
}
