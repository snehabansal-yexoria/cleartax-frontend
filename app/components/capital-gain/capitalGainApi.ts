/**
 * Capital Gain — the contract between this UI and the backend.
 *
 * Reads use endpoints that already exist:
 *   GET /api/properties/{id}            purchase amount, name, address
 *   GET /api/properties/{id}/cost-base  Property Cost Base entries (settlement entries are a separate list)
 *
 * Writes use planned endpoints that are not built yet. Until they are, the
 * UI keeps the values on screen and says so. Write-up:
 * docs/BALANCE_SHEET_CGT_UI_HANDOFF.md.
 *   POST /api/properties/{id}/selling-costs   [{ subcategory, description, date, amount }]
 *   POST /api/properties/{id}/mark-sold       { sellingAmount, soldDate }
 */

export const SELLING_COST_SUBCATEGORIES = [
  "Agent commission",
  "PEXA fees",
  "Advertisement / Marketing",
  "Professional fees",
  "Others",
] as const;

/** Category the backend should store selling-cost rows under in the cost base list. */
export const SELLING_COST_CATEGORY = "Selling cost";

export type SellingCostRow = {
  key: string;
  subcategory: string;
  description: string;
  date: string; // YYYY-MM-DD, never after today
  amount: string; // as typed
};

function isMissing(status: number) {
  return status === 404 || status === 405 || status === 501;
}

async function postPlanned(url: string, token: string, body: unknown): Promise<{ saved: boolean; isSample: boolean }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { saved: true, isSample: false };
    if (!isMissing(res.status)) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.message || data?.error || "Could not save.");
    }
  } catch (err) {
    if (!(err instanceof TypeError)) throw err;
  }
  return { saved: false, isSample: true };
}

export function saveSellingCosts(token: string, propertyId: string, rows: SellingCostRow[]) {
  return postPlanned(
    `/api/properties/${encodeURIComponent(propertyId)}/selling-costs`,
    token,
    rows.map((r) => ({
      subcategory: r.subcategory,
      description: r.description,
      date: r.date,
      amount: parseMoney(r.amount),
    })),
  );
}

export function markPropertySold(token: string, propertyId: string, sellingAmount: number, soldDate: string) {
  return postPlanned(`/api/properties/${encodeURIComponent(propertyId)}/mark-sold`, token, { sellingAmount, soldDate });
}

export function parseMoney(v: string): number {
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
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
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}
