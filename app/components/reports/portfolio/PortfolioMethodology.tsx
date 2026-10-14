import type { CorePortfolioSummary } from "@/src/lib/coreApi";
import { longDate } from "./portfolioFormat";
import type { ReportScopeLevel } from "./reportScope";

/**
 * The statement's footer: what the balance-sheet figures are (and are not),
 * when it was generated, and how every figure on the page is calculated.
 *
 * The formulas describe what GET /clients/{id}/portfolio-summary actually
 * computes — keep them in step with portfolio_summary.go if that changes.
 */

type Formula = {
  item: string;
  formula: string;
  source: string;
  /** Scopes the row applies to; omitted = every scope. */
  scopes?: ReportScopeLevel[];
  /** Wording for a one-property report, where "per property" reads oddly. */
  propertyFormula?: string;
};

const FORMULAS: Formula[] = [
  {
    item: "Net Market Value",
    formula: "Σ the latest recorded market value of each property. Properties with no recorded value are left out and counted.",
    source: "properties",
  },
  {
    item: "Current Loan Balance",
    formula: "Σ the loan amount recorded on each property × the share allocated to that property. The latest recorded figure — no balance history is kept.",
    source: "property loan details",
  },
  { item: "Net Equity", formula: "Net Market Value − Current Loan Balance.", source: "derived" },
  {
    item: "Repayments",
    formula: "Σ expenses in the loan-interest category (account 5050) in the period. Principal repayments are not recorded yet, so Principal shows —.",
    source: "transactions",
  },
  {
    item: "Income",
    formula: "Σ income transactions in the period, grouped by category.",
    source: "transactions",
  },
  {
    item: "Expenses",
    formula: "Σ expense transactions in the period, grouped by category. Asset purchases are not expensed — they are depreciated.",
    source: "transactions",
  },
  {
    item: "Depreciation",
    formula: "Σ this year's claim from each asset's depreciation schedule: capital works (Div 43) and plant & equipment (Div 40).",
    source: "depreciation schedules",
  },
  { item: "Cash Flow", formula: "Income − Expenses, before depreciation.", source: "derived" },
  {
    item: "Net Income / Net Loss",
    formula: "Per property: Income − Expenses − Depreciation. Above zero is in profit, below zero at a loss — the same Net Profit as the property's P&L statement.",
    propertyFormula: "Income − Expenses − Depreciation. Above zero is Net Income, below zero Net Loss — the same Net Profit as this property's P&L statement.",
    source: "derived",
  },
  { item: "Cash Flow chart", formula: "Income and Expenses grouped by invoice month.", source: "transactions" },
  {
    item: "By Entity",
    formula: "The sum of the entity's properties at 100%. Each property belongs to one entity, so the rows add up to the total.",
    source: "derived",
    scopes: ["client"],
  },
  {
    item: "By Property",
    formula: "Income, Expenses and Depreciation allocated to each property, at 100%.",
    source: "transactions",
    scopes: ["client", "entity"],
  },
  { item: "Loan vs Value", formula: "Loan ÷ Value (LVR) and Equity ÷ Value.", source: "derived" },
  {
    item: "To be reviewed",
    formula: "Transactions waiting for your accountant's review are left out of every figure until they are reviewed.",
    source: "transactions",
  },
];

export default function PortfolioMethodology({
  summary,
  level = "client",
  collapsible = false,
}: {
  summary: CorePortfolioSummary;
  level?: ReportScopeLevel;
  /** Fold the formula table into a disclosure (the in-page Reporting tab). */
  collapsible?: boolean;
}) {
  const generated = summary.generatedAt ? longDate(summary.generatedAt.slice(0, 10)) : "";
  const formulas = FORMULAS.filter((f) => !f.scopes || f.scopes.includes(level));

  const table = (
    <div className="overflow-x-auto" role="region" tabIndex={0} aria-label="How each figure is calculated">
      <table className="portfolio-table w-full min-w-[560px] text-[12px]">
        <thead>
          <tr>
            <th className="text-left w-[22%]">Item</th>
            <th className="text-left">Formula</th>
            <th className="text-left w-[18%]">Source</th>
          </tr>
        </thead>
        <tbody>
          {formulas.map((f) => (
            <tr key={f.item}>
              <td className="font-semibold align-top">{f.item}</td>
              <td className="text-[var(--text-secondary)] align-top">
                {level === "property" && f.propertyFormula ? f.propertyFormula : f.formula}
              </td>
              <td className="text-[var(--text-muted)] align-top">{f.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <footer className="flex flex-col gap-4">
      <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">
        Market values and loans are the latest recorded on each property, not values as at{" "}
        {longDate(summary.period.to)}. Amounts include GST and are dated by invoice date. Estimates, not financial
        advice.{generated && ` Generated ${generated}.`}
      </div>

      {collapsible ? (
        <details className="portfolio-section portfolio-methodology">
          <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
            How each figure is calculated
          </summary>
          <div className="mt-3">{table}</div>
        </details>
      ) : (
        <section className="portfolio-section portfolio-methodology">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--accent)] mb-3">
            How each figure is calculated
          </h2>
          {table}
        </section>
      )}
    </footer>
  );
}
