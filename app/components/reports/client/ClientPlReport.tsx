"use client";

import { useEffect } from "react";
import type { CorePortfolioSummary } from "@/src/lib/coreApi";
import { fyLongLabel, fyMonthKeys } from "@/app/components/clients/portfolioDashboard";
import { categoryLabel } from "@/app/components/reports/portfolio/portfolioFormat";
import { usePortfolioSummary } from "@/app/components/usePortfolioSummary";
import ReportDocument from "./ReportDocument";
import {
  Bars,
  Explain,
  Kpi,
  Kpis,
  MonthlyChart,
  Note,
  Pill,
  ReportProblem,
  ReportSkeleton,
  ReportTable,
  Section,
  Signed,
} from "./reportParts";
import { compact, money, pct, titleWord, tone } from "./reportFormat";
import type { ReportContext } from "./reportScope";

/**
 * Profit & Loss: money in, money out and the result, for one financial year
 * at client, entity or property scope.
 *
 * Every figure is the Portfolio Summary aggregate (GET /clients/{id}/
 * portfolio-summary) — the same numbers as the Reports page's Portfolio
 * Summary and the home dashboard: gross amounts, each property's share of a
 * split bill, transactions awaiting review left out (and counted in the
 * header). Depreciation is a separate report; loan principal is not recorded,
 * so the fourth card shows loan interest instead.
 */
export default function ClientPlReport({
  ctx,
  onReady,
}: {
  ctx: ReportContext;
  onReady: (ready: boolean) => void;
}) {
  const { scope, level } = ctx;
  // A property scope sends only the property; the server derives its entity.
  const entityArg = level === "entity" ? scope.entityId : null;
  const propertyArg = level === "property" ? scope.propertyId : null;
  const current = usePortfolioSummary(ctx.clientId, scope.fy, entityArg, propertyArg);
  const prior = usePortfolioSummary(ctx.clientId, scope.fy - 1, entityArg, propertyArg);

  const ready = current.status === "ready" && current.data != null;
  useEffect(() => {
    onReady(ready);
  }, [ready, onReady]);

  if (current.status === "error") {
    return <ReportProblem message={current.error ?? "This report could not be loaded."} onRetry={current.reload} />;
  }
  if (!current.data) return <ReportSkeleton />;

  const summary = current.data;
  // The prior year only feeds the "Up/Down on last year" lines; it is shown
  // when it loaded and had any activity, and silently left out otherwise.
  const prev =
    prior.status === "ready" && prior.data && prior.data.totals.transactionCount > 0 ? prior.data : null;

  return (
    <ReportDocument
      reportKey="pl"
      title="Profit & Loss"
      ctx={ctx}
      ready={ready}
      pills={
        summary.excludedUnreviewedCount > 0 ? (
          <Pill tone="amber" title="Left out of these figures until your accountant reviews them">
            {summary.excludedUnreviewedCount} to be reviewed (excluded)
          </Pill>
        ) : null
      }
    >
      <PlBody ctx={ctx} summary={summary} prev={prev} />
    </ReportDocument>
  );
}

function PlBody({
  ctx,
  summary,
  prev,
}: {
  ctx: ReportContext;
  summary: CorePortfolioSummary;
  prev: CorePortfolioSummary | null;
}) {
  const fy = ctx.scope.fy;
  const { totals } = summary;
  const income = totals.income;
  const expenses = totals.expenses;
  // Before depreciation: that is the Depreciation report's job.
  const net = income - expenses;
  const count = ctx.properties.length;
  const many = count !== 1;

  const delta = (cur: number, before: number | undefined) => {
    if (before == null) return undefined;
    const change = Math.round(cur - before);
    if (change === 0) return `Same as ${fyLongLabel(fy - 1)}`;
    return `${change > 0 ? "Up" : "Down"} ${money(Math.abs(change))} on ${fyLongLabel(fy - 1)}`;
  };

  // Months keyed by "YYYY-MM", so a sparse or reordered list still lands in
  // the right column.
  const byMonth = new Map(summary.months.map((m) => [m.month, m]));
  const monthKeys = fyMonthKeys(fy);
  const monthIncome = monthKeys.map((k) => byMonth.get(k)?.income ?? 0);
  const monthExpenses = monthKeys.map((k) => byMonth.get(k)?.expenses ?? 0);

  const incomeRows = summary.incomeByCategory
    .filter((c) => c.amount !== 0)
    .map((c) => ({ key: `i${c.categoryId}`, label: categoryLabel(c.categoryName, c.isInterest), value: c.amount }))
    .sort((a, b) => b.value - a.value);
  const expenseRows = summary.expensesByCategory
    .filter((c) => c.amount !== 0)
    .map((c) => ({ key: `e${c.categoryId}`, label: categoryLabel(c.categoryName, c.isInterest), value: c.amount }))
    .sort((a, b) => b.value - a.value);
  const top = expenseRows[0];

  const noActivity = totals.transactionCount === 0 && income === 0 && expenses === 0;
  const subject = many ? "properties" : "property";
  const pronoun = many ? "they" : "it";
  const verdict = noActivity
    ? "No income or expenses have been recorded for this year yet."
    : net < 0
      ? (
          <>
            Your {subject} cost <b>{money(-net)}</b> more to hold than {pronoun} earned this year. That&apos;s about{" "}
            <b>{money(-net / 12)} a month</b> from your own pocket.
          </>
        )
      : (
          <>
            Your {subject} earned <b>{money(net)}</b> more than {pronoun} cost this year, about{" "}
            <b>{money(net / 12)} a month</b>.
          </>
        );

  const showProperties = ctx.level !== "property" && summary.properties.length > 1;
  const showEntities = ctx.level === "client" && summary.entities.length > 1;
  const entityType = (id: string) => titleWord(ctx.holdings.find((e) => e.id === id)?.entityType ?? "");

  return (
    <>
      <Section bare>
        <Kpis>
          <Kpi label="Income (FY)" value={compact(income)} sub={delta(income, prev?.totals.income)} toneClass="cp-pos" />
          <Kpi
            label="Expenses (FY)"
            value={compact(expenses)}
            sub={delta(expenses, prev?.totals.expenses)}
            toneClass="cp-neg"
          />
          <Kpi
            label={net < 0 ? "Net loss (FY)" : "Net profit (FY)"}
            value={compact(net)}
            sub="Income − Expenses, before depreciation"
            toneClass={tone(net)}
          />
          <Kpi label="Loan interest (FY)" value={compact(totals.interest)} sub="Already counted in expenses" />
        </Kpis>
        <Explain>
          <b>In short:</b> {verdict}
          {top && !noActivity ? (
            <>
              {" "}
              The biggest cost was {top.label.toLowerCase()} ({pct(top.value, expenses).toFixed(0)}% of everything you
              spent).
            </>
          ) : null}
        </Explain>
      </Section>

      <MonthlyChart income={monthIncome} expenses={monthExpenses} periodLabel={fyLongLabel(fy)} />

      <Section title="Income by category" aside={money(income)}>
        {incomeRows.length ? <Bars rows={incomeRows} total={income} /> : <Note>No income recorded this year.</Note>}
      </Section>

      <Section title="Expenses by category" aside={money(expenses)}>
        {expenseRows.length ? (
          <Bars rows={expenseRows} total={expenses} variant="exp" />
        ) : (
          <Note>No expenses recorded this year.</Note>
        )}
      </Section>

      {showProperties ? (
        <Section title="By property" aside="Each property in full">
          <ReportTable
            columns={[
              { key: "p", label: "Property", text: "Property" },
              { key: "i", label: "Income", text: "Income", numeric: true },
              { key: "e", label: "Expenses", text: "Expenses", numeric: true },
              { key: "n", label: "Net", text: "Net", numeric: true },
            ]}
            rows={[
              ...summary.properties.map((p) => ({
                key: p.propertyId,
                cells: [
                  <>
                    {p.name}
                    {ctx.level === "client" ? <small>{p.entityName}</small> : null}
                  </>,
                  money(p.income),
                  money(p.expenses),
                  <Signed key="n" value={p.income - p.expenses} />,
                ],
              })),
              {
                key: "total",
                total: true,
                cells: ["Total", money(income), money(expenses), <Signed key="n" value={net} />],
              },
            ]}
          />
        </Section>
      ) : null}

      {showEntities ? (
        <Section title="By entity" aside="Each entity's properties">
          <ReportTable
            columns={[
              { key: "o", label: "Entity", text: "Entity" },
              { key: "i", label: "Income", text: "Income", numeric: true },
              { key: "e", label: "Expenses", text: "Expenses", numeric: true },
              { key: "n", label: "Net", text: "Net", numeric: true },
            ]}
            rows={summary.entities.map((e) => ({
              key: e.entityId,
              cells: [
                <>
                  {e.name}
                  {entityType(e.entityId) ? <small>{entityType(e.entityId)}</small> : null}
                </>,
                money(e.income),
                money(e.expenses),
                <Signed key="n" value={e.income - e.expenses} />,
              ],
            }))}
          />
        </Section>
      ) : null}

      <Section bare>
        <Note>
          This report shows money that came in and went out. It doesn&apos;t include depreciation, which is a tax
          deduction rather than a payment (see your Depreciation report), or loan principal, which reduces your loan
          instead of being a cost.
        </Note>
        <Note>
          Amounts include GST where it was charged. GST is covered in your GST report. Figures are by invoice date.
        </Note>
      </Section>
    </>
  );
}
