import { MINUS, DASH, heroAmount } from "@/app/components/reports/portfolio/portfolioFormat";

/**
 * Number and date formatting for the client reports (P&L, Depreciation, GST).
 *
 * Amounts print as the mockup does: "A$ 1,234", "A$ −1,234" with a real
 * minus sign, "+" only where a signed column asks for it. KPI cards use the
 * portal's compact form ("A$ 121.2K"), shared with the Portfolio Summary.
 */

export { MINUS, DASH };

/** Whole dollars: "A$ 54,600", "A$ −3,824", "A$ +708" when `sign`. */
export function money(value: number | null | undefined, opts: { sign?: boolean } = {}): string {
  if (value == null || Number.isNaN(value)) return DASH;
  const rounded = Math.round(value);
  const digits = Math.abs(rounded).toLocaleString("en-AU");
  const prefix = rounded < 0 ? MINUS : opts.sign && rounded > 0 ? "+" : "";
  return `A$ ${prefix}${digits}`;
}

/** Dollars and cents, for GST: "A$ 1,234.56". */
export function cents(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return DASH;
  const abs = Math.abs(value).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `A$ ${value < 0 ? MINUS : ""}${abs}`;
}

/** KPI-card amount: "A$ 121.2K", "A$ 1.3M". */
export function compact(value: number | null | undefined): string {
  return heroAmount(value);
}

/** a as a percentage of b; 0 when b is 0. */
export function pct(a: number, b: number): number {
  return b ? (a / b) * 100 : 0;
}

/** The tone class for a signed result. */
export function tone(value: number): string {
  return value < 0 ? "cp-neg" : value > 0 ? "cp-pos" : "";
}

/** Financial-year months in order, July first. */
export const FY_MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];

/** "FY 2025-26" — the short form used in pickers and chips. */
export function fyOption(financialYear: number): string {
  return `FY ${financialYear - 1}-${String(financialYear).slice(-2)}`;
}

/**
 * BAS quarter `q` (1-4) of financial year `fy` (end-year): "Jul – Sep 2025".
 */
export function quarterLabel(fy: number, q: number): string {
  switch (q) {
    case 1:
      return `Jul – Sep ${fy - 1}`;
    case 2:
      return `Oct – Dec ${fy - 1}`;
    case 3:
      return `Jan – Mar ${fy}`;
    default:
      return `Apr – Jun ${fy}`;
  }
}

/**
 * The standard quarterly BAS due date. A tax agent's lodgement program can
 * push these later, which the report says next to the table.
 */
export function quarterDue(fy: number, q: number): string {
  switch (q) {
    case 1:
      return `28 Oct ${fy - 1}`;
    case 2:
      return `28 Feb ${fy}`;
    case 3:
      return `28 Apr ${fy}`;
    default:
      return `28 Jul ${fy}`;
  }
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2021-03-22" → "Mar 2021". Parsed by hand so no timezone moves the month. */
export function monthYear(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(isoDate ?? "");
  if (!match) return isoDate ?? "";
  return `${MONTH_NAMES[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

/** Today as "18 Oct 2026". */
export function todayLabel(now: Date = new Date()): string {
  return `${now.getDate()} ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
}

/** "FY 2025–26" for a depreciation `fy_start_year` (2025). */
export function fyFromStartYear(startYear: number): string {
  return `FY ${startYear}–${String(startYear + 1).slice(-2)}`;
}

/** Effective life: "8 yrs", "2.5 yrs". */
export function lifeLabel(years: number): string {
  const rounded = Math.round(years * 100) / 100;
  return `${rounded.toLocaleString("en-AU")} ${rounded === 1 ? "yr" : "yrs"}`;
}

/** "residential" → "Residential", "vacant_land" → "Vacant land". */
export function titleWord(value: string): string {
  const spaced = (value ?? "").replace(/_/g, " ").trim();
  return spaced ? spaced[0].toUpperCase() + spaced.slice(1) : "";
}
