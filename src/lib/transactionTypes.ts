import type { CoreTransactionType } from "@/src/lib/coreApi";

/**
 * Shared vocabulary for the four transaction types.
 *
 * Before this existed, the Add Transaction form, the reconciliation categorize
 * drawer and the transaction tables each kept their own copy — including a
 * second "income" | "expense" | "personal" | "cost_base" union that had to be
 * projected back onto the API's `type` on every submit. Everything now speaks
 * CoreTransactionType directly; "Income" is only ever a label for "revenue".
 *
 * This module is deliberately free of fetch/server code so client components
 * can import it as a value without pulling coreApi's request helpers into the
 * browser bundle.
 */

export const TRANSACTION_TYPES: readonly CoreTransactionType[] = [
  "revenue",
  "expense",
  "personal",
  "cost_base",
] as const;

const TRANSACTION_TYPE_LABELS: Record<CoreTransactionType, string> = {
  revenue: "Income",
  expense: "Expense",
  personal: "Personal Transaction",
  cost_base: "Property Cost Base",
};

/**
 * Display label. Note "revenue" reads as "Income" everywhere — the tables used
 * to say "Revenue" while the filter and detail pill said "Income" for the same
 * value.
 */
export function transactionTypeLabel(type: CoreTransactionType | ""): string {
  if (!type) return "";
  return TRANSACTION_TYPE_LABELS[type] ?? "Expense";
}

/** Options for the `StaticSelect` dropdowns. */
export const TRANSACTION_TYPE_OPTIONS = TRANSACTION_TYPES.map((value) => ({
  label: TRANSACTION_TYPE_LABELS[value],
  value,
}));

const TRANSACTION_TYPE_MODIFIERS: Record<CoreTransactionType, string> = {
  revenue: "is-income",
  expense: "is-expense",
  personal: "is-personal",
  cost_base: "is-cost-base",
};

/**
 * BEM-ish modifier shared by `.figma-type-btn`, `.transaction-type-pill` and
 * `.transaction-type-badge`, so one palette drives every surface.
 */
export function transactionTypeModifier(type: CoreTransactionType): string {
  return TRANSACTION_TYPE_MODIFIERS[type] ?? "is-expense";
}

/** Accent colour, matching the modifier classes in globals.css. */
const TRANSACTION_TYPE_COLORS: Record<CoreTransactionType, string> = {
  revenue: "#12a150",
  expense: "#3538cd",
  personal: "#a855f7",
  cost_base: "#f97316",
};

export function transactionTypeColor(type: CoreTransactionType): string {
  return TRANSACTION_TYPE_COLORS[type] ?? TRANSACTION_TYPE_COLORS.expense;
}

/** Only revenue is money in; the other three are outflows and render negative. */
export function isRevenueType(type: CoreTransactionType | string): boolean {
  return type === "revenue";
}

/**
 * Personal transactions post to the single seeded "Personal" category, so the
 * picker is hidden and the category is auto-selected.
 */
export function hidesCategoryPicker(type: CoreTransactionType | ""): boolean {
  return type === "personal";
}

/**
 * Cost base is one free-text/typeable category only — its categories each carry
 * a single "General" subcategory that is auto-selected.
 */
export function hidesSubcategoryPicker(type: CoreTransactionType | ""): boolean {
  return type === "personal" || type === "cost_base";
}

/**
 * Asset purchases (depreciation) remain expense-only. Cost base is capitalised
 * against CGT rather than depreciated, so it is NOT an asset purchase — the
 * backend rejects `is_asset_purchase` on any non-expense type.
 */
export function allowsAssetPurchase(type: CoreTransactionType | ""): boolean {
  return type === "expense";
}

/**
 * A *partial* private-use portion — "40% of this bill was personal" — applies
 * to expenses only.
 *
 * Revenue has no deduction to reduce, cost base is capitalised against CGT
 * rather than claimed, and `personal` is already wholly private. The toggle
 * used to be gated on `allowsBusinessExtras`, which also showed it on Income;
 * the backend now rejects that combination outright, so the gate has to match.
 *
 * A transaction carrying one is stored as three rows — the parent bill, a
 * deductible business child and a non-deductible personal child — but the form
 * only ever sends `personal_split: { percentage }` and the backend builds them.
 */
export function allowsPersonalPortion(type: CoreTransactionType | ""): boolean {
  return type === "expense";
}

/**
 * Personal and cost base carry no GST claim, no rent-alert scheduling and no
 * property split.
 *
 * Deliberately phrased as "not one of the two new types" rather than
 * "revenue or expense": the form starts with no type chosen, and in that state
 * every section must render exactly as it did before these types existed. Only
 * Personal and Property Cost Base get a reduced form.
 */
export function allowsBusinessExtras(type: CoreTransactionType | ""): boolean {
  return type !== "personal" && type !== "cost_base";
}

/** Normalises free text (CSV import, OCR, bank rows) onto a known type. */
export function parseTransactionType(
  value: unknown,
  fallback: CoreTransactionType = "expense",
): CoreTransactionType {
  const s = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (s === "revenue" || s === "income") return "revenue";
  if (s === "expense") return "expense";
  if (s === "personal" || s === "personal_transaction") return "personal";
  if (s === "cost_base" || s === "property_cost_base") return "cost_base";
  return fallback;
}
