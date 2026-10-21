"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type DropdownOption<T extends number | string> = {
  value: T;
  label: string;
};

type GstDropdownProps<T extends number | string> = {
  id: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (val: T) => void;
  align?: "left" | "right";
  "aria-label": string;
};

function GstDropdown<T extends number | string>({
  id,
  value,
  options,
  onChange,
  align = "left",
  "aria-label": ariaLabel,
}: GstDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const currentLabel = selected ? selected.label : String(value);

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) {
          setOpen(false);
        }
      }}
    >
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all cursor-pointer select-none shadow-sm ${
          open
            ? "bg-[var(--surface-1)] text-[var(--text-primary)] border-[var(--brand)] ring-2 ring-[var(--brand)]/15"
            : "bg-[var(--surface-2)] text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--surface-1)] hover:border-[var(--text-muted)]/40"
        }`}
      >
        <span>{currentLabel}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`w-3.5 h-3.5 text-[var(--text-secondary)] transition-transform duration-200 shrink-0 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute top-[calc(100%+4px)] ${
            align === "right" ? "right-0" : "left-0"
          } z-50 min-w-full w-max max-h-60 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-1 shadow-lg shadow-black/10 dark:shadow-black/50 backdrop-blur-sm`}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={String(option.value)}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-xs rounded-lg transition-colors cursor-pointer text-left whitespace-nowrap ${
                  isSelected
                    ? "bg-[var(--surface-2)] font-semibold text-[var(--text-primary)]"
                    : "font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span>{option.label}</span>
                {isSelected && (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-3.5 h-3.5 text-[var(--brand)] dark:text-[var(--accent)] shrink-0"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  tone = "neutral",
  loading,
  layout = "box",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "good" | "bad";
  loading: boolean;
  layout?: "box" | "row";
}) {
  const color =
    tone === "good" ? "text-[var(--success)]" : tone === "bad" ? "text-[var(--danger)]" : "text-[var(--text-primary)]";

  if (layout === "row") {
    const subColor =
      tone === "good"
        ? "text-[var(--success)] font-medium"
        : tone === "bad"
          ? "text-[var(--danger)] font-medium"
          : "text-[var(--text-muted)]";

    return (
      <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border)] px-4 py-3.5 flex items-center justify-between gap-4 min-w-0 transition-all hover:bg-[var(--surface-1)] hover:border-[var(--text-muted)]/30 hover:shadow-xs">
        <div className="flex flex-col min-w-0">
          <dt className="text-xs font-bold text-[var(--text-secondary)] leading-snug">
            {label}
          </dt>
          {sub && !loading && (
            <div className={`mt-0.5 text-[11px] leading-snug ${subColor}`}>
              {sub}
            </div>
          )}
        </div>
        <dd className="shrink-0 text-right">
          {loading ? (
            <div className="h-6 w-24 max-w-full rounded-md bg-[var(--surface-1)] animate-pulse ml-auto" />
          ) : (
            <div className={`text-base sm:text-lg font-bold tabular-nums ${color}`}>
              {value}
            </div>
          )}
        </dd>
      </div>
    );
  }

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
  const isProperty = level === "property";

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
  // Zero tiles for a period with no bills at all, said in words — otherwise
  // an empty quarter is indistinguishable from figures that failed to bind.
  const periodEmpty =
    !loading && !!summary && summary.salesCount === 0 && summary.purchasesCount === 0;
  // The bills behind each GST figure, with their total. Bills can carry no
  // GST at all — residential rent is input-taxed, and a GST-free purchase
  // records 0 — so 1A/1B alone read A$ 0.00 while the response holds real
  // sales and purchases; the totals say what the zero was computed over.
  const billsLine = (count: number, total: number, noun: string) =>
    `${count} ${noun}${count === 1 ? "" : "s"}${count > 0 ? ` totalling ${gstMoney(total)}` : ""}`;
  const idBase = `gst-${level}`;

  const yearOptions = useMemo(
    () =>
      gstAvailableYears().map((y) => ({
        value: y,
        label: `FY${y}`,
      })),
    []
  );

  const quarterOptions = useMemo(
    () => [
      ...([1, 2, 3, 4] as const).map((q) => ({
        value: q,
        label: GST_QUARTER_LABELS[q],
      })),
      { value: GST_FULL_YEAR, label: "Full year" },
    ],
    []
  );

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
        <div className="flex items-center gap-2 flex-wrap">
          <GstDropdown
            id={`${idBase}-fy`}
            aria-label="Financial year"
            value={gst.financialYear}
            options={yearOptions}
            onChange={gst.setFinancialYear}
          />
          <GstDropdown
            id={`${idBase}-quarter`}
            aria-label="Quarter"
            value={gst.quarter}
            options={quarterOptions}
            onChange={gst.setQuarter}
          />
          <button
            ref={triggerRef}
            type="button"
            disabled={!summary}
            onClick={() => setOpen(true)}
            className="text-xs font-semibold text-white bg-[var(--brand)] hover:brightness-110 active:brightness-95 px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            View details
          </button>
        </div>
      </div>

      {gst.error ? (
        <RegionError message={gst.error} onRetry={gst.reload} />
      ) : (
        <>
          {isProperty ? (
            <dl className="flex flex-col gap-2.5" aria-busy={loading}>
              <Tile
                layout="row"
                label="GST on sales (1A)"
                value={gstMoney(summary?.gstOnSales ?? 0)}
                sub={summary ? billsLine(summary.salesCount, summary.g1TotalSales, "sale") : undefined}
                loading={loading}
              />
              <Tile
                layout="row"
                label="GST on purchases (1B)"
                value={gstMoney(summary?.gstOnPurchases ?? 0)}
                sub={summary ? billsLine(summary.purchasesCount, summary.purchasesTotal, "purchase") : undefined}
                loading={loading}
              />
              <Tile
                layout="row"
                label="Net GST (9)"
                value={gstMoney(summary?.amountDue ?? 0)}
                sub={summary ? gstOutcomeLabel(summary.outcome) : undefined}
                tone={summary?.outcome === "payment_due" ? "bad" : summary?.outcome === "refund_due" ? "good" : "neutral"}
                loading={loading}
              />
            </dl>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3" aria-busy={loading}>
              <Tile
                layout="box"
                label="GST on sales (1A)"
                value={gstMoney(summary?.gstOnSales ?? 0)}
                sub={summary ? billsLine(summary.salesCount, summary.g1TotalSales, "sale") : undefined}
                loading={loading}
              />
              <Tile
                layout="box"
                label="GST on purchases (1B)"
                value={gstMoney(summary?.gstOnPurchases ?? 0)}
                sub={summary ? billsLine(summary.purchasesCount, summary.purchasesTotal, "purchase") : undefined}
                loading={loading}
              />
              <Tile
                layout="box"
                label="Net GST (9)"
                value={gstMoney(summary?.amountDue ?? 0)}
                sub={summary ? gstOutcomeLabel(summary.outcome) : undefined}
                tone={summary?.outcome === "payment_due" ? "bad" : summary?.outcome === "refund_due" ? "good" : "neutral"}
                loading={loading}
              />
            </dl>
          )}

          {/* A div, not a <p>: globals.css styles bare p unlayered, which
              beats these utilities. */}
          {periodEmpty && (
            <div className="mt-3 text-[11px] font-semibold text-[var(--text-secondary)]" role="status">
              No sales or purchases dated in {summary?.period.label || "this period"}. Choose
              another year or quarter above.
            </div>
          )}
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
