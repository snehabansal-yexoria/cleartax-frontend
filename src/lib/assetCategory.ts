import type {
  CoreAssetClass,
  CoreTransactionCategory,
  CoreTransactionType,
} from "@/src/lib/coreApi";

/**
 * Which category an asset purchase files under, and the type-safe replacement
 * for `categories[0]`.
 *
 * ---- Why this module exists -------------------------------------------------
 *
 * Three entry forms hid or locked the category picker and then took
 * `categories[0]`. The list endpoint sorts `ORDER BY type ASC, lower(name) ASC`
 * (handler.go listCategories), so index 0 among expense categories is
 * deterministically **"Advertising for Tenants"** — the alphabetically first
 * rental expense. Every asset purchase ever created through those forms was
 * therefore filed under Advertising and posted to account 5070 in the General
 * Ledger, with the picker greyed out so nobody could correct it.
 *
 * The same index-0 assumption broke contra entries in a nastier way: see
 * `firstCategoryOfType` below.
 */

/**
 * Chart-of-accounts codes for the two depreciation categories, seeded by
 * migration 0009 and given codes by 0041.
 *
 * Matching on the CODE rather than the name because the code is what the
 * General Ledger actually posts to, and because an org may rename its own
 * copy of a category — `0041` is the single source of truth for both.
 */
const ASSET_CATEGORY_CODE: Record<CoreAssetClass, string> = {
  // Division 40, plant & equipment.
  capital_allowance: "5160",
  // Division 43, building write-off.
  capital_works: "5150",
};

/**
 * Is this category a Division 43 (capital works) one?
 *
 * Deliberately fuzzy: an org may name its own "Capital Works - Div 43", and the
 * seeded row is "Capital works deductions". Re-exported from AssetBuilder,
 * which is where most callers import it from.
 */
export function isCapitalWorksCategory(name?: string | null): boolean {
  if (!name) return false;
  const n = name.trim().toLowerCase();
  return (
    n.includes("capital work") ||
    n.includes("capital works") ||
    n.includes("div 43") ||
    n.includes("division 43")
  );
}

/** Is this category a Division 40 (plant & equipment) one? */
export function isCapitalAllowanceCategory(name?: string | null): boolean {
  if (!name) return false;
  const n = name.trim().toLowerCase();
  return (
    n.includes("capital allowance") ||
    n.includes("div 40") ||
    n.includes("division 40")
  );
}

const ASSET_CATEGORY_MATCHES: Record<
  CoreAssetClass,
  (name?: string | null) => boolean
> = {
  capital_allowance: isCapitalAllowanceCategory,
  capital_works: isCapitalWorksCategory,
};

/**
 * The category an asset purchase of this class belongs to, or null when the
 * list does not contain it.
 *
 * Returning null rather than falling back to *some* category is deliberate:
 * silently filing a $30,000 asset under whatever happened to be first is the
 * bug this replaces. A caller that gets null must say so, not guess.
 *
 * System rows (`org_id IS NULL`) win over an org's own same-named category, so
 * a tenant that created its own "Capital allowances" cannot shadow the seeded
 * one that the chart of accounts is mapped to.
 */
export function findAssetCategory(
  categories: CoreTransactionCategory[],
  assetClass: CoreAssetClass | "",
): CoreTransactionCategory | null {
  if (!assetClass) return null;

  const code = ASSET_CATEGORY_CODE[assetClass];
  const matchesName = ASSET_CATEGORY_MATCHES[assetClass];

  // Account code first — it is what the General Ledger actually posts to, and
  // it survives a rename. The name predicate is the fallback, so an org's own
  // "Capital Works - Div 43" (which carries no seeded code) still resolves.
  const matches = categories.filter(
    (c) => c.accountCode === code || matchesName(c.name),
  );
  if (matches.length === 0) return null;

  // Prefer the exact code, then a system row: a tenant's own same-named
  // category must not shadow the seeded one the chart of accounts is mapped to.
  return (
    matches.find((c) => c.accountCode === code && c.isSystem) ??
    matches.find((c) => c.accountCode === code) ??
    matches.find((c) => c.isSystem) ??
    matches[0]
  );
}

/**
 * The first category of a given type — the type-checked replacement for
 * `categories[0]` wherever the picker is hidden and the choice is automatic.
 *
 * ---- The bug this fixes ----------------------------------------------------
 *
 * `hidesCategoryPicker` is true for `personal` and `contra`, so those types
 * auto-select. The auto-select effect ran on `[type, categories, categoryId]`,
 * but `categories` is refetched asynchronously when the type changes — so on
 * the render where `type` is already "contra" and the fetch has not landed,
 * `categories` still held the EXPENSE list. If that refetch then failed, the
 * early `return` left the stale list in place and the form posted
 * `{type: "contra", category_id: <an expense category>}`, which the backend
 * rejects with "category type does not match transaction type" — the exact
 * error reported. The picker being hidden meant the accountant could neither
 * see nor fix the mismatch.
 *
 * Filtering on `type` makes that unrepresentable: a stale list of the wrong
 * type yields null, and null is surfaced as a real message instead of being
 * posted.
 */
export function firstCategoryOfType(
  categories: CoreTransactionCategory[],
  type: CoreTransactionType | "",
): CoreTransactionCategory | null {
  if (!type) return null;
  return categories.find((c) => c.type === type) ?? null;
}
