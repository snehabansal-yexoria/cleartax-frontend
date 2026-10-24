"use client";

import type { CoreGstScopeLevel } from "@/src/lib/coreApi";
import RegionError from "@/app/components/ui/RegionError";
import {
  personalCategoryLabel,
  usePersonalSummary,
} from "@/app/components/usePersonalAndAssetTransactions";
import { formatClientCurrency } from "@/app/components/clients/CurrencyFormatter";

/**
 * Personal Transactions on the client's side: the accountant entity page's
 * PersonalPanel in the client dashboard's idiom.
 *
 * Same server aggregate, same rules — private spending totalled by category at
 * money grain (so the private slice of a part-private bill is counted), rejected
 * rows excluded, all time. For a client the API also leaves out bills awaiting
 * review, so this can read lower than the accountant's panel until they sign
 * them off. Not the GST card's personal tile, which narrows
 * to the BAS period picked there.
 */

export type ClientPersonalTransactionsCardProps = {
  level: CoreGstScopeLevel;
  id: string;
  title?: string;
  /** Replaces the card chrome, as ClientGstSummaryCard's does. */
  className?: string;
};

const DEFAULT_CHROME =
  "bg-[var(--surface-1)] rounded-2xl border border-[var(--border)] p-5 shadow-sm";

// Private spending is money out by definition; the API returns magnitudes and
// the sign is applied here, as the accountant panel does.
function moneyOut(value: number) {
  return formatClientCurrency(-value, { decimals: 2 });
}

export default function ClientPersonalTransactionsCard({
  level,
  id,
  title = "Personal Transactions",
  className = DEFAULT_CHROME,
}: ClientPersonalTransactionsCardProps) {
  const personal = usePersonalSummary(level, id, { enabled: !!id });
  const categories = personal.summary?.categories ?? [];
  const titleId = `personal-${level}-title`;

  let body: React.ReactNode;
  if (personal.error) {
    body = <RegionError message={personal.error} onRetry={personal.reload} compact />;
  } else if (personal.isLoading && !personal.summary) {
    body = (
      <div className="flex flex-col gap-2" aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-9 rounded-lg bg-[var(--surface-2)] animate-pulse" />
        ))}
      </div>
    );
  } else if (categories.length === 0) {
    body = (
      <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
        No personal transactions recorded for this {level}.
      </div>
    );
  } else {
    const count = personal.summary?.count ?? 0;
    body = (
      <ul className="flex flex-col">
        {categories.map((c) => (
          <li
            key={`${c.categoryId}|${c.subcategoryName}`}
            className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--border)]"
          >
            <span className="text-sm font-semibold text-[var(--text-primary)] min-w-0 truncate">
              {personalCategoryLabel(c)}
            </span>
            <span className="text-sm font-bold text-[var(--text-primary)] tabular-nums shrink-0">
              {moneyOut(c.grossAmount)}
            </span>
          </li>
        ))}
        <li className="flex items-center justify-between gap-3 pt-3">
          <span className="text-sm font-bold text-[var(--text-primary)]">
            Total
            <span className="ml-1.5 text-[11px] font-semibold text-[var(--text-muted)]">
              {count} item{count === 1 ? "" : "s"}
            </span>
          </span>
          <span className="text-sm font-extrabold text-[var(--text-primary)] tabular-nums">
            {moneyOut(personal.summary?.totalGross ?? 0)}
          </span>
        </li>
      </ul>
    );
  }

  return (
    <section
      className={`${className} flex flex-col gap-4`}
      aria-labelledby={titleId}
      aria-busy={personal.isLoading || undefined}
    >
      <div className="flex flex-col">
        <h2 id={titleId} className="text-base font-bold text-[var(--text-primary)]">
          {title}
        </h2>
        <span className="text-[11px] text-[var(--text-muted)]">
          Private spending by category · all time
        </span>
      </div>
      {body}
    </section>
  );
}
