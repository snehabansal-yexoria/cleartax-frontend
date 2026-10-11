"use client";

import { useCallback } from "react";
import type { CorePortfolioSummary } from "@/src/lib/coreApi";
import { fetchJson, useAsyncRegion, type AsyncRegion } from "./useAsyncRegion";

/**
 * The client's Portfolio Summary for one financial year (end-year convention:
 * 2026 is FY 2025-26).
 *
 * Reads GET /api/clients/{id}/portfolio-summary, one server aggregate behind
 * the Reports page (and, next, the home dashboard's cards) — so the figures
 * are the same wherever they are shown, and never a sum over one page of
 * transactions in the browser.
 *
 * No 404 fallback, unlike usePnlTrend: here a 404 also means "not your
 * client", and a confident report built from the wrong rows is worse than an
 * error with Retry.
 */
export function usePortfolioSummary(
  clientId: string | null,
  financialYear: number,
): AsyncRegion<CorePortfolioSummary> {
  const key = clientId ? `${clientId}:${financialYear}` : null;

  const load = useCallback(
    (token: string, signal: AbortSignal) =>
      fetchJson<CorePortfolioSummary>(
        `/api/clients/${encodeURIComponent(clientId ?? "")}/portfolio-summary?financial_year=${financialYear}`,
        token,
        signal,
      ),
    [clientId, financialYear],
  );

  return useAsyncRegion(key, load);
}

/** The signed-in user's id, from /api/users/me — the client id for client-scope reads. */
export function useCurrentUserId(): AsyncRegion<string> {
  const load = useCallback(async (token: string, signal: AbortSignal) => {
    const me = await fetchJson<{ id?: string }>("/api/users/me", token, signal);
    const id = (me?.id ?? "").trim();
    if (!id) throw new Error("Couldn't identify your account.");
    return id;
  }, []);

  return useAsyncRegion("me", load);
}
