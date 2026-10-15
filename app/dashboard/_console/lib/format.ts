const numberFormatter = new Intl.NumberFormat("en-AU");
const moneyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const monthFormatter = new Intl.DateTimeFormat("en-AU", { month: "short" });

export const EMPTY = "—";

export function formatNumber(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? EMPTY : numberFormatter.format(value);
}

export function formatMoney(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? EMPTY : moneyFormatter.format(value);
}

/** $52.6M, $410K, $950 */
export function formatCompactMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return EMPTY;
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}${moneyFormatter.format(abs)}`;
}

export function formatPercent(value: number | null | undefined, digits = 0) {
  return value == null || !Number.isFinite(value) ? EMPTY : `${(value * 100).toFixed(digits)}%`;
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | null | undefined) {
  const date = parseDate(value);
  return date ? dateFormatter.format(date) : EMPTY;
}

export function formatDateTime(value: string | null | undefined) {
  const date = parseDate(value);
  return date ? dateTimeFormatter.format(date) : EMPTY;
}

export function formatMonth(date: Date) {
  return monthFormatter.format(date);
}

export function formatRelative(value: string | null | undefined) {
  const date = parseDate(value);
  if (!date) return EMPTY;
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return formatDate(value);
}

export function initials(nameOrEmail: string) {
  const base = (nameOrEmail || "").split("@")[0];
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return base.slice(0, 2).toUpperCase() || "—";
}

/** Stable avatar colour for a name, 0–5. */
export function toneFor(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash % 6;
}

export function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function share(part: number, whole: number) {
  return whole > 0 ? part / whole : 0;
}
