"use client";

import { useRef, useState } from "react";
import type { CoreGstScopeLevel } from "@/src/lib/coreApi";
import RegionError from "@/app/components/ui/RegionError";
import {
  GST_FULL_YEAR,
  GST_QUARTER_LABELS,
  gstAvailableYears,
  gstOutcomeLabel,
  useGstSummary,
} from "@/app/components/useGstSummary";
import { usePersonalSummary } from "@/app/components/usePersonalAndAssetTransactions";
import ClientGstSummaryModal, { gstMoney } from "./ClientGstSummaryModal";

/**
 * GST Summary on the client's property, entity and home pages: GST on sales
 * (1A), GST on purchases (1B), the net position, and the period's private
 * spending — with the full BAS breakdown and the personal categories one click
 * away.
 *
 * The same server aggregate and rules as the accountant's GST Summary
 * (useGstSummary): accruals basis, rejected excluded, bills awaiting review
 * INCLUDED — unlike the rest of the client portal, so the card says how many.
 * Property scope sums each property's share of a split bill; entity and client
 * scope sum whole bills, so an entity is its properties plus anything not
 * allocated to one, and a client is the sum of their entities.
 */

export type ClientGstSummaryCardProps = {
  level: CoreGstScopeLevel;
  /** null while the id is still being resolved (the client's own id). */
  id: string | null;
  /** Names the scope in the details dialog, e.g. the property's name. */
  scopeName?: string;
  title?: string;
  /** Replaces the card chrome, as ClientDepreciationCard's does. */
  className?: string;
};

const DEFAULT_CHROME =
  "bg-[var(--surface-1)] rounded-2xl border border-[var(--border)] p-5 shadow-sm";

const selectClass =
  "text-[11px] font-semibold text-[var(--text-primary)] bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-2 py-1 cursor-pointer";

function Tile({
  label,
  value,
  sub,
  tone = "neutral",
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "good" | "bad";
  loading: boolean;
}) {
  const color =
    tone === "good" ? "text-[var(--success)]" : tone === "bad" ? "text-[var(--danger)]" : "text-[var(--text-primary)]";
  return (
    <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border)] p-3 min-w-0">
      <dt className="text-[11px] font-semibold text-[var(--text-secondary)] leading-snug">{label}</dt>
      <dd className="mt-1">
        {loading ? (
          <div className="h-6 w-24 max-w-full rounded-md bg-[var(--surface-1)] animate-pulse" />
        ) : (
          <div className={`text-lg font-bold tabular-nums break-words ${color}`}>{value}</div>
        )}
        {sub && !loading && <div className="mt-0.5 text-[11px] text-[var(--text-muted)] leading-snug">{sub}</div>}
      </dd>
    </div>
  );
}

export default function ClientGstSummaryCard({
  level,
  id,
  scopeName = "",
  title = "GST Summary",
  className = DEFAULT_CHROME,
}: ClientGstSummaryCardProps) {
  const enabled = !!id;
  // Opens on the whole financial year, not the current BAS quarter: early in a
  // quarter that is a near-empty window, and a card of A$ 0 tiles read as
  // "the GST figures are broken" rather than "nothing dated in these weeks".
  const gst = useGstSummary(level, id ?? "", { enabled, initialQuarter: GST_FULL_YEAR });
  const personal = usePersonalSummary(level, id ?? "", {
    enabled,
    period: { financialYear: gst.financialYear, quarter: gst.quarter },
  });
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const summary = gst.summary;
  const loading = !enabled || gst.isLoading;
  const unreviewed = summary?.unreviewedCount ?? null;
  // An older backend ignores the period and answers for all time; say so
  // rather than print an all-time total under a quarter's heading.
  const personalAllTime = !!personal.summary && personal.summary.period == null;
  // Zero tiles for a period with no bills at all, said in words — otherwise
  // an empty quarter is indistinguishable from figures that failed to bind.
  const periodEmpty =
    !loading && !!summary && summary.salesCount === 0 && summary.purchasesCount === 0;
  const idBase = `gst-${level}`;

  return (
    <section className={`${className} flex flex-col`} aria-labelledby={`${idBase}-title`}>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex flex-col min-w-0">
          <h2 id={`${idBase}-title`} className="text-base font-bold text-[var(--text-primary)]">
            {title}
          </h2>
          <span className="text-[11px] text-[var(--text-muted)]">
            {gst.periodLabel || " "}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor={`${idBase}-fy`}>
            Financial year
          </label>
          <select
            id={`${idBase}-fy`}
            className={selectClass}
            value={gst.financialYear}
            onChange={(e) => gst.setFinancialYear(Number(e.target.value))}
          >
            {gstAvailableYears().map((y) => (
              <option key={y} value={y}>
                FY{y}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor={`${idBase}-quarter`}>
            Quarter
          </label>
          <select
            id={`${idBase}-quarter`}
            className={selectClass}
            value={gst.quarter}
            onChange={(e) => gst.setQuarter(Number(e.target.value))}
          >
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>
                {GST_QUARTER_LABELS[q]}
              </option>
            ))}
            <option value={GST_FULL_YEAR}>Full year</option>
          </select>
        </div>
      </div>

      {gst.error ? (
        <RegionError message={gst.error} onRetry={gst.reload} />
      ) : (
        <>
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-busy={loading}>
            <Tile
              label="GST on sales (1A)"
              value={gstMoney(summary?.gstOnSales ?? 0)}
              sub={summary ? `${summary.salesCount} sale${summary.salesCount === 1 ? "" : "s"}` : undefined}
              loading={loading}
            />
            <Tile
              label="GST on purchases (1B)"
              value={gstMoney(summary?.gstOnPurchases ?? 0)}
              sub={summary ? `${summary.purchasesCount} purchase${summary.purchasesCount === 1 ? "" : "s"}` : undefined}
              loading={loading}
            />
            <Tile
              label="Net GST (9)"
              value={gstMoney(summary?.amountDue ?? 0)}
              sub={summary ? gstOutcomeLabel(summary.outcome) : undefined}
              tone={summary?.outcome === "payment_due" ? "bad" : summary?.outcome === "refund_due" ? "good" : "neutral"}
              loading={loading}
            />
            <Tile
              label={personalAllTime ? "Personal spending (all time)" : "Personal spending"}
              value={personal.error ? "—" : gstMoney(personal.summary?.totalGross ?? 0)}
              sub={
                personal.error
                  ? "Couldn't load"
                  : personal.summary
                    ? `${personal.summary.count} item${personal.summary.count === 1 ? "" : "s"} · not in 1B`
                    : undefined
              }
              loading={loading || (personal.isLoading && !personal.summary)}
            />
          </dl>

          {/* A div, not a <p>: globals.css styles bare p unlayered, which
              beats these utilities. */}
          {periodEmpty && (
            <div className="mt-3 text-[11px] font-semibold text-[var(--text-secondary)]" role="status">
              No sales or purchases dated in {summary?.period.label || "this period"}. Choose
              another year or quarter above.
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {unreviewed != null && unreviewed > 0 && (
                <span
                  className="portfolio-pill is-warn"
                  title="Bills still waiting for your accountant's review are counted here, as they are on your accountant's GST summary."
                >
                  {unreviewed} awaiting review included
                </span>
              )}
              <span className="text-[11px] text-[var(--text-muted)]">
                Accruals basis · dated by invoice date
              </span>
            </div>
            <button
              ref={triggerRef}
              type="button"
              disabled={!summary}
              onClick={() => setOpen(true)}
              className="text-xs font-bold text-white bg-[var(--brand)] px-3.5 py-2 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              View details
            </button>
          </div>
        </>
      )}

      {open && summary && (
        <ClientGstSummaryModal
          scopeName={summary.scope.name || scopeName}
          gst={gst}
          personal={personal}
          onClose={() => {
            setOpen(false);
            triggerRef.current?.focus();
          }}
        />
      )}
    </section>
  );
}
