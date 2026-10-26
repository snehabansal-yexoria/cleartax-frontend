"use client";

import type { CoreNotification, CoreNotificationPage } from "@/src/lib/coreApi";
import { getIdToken } from "@/src/lib/authToken";

export type NotificationItem = CoreNotification;
export type NotificationViewerRole = "client" | "accountant";

// Filter chips, in the order the page shows them. Values are the backend's
// catalog categories; client_bank holds the accountant-assignment events.
export const CATEGORY_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "transaction", label: "Transactions" },
  { value: "property", label: "Properties" },
  { value: "entity", label: "Entities" },
  { value: "reconciliation", label: "Reconciliation" },
  { value: "journal", label: "Journal entries" },
  { value: "document", label: "Documents" },
  { value: "client_bank", label: "Accountant & bank" },
];

export async function fetchNotifications(params: {
  limit?: number;
  cursor?: string | null;
  category?: string;
  signal?: AbortSignal;
}): Promise<CoreNotificationPage> {
  const token = await getIdToken();
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", String(params.limit));
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.category) query.set("category", params.category);

  const res = await fetch(`/api/notifications?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: params.signal,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return (await res.json()) as CoreNotificationPage;
}

export function notificationsPagePath(role: NotificationViewerRole) {
  return role === "accountant"
    ? "/dashboard/accountant/notifications"
    : "/dashboard/client/alerts";
}

// Where a notification takes its reader. Deleted records link to the list they
// were in. Documents have no page yet, so they are not clickable, except
// emailed ones: those open the emailed-documents inbox (accountant) or the
// client's emailed-documents list on their transactions page. Accountants
// land on the client's workspace, since the audit row carries no entity id for
// a property or transaction.
export function notificationHref(
  n: NotificationItem,
  role: NotificationViewerRole,
): string | null {
  const deleted = n.eventType.endsWith(".deleted");
  const enc = encodeURIComponent;

  if (role === "accountant") {
    if (!n.clientId) return null;
    const clientHome = `/dashboard/accountant/clients/${enc(n.clientId)}`;
    if (n.eventType === "document.emailed") return `${clientHome}?tab=emailed`;
    if (n.category === "document") return null;
    if (n.recordType === "entity" && n.recordId && !deleted) {
      return `${clientHome}/entities/${enc(n.recordId)}`;
    }
    return clientHome;
  }

  if (n.eventType === "document.email_rejected") {
    return "/dashboard/client/transactions#emailed-documents";
  }

  switch (n.category) {
    case "property":
      if (n.recordType === "property" && n.recordId && !deleted) {
        return `/dashboard/client/properties/${enc(n.recordId)}`;
      }
      return "/dashboard/client/properties";
    case "entity":
      if (n.recordId && !deleted) {
        return `/dashboard/client/entities/${enc(n.recordId)}`;
      }
      return "/dashboard/client/entities";
    case "transaction":
    case "journal":
    case "reconciliation":
      return "/dashboard/client/transactions";
    case "client_bank":
      return "/dashboard/client/profile";
    default:
      return null;
  }
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diff = Math.max(0, now - t);
  if (diff < MINUTE) return "Just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(t).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: new Date(t).getFullYear() === new Date(now).getFullYear() ? undefined : "numeric",
  });
}

export function formatFullTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Read state lives on the server (notification.read_at, migration 0053), so it
// follows the user across browsers and devices — it used to be a per-browser
// localStorage "seen" timestamp. A collapsed row that gains a new event is
// made unread again by the backend.

export function isUnread(n: NotificationItem): boolean {
  return !n.readAt;
}

// Fired in this tab after a mark-read, so the bell's badge follows the full
// page (and the page follows the bell) without waiting for the next poll.
export const READ_EVENT = "cleartax:notifications-read";

export async function markNotificationsRead(
  target: { ids: string[] } | { all: true },
): Promise<{ updated: number; unreadCount: number }> {
  const token = await getIdToken();
  const res = await fetch("/api/notifications/read", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(target),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  const result = (await res.json()) as { updated: number; unreadCount: number };
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(READ_EVENT, { detail: { ...result, target } }),
    );
  }
  return result;
}

/** A copy of `items` with the given ids (or everything) marked read now. */
export function withRead(
  items: NotificationItem[],
  target: { ids: string[] } | { all: true },
): NotificationItem[] {
  const now = new Date().toISOString();
  const ids = "ids" in target ? new Set(target.ids) : null;
  return items.map((n) =>
    n.readAt || (ids && !ids.has(n.id)) ? n : { ...n, readAt: now },
  );
}
