"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CoreChartAccount } from "@/src/lib/coreApi";

export interface ChartOfAccountsIndex {
  accounts: CoreChartAccount[];
  byId: Map<number, CoreChartAccount>;
  byCode: Map<string, CoreChartAccount>;
  isLoading: boolean;
  error: string;
  reload: () => void;
}

/**
 * Load the Chart of Accounts once per screen and index it.
 *
 * This replaces the hardcoded eight-code map the manual grid used to carry,
 * whose codes (310, 610, 620, 110, 800) matched nothing in the database. The
 * codes are now whatever migration 0042 seeded, and an org can extend them.
 */
export function useChartOfAccounts(token: string): ChartOfAccountsIndex {
  const [accounts, setAccounts] = useState<CoreChartAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();

    (async () => {
      setIsLoading(true);
      setError("");
      try {
        const res = await fetch("/api/chart-of-accounts", {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body?.message || body?.error || "Could not load the chart of accounts.",
          );
        }
        const data = await res.json();
        setAccounts(Array.isArray(data.items) ? data.items : []);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        // Surface the real failure rather than falling back to invented codes:
        // an account code the database does not have cannot be saved.
        setError((err as Error)?.message ?? "Could not load the chart of accounts.");
        setAccounts([]);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [token, nonce]);

  const { byId, byCode } = useMemo(() => {
    const ids = new Map<number, CoreChartAccount>();
    const codes = new Map<string, CoreChartAccount>();
    for (const a of accounts) {
      ids.set(a.id, a);
      codes.set(a.accountCode.trim().toUpperCase(), a);
    }
    return { byId: ids, byCode: codes };
  }, [accounts]);

  return { accounts, byId, byCode, isLoading, error, reload };
}

/**
 * Rank accounts for the picker.
 *
 * An exact code match wins, then a code prefix, then a name prefix, then any
 * substring across name, category and subcategory. Typing "50" must surface
 * 5000 / 5010 / 5020 before something that merely contains "50" in its name.
 */
export function rankChartAccounts(
  accounts: CoreChartAccount[],
  query: string,
  limit = 50,
): { matches: CoreChartAccount[]; more: number } {
  const q = query.trim().toLowerCase();
  if (!q) {
    const sorted = [...accounts].sort((a, b) =>
      a.accountCode.localeCompare(b.accountCode),
    );
    return {
      matches: sorted.slice(0, limit),
      more: Math.max(0, sorted.length - limit),
    };
  }

  const scored: { account: CoreChartAccount; score: number }[] = [];
  for (const a of accounts) {
    const code = a.accountCode.toLowerCase();
    const name = a.accountName.toLowerCase();
    const cat = `${a.category} ${a.subcategory}`.toLowerCase();

    let score = -1;
    if (code === q) score = 0;
    else if (code.startsWith(q)) score = 1;
    else if (name.startsWith(q)) score = 2;
    else if (name.includes(q)) score = 3;
    else if (code.includes(q)) score = 4;
    else if (cat.includes(q)) score = 5;

    if (score >= 0) scored.push({ account: a, score });
  }

  scored.sort(
    (a, b) =>
      a.score - b.score ||
      a.account.accountCode.localeCompare(b.account.accountCode),
  );

  return {
    matches: scored.slice(0, limit).map((s) => s.account),
    more: Math.max(0, scored.length - limit),
  };
}
