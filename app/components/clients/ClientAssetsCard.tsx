"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CoreGstScopeLevel } from "@/src/lib/coreApi";
import RegionError from "@/app/components/ui/RegionError";
import {
  assetItemName,
  useAssetTransactions,
} from "@/app/components/usePersonalAndAssetTransactions";
import { formatClientCurrency } from "@/app/components/clients/CurrencyFormatter";
import { formatDateAU } from "@/src/lib/dates";

/**
 * Assets on the client's side: the accountant entity page's Asset Transactions
 * panel (AssetPanel) in the client dashboard's idiom.
 *
 * Same request, same rows — expenses flagged as asset purchases, newest first,
 * read at display grain so a part-private asset appears once as its bill — and
 * each row opens the asset page the accountant's does, keyed by transaction id.
 * `total` is the server's count for the whole filter, so the footer can say
 * how many were not shown rather than imply the first ten are all of them.
 */

export type ClientAssetsCardProps = {
  level: CoreGstScopeLevel;
  id: string;
  /** `${assetHrefBase}/${transactionId}` opens the asset. */
  assetHrefBase: string;
  /** "table" on desktop; "list" stacks each asset for a phone. */
  layout?: "table" | "list";
  title?: string;
  /** Replaces the card chrome, as ClientGstSummaryCard's does. */
  className?: string;
};

const DEFAULT_CHROME =
  "bg-[var(--surface-1)] rounded-2xl border border-[var(--border)] p-5 shadow-sm";

// The purchase price, signed as money out, as the accountant panel shows it.
function purchasePrice(gross: number | null | undefined) {
  return formatClientCurrency(-(gross ?? 0), { decimals: 2 });
}

const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className="w-4 h-4">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export default function ClientAssetsCard({
  level,
  id,
  assetHrefBase,
  layout = "table",
  title = "Assets",
  className = DEFAULT_CHROME,
}: ClientAssetsCardProps) {
  const router = useRouter();
  const assets = useAssetTransactions(level, id, { enabled: !!id });
  const rows = assets.rows;
  const titleId = `assets-${level}-title`;
  // On a property's own page every row is that property, so the column (and
  // the list's property line) would only repeat the page title — the
  // accountant's property asset panel leaves it out too.
  const showProperty = level !== "property";
  const href = (transactionId: string) => `${assetHrefBase}/${encodeURIComponent(transactionId)}`;

  let body: React.ReactNode;
  if (assets.error) {
    body = <RegionError message={assets.error} onRetry={assets.reload} compact />;
  } else if (assets.isLoading && rows.length === 0) {
    body = (
      <div className="flex flex-col gap-2" aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-11 rounded-lg bg-[var(--surface-2)] animate-pulse" />
        ))}
      </div>
    );
  } else if (rows.length === 0) {
    body = (
      <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
        No asset purchases recorded for this {level}.
      </div>
    );
  } else if (layout === "list") {
    body = (
      <ul className="flex flex-col gap-2">
        {rows.map((t) => {
          const name = assetItemName(t);
          return (
            <li key={t.id}>
              <Link
                href={href(t.id)}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--brand)] transition-colors"
                style={{ textDecoration: "none" }}
              >
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-bold text-[var(--text-primary)] truncate">{name}</span>
                  <span className="text-[11px] font-semibold text-[var(--text-muted)] truncate">
                    {showProperty
                      ? `${t.propertyNames?.[0] || "No property"} · ${formatDateAU(t.invoiceDate)}`
                      : formatDateAU(t.invoiceDate)}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0 text-[var(--text-muted)]">
                  <span className="text-sm font-bold text-[var(--text-primary)] tabular-nums">
                    {purchasePrice(t.grossAmount)}
                  </span>
                  <ChevronIcon />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  } else {
    const th = "text-left text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] py-2 px-3";
    const td = "py-3 px-3 text-sm text-[var(--text-primary)] border-t border-[var(--border)]";
    body = (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {showProperty && <th scope="col" className={th}>Property</th>}
              <th scope="col" className={th}>Asset name</th>
              <th scope="col" className={th}>Date</th>
              <th scope="col" className={`${th} text-right`}>Amount</th>
              <th scope="col" className="w-8">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const name = assetItemName(t);
              const to = href(t.id);
              return (
                <tr
                  key={t.id}
                  className="cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
                  // The whole row is a target for the mouse; the name link is
                  // the keyboard and screen-reader path to the same page.
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("a")) return;
                    router.push(to);
                  }}
                >
                  {showProperty && (
                    <td className={`${td} text-[var(--text-secondary)] font-semibold`}>
                      {t.propertyNames?.[0] || "—"}
                    </td>
                  )}
                  <td className={`${td} font-bold`}>
                    <Link href={to} className="hover:underline" style={{ textDecoration: "none" }}>
                      {name}
                    </Link>
                  </td>
                  <td className={`${td} whitespace-nowrap text-[var(--text-secondary)] font-semibold`}>
                    {formatDateAU(t.invoiceDate)}
                  </td>
                  <td className={`${td} text-right font-bold tabular-nums whitespace-nowrap`}>
                    {purchasePrice(t.grossAmount)}
                  </td>
                  <td className={`${td} text-[var(--text-muted)]`}>
                    <Link href={to} aria-label={`Open ${name}`} className="flex justify-end">
                      <ChevronIcon />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <section
      className={`${className} flex flex-col gap-4`}
      aria-labelledby={titleId}
      aria-busy={assets.isLoading || undefined}
    >
      <div className="flex flex-col">
        <h2 id={titleId} className="text-base font-bold text-[var(--text-primary)]">
          {title}
        </h2>
        <span className="text-[11px] text-[var(--text-muted)]">
          Expenses marked as asset purchases
        </span>
      </div>
      {body}
      {!assets.error && !assets.isLoading && assets.total > rows.length && (
        <div className="text-[11px] font-semibold text-[var(--text-muted)]">
          Showing the {rows.length} most recent of {assets.total}.
        </div>
      )}
    </section>
  );
}
