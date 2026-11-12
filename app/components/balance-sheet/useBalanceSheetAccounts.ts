"use client";

import { useEffect, useState } from "react";
import { getSession } from "@/src/lib/session";
import type { CoreChartAccount } from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): { getJwtToken(): string };
}

/**
 * The chart of accounts, loaded once a form needs it. A Balance Sheet transaction
 * picks Category (Assets), Subcategory (Cash and Bank) and then an account from
 * this list.
 */
export function useBalanceSheetAccounts(enabled: boolean): CoreChartAccount[] {
  const [accounts, setAccounts] = useState<CoreChartAccount[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session || cancelled) return;
      const res = await fetch("/api/chart-of-accounts", {
        headers: { Authorization: `Bearer ${session.getIdToken().getJwtToken()}` },
      });
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { items?: CoreChartAccount[] };
      if (!cancelled) setAccounts(data.items ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return accounts;
}

const SECTION_BY_CATEGORY: Record<string, string> = {
  assets: "asset",
  liabilities: "liability",
  equity: "equity",
};

/**
 * The accounts under one Category and Subcategory, as picker options. Empty for an
 * older typed category, which has no accounts to choose from, so no picker shows.
 */
export function balanceSheetAccountOptions(
  accounts: CoreChartAccount[],
  categoryName: string | undefined,
  subcategoryName: string | undefined,
): { label: string; value: string }[] {
  const section = SECTION_BY_CATEGORY[(categoryName ?? "").toLowerCase()];
  if (!section || !subcategoryName) return [];
  return accounts
    .filter((a) => a.category === section && a.subcategory === subcategoryName)
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode))
    .map((a) => ({ label: `${a.accountCode} ${a.accountName}`, value: String(a.id) }));
}
