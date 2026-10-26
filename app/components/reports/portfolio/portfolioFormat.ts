import { formatClientCurrency } from "@/app/components/clients/CurrencyFormatter";

/**
 * Number formatting for the Portfolio Summary.
 *
 * One rule runs through all of it: `null` is "unknown" and prints "—", never a
 * confident 0 (the precedent `pnlReady` set on the property page). The server
 * sends null for a property with no recorded value, a loan that cannot be
 * read, an LVR with nothing to divide by, and principal (not recorded yet).
 */

/** U+2212, so a negative reads as a minus sign, not a hyphen. */
export const MINUS = "−";
export const DASH = "—";

/** Whole dollars, grouped: "1,420,000", "−3,824", "+708" when `signed`. */
export function tableAmount(
  value: number | null | undefined,
  opts: { signed?: boolean } = {},
): string {
  if (value == null || Number.isNaN(value)) return DASH;
  const rounded = Math.round(value);
  const digits = Math.abs(rounded).toLocaleString("en-AU");
  if (rounded < 0) return `${MINUS}${digits}`;
  if (opts.signed && rounded > 0) return `+${digits}`;
  return digits;
}

/** Compact hero figure: "A$ 1.36M", "A$ 128.0K", "A$ −14.3K". */
export function heroAmount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return DASH;
  return formatClientCurrency(value, { short: true }).replace("-", MINUS);
}

/** Compact amount without the currency prefix, for sub-lines: "105.1K". */
export function shortAmount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return DASH;
  return heroAmount(value).replace(/^A\$\s?/, "");
}

/** "55.5%". */
export function percent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return DASH;
  return `${value.toFixed(1)}%`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "2025-07-01" → "1 Jul 2025". Parsed by hand rather than through Date, so no
 * browser timezone can move 30 June to 29 June.
 */
export function longDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate ?? "");
  if (!match) return isoDate ?? "";
  const [, y, m, d] = match;
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

/** "2025-07" → "Jul". */
export function monthShort(monthKey: string): string {
  const m = Number((monthKey ?? "").slice(5, 7));
  return MONTHS[m - 1] ?? monthKey;
}

/** "2025-07" → "Jul 2025". */
export function monthLong(monthKey: string): string {
  return `${monthShort(monthKey)} ${(monthKey ?? "").slice(0, 4)}`;
}

/** "FY 2025-26" → "FY 2025–26" (en dash, as printed on a statement). */
export function fyText(label: string): string {
  return (label ?? "").replace(/(\d{4})-(\d{2})/, "$1–$2");
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** The seeded interest category is named "Interest on loans - TBD"; never print the placeholder. */
export function categoryLabel(name: string, isInterest: boolean): string {
  if (isInterest) return "Interest on loans";
  return name;
}
