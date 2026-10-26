import {
  currentFinancialYear,
  fyLongLabel,
  monthKey,
  monthShortLabel,
  shiftMonth,
} from "@/app/components/clients/portfolioDashboard";

/**
 * The Insights page's period filters, as pure date arithmetic.
 *
 * Every selection resolves to an exact window that is sent to the Portfolio
 * Summary as ?from=&to= — the page used to load two financial years once and
 * re-slice their months in the browser, so the pills made no request and a
 * day-precise range was impossible. Dates are local calendar dates as
 * YYYY-MM-DD, the only format the API takes.
 */

export type InsightsSelection =
  | { kind: "fy-to-date" }
  | { kind: "quarter" }
  | { kind: "month" }
  | { kind: "fy"; fy: number }
  | { kind: "custom"; from: string; to: string };

export type DateWindow = { from: string; to: string };

export type InsightsPeriod = {
  /** Exactly what every total, the breakdown and Top Performing cover. */
  window: DateWindow;
  label: string;
  /** What the Net Cash Flow badge compares the window with. */
  comparison: DateWindow;
  comparisonLabel: string;
  /**
   * What the two monthly charts plot: the window's own months, or — when the
   * window covers fewer than six — the six whole months ending with it, so a
   * month or a fortnight still has a shape. `chartIsContext` says which.
   */
  chartWindow: DateWindow;
  chartMonths: string[];
  chartIsContext: boolean;
  chartLabel: string;
  /** The forecast only makes sense looking forward from a current period. */
  includesCurrentMonth: boolean;
};

/** The custom-range limit; the API enforces the same (portfolioMaxCustomMonths). */
export const MAX_CUSTOM_RANGE_MONTHS = 24;
const MIN_CHART_MONTHS = 6;

export function toIsoDate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/** A strict YYYY-MM-DD as a local date, or null. */
export function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

const lastDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

/** The same calendar date `years` earlier; 29 Feb becomes 28 Feb. */
function shiftYears(date: Date, years: number): Date {
  const target = new Date(date.getFullYear() + years, date.getMonth(), 1);
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDayOfMonth(target).getDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function daysInclusive(from: Date, to: Date): number {
  const utc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((utc(to) - utc(from)) / 86_400_000) + 1;
}

/** "YYYY-MM" keys from the month of `from` to the month of `to`, inclusive. */
export function monthKeysCovering(window: DateWindow): string[] {
  const from = parseIsoDate(window.from);
  const to = parseIsoDate(window.to);
  if (!from || !to || to < from) return [];
  const keys: string[] = [];
  const last = new Date(to.getFullYear(), to.getMonth(), 1);
  for (let m = new Date(from.getFullYear(), from.getMonth(), 1); m <= last; m = shiftMonth(m, 1)) {
    keys.push(monthKey(m));
  }
  return keys;
}

function formatDay(date: Date): string {
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function monthYearLabel(key: string): string {
  return `${monthShortLabel(key)} ${key.slice(0, 4)}`;
}

/**
 * The browser-side twin of the API's check, so a bad range is explained
 * before any request rather than surfacing as a failed card.
 */
export function validateCustomRange(from: string, to: string): string | null {
  if (!from || !to) return "Choose both a start and an end date.";
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (!start || !end) return "Enter valid dates.";
  if (end < start) return "The end date must not be before the start date.";
  const limit = new Date(start.getFullYear(), start.getMonth() + MAX_CUSTOM_RANGE_MONTHS, start.getDate());
  if (end >= limit) return `Choose a range of ${MAX_CUSTOM_RANGE_MONTHS} months or less.`;
  return null;
}

export function resolveInsightsPeriod(selection: InsightsSelection, now: Date): InsightsPeriod {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let from: Date;
  let to: Date;
  let prevFrom: Date;
  let prevTo: Date;
  let label: string;
  let comparisonLabel: string;

  switch (selection.kind) {
    case "month": {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = lastDayOfMonth(from);
      prevFrom = shiftMonth(from, -1);
      prevTo = lastDayOfMonth(prevFrom);
      label = "This month";
      comparisonLabel = "vs last month";
      break;
    }
    case "quarter": {
      // Calendar quarters line up with FY quarters (Jul, Oct, Jan, Apr).
      from = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
      to = lastDayOfMonth(shiftMonth(from, 2));
      prevFrom = shiftMonth(from, -3);
      prevTo = addDays(from, -1);
      label = "This quarter";
      comparisonLabel = "vs last quarter";
      break;
    }
    case "fy": {
      from = new Date(selection.fy - 1, 6, 1);
      to = new Date(selection.fy, 5, 30);
      prevFrom = new Date(selection.fy - 2, 6, 1);
      prevTo = new Date(selection.fy - 1, 5, 30);
      label = fyLongLabel(selection.fy);
      comparisonLabel = `vs ${fyLongLabel(selection.fy - 1)}`;
      break;
    }
    case "custom": {
      const start = parseIsoDate(selection.from);
      const end = parseIsoDate(selection.to);
      if (start && end && end >= start) {
        from = start;
        to = end;
        // The same number of days, ending the day before the window starts.
        prevTo = addDays(from, -1);
        prevFrom = addDays(prevTo, -(daysInclusive(from, to) - 1));
        label = `${formatDay(from)} – ${formatDay(to)}`;
        comparisonLabel = "vs previous period";
        break;
      }
      // An invalid range never reaches here from the page (it validates
      // first); fall back to FY to date rather than send nonsense.
      return resolveInsightsPeriod({ kind: "fy-to-date" }, now);
    }
    default: {
      // FY to date: 1 July to today, against the same dates a year earlier.
      const fy = currentFinancialYear(today);
      from = new Date(fy - 1, 6, 1);
      to = today;
      prevFrom = shiftYears(from, -1);
      prevTo = shiftYears(to, -1);
      label = `${fyLongLabel(fy)} to date`;
      comparisonLabel = "vs same period last year";
    }
  }

  const window = { from: toIsoDate(from), to: toIsoDate(to) };
  const windowMonths = monthKeysCovering(window);

  let chartWindow = window;
  let chartMonths = windowMonths;
  let chartIsContext = false;
  let chartLabel = label;
  if (windowMonths.length < MIN_CHART_MONTHS) {
    // Six months that have happened: a window running past today (This
    // quarter, this month) ends its context at the current month rather
    // than plotting empty months to come.
    const endRef = to > today && from <= today ? today : to;
    const endMonth = new Date(endRef.getFullYear(), endRef.getMonth(), 1);
    const startMonth = shiftMonth(endMonth, -(MIN_CHART_MONTHS - 1));
    chartWindow = { from: toIsoDate(startMonth), to: toIsoDate(lastDayOfMonth(endMonth)) };
    chartMonths = monthKeysCovering(chartWindow);
    chartIsContext = true;
    chartLabel = `6 months to ${monthYearLabel(monthKey(endMonth))}`;
  }

  const thisMonth = monthKey(today);
  return {
    window,
    label,
    comparison: { from: toIsoDate(prevFrom), to: toIsoDate(prevTo) },
    comparisonLabel,
    chartWindow,
    chartMonths,
    chartIsContext,
    chartLabel,
    includesCurrentMonth: windowMonths.includes(thisMonth),
  };
}
