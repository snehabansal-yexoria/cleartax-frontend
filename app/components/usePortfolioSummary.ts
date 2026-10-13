"use client";

import { useCallback } from "react";
import type { CorePortfolioSummary } from "@/src/lib/coreApi";
import { fetchJson, useAsyncRegion, type AsyncRegion } from "./useAsyncRegion";
import { fetchCurrentUser } from "./currentUser";

/**
 * The client's Portfolio Summary for one financial year (end-year convention:
 * 2026 is FY 2025-26), optionally narrowed to one entity or one property.
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
  /** Narrow every figure to one of the client's entities (the entity page). */
  entityId?: string | null,
  /**
   * Narrow to one property (the property page). The server derives its
   * entity, so pass this alone.
   */
  propertyId?: string | null,
): AsyncRegion<CorePortfolioSummary> {
  const key = clientId
    ? `${clientId}:${financialYear}:${entityId ?? ""}:${propertyId ?? ""}`
    : null;

  const load = useCallback(
    async (token: string, signal: AbortSignal) => {
      const params = new URLSearchParams({ financial_year: String(financialYear) });
      if (entityId) params.set("entity_id", entityId);
      if (propertyId) params.set("property_id", propertyId);
      const summary = await fetchJson<CorePortfolioSummary>(
        `/api/clients/${encodeURIComponent(clientId ?? "")}/portfolio-summary?${params.toString()}`,
        token,
        signal,
      );
      assertScope(summary, entityId, propertyId);
      return summary;
    },
    [clientId, financialYear, entityId, propertyId],
  );

  return useAsyncRegion(key, load);
}

/**
 * A backend that predates a filter ignores the param and answers for the
 * whole client — a confident report for the wrong scope. Refuse anything that
 * isn't the scope asked for, so the region shows Retry instead. Compares the
 * id as well as the level.
 */
function assertScope(
  summary: CorePortfolioSummary,
  entityId?: string | null,
  propertyId?: string | null,
) {
  const want = propertyId
    ? { level: "property", id: propertyId }
    : entityId
      ? { level: "entity", id: entityId }
      : null;
  if (!want) return;
  const got = summary?.scope;
  if (
    !got ||
    got.level !== want.level ||
    (got.id ?? "").toLowerCase() !== want.id.toLowerCase()
  ) {
    throw new Error(
      `This ${want.level} report isn't available yet. Please try again shortly.`,
    );
  }
}

/**
 * The signed-in user's id, from /api/users/me — the client id for client-scope
 * reads. Shares the layout's in-flight request (fetchCurrentUser) rather than
 * making its own.
 */
export function useCurrentUserId(): AsyncRegion<string> {
  const load = useCallback(async (token: string) => {
    const me = await fetchCurrentUser(token);
    const id = (me?.id ?? "").trim();
    if (!id) throw new Error("Couldn't identify your account.");
    return id;
  }, []);

  return useAsyncRegion("me", load);
}
