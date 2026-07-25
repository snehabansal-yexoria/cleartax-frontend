"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { formatCurrency as globalFormatCurrency } from "@/src/lib/currency";
import type { CoreTransactionListItem, CorePropertyTransactionRow } from "@/src/lib/coreApi";
import { TrendSkeleton } from "@/app/components/PortalSkeletons";

export interface ProfitLossTrendCardProps {
  transactions: (CoreTransactionListItem | CorePropertyTransactionRow)[];
  isLoading?: boolean;
}

function formatCurrency(value: number) {
  return globalFormatCurrency(value, { decimals: 0 });
}

function monthKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  if (Number.isNaN(date.getTime())) return key;
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date);
}

export default function ProfitLossTrendCard({
  transactions = [],
  isLoading = false,
}: ProfitLossTrendCardProps) {
  const [trendView, setTrendView] = useState<"graph" | "table">("graph");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Extract unique years dynamically from transaction data
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    for (const row of transactions) {
      const dateVal = "invoiceDate" in row ? row.invoiceDate : "";
      const key = monthKey(dateVal);
      if (!key) continue;
      const year = key.split("-")[0];
      if (year) {
        years.add(year);
      }
    }
    const currentYear = new Date().getFullYear().toString();
    years.add(currentYear); // Ensure the current year is always an option
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  // Determine the default year: current year if it has data, or the latest year with data.
  const defaultYear = useMemo(() => {
    const currentYear = new Date().getFullYear().toString();
    const yearsWithData = new Set<string>();
    for (const row of transactions) {
      const dateVal = "invoiceDate" in row ? row.invoiceDate : "";
      const key = monthKey(dateVal);
      if (!key) continue;
      const year = key.split("-")[0];
      if (year) {
        yearsWithData.add(year);
      }
    }
    
    if (yearsWithData.has(currentYear)) {
      return currentYear;
    }
    if (yearsWithData.size > 0) {
      const sorted = Array.from(yearsWithData).sort((a, b) => b.localeCompare(a));
      return sorted[0];
    }
    return currentYear;
  }, [transactions]);

  const [selectedYear, setSelectedYear] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlYear = params.get("trendYear");
      if (urlYear && (availableYears.includes(urlYear) || urlYear === "all")) {
        setSelectedYear(urlYear);
        return;
      }
    }
    if (defaultYear) {
      setSelectedYear(defaultYear);
    }
  }, [defaultYear, availableYears]);

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (year) {
        url.searchParams.set("trendYear", year);
      } else {
        url.searchParams.delete("trendYear");
      }
      window.history.replaceState(null, "", url.toString());
    }
  };

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

  const trendRows = useMemo(() => {
    const byMonth = new Map<string, { month: string; expenses: number; income: number }>();
    for (const row of transactions) {
      const dateVal = "invoiceDate" in row ? row.invoiceDate : "";
      const key = monthKey(dateVal);
      if (!key) continue;
      const year = key.split("-")[0];
      if (selectedYear && year !== selectedYear) continue;

      const current = byMonth.get(key) || {
        month: key,
        expenses: 0,
        income: 0,
      };
      
      const amount = Math.abs(
        "splitGrossAmount" in row
          ? row.splitGrossAmount || row.transactionGrossAmount || 0
          : "grossAmount" in row
          ? row.grossAmount || 0
          : 0
      );
      const type = "transactionType" in row ? row.transactionType : "type" in row ? row.type : "";

      if (type === "revenue") current.income += amount;
      else current.expenses += amount;
      byMonth.set(key, current);
    }
    return Array.from(byMonth.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);
  }, [transactions, selectedYear]);

  const maxTrendAmount = Math.max(
    1,
    ...trendRows.flatMap((row) => [row.expenses, row.income]),
  );

  const trendTotals = useMemo(() => {
    return trendRows.reduce(
      (acc, row) => {
        acc.income += row.income;
        acc.expenses += row.expenses;
        return acc;
      },
      { income: 0, expenses: 0 },
    );
  }, [trendRows]);

  const trendNetTotal = trendTotals.income - trendTotals.expenses;

  if (isLoading) {
    return <TrendSkeleton />;
  }

  return (
    <section className="entity-trend-card" aria-label="Profit and loss trend">
      <div className="entity-trend-head">
        <div>
          <h2>Profit & Loss Trend</h2>
          {selectedYear && (
            <p className="trend-period-label" style={{ fontSize: "14px", color: "#667085", marginTop: "4px" }} data-testid="trend-period-label">
              Reporting Period: {selectedYear}
            </p>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Year Dropdown Filter */}
          <div className="property-status-select" ref={dropdownRef} data-testid="year-select-container" style={{ position: "relative" }}>
            <button
              type="button"
              className="property-status-trigger"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{
                minHeight: "40px",
                padding: "8px 16px",
                fontSize: "14px",
                borderRadius: "8px",
                display: "inline-flex",
                alignItems: "center",
                width: "auto",
                gap: "8px"
              }}
              data-testid="year-select-trigger"
            >
              <span>{selectedYear || "Select Year"}</span>
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                style={{
                  width: "14px",
                  height: "14px",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: 2,
                  transform: isDropdownOpen ? "rotate(180deg)" : "none",
                  transition: "transform 140ms ease",
                }}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {isDropdownOpen && (
              <div
                className="property-status-menu"
                style={{
                  zIndex: 50,
                  position: "absolute",
                  right: 0,
                  left: "auto",
                  minWidth: "120px",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                }}
                role="listbox"
                data-testid="year-select-menu"
              >
                {availableYears.map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    role="option"
                    aria-selected={selectedYear === yr}
                    className={selectedYear === yr ? "is-selected" : ""}
                    onClick={() => {
                      handleYearChange(yr);
                      setIsDropdownOpen(false);
                    }}
                    data-testid={`year-option-${yr}`}
                  >
                    <span>{yr}</span>
                    {selectedYear === yr && (
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        style={{ width: "16px", height: "16px", fill: "none", stroke: "currentColor", strokeWidth: 2 }}
                      >
                        <path d="M5 12l4 4 10-10" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="entity-trend-toggle">
            <span
              className={trendView === "graph" ? "is-active" : ""}
              onClick={() => setTrendView("graph")}
            >
              <svg viewBox="0 0 24 24">
                <path d="M4 19V5" />
                <path d="M4 19h16" />
                <path d="M8 17V9" />
                <path d="M13 17V6" />
                <path d="M18 17v-5" />
              </svg>
              Graph View
            </span>
            <span
              className={trendView === "table" ? "is-active" : ""}
              onClick={() => setTrendView("table")}
            >
              <svg viewBox="0 0 24 24">
                <rect x="4" y="5" width="16" height="14" rx="1" />
                <path d="M4 10h16" />
                <path d="M4 15h16" />
                <path d="M10 5v14" />
              </svg>
              Table View
            </span>
          </div>
        </div>
      </div>

      {trendRows.length === 0 ? (
        <div className="property-trend-empty" data-testid="trend-empty-state">
          {selectedYear
            ? `No transactions are available for the year ${selectedYear}.`
            : "No transactions are available for this entity yet."}
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
            <div className="entity-chart-plot">
              {trendRows.map((item) => (
                <div key={item.month} className="entity-chart-month">
                  <div className="entity-chart-bars">
                    <span
                      className="is-expense"
                      style={{
                        height: `${Math.max(
                          3,
                          (item.expenses / maxTrendAmount) * 100,
                        )}%`,
                      }}
                    />
                    <span
                      className="is-income"
                      style={{
                        height: `${Math.max(
                          3,
                          (item.income / maxTrendAmount) * 100,
                        )}%`,
                      }}
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
              {trendRows.map((item) => {
                const net = item.income - item.expenses;
                const isPositive = net >= 0;
                return (
                  <tr key={item.month}>
                    <td>{monthLabel(item.month)}</td>
                    <td className="income-col">
                      <span className="dot">●</span> {formatCurrency(item.income)}
                    </td>
                    <td className="expense-col">
                      <span className="dot">●</span> {formatCurrency(item.expenses)}
                    </td>
                    <td className={isPositive ? "income-col" : "expense-col"}>
                      {isPositive ? "+" : "-"}{formatCurrency(Math.abs(net))}
                    </td>
                  </tr>
                );
              })}
              <tr className="total-row">
                <td>Total</td>
                <td>{formatCurrency(trendTotals.income)}</td>
                <td>{formatCurrency(trendTotals.expenses)}</td>
                <td className={trendNetTotal >= 0 ? "income-col" : "expense-col"}>
                  {trendNetTotal >= 0 ? "+" : "-"}{formatCurrency(Math.abs(trendNetTotal))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
