"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CATEGORY_FILTERS,
  fetchNotifications,
  formatFullTime,
  formatRelativeTime,
  isUnread,
  markNotificationsRead,
  notificationHref,
  READ_EVENT,
  withRead,
  type NotificationItem,
  type NotificationViewerRole,
} from "./notificationClient";
import "./notifications.css";

const PAGE_SIZE = 25;

type Status = "loading" | "ready" | "error";

// Full notifications page, shared by the client and accountant dashboards.
// Newest first, grouped by day, filterable by category, paged with "Load more".
export default function NotificationsFeed({ role }: { role: NotificationViewerRole }) {
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // The viewer's unread total (server read state), for "Mark all read".
  const [unreadCount, setUnreadCount] = useState(0);

  // First page for the current filter. Status is set to "loading" by whatever
  // changed the filter, so this effect only sets state after the fetch.
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const page = await fetchNotifications({
          limit: PAGE_SIZE,
          category,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;

        // Opening the page no longer marks anything: unread rows keep their
        // dot until they are opened or "Mark all read" is pressed, and that
        // state is the server's, so it is the same on every device.
        setUnreadCount(page.unreadCount);
        setItems(page.items);
        setCursor(page.nextCursor);
        setStatus("ready");
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    })();
    return () => controller.abort();
  }, [category, reloadKey]);

  function chooseCategory(value: string) {
    if (value === category) return;
    setStatus("loading");
    setItems([]);
    setCursor(null);
    setMoreError(false);
    setCategory(value);
  }

  // The bell marked something read: follow it.
  useEffect(() => {
    function sync(event: Event) {
      const detail = (event as CustomEvent<{
        unreadCount: number;
        target: { ids: string[] } | { all: true };
      }>).detail;
      if (!detail) return;
      setUnreadCount(detail.unreadCount);
      setItems((current) => withRead(current, detail.target));
    }
    window.addEventListener(READ_EVENT, sync);
    return () => window.removeEventListener(READ_EVENT, sync);
  }, []);

  // Optimistic; a failure is only logged — the next load shows the truth.
  function markRead(target: { ids: string[] } | { all: true }) {
    setItems((current) => withRead(current, target));
    if ("all" in target) setUnreadCount(0);
    else setUnreadCount((c) => Math.max(0, c - target.ids.length));
    markNotificationsRead(target).catch((err) => {
      console.warn("Could not mark notifications read:", err);
    });
  }

  function retry() {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  }

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const page = await fetchNotifications({ limit: PAGE_SIZE, category, cursor });
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  const groups = groupByDay(items);

  return (
    <div className="notif-page">
      <header className="notif-page-head">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
          <h1>Notifications</h1>
          {unreadCount > 0 && (
            <button type="button" className="notif-button" onClick={() => markRead({ all: true })}>
              Mark all read
            </button>
          )}
        </div>
        <p>
          {role === "client"
            ? "Changes your accountant makes to your properties, entities and transactions."
            : "Changes your clients make, and clients assigned to you."}
        </p>
      </header>

      <div className="notif-filters" role="group" aria-label="Filter by category">
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f.value || "all"}
            type="button"
            className={`notif-chip${category === f.value ? " is-active" : ""}`}
            aria-pressed={category === f.value}
            onClick={() => chooseCategory(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <section className="notif-card" aria-live="polite" aria-busy={status === "loading"}>
        {status === "loading" && (
          <ul className="notif-list" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i} className="notif-row notif-row-skeleton notif-row-page">
                <span className="notif-skel notif-skel-title" />
                <span className="notif-skel notif-skel-body" />
              </li>
            ))}
          </ul>
        )}

        {status === "error" && (
          <div className="notif-empty">
            <p>Notifications couldn&apos;t load.</p>
            <span>Check your connection, then try again.</span>
            <button type="button" className="notif-button" onClick={retry}>
              Try again
            </button>
          </div>
        )}

        {status === "ready" && items.length === 0 && (
          <div className="notif-empty">
            <p>{category ? "Nothing in this category yet." : "No notifications yet."}</p>
            <span>
              {category
                ? "Choose All to see every notification."
                : role === "client"
                  ? "When your accountant makes changes to your records, they'll appear here."
                  : "When your clients add or change their records, it'll appear here."}
            </span>
          </div>
        )}

        {status === "ready" &&
          groups.map((g, i) => (
            <div key={`${g.label}-${i}`} className="notif-group">
              <h2 className="notif-group-label">{g.label}</h2>
              <ul className="notif-list">
                {g.items.map((n) => {
                  const href = notificationHref(n, role);
                  const fresh = isUnread(n);
                  const content = (
                    <>
                      <span className={`notif-dot${fresh ? " is-new" : ""}`} aria-hidden="true" />
                      <span className="notif-text">
                        <span className="notif-title">{n.title}</span>
                        {n.body && <span className="notif-body">{n.body}</span>}
                      </span>
                      <time className="notif-time" dateTime={n.updatedAt} title={formatFullTime(n.updatedAt)}>
                        {formatRelativeTime(n.updatedAt)}
                      </time>
                    </>
                  );
                  return (
                    <li key={n.id}>
                      {href ? (
                        <button
                          type="button"
                          className="notif-row notif-row-page notif-row-action"
                          onClick={() => {
                            if (fresh) markRead({ ids: [n.id] });
                            router.push(href);
                          }}
                        >
                          {fresh && <span className="sr-only">New: </span>}
                          {content}
                        </button>
                      ) : (
                        <div
                          className="notif-row notif-row-page"
                          onClick={fresh ? () => markRead({ ids: [n.id] }) : undefined}
                        >
                          {fresh && <span className="sr-only">New: </span>}
                          {content}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

        {status === "ready" && cursor && (
          <div className="notif-more">
            {moreError && <span className="notif-more-error">Couldn&apos;t load more.</span>}
            <button type="button" className="notif-button" onClick={() => void loadMore()} disabled={loadingMore}>
              {loadingMore ? "Loading…" : moreError ? "Try again" : "Load more"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

// Groups rows under Today / Yesterday / a date, in viewer time. Rows arrive in
// creation order, so they are grouped by createdAt; a collapsed row's
// updatedAt is at most one 10-minute window later.
function groupByDay(items: NotificationItem[]) {
  const groups: { label: string; items: NotificationItem[] }[] = [];
  const today = startOfDay(Date.now());
  const yesterday = startOfDay(today - 1); // DST-safe: the previous calendar day
  for (const n of items) {
    const t = Date.parse(n.createdAt);
    const day = Number.isNaN(t) ? today : startOfDay(t);
    const label =
      day === today
        ? "Today"
        : day === yesterday
          ? "Yesterday"
          : new Date(day).toLocaleDateString("en-AU", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: new Date(day).getFullYear() === new Date(today).getFullYear() ? undefined : "numeric",
            });
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(n);
    else groups.push({ label, items: [n] });
  }
  return groups;
}

function startOfDay(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
