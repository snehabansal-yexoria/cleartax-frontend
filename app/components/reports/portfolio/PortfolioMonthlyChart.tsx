"use client";

import { useState } from "react";
import type { CorePortfolioMonth, CorePortfolioTotals } from "@/src/lib/coreApi";
import { heroAmount, monthLong, monthShort, shortAmount, tableAmount } from "./portfolioFormat";

/**
 * Cash Flow · Income vs Expenses, one financial year by month.
 *
 * Hand-rolled bars on the portal's chart tokens (--chart-income /
 * --chart-expense, validated for colour-vision separation and contrast in both
 * themes). Every month column is one hover/focus target bigger than its bars,
 * showing that month's figures; the legend and the table view mean identity
 * never rests on colour alone. Bars clamp at zero — a month whose journal
 * credits outweigh its costs has a negative expense total, which the table
 * prints signed.
 *
 * On screen the Graph/Table toggle shows one view; in print both are shown.
 */

function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  const f = raw / base;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * base;
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-[11px] font-semibold text-[var(--text-secondary)]">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-2.5 h-2.5 rounded-[3px] bg-[var(--chart-income)]" aria-hidden="true" />
        Income
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-2.5 h-2.5 rounded-[3px] bg-[var(--chart-expense)]" aria-hidden="true" />
        Expenses
      </span>
    </div>
  );
}

function Bars({ months }: { months: CorePortfolioMonth[] }) {
  const [active, setActive] = useState<number | null>(null);

  const peak = Math.max(0, ...months.map((m) => Math.max(m.income, m.expenses)));
  const step = niceStep(peak / 3);
  const top = peak > 0 ? Math.ceil(peak / step) * step : step * 3;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);

  const height = (v: number) => `${Math.max(0, Math.min(100, (v / top) * 100))}%`;

  return (
    <div className="portfolio-chart flex gap-2 pt-3" role="img" aria-label="Monthly income and expenses bar chart; the table view lists the same figures">
      {/* Y axis */}
      <div className="relative w-9 shrink-0 h-44 text-[10px] text-[var(--text-muted)] tabular-nums">
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute right-0 -translate-y-1/2"
            style={{ bottom: height(t) }}
          >
            {t === 0 ? "0" : shortAmount(t)}
          </span>
        ))}
      </div>

      <div className="flex-1 min-w-0">
        <div className="relative h-44">
          {/* Recessive gridlines */}
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute left-0 right-0 border-t border-[var(--border)]"
              style={{ bottom: height(t) }}
              aria-hidden="true"
            />
          ))}

          <div className="absolute inset-0 flex items-end">
            {months.map((m, i) => (
              <div
                key={m.month}
                tabIndex={0}
                aria-label={`${monthLong(m.month)}: income ${tableAmount(m.income)}, expenses ${tableAmount(m.expenses)}`}
                className="relative flex-1 h-full flex items-end justify-center gap-[2px] outline-none rounded-md focus-visible:ring-2 focus-visible:ring-[var(--chart-income)] cursor-default"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
                onFocus={() => setActive(i)}
                onBlur={() => setActive((cur) => (cur === i ? null : cur))}
              >
                {active === i && (
                  <div className="absolute inset-y-0 inset-x-[8%] rounded-md bg-[var(--text-primary)] opacity-[0.04] print-hide" aria-hidden="true" />
                )}
                <div
                  className="relative w-[28%] max-w-[14px] min-w-[4px] rounded-t-[4px] bg-[var(--chart-income)]"
                  style={{ height: height(m.income) }}
                />
                <div
                  className="relative w-[28%] max-w-[14px] min-w-[4px] rounded-t-[4px] bg-[var(--chart-expense)]"
                  style={{ height: height(m.expenses) }}
                />

                {active === i && (
                  <div
                    role="tooltip"
                    className={`print-hide absolute bottom-[calc(100%+6px)] z-20 w-max min-w-[150px] rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 shadow-lg text-[11px] text-[var(--text-primary)] ${
                      i < 2 ? "left-0" : i > months.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2"
                    }`}
                  >
                    <div className="font-bold mb-1">{monthLong(m.month)}</div>
                    <div className="flex justify-between gap-4">
                      <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
                        <span className="w-2 h-2 rounded-[2px] bg-[var(--chart-income)]" aria-hidden="true" />
                        Income
                      </span>
                      <span className="tabular-nums font-semibold">{heroAmount(m.income)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
                        <span className="w-2 h-2 rounded-[2px] bg-[var(--chart-expense)]" aria-hidden="true" />
                        Expenses
                      </span>
                      <span className="tabular-nums font-semibold">{heroAmount(m.expenses)}</span>
                    </div>
                    <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-[var(--border)]">
                      <span className="text-[var(--text-secondary)]">Net</span>
                      <span className="tabular-nums font-semibold">{tableAmount(m.netResult, { signed: true })}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* X axis */}
        <div className="flex mt-1.5">
          {months.map((m) => (
            <span key={m.month} className="flex-1 text-center text-[10px] font-semibold text-[var(--text-muted)]">
              {monthShort(m.month)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MonthTable({ months, totals }: { months: CorePortfolioMonth[]; totals: CorePortfolioTotals }) {
  return (
    <div className="overflow-x-auto">
      <table className="portfolio-table w-full text-[12px] tabular-nums">
        <thead>
          <tr>
            <th className="text-left">Month</th>
            <th className="text-right">Income</th>
            <th className="text-right">Expenses</th>
            <th className="text-right">Net</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.month}>
              <td>{monthLong(m.month)}</td>
              <td className="text-right">{tableAmount(m.income)}</td>
              <td className="text-right">{tableAmount(m.expenses)}</td>
              <td className={`text-right ${m.netResult < 0 ? "text-[var(--danger)]" : ""}`}>
                {tableAmount(m.netResult, { signed: true })}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className="text-right">{tableAmount(totals.income)}</td>
            <td className="text-right">{tableAmount(totals.expenses)}</td>
            <td className={`text-right ${totals.cashFlow < 0 ? "text-[var(--danger)]" : ""}`}>
              {tableAmount(totals.cashFlow, { signed: true })}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function PortfolioMonthlyChart({
  months,
  totals,
  periodLabel,
}: {
  months: CorePortfolioMonth[];
  totals: CorePortfolioTotals;
  periodLabel: string;
}) {
  const [view, setView] = useState<"graph" | "table">("graph");

  return (
    <section className="portfolio-section">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Cash Flow · Income vs Expenses</h2>
          <Legend />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold text-[var(--text-muted)]">Monthly, {periodLabel}</span>
          <div className="print-hide inline-flex rounded-lg border border-[var(--border)] p-0.5" role="group" aria-label="Chart view">
            {(["graph", "table"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold capitalize cursor-pointer ${
                  view === v
                    ? "bg-[var(--brand)] text-white"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={view === "graph" ? "" : "portfolio-print-only"}>
        <Bars months={months} />
      </div>
      <div className={view === "table" ? "mt-1" : "portfolio-print-only mt-4"}>
        <MonthTable months={months} totals={totals} />
      </div>

      {totals.depreciation > 0 && (
        <div className="mt-3 text-[11px] text-[var(--text-muted)]">
          Excludes depreciation of {heroAmount(totals.depreciation)} for the year, which is claimed annually rather than by month.
        </div>
      )}
    </section>
  );
}
