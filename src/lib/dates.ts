/**
 * The one date format for the portal: `10 Sep 2026`.
 *
 * A fixed month table rather than `Intl.DateTimeFormat("en-AU")`, which prints
 * "Sept" for September in current ICU data and allocates a formatter per call.
 * Local-time getters, so a timestamp reads as the day the user saw it happen.
 */
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  // A bare YYYY-MM-DD parses as UTC midnight in JS, which local getters would
  // shift back a day west of Greenwich. Build it as a local date instead.
  const dateOnly = DATE_ONLY.exec(value.trim());
  if (dateOnly) {
    return new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
    );
  }
  return new Date(value);
}

export function formatDateAU(
  value: string | Date | null | undefined,
  fallback = "—",
): string {
  if (value == null || value === "") return fallback;
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}
