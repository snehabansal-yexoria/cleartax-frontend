"use client";

import React from "react";
import { formatClientCurrency, formatCurrencyShort } from "./CurrencyFormatter";

interface CashFlowChartProps {
  months: string[];
  income: number[];
  expenses: number[];
  view?: 'graph' | 'table';
}

export default function CashFlowChart({
  months,
  income,
  expenses,
  view = 'graph',
}: CashFlowChartProps) {
  const hasData = income.some(v => v > 0) || expenses.some(v => v > 0);

  // Layout calculations
  const dataMax = Math.max(...income, ...expenses, 1);

  // Format helper
  const formatYLabel = (val: number) => {
    if (val >= 1000) return `$${(val / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    return `$${val}`;
  };

  if (view === 'graph') {
    return (
      <div className="flex flex-col w-full">
        <div className="flex gap-4 h-[200px] mt-2 relative w-full">
          {!hasData ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-[#667085] bg-white/50 backdrop-blur-[1px] rounded-lg">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '36px', height: '36px' }} className="mb-2 text-[#98a2b3]">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              <span className="text-sm font-semibold">No cash flow data available</span>
              <span className="text-xs text-[#98a2b3] mt-1">Add income or expense transactions to view cash flow charts.</span>
            </div>
          ) : (
            <>
              {/* Y Axis Grid/Labels */}
              <div className="flex flex-col justify-between text-[#98a2b3] text-[10px] font-semibold h-[180px] w-8 select-none">
                <span>{formatYLabel(dataMax)}</span>
                <span>{formatYLabel(dataMax * 0.75)}</span>
                <span>{formatYLabel(dataMax * 0.5)}</span>
                <span>{formatYLabel(dataMax * 0.25)}</span>
                <span>$0</span>
              </div>

              <div className="flex-1 flex justify-between items-end h-[180px] border-b border-[#f2f4f7] pb-1 relative">
                {/* Horizontal dotted lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pr-1">
                  <div className="w-full border-t border-dashed border-[#f2f4f7]" />
                  <div className="w-full border-t border-dashed border-[#f2f4f7]" />
                  <div className="w-full border-t border-dashed border-[#f2f4f7]" />
                  <div className="w-full border-t border-dashed border-[#f2f4f7]" />
                  <div className="w-full" />
                </div>

                {months.map((month, idx) => {
                  const incVal = income[idx] || 0;
                  const expVal = expenses[idx] || 0;

                  const incHeightPct = (incVal / dataMax) * 100;
                  const expHeightPct = (expVal / dataMax) * 100;

                  return (
                    <div key={month} className="flex-1 flex flex-col items-center h-full justify-end z-10">
                      <div className="flex items-end gap-2.5 h-[150px] justify-center w-full">
                        {/* Expense (Orange) */}
                        <div
                          className="w-4 rounded-md transition-all duration-300 hover:opacity-90"
                          style={{
                            height: `${Math.max(expHeightPct, 6)}%`,
                            backgroundColor: 'var(--accent)'
                          }}
                          title={`Expenses: ${formatCurrencyShort(expVal)}`}
                        />
                        {/* Income (Dark Blue) */}
                        <div
                          className="w-4 rounded-md transition-all duration-300 hover:opacity-90"
                          style={{
                            height: `${Math.max(incHeightPct, 6)}%`,
                            backgroundColor: 'var(--brand)'
                          }}
                          title={`Income: ${formatCurrencyShort(incVal)}`}
                        />
                      </div>
                      <span className="text-[#8c9ba5] text-[11px] font-bold mt-2.5">{month}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Legend */}
        {hasData && (
          <div className="flex justify-center gap-6 mt-4 select-none">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <span className="w-2.5 h-2.5 rounded bg-[#f4a117]" />
              <span>Expenses</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <span className="w-2.5 h-2.5 rounded bg-[#28336e]" />
              <span>Income</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="property-trend-table-full mt-2 h-[200px] overflow-y-auto w-full relative">
      {!hasData ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-[#667085] bg-white/50 backdrop-blur-[1px] rounded-lg">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '36px', height: '36px' }} className="mb-2 text-[#98a2b3]">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
          <span className="text-sm font-semibold">No cash flow data available</span>
          <span className="text-xs text-[#98a2b3] mt-1">Add income or expense transactions to view cash flow details.</span>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 12px', fontSize: '12px' }}>Month</th>
              <th style={{ padding: '8px 12px', fontSize: '12px' }}>Income</th>
              <th style={{ padding: '8px 12px', fontSize: '12px' }}>Expenses</th>
              <th style={{ padding: '8px 12px', fontSize: '12px', textAlign: 'right' }}>Net Result</th>
            </tr>
          </thead>
          <tbody>
            {months.map((month, idx) => {
              const inc = income[idx] || 0;
              const exp = expenses[idx] || 0;
              const net = inc - exp;
              const isPositive = net >= 0;
              return (
                <tr key={month}>
                  <td style={{ padding: '8px 12px', fontSize: '13px' }}>{month}</td>
                  <td className="income-col" style={{ padding: '8px 12px', fontSize: '13px' }}>
                    <span className="dot">●</span> {formatClientCurrency(inc)}
                  </td>
                  <td className="expense-col" style={{ padding: '8px 12px', fontSize: '13px' }}>
                    <span className="dot">●</span> {formatClientCurrency(exp)}
                  </td>
                  <td className={isPositive ? "income-col" : "expense-col"} style={{ padding: '8px 12px', fontSize: '13px', textAlign: 'right' }}>
                    {isPositive ? "+" : "-"}{formatClientCurrency(Math.abs(net))}
                  </td>
                </tr>
              );
            })}
            {(() => {
              const totalIncome = income.reduce((a, b) => a + b, 0);
              const totalExpense = expenses.reduce((a, b) => a + b, 0);
              const netTotal = totalIncome - totalExpense;
              return (
                <tr className="total-row">
                  <td style={{ padding: '8px 12px', fontSize: '13px' }}>Total</td>
                  <td className="income-col" style={{ padding: '8px 12px', fontSize: '13px' }}>{formatClientCurrency(totalIncome)}</td>
                  <td className="expense-col" style={{ padding: '8px 12px', fontSize: '13px' }}>{formatClientCurrency(totalExpense)}</td>
                  <td className={netTotal >= 0 ? "income-col" : "expense-col"} style={{ padding: '8px 12px', fontSize: '13px', textAlign: 'right' }}>
                    {netTotal >= 0 ? "+" : "-"}{formatClientCurrency(Math.abs(netTotal))}
                  </td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      )}
    </div>
  );
}
