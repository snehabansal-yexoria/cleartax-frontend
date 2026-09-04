"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CoreDepreciationScopeLevel } from "@/src/lib/coreApi";
import { assetClassLabel, methodLabel } from "@/app/components/AssetBuilder";
import {
  downloadDepreciationDocument,
  fyLabel,
  useDepreciation,
} from "@/app/components/useDepreciation";
import { formatClientCurrency } from "@/app/components/clients/CurrencyFormatter";

/**
 * Depreciation, on the client's side of the product.
 *
 * The accountant's DepreciationReport is a working table — every column, every
 * asset, in the accountant's own layout. A client is answering a different
 * question: "how much is this claiming for me this year, and can I have the
 * document". So this shows the year's deduction first, the Division 43 / 40
 * split second, and the per-asset detail last, in the client dashboard's own
 * Tailwind idiom rather than the accountant's inline styles.
 *
 * Nothing here is editable. A client cannot change a method or an effective
 * life — those are the accountant's judgement and the backend refuses them from
 * a client role — so this is a read-and-download surface only.
 */

export type ClientDepreciationCardProps = {
  level: CoreDepreciationScopeLevel;
  id: string;
  /** Asset rows link to `${assetHrefBase}/${transactionId}` when provided. */
  assetHrefBase?: string;
  /** Compact drops the per-asset list, for a summary-only placement. */
  compact?: boolean;
  title?: string;
  /**
   * Replaces the card's own chrome. Insights supplies its own `.insights-card`
   * shell, and nesting one card inside another reads as a mistake.
   */
  className?: string;
};

const DEFAULT_CHROME =
  "bg-[var(--surface-1)] rounded-2xl border border-[var(--border)] p-5 shadow-sm";

function money(value: number) {
  return formatClientCurrency(value, { decimals: 0 });
}

export default function ClientDepreciationCard({
  level,
  id,
  assetHrefBase,
  compact = false,
  title = "Depreciation",
  className = DEFAULT_CHROME,
}: ClientDepreciationCardProps) {
  const [fy, setFy] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const { data, isLoading, error } = useDepreciation(level, id, { fy });
  const items = useMemo(() => data?.items ?? [], [data]);
  const totals = data?.totals;

  // The financial years these assets span. Derived from the response rather
  // than a fixed range so the picker never offers an empty year. `fy` narrows
  // the claim figures only, never the item list, so this cannot collapse to the
  // year already chosen.
  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    for (const item of items) {
      const year = Number.parseInt(item.startDate.slice(0, 4), 10);
      const month = Number.parseInt(item.startDate.slice(5, 7), 10);
      if (!Number.isFinite(year) || !Number.isFinite(month)) continue;
      const first = month >= 7 ? year : year - 1;
      const span = Math.ceil(item.effectiveLifeYears) + 1;
      for (let i = 0; i < span; i += 1) years.add(first + i);
    }
    return [...years].sort((a, b) => b - a);
  }, [items]);

  const handleDownload = async (
    scheduleId: string,
    fileName: string,
  ): Promise<void> => {
    setBusyId(scheduleId);
    setDownloadError(null);
    try {
      await downloadDepreciationDocument(scheduleId, fileName);
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : "Could not download the schedule.",
      );
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
    return (
      <div className={className}>
        <h2 className="text-base font-bold text-[var(--text-primary)] mb-3">{title}</h2>
        <div className="h-16 rounded-xl bg-[var(--surface-2)] animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <h2 className="text-base font-bold text-[var(--text-primary)] mb-2">{title}</h2>
        <p className="text-xs text-[var(--danger)] font-semibold">{error}</p>
      </div>
    );
  }

  // An empty state that explains rather than just says "none". A client cannot
  // create a depreciating asset themselves — their accountant categorises one —
  // so "add one" would be the wrong call to action.
  if (!totals || totals.assetCount === 0) {
    return (
      <div className={className}>
        <h2 className="text-base font-bold text-[var(--text-primary)] mb-2">{title}</h2>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          No depreciating assets yet. When your accountant records a capital works or
          plant &amp; equipment purchase, its schedule appears here automatically.
        </p>
      </div>
    );
  }

  const claimLabel = fy == null ? "Total over effective life" : `${fyLabel(fy)} deduction`;

  return (
    <div className={`${className} flex flex-col`}>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-base font-bold text-[var(--text-primary)]">{title}</h2>
        {yearOptions.length > 0 && (
          <select
            aria-label="Financial year"
            value={fy == null ? "" : String(fy)}
            onChange={(e) => setFy(e.target.value ? Number(e.target.value) : null)}
            className="text-[11px] font-semibold text-[var(--text-primary)] bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-2 py-1 cursor-pointer"
          >
            <option value="">All years</option>
            {yearOptions.map((y) => (
              <option key={y} value={String(y)}>
                {fyLabel(y)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ---- Headline claim ------------------------------------------------ */}
      <div className="rounded-xl bg-[var(--brand)] text-white p-4 mb-4">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
          {claimLabel}
        </span>
        <div className="text-2xl font-bold mt-1 tabular-nums">
          {money(totals.depreciation)}
        </div>
        <div className="text-[11px] font-semibold text-white/70 mt-1">
          across {totals.assetCount} asset{totals.assetCount === 1 ? "" : "s"}
        </div>
      </div>

      {/* ---- Division split ------------------------------------------------ */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl border border-[var(--border)] p-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Capital works
          </span>
          <div className="text-sm font-bold text-[var(--text-primary)] mt-1 tabular-nums">
            {money(totals.capitalWorks)}
          </div>
          <span className="text-[10px] text-[var(--text-muted)] font-semibold">Division 43</span>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Plant &amp; equipment
          </span>
          <div className="text-sm font-bold text-[var(--text-primary)] mt-1 tabular-nums">
            {money(totals.capitalAllowances)}
          </div>
          <span className="text-[10px] text-[var(--text-muted)] font-semibold">Division 40</span>
        </div>
      </div>

      {downloadError && (
        <p className="text-[11px] text-[var(--danger)] font-semibold mb-3">{downloadError}</p>
      )}

      {/* ---- Per-asset list ------------------------------------------------ */}
      {!compact && (
        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const claim = fy == null ? item.totalDepreciation : item.fyDepreciation ?? 0;
            const href = assetHrefBase
              ? `${assetHrefBase}/${encodeURIComponent(item.transactionId)}`
              : null;

            const body = (
              <>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[var(--surface-2)] text-[var(--brand)] flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                      <polyline points="17 18 23 18 23 12" />
                    </svg>
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                      {item.assetName}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)] font-semibold truncate">
                      {assetClassLabel(item.assetClass)} · {methodLabel(item.depreciationMethod)} ·{" "}
                      {item.effectiveLifeYears} yrs
                      {item.personalPercentage > 0
                        ? ` · ${item.businessPercentage}% business use`
                        : ""}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-[var(--text-primary)] tabular-nums">
                    {money(claim)}
                  </span>
                </div>
              </>
            );

            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors"
              >
                {href ? (
                  <Link href={href} className="flex items-center justify-between gap-2 flex-1 min-w-0 group">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-center justify-between gap-2 flex-1 min-w-0">{body}</div>
                )}

                <button
                  type="button"
                  onClick={() => handleDownload(item.id, item.documentName)}
                  disabled={busyId === item.id}
                  aria-label={`Download ${item.assetName} depreciation schedule`}
                  title="Download schedule (PDF)"
                  className="w-7 h-7 rounded-lg text-[var(--text-muted)] hover:text-[var(--brand)] hover:bg-[var(--surface-2)] flex items-center justify-center shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-3.5 h-3.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-[var(--text-muted)] leading-relaxed mt-3">
        Financial years run 1 July to 30 June. Your accountant sets each asset&apos;s
        category, effective life and method.
      </p>
    </div>
  );
}
