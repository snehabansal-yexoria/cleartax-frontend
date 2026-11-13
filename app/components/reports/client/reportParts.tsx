"use client";

import { useState, type ReactNode } from "react";
import { FY_MONTHS, MINUS, money, pct, tone } from "./reportFormat";

/**
 * Building blocks shared by the client reports. Plain `cp-*` classes from
 * client.css (in `@layer components`), never `<p>`: globals.css carries an
 * unlayered `p` rule that beats every layered style.
 */

export function Kpis({ children }: { children: ReactNode }) {
  return <div className="cp-kpis">{children}</div>;
}

export function Kpi({
  label,
  value,
  sub,
  toneClass = "",
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  toneClass?: string;
}) {
  return (
    <div className="cp-kpi">
      <span className="cp-kpi-l">{label}</span>
      <span className={`cp-kpi-v ${toneClass}`}>{value}</span>
      {sub ? <span className="cp-kpi-s">{sub}</span> : null}
    </div>
  );
}

/** The amber "In short" box. */
export function Explain({ children }: { children: ReactNode }) {
  return (
    <div className="cp-explain">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8h.01M11 12h1v4h1" />
      </svg>
      <div>{children}</div>
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <div className="cp-note">{children}</div>;
}

export function Info({ children }: { children: ReactNode }) {
  return (
    <div className="cp-info">
      {/* An inline icon, not a ::before badge: html2canvas (Download PDF)
          draws a pseudo-element's text and radius unreliably. */}
      <svg viewBox="0 0 18 18" aria-hidden="true">
        <circle cx="9" cy="9" r="9" fill="currentColor" />
        <rect x="8" y="7.5" width="2" height="6" rx="1" fill="var(--cp-btn-ink)" />
        <circle cx="9" cy="5" r="1.2" fill="var(--cp-btn-ink)" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

export function Pill({
  tone: pillTone,
  title,
  children,
}: {
  tone?: "amber" | "green";
  title?: string;
  children: ReactNode;
}) {
  return (
    <span className={`cp-pill${pillTone ? ` cp-pill--${pillTone}` : ""}`} title={title}>
      {children}
    </span>
  );
}

/** A card section with a heading row. `bare` drops the card. */
export function Section({
  title,
  aside,
  bare = false,
  children,
}: {
  title?: string;
  aside?: ReactNode;
  bare?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`cp-sec${bare ? " cp-sec--bare" : ""}`}>
      {title ? (
        <div className="cp-sec-h">
          <h3>{title}</h3>
          {aside ? <span>{aside}</span> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export type BarRow = { key: string; label: string; value: number };

/**
 * Horizontal bars scaled to the largest row, with the amount and its share of
 * `total`. Refunds can make a category negative; the bar uses its size.
 */
export function Bars({
  rows,
  total,
  variant = "inc",
  showShare = true,
}: {
  rows: BarRow[];
  total: number;
  variant?: "inc" | "exp" | "proj";
  showShare?: boolean;
}) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <div className="cp-bars">
      {rows.map((r) => (
        <div className="cp-bar" key={r.key}>
          <span className="cp-bar-l">{r.label}</span>
          <div className="cp-bar-t" aria-hidden="true">
            <i className={`cp-bar-i--${variant}`} style={{ width: `${((Math.abs(r.value) / max) * 100).toFixed(1)}%` }} />
          </div>
          <span className="cp-bar-v">{money(r.value)}</span>
          <span className="cp-bar-p">{showShare ? `${pct(r.value, total).toFixed(1)}%` : ""}</span>
        </div>
      ))}
    </div>
  );
}

export type TableColumn = {
  key: string;
  /** Header content (may carry a <small> BAS label). */
  label: ReactNode;
  /** Plain-text label, used when a narrow table stacks into cards. */
  text: string;
  numeric?: boolean;
};

export type TableRow = { key: string; cells: ReactNode[]; total?: boolean };

/**
 * A table that turns into label/value cards when its container is narrow
 * (`stack`, the default), or scrolls sideways when it must keep its columns.
 */
export function ReportTable({
  columns,
  rows,
  stack = true,
  mini = false,
  caption,
}: {
  columns: TableColumn[];
  rows: TableRow[];
  stack?: boolean;
  mini?: boolean;
  caption?: string;
}) {
  const cls = `cp-t${stack ? " cp-stack" : ""}${mini ? " cp-t--mini" : ""}`;
  return (
    <div className={`cp-tw${stack ? "" : " cp-scroll"}`} {...(stack ? {} : { role: "region", tabIndex: 0, "aria-label": caption })}>
      <table className={cls}>
        {caption ? <caption className="cp-sr">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.numeric ? "n" : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={r.total ? "tot" : undefined}>
              {r.cells.map((cell, i) => (
                <td key={columns[i]?.key ?? i} className={columns[i]?.numeric ? "n" : undefined} data-label={columns[i]?.text}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A signed amount in its tone: green above zero, red below. */
export function Signed({ value }: { value: number }) {
  return <span className={tone(value)}>{money(value, { sign: true })}</span>;
}

/** One income or expense category, its amount for each month July first. */
export type CashFlowCategory = {
  key: string;
  label: string;
  type: "revenue" | "expense";
  months: number[];
};

/** A statement cell: "1,234.56", a dash for zero; `signed` adds + / − and colour. */
function StatementAmount({ value, signed = false }: { value: number; signed?: boolean }) {
  const rounded = Math.round(value * 100) / 100;
  if (rounded === 0) return <span className="cp-cf-zero">–</span>;
  const digits = Math.abs(rounded).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (!signed) return <>{rounded < 0 ? `${MINUS}${digits}` : digits}</>;
  return <span className={tone(rounded)}>{`${rounded < 0 ? MINUS : "+"}${digits}`}</span>;
}

/**
 * The Table view in full: months across, income and expense categories down,
 * each with its total, then Net (income − expenses) for every month. Laid out
 * like the statement an accountant keeps in a spreadsheet.
 */
function CashFlowStatement({
  categories,
  income,
  expenses,
  periodLabel,
}: {
  categories: CashFlowCategory[];
  income: number[];
  expenses: number[];
  periodLabel: string;
}) {
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const at = (xs: number[], i: number) => xs[i] ?? 0;
  const section = (type: CashFlowCategory["type"], totals: number[]) => {
    const rows = categories.filter((c) => c.type === type);
    // Anything the month totals hold that no category row explains (rounding,
    // an older backend) shows as "Other", so every column still adds up.
    const other = FY_MONTHS.map((_, i) => at(totals, i) - rows.reduce((a, r) => a + at(r.months, i), 0));
    if (other.some((v) => Math.abs(v) >= 0.005)) {
      rows.push({ key: `${type}-other`, label: "Other", type, months: other });
    }
    return rows;
  };
  const incomeRows = section("revenue", income);
  const expenseRows = section("expense", expenses);
  const net = FY_MONTHS.map((_, i) => at(income, i) - at(expenses, i));
  const cols = FY_MONTHS.length + 2;

  const line = (key: string, label: ReactNode, months: number[], cls?: string, signed = false) => (
    <tr key={key} className={cls}>
      <th scope="row">{label}</th>
      {FY_MONTHS.map((m, i) => (
        <td key={m} className="n">
          <StatementAmount value={at(months, i)} signed={signed} />
        </td>
      ))}
      <td className="n cp-cf-year">
        <StatementAmount value={sum(months)} signed={signed} />
      </td>
    </tr>
  );

  return (
    <div className="cp-tw cp-scroll" role="region" tabIndex={0} aria-label={`Cash flow by category and month, ${periodLabel}`}>
      <table className="cp-t cp-t--mini cp-cf">
        <caption className="cp-sr">Cash flow by category and month, {periodLabel}. Amounts in Australian dollars.</caption>
        <thead>
          <tr>
            <th scope="col">A$</th>
            {FY_MONTHS.map((m) => (
              <th key={m} scope="col" className="n">
                {m}
              </th>
            ))}
            <th scope="col" className="n cp-cf-year">
              Year
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="cp-cf-sec">
            <th scope="colgroup" colSpan={cols}>
              Income
            </th>
          </tr>
          {incomeRows.map((r) => line(r.key, r.label, r.months, "cp-cf-cat"))}
          {line("income-total", "Total income", income, "cp-cf-sub")}
          <tr className="cp-cf-sec">
            <th scope="colgroup" colSpan={cols}>
              Expenses
            </th>
          </tr>
          {expenseRows.map((r) => line(r.key, r.label, r.months, "cp-cf-cat"))}
          {line("expense-total", "Total expenses", expenses, "cp-cf-sub")}
          {line("net", "Net (income − expenses)", net, "tot cp-cf-net", true)}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Income vs expenses by month, July first, as bars or a table. Both views are
 * always in the DOM — the toggle only hides one — so a print or PDF shows the
 * two together. With `categories`, the table breaks each month down by
 * category (CashFlowStatement); without, it lists the month totals.
 */
export function MonthlyChart({
  income,
  expenses,
  periodLabel,
  categories,
}: {
  income: number[];
  expenses: number[];
  periodLabel: string;
  categories?: CashFlowCategory[];
}) {
  const [view, setView] = useState<"graph" | "table">("graph");
  const raw = Math.max(...income, ...expenses, 1);
  const step = Math.pow(10, Math.floor(Math.log10(raw)));
  const max = Math.ceil(raw / step) * step;
  const ticks = [0, max / 2, max];
  const tickLabel = (t: number) =>
    t >= 1000 ? `${(t / 1000).toLocaleString("en-AU", { maximumFractionDigits: 1 })}K` : String(t);
  const totalIncome = income.reduce((a, b) => a + b, 0);
  const totalExpenses = expenses.reduce((a, b) => a + b, 0);
  const net = totalIncome - totalExpenses;

  return (
    <section className="cp-sec" data-view={view}>
      <div className="cp-sec-h">
        <h3>Cash Flow · Income vs Expenses</h3>
        <div className="cp-sec-r">
          <span>Monthly, {periodLabel}</span>
          <div className="cp-seg" role="group" aria-label="View as">
            <button type="button" aria-pressed={view === "graph"} onClick={() => setView("graph")}>
              Graph
            </button>
            <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>
              Table
            </button>
          </div>
        </div>
      </div>
      <div className="cp-legend cp-v-graph" aria-hidden="true">
        <span>
          <b className="cp-legend-inc" />
          Income
        </span>
        <span>
          <b className="cp-legend-exp" />
          Expenses
        </span>
      </div>
      <div
        className="cp-graph cp-v-graph"
        role="img"
        aria-label={`Monthly income and expenses, ${periodLabel}. Income ${money(totalIncome)}, expenses ${money(totalExpenses)}. The table view lists each month.`}
      >
        <div className="cp-yax">
          {ticks.map((t) => (
            <span key={t} style={{ bottom: `${(t / max) * 100}%` }}>
              {tickLabel(t)}
            </span>
          ))}
        </div>
        <div className="cp-plot">
          {ticks.slice(1).map((t) => (
            <span key={t} className="cp-plot-g" style={{ bottom: `${(t / max) * 100}%` }} />
          ))}
          {FY_MONTHS.map((m, i) => (
            <div
              key={m}
              className="cp-plot-m"
              title={`${m}: income ${money(income[i] ?? 0)}, expenses ${money(expenses[i] ?? 0)}`}
            >
              <i className="cp-plot-in" style={{ height: `${((Math.max(income[i] ?? 0, 0) / max) * 100).toFixed(1)}%` }} />
              <i className="cp-plot-ex" style={{ height: `${((Math.max(expenses[i] ?? 0, 0) / max) * 100).toFixed(1)}%` }} />
            </div>
          ))}
        </div>
        <div className="cp-xax">
          {FY_MONTHS.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
      </div>
      <div className="cp-v-table">
        {categories && categories.length > 0 ? (
          <CashFlowStatement categories={categories} income={income} expenses={expenses} periodLabel={periodLabel} />
        ) : (
        <ReportTable
          stack={false}
          mini
          caption={`Income and expenses by month, ${periodLabel}`}
          columns={[
            { key: "m", label: "Month", text: "Month" },
            { key: "i", label: "Income", text: "Income", numeric: true },
            { key: "e", label: "Expenses", text: "Expenses", numeric: true },
            { key: "n", label: "Net", text: "Net", numeric: true },
          ]}
          rows={[
            ...FY_MONTHS.map((m, i) => ({
              key: m,
              cells: [
                m,
                money(income[i] ?? 0),
                money(expenses[i] ?? 0),
                <Signed key="n" value={(income[i] ?? 0) - (expenses[i] ?? 0)} />,
              ],
            })),
            {
              key: "year",
              total: true,
              cells: ["Year", money(totalIncome), money(totalExpenses), <Signed key="n" value={net} />],
            },
          ]}
        />
        )}
      </div>
      <Note>Excludes depreciation, which is claimed for the year rather than by month. See your Depreciation report.</Note>
    </section>
  );
}

/** Placeholder while a report loads. */
export function ReportSkeleton() {
  return (
    <div className="cp-doc" aria-busy="true" aria-label="Loading report">
      <div className="cp-box cp-skel cp-skel--head" />
      <div className="cp-skel cp-skel--kpis" />
      <div className="cp-box cp-skel cp-skel--block" />
      <div className="cp-box cp-skel cp-skel--block" />
    </div>
  );
}

/** The report could not be produced; the message says why. */
export function ReportProblem({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="cp-empty" role="alert">
      <div>{message}</div>
      {onRetry ? (
        <button type="button" className="cp-btn cp-btn--soft cp-empty-btn" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
