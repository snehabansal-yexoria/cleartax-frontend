import { formatDateAU } from "@/src/lib/dates";
import { formatAmountAU } from "@/src/lib/currency";
/**
 * Upcoming payments — the browser's calls. Used read-only on the client
 * dashboard, and with Mark as paid on the accountant's transaction pages
 * (all clients, or one client / entity / property).
 *
 * A reminder is a transaction the client saved with "Is this a regular
 * payment?" turned on: metadata.is_regular_payment, metadata.due_date and
 * metadata.alert_name (ClientAddTransactionViewNew). Amount, category,
 * property and entity come from that transaction.
 *
 * Today (existing endpoints only):
 *   GET  /api/transactions?sort=date&dir=desc&limit=200   reminders are filtered from these rows
 *   GET  /api/transactions?sort=date&dir=desc&limit=50&search=   payments to link
 *   POST /api/entities/{entityId}/transactions            "Add a new transaction"
 *
 * For the backend to add (see docs/UPCOMING_PAYMENTS_UI_HANDOFF.md):
 *   GET  /api/reminders?status=open
 *   POST /api/reminders/{transactionId}/mark-paid  { transactionId }   (the payment)
 *   POST /api/reminders/{transactionId}/dismiss
 *   POST /api/reminders/{transactionId}/reopen     (Undo)
 * Closing a reminder should set metadata.reminder_status to "paid" or
 * "dismissed" on the reminder's transaction, so the list below skips it.
 *
 * Until those POST routes exist they answer 404. The UI then remembers the
 * cleared reminder in this browser only (localStorage), so the flow can be
 * used and tested; it comes back on another device. Remove the fallback once
 * the routes are live.
 */

export type UpcomingPayment = {
  /** The reminder's transaction id. */
  id: string;
  clientId: string;
  clientName: string;
  alertName: string;
  dueDate: string; // YYYY-MM-DD
  amount: number;
  type: string;
  categoryId: number;
  categoryName: string;
  subcategoryId: number;
  subcategoryName: string;
  entityId: string;
  entityName: string;
  propertyIds: string[];
  propertyNames: string[];
};

export type PaymentCandidate = {
  id: string;
  date: string;
  description: string;
  amount: number;
  propertyNames: string[];
  source: string;
};

/** Which reminders to load. Empty = everything the signed-in user can see. */
export type ReminderScope = {
  clientId?: string;
  entityId?: string;
  propertyId?: string;
};

type Row = {
  id: string;
  clientId?: string;
  clientName?: string;
  type: string;
  categoryId: number;
  categoryName: string;
  subcategoryId: number;
  subcategoryName: string;
  invoiceDate: string;
  grossAmount: number;
  description: string | null;
  entityId: string;
  entityName: string;
  propertyIds: string[];
  propertyNames: string[];
  metadata: Record<string, unknown>;
  source?: string;
};

const CLEARED_KEY = "cp-upcoming-payments-cleared";

function readCleared(): string[] {
  try {
    const raw = window.localStorage.getItem(CLEARED_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeCleared(ids: string[]) {
  try {
    window.localStorage.setItem(CLEARED_KEY, JSON.stringify(ids));
  } catch {
    /* private mode: nothing to remember */
  }
}

async function getPage(token: string, query: string): Promise<{ items: Row[]; total: number | null }> {
  const res = await fetch(`/api/transactions?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || data?.error || "Could not load transactions.");
  }
  const data = (await res.json()) as { items?: Row[]; total?: number };
  return { items: data.items ?? [], total: typeof data.total === "number" ? data.total : null };
}

async function getRows(token: string, query: string): Promise<Row[]> {
  return (await getPage(token, query)).items;
}

function scopeParams(scope: ReminderScope | undefined, q: URLSearchParams) {
  if (scope?.clientId) q.set("client_id", scope.clientId);
  if (scope?.entityId) q.set("entity_id", scope.entityId);
  if (scope?.propertyId) q.set("property_id", scope.propertyId);
}

const PAGE = 200;

function truthy(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

/**
 * Open reminders, closest due date first.
 *
 * Reads the newest `maxRows` transactions in the scope (200 a page) and keeps
 * the ones saved as a regular payment. GET /api/reminders will replace this
 * once the backend serves it.
 */
export async function loadUpcomingPayments(
  token: string,
  scope?: ReminderScope,
  maxRows = PAGE,
): Promise<UpcomingPayment[]> {
  const rows: Row[] = [];
  for (let offset = 0; offset < maxRows; offset += PAGE) {
    const q = new URLSearchParams({ sort: "date", dir: "desc", limit: String(PAGE), offset: String(offset) });
    scopeParams(scope, q);
    const page = await getPage(token, q.toString());
    rows.push(...page.items);
    if (page.items.length < PAGE || (page.total !== null && offset + PAGE >= page.total)) break;
  }
  const cleared = new Set(readCleared());
  return rows
    .filter((r) => {
      const m = r.metadata ?? {};
      const due = typeof m.due_date === "string" ? m.due_date.slice(0, 10) : "";
      const status = typeof m.reminder_status === "string" ? m.reminder_status : "";
      return truthy(m.is_regular_payment) && /^\d{4}-\d{2}-\d{2}$/.test(due) && !status && !cleared.has(r.id);
    })
    .map((r) => {
      const m = r.metadata;
      const alert = typeof m.alert_name === "string" && m.alert_name.trim() ? m.alert_name.trim() : "";
      const fallbackName = [r.subcategoryName || r.categoryName, r.propertyNames[0]].filter(Boolean).join(" - ");
      return {
        id: r.id,
        clientId: r.clientId ?? "",
        clientName: r.clientName ?? "",
        alertName: alert || fallbackName || r.description || "Payment",
        dueDate: String(m.due_date).slice(0, 10),
        amount: Math.abs(Number(r.grossAmount) || 0),
        type: r.type,
        categoryId: r.categoryId,
        categoryName: r.categoryName,
        subcategoryId: r.subcategoryId,
        subcategoryName: r.subcategoryName,
        entityId: r.entityId,
        entityName: r.entityName,
        propertyIds: r.propertyIds ?? [],
        propertyNames: r.propertyNames ?? [],
      };
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/**
 * The newest transactions of the reminder's client, to pick the one that paid
 * it. Scoped to that client so an accountant never sees another client's rows.
 */
export async function loadPaymentCandidates(
  token: string,
  reminder: UpcomingPayment,
  search: string,
): Promise<PaymentCandidate[]> {
  const q = new URLSearchParams({ sort: "date", dir: "desc", limit: "50" });
  if (reminder.clientId) q.set("client_id", reminder.clientId);
  if (search.trim()) q.set("search", search.trim());
  const rows = await getRows(token, q.toString());
  return rows
    .filter((r) => r.id !== reminder.id)
    .map((r) => ({
      id: r.id,
      date: (r.invoiceDate || "").slice(0, 10),
      description: r.description || r.subcategoryName || r.categoryName || "Transaction",
      amount: Math.abs(Number(r.grossAmount) || 0),
      propertyNames: r.propertyNames ?? [],
      source: r.source ?? "",
    }));
}

async function post(url: string, token: string, body?: unknown): Promise<"saved" | "local"> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.ok) return "saved";
  // Route not built yet: remember it in this browser (see the note at the top).
  if (res.status === 404 || res.status === 405) return "local";
  const data = await res.json().catch(() => ({}));
  throw new Error(data?.message || data?.error || "Could not save. Try again.");
}

function rememberCleared(id: string) {
  const ids = readCleared();
  if (!ids.includes(id)) writeCleared([...ids, id]);
}

export async function markReminderPaid(token: string, reminderId: string, paymentTransactionId: string) {
  const r = await post(`/api/reminders/${encodeURIComponent(reminderId)}/mark-paid`, token, {
    transactionId: paymentTransactionId,
  });
  if (r === "local") rememberCleared(reminderId);
}

export async function dismissReminder(token: string, reminderId: string) {
  const r = await post(`/api/reminders/${encodeURIComponent(reminderId)}/dismiss`, token);
  if (r === "local") rememberCleared(reminderId);
}

export async function reopenReminder(token: string, reminderId: string) {
  writeCleared(readCleared().filter((x) => x !== reminderId));
  await post(`/api/reminders/${encodeURIComponent(reminderId)}/reopen`, token);
}

/**
 * "Add a new transaction" from the overlay: the same create call as the Add
 * Transaction page, copying the reminder's type, category and property.
 * Returns the new transaction's id.
 */
export async function addPaymentTransaction(
  token: string,
  reminder: UpcomingPayment,
  input: { date: string; amount: number; description: string },
): Promise<string> {
  const ids = reminder.propertyIds;
  const splits =
    ids.length <= 1
      ? ids.map((property_id) => ({ property_id, split_percentage: 100 }))
      : ids.map((property_id, i) => {
          const even = Number((100 / ids.length).toFixed(4));
          return { property_id, split_percentage: i === ids.length - 1 ? Number((100 - even * (ids.length - 1)).toFixed(4)) : even };
        });
  const body: Record<string, unknown> = {
    type: reminder.type,
    category_id: reminder.categoryId,
    ...(reminder.subcategoryId ? { subcategory_id: reminder.subcategoryId } : {}),
    invoice_date: input.date,
    gross_amount: input.amount,
    description: input.description.trim() || null,
    internal_remarks: null,
    is_asset_purchase: false,
    splits,
    metadata: { is_regular_payment: false, due_date: null, alert_name: null, paid_reminder_id: reminder.id },
  };
  const res = await fetch(`/api/entities/${encodeURIComponent(reminder.entityId)}/transactions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || `Could not save the transaction (${res.status}).`);
  return String(data?.id ?? data?.transaction?.id ?? "");
}

/** Whole days from today (local) to an ISO date; negative when overdue. */
export function daysUntil(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.UTC(y, m - 1, d) - today) / 86400000);
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function displayDate(iso: string): string {
  return formatDateAU(iso);
}

export function aud(n: number): string {
  return `A$ ${formatAmountAU(n)}`;
}
