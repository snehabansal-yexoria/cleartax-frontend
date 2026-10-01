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
// were in; documents have no page yet, so they are not clickable. Accountants
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
    if (n.category === "document") return null;
    if (n.recordType === "entity" && n.recordId && !deleted) {
      return `${clientHome}/entities/${enc(n.recordId)}`;
    }
    return clientHome;
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

// "Seen" is a per-browser marker, not server read state: the newest
// updatedAt the viewer has seen in the bell. A collapsed row that gains events
// gets a newer updatedAt, so it counts as new again.
function seenKey(viewer: string) {
  return `cleartax:notifications:seen:${viewer.trim().toLowerCase()}`;
}

// Fired in this tab when the marker moves, so the bell's badge clears when the
// viewer reads the full page. (The storage event only reaches other tabs.)
export const SEEN_EVENT = "cleartax:notifications-seen";

export function readSeenAt(viewer: string): number {
  if (typeof window === "undefined" || !viewer) return 0;
  const raw = window.localStorage.getItem(seenKey(viewer));
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function writeSeenAt(viewer: string, at: number) {
  if (typeof window === "undefined" || !viewer || !at) return;
  if (at <= readSeenAt(viewer)) return;
  window.localStorage.setItem(seenKey(viewer), String(at));
  window.dispatchEvent(new CustomEvent(SEEN_EVENT, { detail: { at } }));
}

export function newestUpdatedAt(items: NotificationItem[]): number {
  let max = 0;
  for (const n of items) {
    const t = Date.parse(n.updatedAt);
    if (!Number.isNaN(t) && t > max) max = t;
  }
  return max;
}

export function isNewSince(n: NotificationItem, seenAt: number) {
  const t = Date.parse(n.updatedAt);
  return !Number.isNaN(t) && t > seenAt;
}
