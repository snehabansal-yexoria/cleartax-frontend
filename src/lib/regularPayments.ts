/**
 * Regular payments (bills that come round again): which categories start
 * switched on, how often they recur, and the next due date.
 *
 * Used by every place a transaction is categorised: client Add transaction
 * (Review & submit), the accountant's Add transaction, and reconciliation
 * (one line, and bulk).
 */

export type RegularFrequency = "monthly" | "quarterly" | "annually";

export const REGULAR_FREQUENCIES: { value: RegularFrequency; label: string; months: number }[] = [
  { value: "monthly", label: "Monthly", months: 1 },
  { value: "quarterly", label: "Quarterly", months: 3 },
  { value: "annually", label: "Annually", months: 12 },
];

/**
 * Expense categories that are almost always a recurring bill, and how often
 * they usually fall due. Matched on the category name (case and spacing
 * ignored), so the list works whatever ids the backend gives them.
 */
const REGULAR_BILL_CATEGORIES: { match: RegExp; frequency: RegularFrequency }[] = [
  { match: /^council rates$/, frequency: "quarterly" },
  { match: /^water (charges|rates)$/, frequency: "quarterly" },
  { match: /^body corporate fees( \/ strata levy)?$|^strata levy$/, frequency: "quarterly" },
  { match: /^insurance$/, frequency: "annually" },
  { match: /^land tax$/, frequency: "annually" },
];

function normalise(name: string | null | undefined) {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** The usual frequency when this is a regular-bill expense category, else null. */
export function regularBillFrequency(
  type: string | null | undefined,
  categoryName: string | null | undefined,
): RegularFrequency | null {
  if (type !== "expense") return null;
  const name = normalise(categoryName);
  if (!name) return null;
  return REGULAR_BILL_CATEGORIES.find((c) => c.match.test(name))?.frequency ?? null;
}

export function frequencyMonths(f: RegularFrequency): number {
  return REGULAR_FREQUENCIES.find((x) => x.value === f)?.months ?? 1;
}

export function frequencyLabel(f: RegularFrequency): string {
  return REGULAR_FREQUENCIES.find((x) => x.value === f)?.label ?? "Monthly";
}

/** "1 month" / "3 months" / "1 year", for the hint under the due date. */
export function frequencyGap(f: RegularFrequency): string {
  return f === "annually" ? "1 year" : f === "quarterly" ? "3 months" : "1 month";
}

function parseIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIso(d: Date): string {
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The same day n months later; a day the month lacks (the 31st) becomes its last day. */
export function addMonthsIso(iso: string, months: number): string {
  const d = parseIso(iso);
  if (!d) return "";
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return toIso(target);
}

/**
 * The next due date: the invoice date plus one period, and if that has
 * already passed, period after period until the first date after today.
 * (An invoice from March, paid quarterly, is next due in the coming quarter,
 * not in June.) Counted from the invoice date each time, so the 31st stays
 * the 31st in months that have one.
 */
export function nextDueDate(invoiceIso: string, frequency: RegularFrequency, today: Date = new Date()): string {
  if (!parseIso(invoiceIso)) return "";
  const todayIso = toIso(today);
  const step = frequencyMonths(frequency);
  for (let k = 1; k <= 600; k += 1) {
    const due = addMonthsIso(invoiceIso, step * k);
    if (due > todayIso) return due;
  }
  return "";
}
