"use client";

import { useMemo } from "react";
import { formatClientCurrency } from "./CurrencyFormatter";
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
        if (row.transactionType === "revenue") {
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
      <style>{`
        .property-custom-chart {
          display: grid;
          grid-template-columns: 50px minmax(0, 1fr);
          gap: 12px;
          min-height: 200px;
          align-items: stretch;
        }
        .property-custom-chart-y {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: flex-end;
          padding-bottom: 24px;
          color: #98a2b3;
          font-size: 10px;
          font-weight: 600;
          text-align: right;
        }
        .property-custom-chart-plot {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 8px;
          min-width: 0;
          border-left: 1px solid #e4e7ef;
          border-bottom: 1px solid #e4e7ef;
          background:
            repeating-linear-gradient(to bottom,
              transparent 0,
              transparent 19.5%,
              #eaeef4 20%,
              transparent 20.5%),
            repeating-linear-gradient(to right,
              transparent 0,
              transparent 16%,
              #f2f4f7 16.5%,
              transparent 17%);
          padding: 0 8px 0;
        }
        .property-custom-chart-month {
          display: grid;
          grid-template-rows: 1fr 20px;
          gap: 8px;
          color: #7b88ad;
          font-size: 10px;
          font-weight: 700;
          text-align: center;
        }
        .property-custom-chart-bars {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 6px;
          height: 100%;
          padding-bottom: 4px;
        }
        .property-custom-chart-bars span {
          display: block;
          width: 14px;
          min-height: 4px;
          border-radius: 4px 4px 0 0;
        }
        .property-custom-chart-bars .is-expense {
          background: #f4a117;
        }
        .property-custom-chart-bars .is-income {
          background: #28336e;
        }
        .property-custom-chart-legend {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
        }
        .property-custom-chart-legend span {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          color: #101828;
        }
        .property-custom-chart-legend i {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
        .property-custom-chart-legend .is-expense {
          background: #f4a117;
        }
        .property-custom-chart-legend .is-income {
          background: #28336e;
        }
      `}</style>

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
