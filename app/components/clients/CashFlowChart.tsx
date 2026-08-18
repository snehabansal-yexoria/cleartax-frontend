"use client";

import React, { useState, useEffect } from "react";
import { formatClientCurrency, formatCurrencyShort } from "./CurrencyFormatter";

interface CategoryItem {
  name: string;
  amount: number;
}

interface CashFlowChartProps {
  months: string[];
  income: number[];
  expenses: number[];
  view?: 'graph' | 'table';
  onViewChange?: (view: 'graph' | 'table') => void;
  title?: string;
  subtitle?: string;
  showViewDetail?: boolean;
  expenseCategories?: CategoryItem[];
  incomeSources?: CategoryItem[];
}

const DEFAULT_EXPENSE_CATEGORIES: CategoryItem[] = [
  { name: "Loan Interest", amount: 2180 },
  { name: "Maintenance", amount: 1340 },
  { name: "Council Rates", amount: 960 },
  { name: "Insurance", amount: 640 },
  { name: "Water & Utilities", amount: 260 },
];

const DEFAULT_INCOME_SOURCES: CategoryItem[] = [
  { name: "Rental Income", amount: 4200 },
  { name: "Other Rental Income", amount: 3800 },
];

export default function CashFlowChart({
  months,
  income,
  expenses,
  view,
  onViewChange,
  title = "Cash Flow",
  subtitle = "Income vs expense",
  showViewDetail = true,
  expenseCategories = DEFAULT_EXPENSE_CATEGORIES,
  incomeSources = DEFAULT_INCOME_SOURCES,
}: CashFlowChartProps) {
  const [internalView, setInternalView] = useState<'graph' | 'table'>('graph');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Sync internal view state if controlled view prop changes
  useEffect(() => {
    if (view) {
      setInternalView(view);
    }
  }, [view]);

  const currentView = view || internalView;

  const handleViewChange = (newView: 'graph' | 'table') => {
    setInternalView(newView);
    if (onViewChange) {
      onViewChange(newView);
    }
  };

  const hasData = income.some(v => v > 0) || expenses.some(v => v > 0);

  // Layout calculations for main desktop chart
  const dataMax = Math.max(...income, ...expenses, 1);

  const formatYLabel = (val: number) => {
    if (val >= 1000) return `$${(val / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    return `$${val}`;
  };

  // Stacked chart calculation for mobile
  const mobileMaxSum = Math.max(
    ...months.map((_, idx) => (income[idx] || 0) + (expenses[idx] || 0)),
    1
  );

  return (
    <div className="flex flex-col w-full">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 w-full mb-4 select-none">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[#101828] dark:text-white text-base font-bold">{title}</h3>
          <span className="text-[#8c9ba5] dark:text-[#B9C0E8] text-xs font-semibold">{subtitle}</span>
        </div>

        <div className="flex items-center gap-4 self-stretch sm:self-auto justify-between sm:justify-end">
          {showViewDetail && hasData && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="text-[#28336e] dark:text-[#B9C0E8] hover:text-[#f4a117] dark:hover:text-[#f4a117] transition-all text-sm font-bold bg-transparent border-none cursor-pointer focus:outline-none"
            >
              View Detail
            </button>
          )}

          <div className="flex bg-[#f2f4f7] dark:bg-[#242C68] rounded-lg p-0.5 border border-[#eaeef4] dark:border-slate-700">
            <button
              type="button"
              onClick={() => handleViewChange('graph')}
              className={`flex items-center gap-1.5 text-xs py-1 px-3.5 rounded-md transition-all font-semibold cursor-pointer ${currentView === 'graph'
                  ? 'bg-white dark:bg-slate-700 text-[#101828] dark:text-white shadow-sm'
                  : 'text-[#475467] dark:text-[#B9C0E8] hover:text-[#101828] dark:hover:text-white'
                }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '12px', height: '12px' }}>
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              Graph View
            </button>
            <button
              type="button"
              onClick={() => handleViewChange('table')}
              className={`flex items-center gap-1.5 text-xs py-1 px-3.5 rounded-md transition-all font-semibold cursor-pointer ${currentView === 'table'
                  ? 'bg-white dark:bg-slate-700 text-[#101828] dark:text-white shadow-sm'
                  : 'text-[#475467] dark:text-[#B9C0E8] hover:text-[#101828] dark:hover:text-white'
                }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '12px', height: '12px' }}>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <line x1="15" y1="3" x2="15" y2="21" />
              </svg>
              Table View
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {currentView === 'graph' ? (
        <div className="flex flex-col w-full">
          <div className="flex gap-4 h-[200px] mt-2 relative w-full">
            {!hasData ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-[#667085] bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px] rounded-lg">
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

                <div className="flex-1 flex justify-between items-end h-[180px] border-b border-[#f2f4f7] dark:border-slate-700 pb-1 relative">
                  {/* Horizontal dotted lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pr-1">
                    <div className="w-full border-t border-dashed border-[#f2f4f7] dark:border-slate-700" />
                    <div className="w-full border-t border-dashed border-[#f2f4f7] dark:border-slate-700" />
                    <div className="w-full border-t border-dashed border-[#f2f4f7] dark:border-slate-700" />
                    <div className="w-full border-t border-dashed border-[#f2f4f7] dark:border-slate-700" />
                    <div className="w-full" />
                  </div>

                  {months.map((month, idx) => {
                    const incVal = income[idx] || 0;
                    const expVal = expenses[idx] || 0;

                    const incHeightPct = (incVal / dataMax) * 100;
                    const expHeightPct = (expVal / dataMax) * 100;

                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end z-10">
                        <div className="flex items-end gap-2.5 h-[150px] justify-center w-full">
                          {/* Expense (Orange) - Rounded top only */}
                          <div
                            className="w-4 rounded-t-[6px] transition-all duration-300 hover:opacity-90"
                            style={{
                              height: `${Math.max(expHeightPct, 6)}%`,
                              backgroundColor: 'var(--accent)'
                            }}
                            title={`Expenses: ${formatCurrencyShort(expVal)}`}
                          />
                          {/* Income (Dark Blue) - Rounded top only */}
                          <div
                            className="w-4 rounded-t-[6px] transition-all duration-300 hover:opacity-90"
                            style={{
                              height: `${Math.max(incHeightPct, 6)}%`,
                              backgroundColor: 'var(--brand)'
                            }}
                            title={`Income: ${formatCurrencyShort(incVal)}`}
                          />
                        </div>
                        <span className="text-[#8c9ba5] dark:text-[#B9C0E8] text-[11px] font-bold mt-2.5">{month}</span>
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
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#f4a117]">
                <span className="w-2.5 h-2.5 rounded bg-[#f4a117]" />
                <span>Expenses</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#28336e] dark:text-[#B9C0E8]">
                <span className="w-2.5 h-2.5 rounded bg-[#28336e] dark:bg-[#38417F]" />
                <span>Income</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="property-trend-table-full mt-2 h-[200px] overflow-y-auto w-full relative">
          {!hasData ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-[#667085] bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px] rounded-lg">
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
                  <th className="dark:text-white" style={{ padding: '8px 12px', fontSize: '12px' }}>Month</th>
                  <th className="dark:text-white" style={{ padding: '8px 12px', fontSize: '12px' }}>Income</th>
                  <th className="dark:text-white" style={{ padding: '8px 12px', fontSize: '12px' }}>Expenses</th>
                  <th className="dark:text-white" style={{ padding: '8px 12px', fontSize: '12px', textAlign: 'right' }}>Net Result</th>
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
      )}

      {/* Responsive Modal/Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop Close Click area */}
          <div className="absolute inset-0 cursor-default" onClick={() => setIsModalOpen(false)} />

          {/* DESKTOP MODAL CONTENT (Figma Image 2 style) */}
          <div className="hidden md:flex flex-col bg-white dark:bg-[#1B2050] border border-[#eaeef4] dark:border-slate-700 rounded-[18px] p-6 shadow-2xl max-w-4xl w-full relative z-10 transition-all transform duration-300">
            {/* Modal Header */}
            <div className="flex justify-between items-center w-full mb-4 select-none">
              <div className="flex items-baseline gap-2">
                <h3 className="text-[#101828] dark:text-white text-base font-bold">{title}</h3>
                <span className="text-[#8c9ba5] dark:text-[#B9C0E8] text-xs font-semibold">{subtitle}</span>
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-[#28336e] dark:text-[#B9C0E8] hover:text-[#f4a117] transition-all text-sm font-bold bg-transparent border-none cursor-pointer focus:outline-none"
                >
                  Hide Detail
                </button>

                <div className="flex bg-[#f2f4f7] dark:bg-[#242C68] rounded-lg p-0.5 border border-[#eaeef4] dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => handleViewChange('graph')}
                    className={`flex items-center gap-1.5 text-xs py-1 px-3.5 rounded-md transition-all font-semibold cursor-pointer ${currentView === 'graph'
                        ? 'bg-white dark:bg-slate-700 text-[#101828] dark:text-white shadow-sm'
                        : 'text-[#475467] dark:text-[#B9C0E8] hover:text-[#101828] dark:hover:text-white'
                      }`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '12px', height: '12px' }}>
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                    Graph View
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewChange('table')}
                    className={`flex items-center gap-1.5 text-xs py-1 px-3.5 rounded-md transition-all font-semibold cursor-pointer ${currentView === 'table'
                        ? 'bg-white dark:bg-slate-700 text-[#101828] dark:text-white shadow-sm'
                        : 'text-[#475467] dark:text-[#B9C0E8] hover:text-[#101828] dark:hover:text-white'
                      }`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '12px', height: '12px' }}>
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <line x1="9" y1="3" x2="9" y2="21" />
                      <line x1="15" y1="3" x2="15" y2="21" />
                    </svg>
                    Table View
                  </button>
                </div>
              </div>
            </div>

            {/* Desktop Modal Chart Content */}
            {currentView === 'graph' ? (
              <div className="flex flex-col w-full mb-2">
                <div className="flex gap-4 h-[200px] mt-2 relative w-full">
                  <div className="flex flex-col justify-between text-[#98a2b3] text-[10px] font-semibold h-[180px] w-8 select-none">
                    <span>{formatYLabel(dataMax)}</span>
                    <span>{formatYLabel(dataMax * 0.75)}</span>
                    <span>{formatYLabel(dataMax * 0.5)}</span>
                    <span>{formatYLabel(dataMax * 0.25)}</span>
                    <span>$0</span>
                  </div>

                  <div className="flex-1 flex justify-between items-end h-[180px] border-b border-[#f2f4f7] dark:border-slate-700 pb-1 relative">
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pr-1">
                      <div className="w-full border-t border-dashed border-[#f2f4f7] dark:border-slate-700" />
                      <div className="w-full border-t border-dashed border-[#f2f4f7] dark:border-slate-700" />
                      <div className="w-full border-t border-dashed border-[#f2f4f7] dark:border-slate-700" />
                      <div className="w-full border-t border-dashed border-[#f2f4f7] dark:border-slate-700" />
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
                            <div
                              className="w-4 rounded-t-[6px] transition-all duration-300 hover:opacity-90"
                              style={{
                                height: `${Math.max(expHeightPct, 6)}%`,
                                backgroundColor: 'var(--accent)'
                              }}
                              title={`Expenses: ${formatCurrencyShort(expVal)}`}
                            />
                            <div
                              className="w-4 rounded-t-[6px] transition-all duration-300 hover:opacity-90"
                              style={{
                                height: `${Math.max(incHeightPct, 6)}%`,
                                backgroundColor: 'var(--brand)'
                              }}
                              title={`Income: ${formatCurrencyShort(incVal)}`}
                            />
                          </div>
                          <span className="text-[#8c9ba5] dark:text-[#B9C0E8] text-[11px] font-bold mt-2.5">{month}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex justify-center gap-6 mt-4 select-none">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#f4a117]">
                    <span className="w-2.5 h-2.5 rounded bg-[#f4a117]" />
                    <span>Expenses</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#28336e] dark:text-[#B9C0E8]">
                    <span className="w-2.5 h-2.5 rounded bg-[#28336e] dark:bg-[#38417F]" />
                    <span>Income</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="property-trend-table-full mt-2 h-[200px] overflow-y-auto w-full relative mb-4">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th className="dark:text-white" style={{ padding: '8px 12px', fontSize: '12px' }}>Month</th>
                      <th className="dark:text-white" style={{ padding: '8px 12px', fontSize: '12px' }}>Income</th>
                      <th className="dark:text-white" style={{ padding: '8px 12px', fontSize: '12px' }}>Expenses</th>
                      <th className="dark:text-white" style={{ padding: '8px 12px', fontSize: '12px', textAlign: 'right' }}>Net Result</th>
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
              </div>
            )}

            {/* Dotted Separator */}
            <div className="w-full border-t border-dashed border-[#eaeef4] dark:border-slate-700 my-4" />

            {/* Details Lists (Desktop: Side-by-Side 2-Columns) */}
            <div className="flex flex-col gap-4 text-left w-full select-none">
              <span className="text-[#8c9ba5] dark:text-[#B9C0E8] text-xs font-semibold">
                Top categories driving this month's activity across your whole portfolio.
              </span>

              <div className="flex flex-row gap-8 w-full mt-2">
                {/* Expense Categories */}
                <div className="flex-1 flex flex-col gap-3">
                  <span className="text-[11px] font-bold text-[#5c639a] dark:text-[#B9C0E8] tracking-wider mb-1">
                    TOP 5 EXPENSE CATEGORIES
                  </span>
                  <div className="flex flex-col gap-2">
                    {expenseCategories.map((item, idx) => (
                      <div key={item.name} className="flex justify-between items-center text-sm font-semibold text-[#14172E] dark:text-white py-1">
                        <div className="flex items-center gap-3">
                          <span className="w-5 h-5 rounded-full bg-[#f2f4f7] dark:bg-slate-800 flex items-center justify-center text-[10px] text-[#5c639a] dark:text-[#B9C0E8] font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-[#101828] dark:text-slate-200 font-bold">{item.name}</span>
                        </div>
                        <span className="text-[#101828] dark:text-white font-bold">{formatClientCurrency(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Income Sources */}
                <div className="flex-1 flex flex-col gap-3">
                  <span className="text-[11px] font-bold text-[#5c639a] dark:text-[#B9C0E8] tracking-wider mb-1">
                    TOP INCOME SOURCES
                  </span>
                  <div className="flex flex-col gap-2">
                    {incomeSources.map((item, idx) => (
                      <div key={item.name} className="flex justify-between items-center text-sm font-semibold text-[#14172E] dark:text-white py-1">
                        <div className="flex items-center gap-3">
                          <span className="w-5 h-5 rounded-full bg-[#f2f4f7] dark:bg-slate-800 flex items-center justify-center text-[10px] text-[#5c639a] dark:text-[#B9C0E8] font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-[#101828] dark:text-slate-200 font-bold">{item.name}</span>
                        </div>
                        <span className="text-[#101828] dark:text-white font-bold">{formatClientCurrency(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MOBILE MODAL CONTENT (Figma Image 3 style) */}
          <div className="flex md:hidden flex-col bg-white dark:bg-[#1B2050] border border-[#eaeef4] dark:border-slate-700 rounded-[18px] p-5 shadow-2xl max-w-sm w-full relative z-10 transition-all transform duration-300">
            {/* Mobile Header */}
            <div className="flex justify-between items-start w-full mb-3 select-none">
              <div className="flex flex-col">
                <h3 className="text-[#101828] dark:text-white text-base font-bold">{title}</h3>
                <span className="text-[#8c9ba5] dark:text-[#B9C0E8] text-[11px] font-semibold mt-0.5">
                  {subtitle} • {months.length} Months
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-[#28336e] dark:text-[#B9C0E8] hover:text-[#f4a117] transition-all text-xs font-bold bg-transparent border-none cursor-pointer focus:outline-none"
              >
                Hide Detail
              </button>
            </div>

            {/* Stacked Chart Area (Mobile specific stacked bar design) */}
            <div className="flex flex-col w-full mb-3 px-1">
              <div className="flex justify-between items-end h-[120px] w-full gap-2 relative">
                {months.map((month, idx) => {
                  const incVal = income[idx] || 0;
                  const expVal = expenses[idx] || 0;
                  const sumVal = incVal + expVal;

                  // Bar container height proportional to sum values
                  const barHeightPct = sumVal > 0 ? (sumVal / mobileMaxSum) * 100 : 0;

                  // Stack proportions
                  const expPct = sumVal > 0 ? (expVal / sumVal) * 100 : 0;
                  const incPct = sumVal > 0 ? (incVal / sumVal) * 100 : 0;

                  return (
                    <div key={`mob-${month}`} className="flex-1 flex flex-col items-center h-full justify-end select-none">
                      {sumVal > 0 ? (
                        <div
                          style={{ height: `${Math.max(barHeightPct, 15)}%` }}
                          className="w-[18px] rounded-[6px] overflow-hidden flex flex-col-reverse gap-[1px]"
                        >
                          {/* Expenses (Orange) - bottom */}
                          <div
                            style={{ height: `${expPct}%` }}
                            className="w-full bg-[#f4a117]"
                            title={`Expenses: ${formatCurrencyShort(expVal)}`}
                          />
                          {/* Income (Dark Blue) - top */}
                          <div
                            style={{ height: `${incPct}%` }}
                            className="w-full bg-[#28336e] dark:bg-[#38417F]"
                            title={`Income: ${formatCurrencyShort(incVal)}`}
                          />
                        </div>
                      ) : (
                        <div className="w-[18px] h-[6px] rounded-[3px] bg-slate-200 dark:bg-slate-700" />
                      )}
                      <span className="text-[#8c9ba5] dark:text-[#B9C0E8] text-[10px] font-bold mt-2">{month}</span>
                    </div>
                  );
                })}
              </div>

              {/* Mobile Legend */}
              <div className="flex justify-start gap-4 mt-3 select-none">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#28336e] dark:text-[#B9C0E8]">
                  <span className="w-2.5 h-2.5 rounded bg-[#28336e] dark:bg-[#38417F]" />
                  <span>Income</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#f4a117]">
                  <span className="w-2.5 h-2.5 rounded bg-[#f4a117]" />
                  <span>Expenses</span>
                </div>
              </div>
            </div>

            {/* Dotted Separator */}
            <div className="w-full border-t border-dashed border-[#eaeef4] dark:border-slate-700 my-3" />

            {/* Mobile Categories lists stacked vertically */}
            <div className="flex flex-col gap-4 text-left w-full select-none max-h-[220px] overflow-y-auto pr-1">
              <span className="text-[#8c9ba5] dark:text-[#B9C0E8] text-[10px] font-semibold">
                Top categories driving this month's activity across your whole portfolio.
              </span>

              {/* Expense Categories */}
              <div className="flex flex-col gap-2">
                <span className="text-[9px] font-bold text-[#5c639a] dark:text-[#B9C0E8] tracking-wider mb-1">
                  TOP 5 EXPENSE CATEGORIES
                </span>
                {expenseCategories.map((item, idx) => (
                  <div key={`mob-exp-${item.name}`} className="flex justify-between items-center text-xs font-semibold text-[#14172E] dark:text-white py-0.5">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-[#f2f4f7] dark:bg-slate-800 flex items-center justify-center text-[9px] text-[#5c639a] dark:text-[#B9C0E8] font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-[#101828] dark:text-slate-200 font-bold text-xs">{item.name}</span>
                    </div>
                    <span className="text-[#101828] dark:text-white font-bold text-xs">{formatClientCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>

              {/* Income Sources */}
              <div className="flex flex-col gap-2 mt-1">
                <span className="text-[9px] font-bold text-[#5c639a] dark:text-[#B9C0E8] tracking-wider mb-1">
                  TOP INCOME SOURCES
                </span>
                {incomeSources.map((item, idx) => (
                  <div key={`mob-inc-${item.name}`} className="flex justify-between items-center text-xs font-semibold text-[#14172E] dark:text-white py-0.5">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-[#f2f4f7] dark:bg-slate-800 flex items-center justify-center text-[9px] text-[#5c639a] dark:text-[#B9C0E8] font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-[#101828] dark:text-slate-200 font-bold text-xs">{item.name}</span>
                    </div>
                    <span className="text-[#101828] dark:text-white font-bold text-xs">{formatClientCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
