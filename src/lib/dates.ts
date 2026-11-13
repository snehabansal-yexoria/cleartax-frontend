/**
 * The one date format for the portal: `DD/MM/YYYY` (13/11/2026), the
 * Australian day/month/year order with two-digit day and month.
 *
 * Built by hand rather than with `Intl.DateTimeFormat("en-AU")` so the output
 * never depends on the browser's ICU data and no formatter is allocated per
 * call. Local-time getters, so a timestamp reads as the day the user saw it
 * happen.
 *
 * Month-only labels (chart axes, "Nov 2026") are not dates and keep their own
 * formatting; anything that names a day uses `formatDateAU`.
 */
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})T00:00:00(?:\.0+)?Z?$/;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const trimmed = value.trim();
  // A bare YYYY-MM-DD (or a midnight-UTC timestamp, which is how the API sends
  // date-only columns) parses as UTC midnight in JS, which local getters would
  // shift back a day west of Greenwich. Build it as a local date instead.
  const dateOnly = DATE_ONLY.exec(trimmed) ?? DATE_PREFIX.exec(trimmed);
  if (dateOnly) {
    return new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
    );
  }
  return new Date(trimmed);
}

function parse(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `13/11/2026`. */
export function formatDateAU(
  value: string | Date | null | undefined,
  fallback = "—",
): string {
  const date = parse(value);
  if (!date) return fallback;
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** `13/11/2026, 2:05 pm`. */
export function formatDateTimeAU(
  value: string | Date | null | undefined,
  fallback = "—",
): string {
  const date = parse(value);
  if (!date) return fallback;
  return `${formatDateAU(date)}, ${formatTimeAU(date)}`;
}

/** `2:05 pm`. */
export function formatTimeAU(value: string | Date | null | undefined, fallback = "—"): string {
  const date = parse(value);
  if (!date) return fallback;
  const h = date.getHours();
  return `${h % 12 || 12}:${pad2(date.getMinutes())} ${h < 12 ? "am" : "pm"}`;
}

/** `13/11` — day and month only, for compact labels in the current year. */
export function formatDayMonthAU(value: string | Date | null | undefined, fallback = "—"): string {
  const date = parse(value);
  if (!date) return fallback;
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`;
}

/** `Nov 2026` — month labels (charts, periods); not a full date. */
export function formatMonthYearAU(value: string | Date | null | undefined, fallback = "—"): string {
  const date = parse(value);
  if (!date) return fallback;
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Display text for a raw API date: any ISO date or timestamp string becomes
 * `DD/MM/YYYY`; anything else (already formatted, a label like "Today") is
 * passed through unchanged.
 */
export function displayDateAU(value: string | null | undefined, fallback = "—"): string {
  if (value == null || value === "") return fallback;
  return /^\d{4}-\d{2}-\d{2}/.test(value.trim()) ? formatDateAU(value, fallback) : value;
}
