"use client";

import { useCallback } from "react";
import type {
  CorePaginated,
  CorePnlTrend,
  CorePnlTrendMonth,
  CoreTransactionListItem,
} from "@/src/lib/coreApi";
import { affectsPnl } from "@/src/lib/transactionTypes";
import {
  fetchJson,
  HttpError,
  useAsyncRegion,
  type AsyncRegion,
} from "./useAsyncRegion";
import { auFinancialYearOf } from "./useGstSummary";

/**
 * Monthly income/expense trend for one entity across a financial year.
 *
 * Reads GET /api/entities/{id}/pnl-trend, a server aggregate that shares the
 * P&L statement's eligibility rules (money grain, revenue/expense only,
 * rejected rows excluded). This replaces a card that bucketed one page of the
 * 50 most recently ENTERED transactions at top grain — not a financial year,
 * and a part-private bill counted at its full amount.
 *
 * Interim fallback: until the backend route is deployed the BFF answers 404.
 * The hook then pages `GET …/transactions?from&to&grain=leaf` for that year
 * (up to three sequential pages, never fanned out — the core API allows two DB
 * connections per container) and buckets in the browser. `truncated` is set
 * when the year has more rows than were read, so the card can say the totals
 * are partial rather than presenting them as the year. Delete the fallback
 * once App Runner serves the endpoint.
 */

export type PnlTrendData = {
  /** The year the rows belong to — may differ from the one asked for when
   *  `autoSelectLatest` moved an empty current year to the latest with data. */
  financialYear: number;
  /** Twelve rows, July to June, zero-filled. */
  months: CorePnlTrendMonth[];
  availableFinancialYears: number[];
  /** Rows that contributed to `months`. */
  transactionCount: number;
  /** Fallback only: the year has more rows than were read. */
  truncated: boolean;
  /** Rows in the year overall (equals transactionCount unless truncated). */
  total: number;
  source: "server" | "fallback";
};

/** "2025-2026" for FY end-year 2026 — the label the trend card has always used. */
export function fyLabel(fy: number): string {
  return `${fy - 1}-${fy}`;
}

/** Inverse of {@link fyLabel}; `null` for anything that is not "YYYY-YYYY+1". */
export function parseFyLabel(label: string): number | null {
  const match = /^(\d{4})-(\d{4})$/.exec(label.trim());
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  return end === start + 1 ? end : null;
}

/** FY end-year for `now`: July onwards belongs to the next year. */
export function currentFinancialYear(now = new Date()): number {
  return auFinancialYearOf(now);
}

/** The twelve "YYYY-MM" keys of a financial year, July first. */
export function fyMonthKeys(fy: number): string[] {
  const keys: string[] = [];
  for (let m = 7; m <= 12; m += 1) keys.push(`${fy - 1}-${String(m).padStart(2, "0")}`);
  for (let m = 1; m <= 6; m += 1) keys.push(`${fy}-${String(m).padStart(2, "0")}`);
  return keys;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function loadFromServer(
  entityId: string,
  fy: number,
  token: string,
  signal: AbortSignal,
): Promise<PnlTrendData> {
  const trend = await fetchJson<CorePnlTrend>(
    `/api/entities/${encodeURIComponent(entityId)}/pnl-trend?financial_year=${fy}`,
    token,
    signal,
  );
  return {
    financialYear: fy,
    months: trend.months ?? [],
    availableFinancialYears: trend.availableFinancialYears ?? [],
    transactionCount: trend.transactionCount ?? 0,
    truncated: false,
    total: trend.transactionCount ?? 0,
    source: "server",
  };
}

const FALLBACK_PAGE_SIZE = 200;
const FALLBACK_MAX_PAGES = 3;

async function loadFromTransactions(
  entityId: string,
  fy: number,
  token: string,
  signal: AbortSignal,
): Promise<PnlTrendData> {
  const rows: CoreTransactionListItem[] = [];
  let total = 0;

  for (let page = 0; page < FALLBACK_MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      from: `${fy - 1}-07-01`,
      to: `${fy}-06-30`,
      sort: "date",
      dir: "asc",
      // Leaf grain: at top grain a part-private bill's container is typed
      // "expense" with the full gross, which would deduct the private slice.
      grain: "leaf",
      limit: String(FALLBACK_PAGE_SIZE),
      offset: String(page * FALLBACK_PAGE_SIZE),
    });
    const result = await fetchJson<CorePaginated<CoreTransactionListItem>>(
      `/api/entities/${encodeURIComponent(entityId)}/transactions?${params.toString()}`,
      token,
      signal,
    );
    const items = result.items ?? [];
    rows.push(...items);
    total = Math.max(result.total ?? 0, rows.length);
    if (rows.length >= total || items.length < FALLBACK_PAGE_SIZE) break;
  }

  const keys = fyMonthKeys(fy);
  const buckets = new Map<string, { income: number; expenses: number }>(
    keys.map((key) => [key, { income: 0, expenses: 0 }]),
  );
  let counted = 0;
  for (const row of rows) {
    if (!affectsPnl(row.type)) continue;
    const bucket = buckets.get((row.invoiceDate ?? "").slice(0, 7));
    if (!bucket) continue;
    const amount = Math.abs(row.grossAmount ?? 0);
    if (row.type === "revenue") bucket.income += amount;
    else bucket.expenses += amount;
    counted += 1;
  }

  const months: CorePnlTrendMonth[] = keys.map((month) => {
    const { income, expenses } = buckets.get(month)!;
    return {
      month,
      income: round2(income),
      expenses: round2(expenses),
      netResult: round2(income - expenses),
    };
  });

  return {
    financialYear: fy,
    months,
    // Only the requested year is known here; the card unions in the current FY.
    availableFinancialYears: [fy],
    transactionCount: counted,
    truncated: rows.length < total,
    total,
    source: "fallback",
  };
}

export function usePnlTrend(
  entityId: string,
  financialYear: number,
  opts: {
    enabled?: boolean;
    /**
     * When the requested year has no rows, show the latest year that does —
     * the default the card has always had. Off once the user picks a year.
     * Server path only: the fallback cannot know which years have data.
     */
    autoSelectLatest?: boolean;
  } = {},
): AsyncRegion<PnlTrendData> {
  const enabled = opts.enabled ?? true;
  const autoSelectLatest = opts.autoSelectLatest ?? false;
  // The flag is part of the key so picking the current year after an
  // auto-switch still refetches rather than reusing the switched data.
  const key = enabled && entityId ? `${entityId}:${financialYear}:${autoSelectLatest ? "auto" : "fixed"}` : null;

  const load = useCallback(
    async (token: string, signal: AbortSignal) => {
      try {
        const result = await loadFromServer(entityId, financialYear, token, signal);
        if (autoSelectLatest && result.transactionCount === 0 && result.availableFinancialYears.length > 0) {
          const latest = Math.max(...result.availableFinancialYears);
          if (latest !== financialYear) {
            return loadFromServer(entityId, latest, token, signal);
          }
        }
        return result;
      } catch (err) {
        // 404 = the core API has no /pnl-trend route yet (chi's not-found,
        // forwarded by renderUpstreamError). Anything else is a real failure.
        if (err instanceof HttpError && err.status === 404) {
          return loadFromTransactions(entityId, financialYear, token, signal);
        }
        throw err;
      }
    },
    [entityId, financialYear, autoSelectLatest],
  );

  return useAsyncRegion(key, load);
}
