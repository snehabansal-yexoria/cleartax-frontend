"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { formatCurrency as globalFormatCurrency } from "@/src/lib/currency";
import { affectsPnl } from "@/src/lib/transactionTypes";
import {
  announceDropdownOpen,
  dropdownRegistryEvent,
  isDropdownRegistryEvent,
} from "@/src/lib/dropdownRegistry";
import type { CoreTransactionListItem, CorePropertyTransactionRow } from "@/src/lib/coreApi";
import { TrendSkeleton } from "@/app/components/PortalSkeletons";
import type { AsyncRegion } from "@/app/components/useAsyncRegion";
import {
  currentFinancialYear,
  fyLabel,
  parseFyLabel,
  type PnlTrendData,
} from "@/app/components/usePnlTrend";

// -----------------------------------------------------------------------------
// Shared helpers
// -----------------------------------------------------------------------------

export type TrendRow = { month: string; expenses: number; income: number };

function formatCurrency(value: number) {
  return globalFormatCurrency(value, { decimals: 0 });
}

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });

function monthKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  if (Number.isNaN(date.getTime())) return key;
  return MONTH_LABEL.format(date);
}

/** "2025-2026" for a date in FY2025-26 (July onwards belongs to the next FY). */
function getFinancialYear(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  return date.getMonth() >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function getFinancialYearMonths(fy: string): string[] {
  const parts = fy.split("-");
  if (parts.length !== 2) return [];
  const startYear = parseInt(parts[0], 10);
  const endYear = parseInt(parts[1], 10);
  if (Number.isNaN(startYear) || Number.isNaN(endYear)) return [];
  return [7, 8, 9, 10, 11, 12].map((m) => `${startYear}-${String(m).padStart(2, "0")}`).concat(
    [1, 2, 3, 4, 5, 6].map((m) => `${endYear}-0${m}`),
  );
}

function readUrlTrendYear(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("trendYear") ?? "";
}

function writeUrlTrendYear(year: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (year) url.searchParams.set("trendYear", year);
  else url.searchParams.delete("trendYear");
  window.history.replaceState(null, "", url.toString());
}

// -----------------------------------------------------------------------------
// Presentational view
// -----------------------------------------------------------------------------

export interface ProfitLossTrendViewProps {
  rows: TrendRow[];
  /** True when there is nothing to plot for the selected year. */
  isEmpty: boolean;
  yearOptions: string[];
  selectedYear: string;
  onYearChange: (year: string) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Short status line under the heading (partial data, fallback source…). */
  notice?: ReactNode;
  emptyMessage: string;
}

export function ProfitLossTrendView({
  rows,
  isEmpty,
  yearOptions,
  selectedYear,
  onYearChange,
  isLoading = false,
  error = null,
  onRetry,
  notice,
  emptyMessage,
}: ProfitLossTrendViewProps) {
  const [trendView, setTrendView] = useState<"graph" | "table">("graph");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownId = `trend-year-${useId()}`;

  useEffect(() => {
    function closeIfAnotherOpened(event: Event) {
      if (isDropdownRegistryEvent(event) && event.detail?.id && event.detail.id !== dropdownId) {
        setIsDropdownOpen(false);
      }
    }
    window.addEventListener(dropdownRegistryEvent, closeIfAnotherOpened);
    return () => window.removeEventListener(dropdownRegistryEvent, closeIfAnotherOpened);
  }, [dropdownId]);

  useEffect(() => {
    if (isDropdownOpen) announceDropdownOpen(dropdownId);
  }, [dropdownId, isDropdownOpen]);

  useEffect(() => {
    if (!isDropdownOpen) return;
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isDropdownOpen]);

  const maxTrendAmount = useMemo(
    () => rows.reduce((max, row) => Math.max(max, row.expenses, row.income), 1),
    [rows],
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.income += row.income;
          acc.expenses += row.expenses;
          return acc;
        },
        { income: 0, expenses: 0 },
      ),
    [rows],
  );
  const netTotal = totals.income - totals.expenses;

  if (isLoading) {
    return <TrendSkeleton />;
  }

  return (
    <section className="entity-trend-card" aria-label="Profit and loss trend">
      <div className="entity-trend-head">
        <div>
          <h2>Profit &amp; Loss Trend</h2>
          {selectedYear && (
            <p
              className="trend-period-label"
              style={{ fontSize: 14, color: "#667085", marginTop: 4 }}
              data-testid="trend-period-label"
            >
              Reporting Period: {selectedYear}
            </p>
          )}
          {notice && (
            <p className="trend-period-label" role="status" style={{ fontSize: 13, color: "#b54708", marginTop: 4 }}>
              {notice}
            </p>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            className="property-status-select"
            ref={dropdownRef}
            data-testid="year-select-container"
            style={{ position: "relative" }}
          >
            <button
              type="button"
              className="property-status-trigger"
              aria-haspopup="listbox"
              aria-expanded={isDropdownOpen}
              onClick={() => setIsDropdownOpen((open) => !open)}
              style={{
                minHeight: 40,
                padding: "8px 16px",
                fontSize: 14,
                borderRadius: 8,
                display: "inline-flex",
                alignItems: "center",
                width: "auto",
                gap: 8,
              }}
              data-testid="year-select-trigger"
            >
              <span>{selectedYear || "Select Year"}</span>
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                style={{
                  width: 14,
                  height: 14,
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: 2,
                  transform: isDropdownOpen ? "rotate(180deg)" : "none",
                  transition: "transform var(--t-fast)",
                }}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {isDropdownOpen && (
              <div
                className="property-status-menu"
                style={{ zIndex: 50, position: "absolute", right: 0, left: "auto", minWidth: 120, boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}
                role="listbox"
                data-testid="year-select-menu"
              >
                {yearOptions.map((year) => (
                  <button
                    key={year}
                    type="button"
                    role="option"
                    aria-selected={selectedYear === year}
                    className={selectedYear === year ? "is-selected" : ""}
                    onClick={() => {
                      onYearChange(year);
                      setIsDropdownOpen(false);
                    }}
                    data-testid={`year-option-${year}`}
                  >
                    <span>{year}</span>
                    {selectedYear === year && (
                      <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: 2 }}>
                        <path d="M5 12l4 4 10-10" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="entity-trend-toggle" role="group" aria-label="Trend view">
            <button
              type="button"
              aria-pressed={trendView === "graph"}
              className={trendView === "graph" ? "is-active" : ""}
              onClick={() => setTrendView("graph")}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 19V5" />
                <path d="M4 19h16" />
                <path d="M8 17V9" />
                <path d="M13 17V6" />
                <path d="M18 17v-5" />
              </svg>
              Graph View
            </button>
            <button
              type="button"
              aria-pressed={trendView === "table"}
              className={trendView === "table" ? "is-active" : ""}
              onClick={() => setTrendView("table")}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="4" y="5" width="16" height="14" rx="1" />
                <path d="M4 10h16" />
                <path d="M4 15h16" />
                <path d="M10 5v14" />
              </svg>
              Table View
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="property-trend-empty" role="alert">
          {error}
          {onRetry && (
            <>
              {" "}
              <button type="button" className="entity-link-button" onClick={onRetry}>
                Retry
              </button>
            </>
          )}
        </div>
      ) : isEmpty ? (
        <div className="property-trend-empty" data-testid="trend-empty-state">
          {emptyMessage}
        </div>
      ) : trendView === "graph" ? (
        <>
          <div className="entity-chart">
            <div className="entity-chart-y">
              <span>{formatCurrency(maxTrendAmount)}</span>
              <span>{formatCurrency(maxTrendAmount * 0.75)}</span>
              <span>{formatCurrency(maxTrendAmount * 0.5)}</span>
              <span>{formatCurrency(maxTrendAmount * 0.25)}</span>
              <span>{formatCurrency(0)}</span>
            </div>
            <div
              className="entity-chart-plot"
              style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}
            >
              {rows.map((item) => (
                <div key={item.month} className="entity-chart-month">
                  <div className="entity-chart-bars">
                    <span
                      className="is-expense"
                      style={{ height: `${Math.max(3, (item.expenses / maxTrendAmount) * 100)}%` }}
                    />
                    <span
                      className="is-income"
                      style={{ height: `${Math.max(3, (item.income / maxTrendAmount) * 100)}%` }}
                    />
                  </div>
                  <span>{monthLabel(item.month)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="entity-chart-legend">
            <span>
              <i className="is-expense" />
              Expenses
            </span>
            <span>
              <i className="is-income" />
              Income
            </span>
          </div>
        </>
      ) : (
        <div className="property-trend-table-full">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Income</th>
                <th>Expenses</th>
                <th>Net Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const net = item.income - item.expenses;
                return (
                  <tr key={item.month}>
                    <td>{monthLabel(item.month)}</td>
                    <td className="income-col">
                      <span className="dot">●</span> {formatCurrency(item.income)}
                    </td>
                    <td className="expense-col">
                      <span className="dot">●</span> {formatCurrency(item.expenses)}
                    </td>
                    <td className={net >= 0 ? "income-col" : "expense-col"}>{formatCurrency(net)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td>Total</td>
                <td>{formatCurrency(totals.income)}</td>
                <td>{formatCurrency(totals.expenses)}</td>
                <td className={netTotal >= 0 ? "income-col" : "expense-col"}>{formatCurrency(netTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

// -----------------------------------------------------------------------------
// Transactions-driven card (property page)
// -----------------------------------------------------------------------------

export interface ProfitLossTrendCardProps {
  transactions: (CoreTransactionListItem | CorePropertyTransactionRow)[];
  isLoading?: boolean;
}

function rowDate(row: CoreTransactionListItem | CorePropertyTransactionRow): string {
  return "invoiceDate" in row ? row.invoiceDate : "";
}

/**
 * Buckets one page of transaction rows into a monthly trend in the browser.
 *
 * Kept for the property page. The entity page reads the server-side
 * aggregate through `EntityProfitLossTrendCard` instead, because a capped page
 * of rows is not a financial year.
 */
export default function ProfitLossTrendCard({
  transactions = [],
  isLoading = false,
}: ProfitLossTrendCardProps) {
  const yearsWithData = useMemo(() => {
    const years = new Set<string>();
    for (const row of transactions) {
      const fy = getFinancialYear(rowDate(row));
      if (fy) years.add(fy);
    }
    return years;
  }, [transactions]);

  const availableYears = useMemo(() => {
    const years = new Set(yearsWithData);
    years.add(getFinancialYear(new Date()));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [yearsWithData]);

  const defaultYear = useMemo(() => {
    const currentFY = getFinancialYear(new Date());
    if (yearsWithData.has(currentFY) || yearsWithData.size === 0) return currentFY;
    return Array.from(yearsWithData).sort((a, b) => b.localeCompare(a))[0];
  }, [yearsWithData]);

  // Lazy-initialised from the URL; validated at render time against the
  // years actually present, so no effect has to re-run when the rows arrive.
  const [pickedYear, setPickedYear] = useState<string>(readUrlTrendYear);
  const selectedYear =
    pickedYear && (availableYears.includes(pickedYear) || pickedYear === "all")
      ? pickedYear
      : defaultYear;

  function handleYearChange(year: string) {
    setPickedYear(year);
    writeUrlTrendYear(year);
  }

  const trendRows = useMemo<TrendRow[]>(() => {
    const isFYFormat = selectedYear.includes("-");
    if (selectedYear && !transactions.some((row) => getFinancialYear(rowDate(row)) === selectedYear)) {
      return [];
    }

    const byMonth = new Map<string, TrendRow>();
    if (isFYFormat) {
      for (const m of getFinancialYearMonths(selectedYear)) {
        byMonth.set(m, { month: m, expenses: 0, income: 0 });
      }
    }

    for (const row of transactions) {
      const dateVal = rowDate(row);
      const key = monthKey(dateVal);
      if (!key) continue;
      if (selectedYear && getFinancialYear(dateVal) !== selectedYear) continue;

      const current = byMonth.get(key) || { month: key, expenses: 0, income: 0 };
      const amount = Math.abs(
        "splitGrossAmount" in row
          ? row.splitGrossAmount || row.transactionGrossAmount || 0
          : "grossAmount" in row
            ? row.grossAmount || 0
            : 0,
      );
      const type = "transactionType" in row ? row.transactionType : "type" in row ? row.type : "";

      // Only revenue and expense reach the chart: personal spending,
      // capitalised cost base and contra transfers are not P&L.
      if (!affectsPnl(type)) continue;
      if (type === "revenue") current.income += amount;
      else current.expenses += amount;
      byMonth.set(key, current);
    }

    if (isFYFormat) {
      return getFinancialYearMonths(selectedYear).map(
        (m) => byMonth.get(m) || { month: m, expenses: 0, income: 0 },
      );
    }
    return Array.from(byMonth.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);
  }, [transactions, selectedYear]);

  return (
    <ProfitLossTrendView
      rows={trendRows}
      isEmpty={trendRows.length === 0}
      yearOptions={availableYears}
      selectedYear={selectedYear}
      onYearChange={handleYearChange}
      isLoading={isLoading}
      emptyMessage={
        selectedYear
          ? `No transactions are available for the year ${selectedYear}.`
          : "No transactions are available yet."
      }
    />
  );
}

// -----------------------------------------------------------------------------
// Server-aggregate card (entity page)
// -----------------------------------------------------------------------------

export interface EntityProfitLossTrendCardProps {
  trend: AsyncRegion<PnlTrendData>;
  selectedFy: number;
  onFyChange: (fy: number) => void;
}

export function EntityProfitLossTrendCard({
  trend,
  selectedFy,
  onFyChange,
}: EntityProfitLossTrendCardProps) {
  const data = trend.data;

  const rows = useMemo<TrendRow[]>(
    () => (data?.months ?? []).map((m) => ({ month: m.month, income: m.income, expenses: m.expenses })),
    [data],
  );

  const yearOptions = useMemo(() => {
    const years = new Set<number>([currentFinancialYear(), selectedFy, ...(data?.availableFinancialYears ?? [])]);
    return Array.from(years)
      .sort((a, b) => b - a)
      .map(fyLabel);
  }, [data, selectedFy]);

  const notice = data?.truncated
    ? `Showing the first ${data.transactionCount} of ${data.total} transactions for ${fyLabel(selectedFy)}; monthly totals are partial.`
    : null;

  return (
    <ProfitLossTrendView
      rows={rows}
      isEmpty={!!data && data.transactionCount === 0}
      yearOptions={yearOptions}
      selectedYear={fyLabel(selectedFy)}
      onYearChange={(label) => {
        const fy = parseFyLabel(label);
        if (fy) onFyChange(fy);
      }}
      isLoading={trend.status === "idle" || trend.status === "loading"}
      error={trend.status === "error" ? trend.error ?? "Could not load the profit & loss trend." : null}
      onRetry={trend.reload}
      notice={notice}
      emptyMessage={`No transactions are available for the year ${fyLabel(selectedFy)}.`}
    />
  );
}
