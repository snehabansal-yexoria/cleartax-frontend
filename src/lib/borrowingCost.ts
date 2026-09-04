import type { CoreTransactionCategory } from "@/src/lib/coreApi";

/**
 * Borrowing expenses are an expense category like any other in the database —
 * they have a row in transaction_category, real subcategories, and every
 * borrowing expense is a real transaction row. What is different is the way in:
 * they are entered from the property's Borrowing Cost page, which locks the
 * type and category, records the loan dates alongside them, and amortises the
 * total across the loan period.
 *
 * Entering one through the general Add Transaction form would produce a
 * transaction that looks right but sits outside that schedule, so the category
 * is filtered out of the general picker and only the dedicated flow can create
 * it.
 *
 * Matching is by name because that is what identifies the category across every
 * org: the seeded row has org_id IS NULL and a BIGSERIAL id that differs per
 * environment, so there is no stable id to compare against.
 */
export const BORROWING_EXPENSE_CATEGORY_NAME = "Borrowing expenses";

const DEDICATED_FLOW_CATEGORY_NAMES = new Set([
  BORROWING_EXPENSE_CATEGORY_NAME.toLowerCase(),
]);

/** True when the category is only creatable from its own dedicated page. */
export function hasDedicatedFlow(category: { name: string }): boolean {
  return DEDICATED_FLOW_CATEGORY_NAMES.has(category.name.trim().toLowerCase());
}

/**
 * Drops the dedicated-flow categories from a picker list. Applied to every
 * general Add Transaction category dropdown.
 */
export function withoutDedicatedFlowCategories<T extends { name: string }>(
  categories: T[],
): T[] {
  return categories.filter((category) => !hasDedicatedFlow(category));
}

/** Finds the borrowing expense category in a list loaded for type "expense". */
export function findBorrowingExpenseCategory(
  categories: CoreTransactionCategory[],
): CoreTransactionCategory | null {
  return (
    categories.find(
      (category) =>
        category.name.trim().toLowerCase() ===
        BORROWING_EXPENSE_CATEGORY_NAME.toLowerCase(),
    ) ?? null
  );
}
