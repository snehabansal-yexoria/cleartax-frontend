import type { CoreTransactionType } from "@/src/lib/coreApi";

/**
 * Shared vocabulary for the five transaction types.
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
  "contra",
] as const;

const TRANSACTION_TYPE_LABELS: Record<CoreTransactionType, string> = {
  revenue: "Income",
  expense: "Expense",
  personal: "Personal Transaction",
  cost_base: "Property Cost Base",
  contra: "Contra",
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

/**
 * Options for the filter dropdowns — every type, including contra, because a
 * contra row exists in the grid and has to be findable.
 */
export const TRANSACTION_TYPE_OPTIONS = TRANSACTION_TYPES.map((value) => ({
  label: TRANSACTION_TYPE_LABELS[value],
  value,
}));

/**
 * Options for the type PICKER on entry forms — deliberately not the same list.
 *
 * Contra is reached by ticking "Contra entry" on an expense, not by choosing it
 * as a type. Offering both would put a fifth button beside a checkbox that does
 * the same thing, and the checkbox is the one that also locks the category.
 */
export const TRANSACTION_TYPE_ENTRY_OPTIONS = TRANSACTION_TYPE_OPTIONS.filter(
  (option) => option.value !== "contra",
);

const TRANSACTION_TYPE_MODIFIERS: Record<CoreTransactionType, string> = {
  revenue: "is-income",
  expense: "is-expense",
  personal: "is-personal",
  cost_base: "is-cost-base",
  contra: "is-contra",
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
  contra: "#0891b2",
};

export function transactionTypeColor(type: CoreTransactionType): string {
  return TRANSACTION_TYPE_COLORS[type] ?? TRANSACTION_TYPE_COLORS.expense;
}

/** Only revenue is money in. */
export function isRevenueType(type: CoreTransactionType | string): boolean {
  return type === "revenue";
}

/**
 * How a type's amount should read in the grid.
 *
 * "neutral" exists for contra: a transfer between the entity's own accounts is
 * a movement, not a flow, so rendering it with a minus sign beside real
 * expenses invites exactly the misreading the type was created to prevent. The
 * bank Account Ledger is unaffected — its amount comes from the statement line,
 * where the money genuinely did leave that account.
 */
export function transactionSign(
  type: CoreTransactionType | string,
): "positive" | "negative" | "neutral" {
  if (type === "revenue") return "positive";
  if (type === "contra") return "neutral";
  return "negative";
}

/**
 * Whether a type belongs in a profit-and-loss calculation at all.
 *
 * The browser-side trend cards used to bucket with `type === "revenue" ? income
 * : expenses`, which quietly counted personal spending, capitalised cost base
 * AND contra transfers as deductible expenses. Anything that is not revenue or
 * expense must be SKIPPED, not bucketed into the else branch.
 */
export function affectsPnl(type: CoreTransactionType | string): boolean {
  return type === "revenue" || type === "expense";
}

/**
 * A contra entry is a transfer between the entity's own accounts — cash banked,
 * a bank-to-bank transfer, cash drawn for petty cash. It looks like a payment on
 * the statement but is neither income nor an expense.
 *
 * The checkbox is offered on expense entry only, per the product decision. A
 * transfer has two legs, so if a second bank account is ever reconciled the
 * incoming leg still arrives as revenue — the backend accepts contra on either
 * side, so widening this gate is all that is needed then.
 *
 * `contra` itself is included so an already-marked transaction can be unticked
 * back into an expense.
 */
export function allowsContraFlag(type: CoreTransactionType | ""): boolean {
  return type === "expense" || type === "contra";
}

/**
 * Personal transactions post to the single seeded "Personal" category, so the
 * picker is hidden and the category is auto-selected.
 */
export function hidesCategoryPicker(type: CoreTransactionType | ""): boolean {
  return type === "personal" || type === "contra";
}

/**
 * Cost base is one free-text/typeable category only — its categories each carry
 * a single "General" subcategory that is auto-selected.
 */
export function hidesSubcategoryPicker(type: CoreTransactionType | ""): boolean {
  return type === "personal" || type === "cost_base" || type === "contra";
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
  return type !== "personal" && type !== "cost_base" && type !== "contra";
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
  if (s === "contra" || s === "contra_entry" || s === "transfer") return "contra";
  return fallback;
}
