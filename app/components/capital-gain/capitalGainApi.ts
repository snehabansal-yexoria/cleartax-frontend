import { formatDateAU } from "@/src/lib/dates";
/**
 * Capital Gain — the browser's calls to the BFF.
 *
 *   GET  /api/properties/{id}                 purchase amount, name, address, sale
 *   GET  /api/properties/{id}/cost-base       cost base and selling cost rows
 *   POST /api/properties/{id}/selling-costs   replaces the selling cost rows
 *   POST /api/properties/{id}/mark-sold       { sellingAmount, soldDate }
 */

export const SELLING_COST_SUBCATEGORIES = [
  "Agent Commission",
  "PEXA Fees",
  "Advertisement / Marketing",
  "Professional Fees",
  "Others",
] as const;

/** Category selling cost rows are stored under in the cost base list. */
export const SELLING_COST_CATEGORY = "Selling Cost";

/**
 * Selling costs come off the selling amount, so they sit in the cost base list
 * but must stay out of every cost base total. The panel's category is free text,
 * hence the case-insensitive match.
 */
export function isSellingCostCategory(category: string): boolean {
  return category.trim().toLowerCase() === SELLING_COST_CATEGORY.toLowerCase();
}

export type SellingCostRow = {
  key: string;
  subcategory: string;
  description: string;
  date: string; // YYYY-MM-DD, never after today
  amount: string; // as typed
};

async function post(url: string, token: string, body: unknown, fallback: string): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return;
  const data = await res.json().catch(() => ({}));
  throw new Error(data?.message || data?.error || fallback);
}

/** Replaces the property's whole set, so going Back and Continuing cannot save rows twice. */
export function saveSellingCosts(token: string, propertyId: string, rows: SellingCostRow[]) {
  return post(
    `/api/properties/${encodeURIComponent(propertyId)}/selling-costs`,
    token,
    rows.map((r) => ({
      subcategory: r.subcategory,
      description: r.description,
      date: r.date,
      amount: parseMoney(r.amount),
    })),
    "Could not save the selling costs.",
  );
}

export function markPropertySold(token: string, propertyId: string, sellingAmount: number, soldDate: string) {
  return post(
    `/api/properties/${encodeURIComponent(propertyId)}/mark-sold`,
    token,
    { sellingAmount, soldDate },
    "Could not mark the property as sold.",
  );
}

export function parseMoney(v: string): number {
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Amounts are stored to the cent, so an input refuses a third decimal rather than rounding it. */
export function exceedsCents(v: string): boolean {
  return /\.\d{3,}/.test(v);
}

export function aud(n: number): string {
  const s = `A$ ${Math.abs(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return n < 0 ? `−${s}` : s;
}

export function todayIso(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function displayDate(iso: string | null | undefined): string {
  return formatDateAU(iso);
}
