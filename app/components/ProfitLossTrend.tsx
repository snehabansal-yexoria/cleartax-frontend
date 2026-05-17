"use client";

import { useState } from "react";

export type ProfitLossTrendItem = {
  id: string;
  invoiceDate: string;
  type: "expense" | "revenue";
  amount: number;
};

type TrendRow = {
  month: string;
  expenses: number;
  income: number;
};

type TrendView = "graph" | "table";

type ProfitLossTrendProps = {
  items: ProfitLossTrendItem[];
  isLoading: boolean;
  emptyMessage: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatNet(value: number) {
  if (value > 0) return `+${formatCurrency(value)}`;
  if (value < 0) return `-${formatCurrency(Math.abs(value))}`;
  return formatCurrency(0);
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
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
}

function buildTrendRows(items: ProfitLossTrendItem[]) {
  const byMonth = new Map<string, TrendRow>();

  for (const item of items) {
    const key = monthKey(item.invoiceDate);
    if (!key) continue;

    const current = byMonth.get(key) || {
      month: key,
      expenses: 0,
      income: 0,
    };
    const amount = Math.abs(item.amount || 0);

    if (item.type === "revenue") current.income += amount;
    else current.expenses += amount;

    byMonth.set(key, current);
  }

  return Array.from(byMonth.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-7);
}

function TrendLoader() {
  return (
    <div className="profit-loss-loader-wrap" role="status" aria-live="polite">
      <span className="profit-loss-loader" />
      <span>Loading trend data</span>
    </div>
  );
}

export function ProfitLossTrend({
  items,
  isLoading,
  emptyMessage,
}: ProfitLossTrendProps) {
  const [view, setView] = useState<TrendView>("graph");
  const [activeTooltipMonth, setActiveTooltipMonth] = useState<string | null>(
    null,
  );
  const [pinnedTooltipMonth, setPinnedTooltipMonth] = useState<string | null>(
    null,
  );
  const trendRows = buildTrendRows(items);
  const maxTrendAmount = Math.max(
    1,
    ...trendRows.flatMap((row) => [row.expenses, row.income]),
  );
  const totals = trendRows.reduce(
    (acc, row) => ({
      income: acc.income + row.income,
      expenses: acc.expenses + row.expenses,
    }),
    { income: 0, expenses: 0 },
  );
  const netTotal = totals.income - totals.expenses;

  return (
    <section className="entity-trend-card profit-loss-trend" aria-label="Profit and loss trend">
      <div className="entity-trend-head">
        <h2>Profit & Loss Trend</h2>
        <div className="entity-trend-toggle" role="tablist" aria-label="Profit and loss trend view">
          <button
            type="button"
            role="tab"
            aria-selected={view === "graph"}
            className={view === "graph" ? "is-active" : ""}
            onClick={() => setView("graph")}
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
            role="tab"
            aria-selected={view === "table"}
            className={view === "table" ? "is-active" : ""}
            onClick={() => setView("table")}
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

      {isLoading ? (
        <TrendLoader />
      ) : trendRows.length === 0 ? (
        <div className="property-trend-empty">{emptyMessage}</div>
      ) : view === "graph" ? (
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
              {trendRows.map((item) => {
                const label = monthLabel(item.month);
                const net = item.income - item.expenses;
                const isActive =
                  activeTooltipMonth === item.month ||
                  pinnedTooltipMonth === item.month;
                const largestValue = Math.max(item.income, item.expenses, 1);
                const tooltipId = `profit-loss-tooltip-${item.month}`;

                return (
                  <div
                    key={item.month}
                    className={`entity-chart-month${isActive ? " is-active" : ""}`}
                    onMouseEnter={() => setActiveTooltipMonth(item.month)}
                    onMouseLeave={() => {
                      if (pinnedTooltipMonth !== item.month) {
                        setActiveTooltipMonth(null);
                      }
                    }}
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) {
                        setActiveTooltipMonth(null);
                        setPinnedTooltipMonth((current) =>
                          current === item.month ? null : current,
                        );
                      }
                    }}
                  >
                    <button
                      type="button"
                      className="entity-chart-bars"
                      aria-label={`${label}: Income ${formatCurrency(
                        item.income,
                      )}, expenses ${formatCurrency(item.expenses)}, net ${formatNet(
                        net,
                      )}`}
                      aria-describedby={isActive ? tooltipId : undefined}
                      onFocus={() => setActiveTooltipMonth(item.month)}
                      onClick={() => {
                        setActiveTooltipMonth(item.month);
                        setPinnedTooltipMonth((current) =>
                          current === item.month ? null : item.month,
                        );
                      }}
                    >
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
                    </button>
                    {isActive ? (
                      <div
                        id={tooltipId}
                        className="entity-chart-tooltip"
                        role="tooltip"
                      >
                        <div className="entity-chart-tooltip-head">
                          <div>
                            <strong>{label}</strong>
                            <small>Monthly summary</small>
                          </div>
                          <button
                            type="button"
                            aria-label={`Close ${label} tooltip`}
                            onClick={() => {
                              setActiveTooltipMonth(null);
                              setPinnedTooltipMonth(null);
                            }}
                          >
                            x
                          </button>
                        </div>
                        <div className="entity-chart-tooltip-metrics">
                          <div className="entity-chart-tooltip-row">
                            <span>
                              <i className="is-income" />
                              Income
                            </span>
                            <b>{formatCurrency(item.income)}</b>
                            <em>
                              <span
                                className="is-income"
                                style={{
                                  width: `${Math.max(
                                    4,
                                    (item.income / largestValue) * 100,
                                  )}%`,
                                }}
                              />
                            </em>
                          </div>
                          <div className="entity-chart-tooltip-row">
                            <span>
                              <i className="is-expense" />
                              Expenses
                            </span>
                            <b>{formatCurrency(item.expenses)}</b>
                            <em>
                              <span
                                className="is-expense"
                                style={{
                                  width: `${Math.max(
                                    4,
                                    (item.expenses / largestValue) * 100,
                                  )}%`,
                                }}
                              />
                            </em>
                          </div>
                        </div>
                        <div
                          className={`entity-chart-tooltip-net ${
                            net >= 0 ? "is-net-positive" : "is-net-negative"
                          }`}
                        >
                          <span>Net result</span>
                          <b>{formatNet(net)}</b>
                        </div>
                      </div>
                    ) : null}
                    <span>{label}</span>
                  </div>
                );
              })}
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
        <div className="profit-loss-table-wrap">
          <table className="profit-loss-table">
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
                return (
                  <tr key={item.month}>
                    <td>{monthLabel(item.month)}</td>
                    <td className="is-income-cell">
                      <span className="profit-loss-dot is-income" />
                      {formatCurrency(item.income)}
                    </td>
                    <td className="is-expense-cell">
                      <span className="profit-loss-dot is-expense" />
                      {formatCurrency(item.expenses)}
                    </td>
                    <td className={net >= 0 ? "is-net-positive" : "is-net-negative"}>
                      {formatNet(net)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td>{formatCurrency(totals.income)}</td>
                <td>{formatCurrency(totals.expenses)}</td>
                <td className={netTotal >= 0 ? "is-net-positive" : "is-net-negative"}>
                  {formatNet(netTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
