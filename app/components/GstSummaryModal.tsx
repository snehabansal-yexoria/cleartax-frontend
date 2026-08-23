"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSession } from "@/src/lib/session";
import { formatCurrency } from "@/src/lib/currency";
import type { CoreGstScopeLevel, CoreGstSummary } from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): { getJwtToken(): string };
}

export type GstSummaryScope = {
  level: CoreGstScopeLevel;
  id: string;
  /** Shown in the modal subtitle; the API also returns a name, this is the
   *  optimistic one so the header isn't blank while the first fetch runs. */
  name: string;
};

export type GstSummaryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  scope: GstSummaryScope;
};

/** Whole-year option in the quarter selector. */
const FULL_YEAR = 0;

const QUARTER_LABELS: Record<number, string> = {
  1: "Q1 · Jul–Sep",
  2: "Q2 · Oct–Dec",
  3: "Q3 · Jan–Mar",
  4: "Q4 · Apr–Jun",
};

/**
 * Australian financial year a date falls in: FY2026 = 1 Jul 2025 – 30 Jun 2026.
 * July onwards belongs to the next FY.
 */
function financialYearOf(date: Date): number {
  return date.getMonth() >= 6 ? date.getFullYear() + 1 : date.getFullYear();
}

/** BAS quarter (1-4) a date falls in. */
function quarterOf(date: Date): number {
  const m = date.getMonth();
  if (m >= 6 && m <= 8) return 1; // Jul–Sep
  if (m >= 9) return 2; // Oct–Dec
  if (m <= 2) return 3; // Jan–Mar
  return 4; // Apr–Jun
}

function endpointFor(scope: GstSummaryScope): string {
  switch (scope.level) {
    case "entity":
      return `/api/entities/${encodeURIComponent(scope.id)}/gst-summary`;
    case "client":
      return `/api/clients/${encodeURIComponent(scope.id)}/gst-summary`;
    default:
      return `/api/properties/${encodeURIComponent(scope.id)}/gst-summary`;
  }
}

const SCOPE_NOUN: Record<CoreGstScopeLevel, string> = {
  property: "property",
  entity: "entity",
  client: "client",
};

export default function GstSummaryModal({
  isOpen,
  onClose,
  scope,
}: GstSummaryModalProps) {
  const now = useMemo(() => new Date(), []);
  const currentFy = financialYearOf(now);

  const [financialYear, setFinancialYear] = useState(currentFy);
  const [quarter, setQuarter] = useState(quarterOf(now));
  const [summary, setSummary] = useState<CoreGstSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Six years back is enough to cover any period still amendable with the ATO.
  const availableYears = useMemo(
    () => Array.from({ length: 6 }, (_, i) => currentFy - i),
    [currentFy],
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const session = (await getSession()) as SessionWithIdToken | null;
      const token = session?.getIdToken().getJwtToken();
      if (!token) throw new Error("Your session has expired. Please sign in again.");

      const params = new URLSearchParams({
        financial_year: String(financialYear),
      });
      if (quarter !== FULL_YEAR) params.set("quarter", String(quarter));

      const res = await fetch(`${endpointFor(scope)}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message || `Could not load the GST summary (${res.status}).`,
        );
      }
      setSummary((await res.json()) as CoreGstSummary);
    } catch (err) {
      setSummary(null);
      setError(err instanceof Error ? err.message : "Could not load the GST summary.");
    } finally {
      setIsLoading(false);
    }
  }, [financialYear, quarter, scope]);

  useEffect(() => {
    if (!isOpen) return;
    void load();
  }, [isOpen, load]);

  // Reset the transient copy confirmation whenever the figures change.
  useEffect(() => setCopied(false), [summary]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const rows = summary
    ? [
        {
          code: "G1",
          label: "Total sales",
          hint: "Income including GST",
          value: summary.g1TotalSales,
        },
        {
          code: "1A",
          label: "GST on sales",
          hint: "GST you collected",
          value: summary.gstOnSales,
        },
        {
          code: "1B",
          label: "GST on purchases",
          hint: "GST you paid",
          value: summary.gstOnPurchases,
        },
      ]
    : [];

  const isRefund = summary?.outcome === "refund_due";
  const isNil = summary?.outcome === "nil";

  async function handleCopy() {
    if (!summary) return;
    const text = [
      `GST Summary — ${summary.scope.name} (${summary.period.label})`,
      `G1 Total sales:       ${formatCurrency(summary.g1TotalSales)}`,
      `1A GST on sales:      ${formatCurrency(summary.gstOnSales)}`,
      `1B GST on purchases:  ${formatCurrency(summary.gstOnPurchases)}`,
      `9  Net GST:           ${formatCurrency(summary.netGst)}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="portal-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gst-summary-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="portal-modal">
        <div className="portal-modal-header">
          <div>
            <h2 id="gst-summary-title">GST Summary</h2>
            <p>
              {summary?.scope.name || scope.name} ·{" "}
              {SCOPE_NOUN[scope.level]}
            </p>
          </div>
          <button
            type="button"
            className="portal-modal-close"
            onClick={onClose}
            aria-label="Close GST summary"
          >
            ×
          </button>
        </div>

        <div className="portal-modal-section">
          <div className="gst-period-controls">
            <label className="gst-period-field">
              <span>Financial year</span>
              <select
                value={financialYear}
                onChange={(e) => setFinancialYear(Number(e.target.value))}
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    FY{year} (Jul {year - 1} – Jun {year})
                  </option>
                ))}
              </select>
            </label>
            <label className="gst-period-field">
              <span>Period</span>
              <select
                value={quarter}
                onChange={(e) => setQuarter(Number(e.target.value))}
              >
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>
                    {QUARTER_LABELS[q]}
                  </option>
                ))}
                <option value={FULL_YEAR}>Full financial year</option>
              </select>
            </label>
          </div>
        </div>

        {error && (
          <p className="portal-modal-error" role="alert">
            {error}
          </p>
        )}

        <div className="portal-modal-section">
          {isLoading && <p className="portal-modal-help">Loading…</p>}

          {!isLoading && summary && (
            <>
              <div className="gst-rows">
                {rows.map((row) => (
                  <div key={row.code} className="gst-row">
                    <span className="gst-row-code">{row.code}</span>
                    <span className="gst-row-label">
                      {row.label}
                      <small>{row.hint}</small>
                    </span>
                    <span className="gst-row-value">
                      {formatCurrency(row.value)}
                    </span>
                  </div>
                ))}

                <div
                  className={`gst-row gst-row-net${
                    isRefund ? " is-refund" : isNil ? " is-nil" : " is-payable"
                  }`}
                >
                  <span className="gst-row-code">9</span>
                  <span className="gst-row-label">
                    {isNil
                      ? "Nothing to pay or refund"
                      : isRefund
                        ? "Refund from the ATO"
                        : "Payment due to the ATO"}
                    <small>GST on sales − GST on purchases</small>
                  </span>
                  <span className="gst-row-value">
                    {formatCurrency(summary.amountDue)}
                  </span>
                </div>
              </div>

              <dl className="gst-supporting">
                <div>
                  <dt>Income excluding GST</dt>
                  <dd>{formatCurrency(summary.salesNet)}</dd>
                </div>
                <div>
                  <dt>Income transactions</dt>
                  <dd>{summary.salesCount}</dd>
                </div>
                <div>
                  <dt>Expense transactions</dt>
                  <dd>{summary.purchasesCount}</dd>
                </div>
              </dl>

              <p className="gst-basis-note">
                {summary.period.label} · {summary.period.from} to{" "}
                {summary.period.to}. Figures are on an{" "}
                <strong>accruals basis</strong>, dated by invoice date — if you
                report GST on a cash basis these totals will differ. Personal
                transactions and rejected transactions are excluded.
              </p>
            </>
          )}

          {!isLoading && summary && summary.salesCount === 0 && summary.purchasesCount === 0 && (
            <p className="portal-modal-help">
              No transactions fall in this period. If this is a residential
              rental, that is expected — residential rent is input-taxed, so no
              GST applies.
            </p>
          )}
        </div>

        <div className="portal-modal-actions">
          {summary && (
            <button
              type="button"
              className="property-outline-button"
              onClick={handleCopy}
            >
              {copied ? "Copied" : "Copy values"}
            </button>
          )}
          <button
            type="button"
            className="property-review-button"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
