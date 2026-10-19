"use client";

import { formatClientCurrency } from "./CurrencyFormatter";

/** One month of the chart: income and expenses as positive magnitudes. */
export type PropertyTrendRow = {
  key: string;
  label: string;
  income: number;
  expense: number;
};

interface PropertyTrendChartProps {
  /**
   * The months to plot, oldest first, from the Portfolio Summary — the same
   * aggregate as the hero's Cash Flow, so this month's bars and that figure
   * cannot disagree. null while it loads.
   */
  rows: PropertyTrendRow[] | null;
}

export default function PropertyTrendChart({ rows }: PropertyTrendChartProps) {
  const trendRows = rows ?? [];

  const maxTrendAmount = Math.max(1, ...trendRows.flatMap((row) => [row.income, row.expense]));

  const formatCurrency = (val: number) => {
    return formatClientCurrency(val, { short: true, decimals: 0 });
  };

  if (rows === null) {
    return <div className="h-48 w-full mt-2 rounded-xl bg-[var(--surface-2)] animate-pulse" aria-hidden="true" />;
  }

  if (trendRows.length === 0) {
    return (
      <div className="property-trend-empty text-center py-12 text-[#667085] text-sm">
        No transactions are available for this property yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 w-full mt-2">
      {/* Chart */}
      <div className="property-custom-chart">
        <div className="property-custom-chart-y">
          <span>{formatCurrency(maxTrendAmount)}</span>
          <span>{formatCurrency(maxTrendAmount * 0.75)}</span>
          <span>{formatCurrency(maxTrendAmount * 0.5)}</span>
          <span>{formatCurrency(maxTrendAmount * 0.25)}</span>
          <span>{formatCurrency(0)}</span>
        </div>
        <div className="property-custom-chart-plot">
          {trendRows.map((item) => (
            <div key={item.key} className="property-custom-chart-month">
              <div className="property-custom-chart-bars">
                {/* Income Bar (Left) */}
                <span
                  className="is-income hover:opacity-95 transition-opacity cursor-pointer"
                  style={{
                    height: `${Math.max(
                      2,
                      (item.income / maxTrendAmount) * 100
                    )}%`,
                  }}
                  title={`Income: ${formatClientCurrency(item.income)}`}
                />
                {/* Expense Bar (Right) */}
                <span
                  className="is-expense hover:opacity-95 transition-opacity cursor-pointer"
                  style={{
                    height: `${Math.max(
                      2,
                      (item.expense / maxTrendAmount) * 100
                    )}%`,
                  }}
                  title={`Expense: ${formatClientCurrency(item.expense)}`}
                />
              </div>
              <span className="uppercase tracking-wider">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="property-custom-chart-legend">
        <span>
          <i className="is-income" />
          Income
        </span>
        <span>
          <i className="is-expense" />
          Expenses
        </span>
      </div>
    </div>
  );
}
