"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import FinancialYearPicker from "@/app/components/ui/FinancialYearPicker";
import { RegionError } from "@/app/components/ui/RegionError";
import type { AsyncRegion } from "@/app/components/useAsyncRegion";
import type {
  CorePortfolioCategoryLine,
  CorePortfolioPropertyRow,
  CorePortfolioSummary,
} from "@/src/lib/coreApi";
import PortfolioMonthlyChart from "./PortfolioMonthlyChart";
import PortfolioMethodology from "./PortfolioMethodology";
import {
  DASH,
  categoryLabel,
  fyText,
  heroAmount,
  longDate,
  percent,
  plural,
  shortAmount,
  tableAmount,
} from "./portfolioFormat";

/**
 * The client portal's Portfolio Summary: the dashboard's detailed view frozen
 * for one financial year and printable as a statement.
 *
 * Purely presentational over GET /clients/{id}/portfolio-summary. Every total
 * on the page — hero cards, table footers, category subtotals — is the
 * server's footed figure; nothing here re-sums rows, so a hidden or truncated
 * row can never change a bottom line.
 */

export type PortfolioSummaryReportProps = {
  region: AsyncRegion<CorePortfolioSummary>;
  financialYear: number;
  onFinancialYearChange: (year: number) => void;
  /** Years for the picker, newest first. */
  yearOptions: number[];
};

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function ReportHeader({
  summary,
  financialYear,
  onFinancialYearChange,
  yearOptions,
}: {
  summary: CorePortfolioSummary | null;
  financialYear: number;
  onFinancialYearChange: (year: number) => void;
  yearOptions: number[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!pickerOpen) return;
    const close = () => setPickerOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [pickerOpen]);

  const excluded = summary?.excludedUnreviewedCount ?? 0;

  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Clear Portfolio · Client Portal · Reports
          </span>
          <h1 className="text-[26px] leading-tight font-bold text-[var(--text-primary)]">Portfolio Summary</h1>
        </div>
        <div className="print-hide flex items-center gap-2">
          <FinancialYearPicker
            value={financialYear}
            onChange={onFinancialYearChange}
            isOpen={pickerOpen}
            setIsOpen={setPickerOpen}
            years={yearOptions}
          />
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!summary}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[var(--brand)] text-white text-[13px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z" />
            </svg>
            Print
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-[var(--border)] bg-[var(--surface-1)] px-4 py-3">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Portfolio summary</span>
          <span className="text-[15px] font-bold text-[var(--text-primary)]">
            {summary ? `${summary.scope.name || "Your portfolio"} · All entities` : DASH}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {summary && (
            <span className="rounded-full bg-[var(--surface-0)] border border-[var(--border)] px-3 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
              {fyText(summary.period.label)} · {longDate(summary.period.from)} – {longDate(summary.period.to)}
            </span>
          )}
          {excluded > 0 && (
            <span
              className="portfolio-pill is-warn is-lg"
              title="Transactions waiting for your accountant's review are left out of every figure until they are reviewed."
            >
              {excluded} to be reviewed (excluded)
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Hero cards
// ---------------------------------------------------------------------------

function Card({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "good" | "bad";
}) {
  const color =
    tone === "good" ? "text-[var(--success)]" : tone === "bad" ? "text-[var(--danger)]" : "text-[var(--text-primary)]";
  return (
    <div className="portfolio-card flex flex-col gap-1 p-4 min-w-0">
      <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{label}</span>
      <strong className={`text-[20px] leading-tight font-bold tabular-nums ${color}`}>{value}</strong>
      {sub && <span className="text-[11px] text-[var(--text-muted)] leading-snug">{sub}</span>}
    </div>
  );
}

const signTone = (v: number) => (v > 0 ? "good" : v < 0 ? "bad" : "neutral");

function HeroCards({ summary }: { summary: CorePortfolioSummary }) {
  const t = summary.totals;
  const hasProperties = t.propertyCount > 0;
  const periodEnd = longDate(summary.period.to);

  return (
    <div className="flex flex-col gap-3">
      <div className="portfolio-card-row grid grid-cols-2 lg:grid-cols-4">
        <Card
          label="Net Equity"
          value={hasProperties ? heroAmount(t.netEquity) : DASH}
          sub="Latest recorded"
        />
        <Card
          label="Net Market Value"
          value={hasProperties ? heroAmount(t.marketValue) : DASH}
          sub={
            <>
              {plural(t.propertyCount, "property", "properties")}
              {t.propertiesMissingValue > 0 && ` · ${t.propertiesMissingValue} without a value`}
            </>
          }
        />
        <Card
          label="Current Loan Balance"
          value={hasProperties ? heroAmount(t.loanBalance) : DASH}
          sub={
            <>
              {plural(t.loanCount, "loan")}
              {t.loansUnparseable > 0 && ` · ${t.loansUnparseable} unreadable`}
            </>
          }
        />
        <Card
          label="Repayments (FY)"
          value={heroAmount(t.interest)}
          sub={`Interest ${shortAmount(t.interest)} · Principal ${t.principal == null ? DASH : shortAmount(t.principal)}`}
        />
      </div>

      <div className="portfolio-card-row grid grid-cols-2 lg:grid-cols-4">
        <Card label="Income (FY)" value={heroAmount(t.income)} tone="good" sub={plural(t.transactionCount, "transaction")} />
        <Card
          label="Expenses (FY)"
          value={heroAmount(t.expenses)}
          tone="bad"
          sub={t.depreciation > 0 ? `Plus ${heroAmount(t.depreciation)} depreciation` : "Before depreciation"}
        />
        <Card
          label="Cash Flow (FY)"
          value={heroAmount(t.cashFlow)}
          tone={signTone(t.cashFlow)}
          sub="Income − Expenses, before depreciation"
        />
        <Card
          label="Net Income / Net Loss"
          value={
            hasProperties ? (
              <span className="text-[16px]">
                <span className="text-[var(--success)]">{t.profitCount} in profit</span>
                <span className="text-[var(--text-muted)]"> · </span>
                <span className="text-[var(--danger)]">{t.lossCount} at a loss</span>
              </span>
            ) : (
              DASH
            )
          }
          sub={`Net ${tableAmount(t.netResult, { signed: true })} after depreciation, to ${periodEnd}`}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category tables
// ---------------------------------------------------------------------------

function CategoryTable({
  title,
  basis,
  lines,
  totalLabel,
  total,
  children,
  emptyText,
}: {
  title: string;
  basis: string;
  lines: CorePortfolioCategoryLine[];
  totalLabel: string;
  total: number;
  children?: ReactNode;
  emptyText: string;
}) {
  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h3 className="text-[14px] font-bold text-[var(--text-primary)]">{title}</h3>
        <span className="text-[11px] text-[var(--text-muted)]">{basis}</span>
      </div>
      <table className="portfolio-table w-full text-[12px] tabular-nums">
        <tbody>
          {lines.length === 0 && (
            <tr>
              <td colSpan={2} className="text-[var(--text-muted)]">{emptyText}</td>
            </tr>
          )}
          {lines.map((l) => (
            <tr key={l.categoryId}>
              <td>{categoryLabel(l.categoryName, l.isInterest)}</td>
              <td className="text-right">{tableAmount(l.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>{totalLabel}</td>
            <td className="text-right">{tableAmount(total)}</td>
          </tr>
          {children}
        </tfoot>
      </table>
    </div>
  );
}

function CategoryTables({ summary }: { summary: CorePortfolioSummary }) {
  const t = summary.totals;
  return (
    <section className="portfolio-section portfolio-two-col grid gap-6 md:grid-cols-2">
      <CategoryTable
        title="Income by category"
        basis="type = Income"
        lines={summary.incomeByCategory}
        totalLabel="Income"
        total={t.income}
        emptyText="No income recorded in this period."
      />
      <CategoryTable
        title="Expenses by category"
        basis="type = Expense"
        lines={summary.expensesByCategory}
        totalLabel="Expenses"
        total={t.expenses}
        emptyText="No expenses recorded in this period."
      >
        {summary.depreciationByKind.map((d) => (
          <tr key={d.kind} className="is-plain">
            <td>{d.label}</td>
            <td className="text-right">{tableAmount(d.amount)}</td>
          </tr>
        ))}
        {summary.depreciationByKind.length > 0 && (
          <tr>
            <td>Expenses incl. depreciation</td>
            <td className="text-right">{tableAmount(t.expensesAndDepreciation)}</td>
          </tr>
        )}
      </CategoryTable>
    </section>
  );
}

// ---------------------------------------------------------------------------
// By Entity / By Property
// ---------------------------------------------------------------------------

function NetCell({ value }: { value: number }) {
  const color = value > 0 ? "text-[var(--success)]" : value < 0 ? "text-[var(--danger)]" : "";
  return <td className={`text-right font-semibold ${color}`}>{tableAmount(value, { signed: true })}</td>;
}

function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 mb-2">
      <h2 className="text-[15px] font-bold text-[var(--text-primary)]">{title}</h2>
      {note && <span className="text-[11px] text-[var(--text-muted)]">{note}</span>}
    </div>
  );
}

function EntityTable({ summary }: { summary: CorePortfolioSummary }) {
  const t = summary.totals;
  return (
    <section className="portfolio-section">
      <SectionTitle title="By Entity" note="Each entity's properties at 100%" />
      <div className="overflow-x-auto">
        <table className="portfolio-table w-full min-w-[720px] text-[12px] tabular-nums">
          <thead>
            <tr>
              <th className="text-left">Entity</th>
              <th className="text-right">Properties</th>
              <th className="text-right">Value</th>
              <th className="text-right">Loan</th>
              <th className="text-right">Equity</th>
              <th className="text-right">Income</th>
              <th className="text-right">Expenses</th>
              <th className="text-right">Depreciation</th>
              <th className="text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {summary.entities.map((e) => (
              <tr key={e.entityId}>
                <td>
                  {e.name}
                  {!e.enabled && <span className="ml-2 text-[10px] font-semibold text-[var(--text-muted)]">Inactive</span>}
                </td>
                <td className="text-right">{e.propertyCount}</td>
                <td className="text-right">{e.propertyCount ? tableAmount(e.marketValue) : DASH}</td>
                <td className="text-right">{e.propertyCount ? tableAmount(e.loanBalance) : DASH}</td>
                <td className="text-right">{e.propertyCount ? tableAmount(e.equity) : DASH}</td>
                <td className="text-right">{tableAmount(e.income)}</td>
                <td className="text-right">{tableAmount(e.expenses)}</td>
                <td className="text-right">{tableAmount(e.depreciation)}</td>
                <NetCell value={e.netResult} />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="text-right">{t.propertyCount}</td>
              <td className="text-right">{tableAmount(t.marketValue)}</td>
              <td className="text-right">{tableAmount(t.loanBalance)}</td>
              <td className="text-right">{tableAmount(t.netEquity)}</td>
              <td className="text-right">{tableAmount(t.income)}</td>
              <td className="text-right">{tableAmount(t.expenses)}</td>
              <td className="text-right">{tableAmount(t.depreciation)}</td>
              <NetCell value={t.netResult} />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

const RESULT_BADGE: Record<CorePortfolioPropertyRow["result"], { label: string; cls: string }> = {
  net_income: { label: "Net Income", cls: "is-good" },
  net_loss: { label: "Net Loss", cls: "is-bad" },
  break_even: { label: "Break-even", cls: "is-neutral" },
  no_activity: { label: "No activity", cls: "is-neutral" },
};

function PropertyTable({ summary }: { summary: CorePortfolioSummary }) {
  const t = summary.totals;
  return (
    <section className="portfolio-section">
      <SectionTitle title="By Property" note="At 100%" />
      <div className="overflow-x-auto">
        <table className="portfolio-table w-full min-w-[780px] text-[12px] tabular-nums">
          <thead>
            <tr>
              <th className="text-left">Property</th>
              <th className="text-left">Entity</th>
              <th className="text-right">Value</th>
              <th className="text-right">Loan</th>
              <th className="text-right">Income</th>
              <th className="text-right">Expenses</th>
              <th className="text-right">Depreciation</th>
              <th className="text-right">Net</th>
              <th className="text-left">Result</th>
            </tr>
          </thead>
          <tbody>
            {summary.properties.map((p) => {
              const badge = RESULT_BADGE[p.result];
              return (
                <tr key={p.propertyId}>
                  <td>
                    {p.name}
                    {!p.enabled && <span className="ml-2 text-[10px] font-semibold text-[var(--text-muted)]">Inactive</span>}
                  </td>
                  <td className="text-[var(--text-secondary)]">{p.entityName}</td>
                  <td className="text-right">{tableAmount(p.marketValue)}</td>
                  <td
                    className="text-right"
                    title={p.loanStatus === "unparseable" ? "The loan recorded on this property could not be read" : undefined}
                  >
                    {tableAmount(p.loanBalance)}
                  </td>
                  <td className="text-right">{tableAmount(p.income)}</td>
                  <td className="text-right">{tableAmount(p.expenses)}</td>
                  <td className="text-right">{tableAmount(p.depreciation)}</td>
                  <NetCell value={p.netResult} />
                  <td>
                    <span className={`portfolio-pill ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td />
              <td className="text-right">{tableAmount(t.marketValue)}</td>
              <td className="text-right">{tableAmount(t.loanBalance)}</td>
              <td className="text-right">{tableAmount(t.income)}</td>
              <td className="text-right">{tableAmount(t.expenses)}</td>
              <td className="text-right">{tableAmount(t.depreciation)}</td>
              <NetCell value={t.netResult} />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {(t.propertiesMissingValue > 0 || t.loansUnparseable > 0) && (
        <div className="mt-2 text-[11px] text-[var(--text-muted)]">
          {t.propertiesMissingValue > 0 &&
            `${plural(t.propertiesMissingValue, "property has", "properties have")} no recorded market value and ${
              t.propertiesMissingValue === 1 ? "is" : "are"
            } left out of Value and Equity. `}
          {t.loansUnparseable > 0 &&
            `${plural(t.loansUnparseable, "loan")} could not be read and ${t.loansUnparseable === 1 ? "is" : "are"} left out of Loan.`}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Loan vs Value
// ---------------------------------------------------------------------------

function LoanVsValue({ summary }: { summary: CorePortfolioSummary }) {
  const t = summary.totals;
  const lvr = t.lvrPercent;
  const loanWidth = lvr == null ? 0 : Math.max(0, Math.min(100, lvr));

  return (
    <section className="portfolio-section">
      <SectionTitle
        title="Loan vs Value"
        note={lvr == null ? undefined : `${percent(lvr)} loan · ${percent(t.equityPercent)} equity`}
      />
      {lvr == null ? (
        <div className="text-[12px] text-[var(--text-muted)]">No market value is recorded, so there is no loan-to-value ratio to show.</div>
      ) : (
        <>
          <div
            className="flex h-3 w-full gap-[2px] rounded-full overflow-hidden"
            role="img"
            aria-label={`Loan ${percent(lvr)} of value, equity ${percent(t.equityPercent)}`}
          >
            {loanWidth > 0 && <div className="h-full bg-[var(--chart-income)]" style={{ width: `${loanWidth}%` }} />}
            {loanWidth < 100 && <div className="h-full flex-1 bg-[var(--chart-expense)]" />}
          </div>
          <div className="mt-2 flex items-center gap-4 text-[11px] font-semibold text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-[var(--chart-income)]" aria-hidden="true" />
              Loan {heroAmount(t.loanBalance)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-[var(--chart-expense)]" aria-hidden="true" />
              Equity {heroAmount(t.netEquity)}
            </span>
          </div>
          {lvr > 100 && (
            <div className="mt-2 text-[11px] text-[var(--danger)]">Recorded loans exceed the recorded market value.</div>
          )}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

function ReportSkeleton() {
  const block = "rounded-xl bg-[var(--surface-0)] animate-pulse";
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading report">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className={`${block} h-[92px]`} />
        ))}
      </div>
      <div className={`${block} h-64`} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className={`${block} h-48`} />
        <div className={`${block} h-48`} />
      </div>
      <div className={`${block} h-40`} />
    </div>
  );
}

function EmptyPortfolio() {
  return (
    <div className="portfolio-section text-center py-10">
      <h2 className="text-[15px] font-bold text-[var(--text-primary)]">No properties yet</h2>
      <div className="mt-1 text-[12px] text-[var(--text-secondary)]">
        Add an entity and a property to see your portfolio summary here.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export default function PortfolioSummaryReport({
  region,
  financialYear,
  onFinancialYearChange,
  yearOptions,
}: PortfolioSummaryReportProps) {
  const summary = region.status === "ready" ? region.data : null;
  // While a new year loads, keep the header's client name from the last good read.
  const headerSummary = region.data;

  return (
    <div className="portfolio-report flex flex-col gap-5">
      <ReportHeader
        summary={headerSummary}
        financialYear={financialYear}
        onFinancialYearChange={onFinancialYearChange}
        yearOptions={yearOptions}
      />

      {(region.status === "loading" || region.status === "idle") && <ReportSkeleton />}

      {region.status === "error" && (
        <RegionError message={region.error ?? "Couldn't load your portfolio summary."} onRetry={region.reload} />
      )}

      {summary && (
        <>
          <HeroCards summary={summary} />
          {summary.totals.propertyCount === 0 ? (
            <EmptyPortfolio />
          ) : (
            <>
              <PortfolioMonthlyChart
                months={summary.months}
                totals={summary.totals}
                periodLabel={fyText(summary.period.label)}
              />
              <CategoryTables summary={summary} />
              <EntityTable summary={summary} />
              <PropertyTable summary={summary} />
              <LoanVsValue summary={summary} />
            </>
          )}
          <PortfolioMethodology summary={summary} />
        </>
      )}
    </div>
  );
}
