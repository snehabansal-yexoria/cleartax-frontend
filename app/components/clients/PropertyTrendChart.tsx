"use client";

import { useMemo } from "react";
import { formatClientCurrency } from "./CurrencyFormatter";
import { affectsPnl } from "@/src/lib/transactionTypes";
import type { CorePropertyTransactionRow } from "@/src/lib/coreApi";

interface PropertyTrendChartProps {
  transactions: CorePropertyTransactionRow[];
}

export default function PropertyTrendChart({ transactions }: PropertyTrendChartProps) {
  // Generate the last 6 calendar months ending at the current calendar month
  const trendRows = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-US", { month: "short" }),
        income: 0,
        expense: 0,
      });
    }

    for (const row of transactions) {
      const date = new Date(row.invoiceDate);
      if (Number.isNaN(date.getTime())) continue;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const monthObj = months.find((m) => m.key === key);
      if (monthObj) {
        const amount = Math.abs(row.splitGrossAmount || row.transactionGrossAmount || 0);
        // Personal, cost base and contra are excluded: none of them is income
        // or an expense, and the else branch used to count all three as
        // expenses.
        if (!affectsPnl(row.transactionType)) {
          // nothing to plot
        } else if (row.transactionType === "revenue") {
          monthObj.income += amount;
        } else {
          monthObj.expense += amount;
        }
      }
    }
    return months;
  }, [transactions]);

  const maxTrendAmount = useMemo(() => {
    return Math.max(1, ...trendRows.flatMap((row) => [row.income, row.expense]));
  }, [trendRows]);

  const formatCurrency = (val: number) => {
    return formatClientCurrency(val, { short: true, decimals: 0 });
  };

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
