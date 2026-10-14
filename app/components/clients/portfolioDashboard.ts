import type {
  CorePortfolioMonth,
  CorePortfolioSummary,
} from "@/src/lib/coreApi";
import { auFinancialYearOf } from "@/app/components/useGstSummary";

/**
 * Pure helpers the client portal's pages use to read the Portfolio Summary
 * (GET /clients/{id}/portfolio-summary).
 *
 * Every money figure on the home, properties, entity and insights pages comes
 * from that one server aggregate — gross, at the property-split grain, with
 * unreviewed rows excluded — so these helpers only PICK and ARRANGE figures,
 * never re-sum transactions. Months are keyed "YYYY-MM"; financial years use
 * the end-year convention (2026 is FY 2025-26), as the endpoint does.
 */

/** The Australian financial year (end-year) today falls in. */
export function currentFinancialYear(now: Date = new Date()): number {
  return auFinancialYearOf(now);
}

/** "FY 25–26" */
export function fyShortLabel(financialYear: number): string {
  return `FY ${String(financialYear - 1).slice(-2)}–${String(financialYear).slice(-2)}`;
}

/** "FY 2025–26" */
export function fyLongLabel(financialYear: number): string {
  return `FY ${financialYear - 1}–${String(financialYear).slice(-2)}`;
}

/** "1 Jul 2025 – 30 Jun 2026" */
export function fyRangeLabel(financialYear: number): string {
  return `1 Jul ${financialYear - 1} – 30 Jun ${financialYear}`;
}

/** "YYYY-MM" for a local date. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** The month `offset` months from `date` (negative is earlier). */
export function shiftMonth(date: Date, offset: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

/** "Oct" for a "YYYY-MM" key. */
export function monthShortLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("en-AU", { month: "short" });
}

/**
 * Months from any number of summaries (typically this FY and last), keyed by
 * "YYYY-MM". Several summaries are needed whenever a window crosses 1 July.
 */
export function monthIndex(
  ...summaries: Array<CorePortfolioSummary | null | undefined>
): Map<string, CorePortfolioMonth> {
  const map = new Map<string, CorePortfolioMonth>();
  for (const summary of summaries) {
    for (const m of summary?.months ?? []) map.set(m.month, m);
  }
  return map;
}

const EMPTY_MONTH: CorePortfolioMonth = {
  month: "",
  income: 0,
  expenses: 0,
  interest: 0,
  netResult: 0,
};

/** The month for `key`, or zeros when no summary covers it. */
export function monthAt(
  index: Map<string, CorePortfolioMonth>,
  key: string,
): CorePortfolioMonth {
  return index.get(key) ?? { ...EMPTY_MONTH, month: key };
}

/**
 * Percentage change from `previous` to `current`, or null when there is no
 * honest number to show: either side is zero (a badge on an empty month
 * says nothing), or the inputs are not finite.
 */
export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (current === 0 || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
