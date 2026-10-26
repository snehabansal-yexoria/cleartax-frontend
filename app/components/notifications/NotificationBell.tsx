"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  announceDropdownOpen,
  dropdownRegistryEvent,
  isDropdownRegistryEvent,
} from "@/src/lib/dropdownRegistry";
import {
  fetchNotifications,
  formatFullTime,
  formatRelativeTime,
  isUnread,
  markNotificationsRead,
  notificationHref,
  notificationsPagePath,
  READ_EVENT,
  withRead,
  type NotificationItem,
  type NotificationViewerRole,
} from "./notificationClient";
import "./notifications.css";

const DROPDOWN_ID = "dashboard-notifications";
const PREVIEW_LIMIT = 10;
const POLL_MS = 30_000;

type Status = "loading" | "ready" | "error";

// Topbar bell. Shows the newest notifications in a dropdown and a badge with
// the viewer's unread count. Read state is the server's (notification.read_at),
// so it is the same in every browser: opening a notification marks it read,
// and "Mark all read" clears the rest.
// Render with key={viewer} so a different signed-in user gets fresh state.
export default function NotificationBell({
  role,
}: {
  role: NotificationViewerRole;
  /** Stable per-user key; the caller passes it as the React key too. */
  viewer: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const page = await fetchNotifications({ limit: PREVIEW_LIMIT });
      setItems(page.items);
      setUnreadCount(page.unreadCount);
      setStatus("ready");
    } catch {
      // Keep showing what we had; only an empty first load shows the error.
      setStatus((s) => (s === "ready" ? s : "error"));
    }
  }, []);

  // Optimistic: the dot and badge clear at once; the next poll reconciles if
  // the request failed.
  const markRead = useCallback((target: { ids: string[] } | { all: true }) => {
    setItems((current) => withRead(current, target));
    if ("all" in target) setUnreadCount(0);
    else setUnreadCount((c) => Math.max(0, c - target.ids.length));
    markNotificationsRead(target).catch((err) => {
      console.warn("Could not mark notifications read:", err);
    });
  }, []);

  // First load, then poll while the tab is visible, and refresh on return.
  useEffect(() => {
    // load() only sets state after its fetch resolves, so this is a data
    // subscription, not a synchronous cascade of renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [load]);

  // The full notifications page marked something read: follow it.
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

  const close = useCallback(() => {
    openRef.current = false;
    setOpen(false);
  }, []);

  // Close when another topbar dropdown opens, on outside click, and on Escape.
  useEffect(() => {
    function onOtherDropdown(event: Event) {
      if (!isDropdownRegistryEvent(event)) return;
      if (event.detail?.id && event.detail.id !== DROPDOWN_ID) close();
    }
    window.addEventListener(dropdownRegistryEvent, onOtherDropdown);
    return () => window.removeEventListener(dropdownRegistryEvent, onOtherDropdown);
  }, [close]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        close();
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  function toggle() {
    if (open) {
      close();
      return;
    }
    openRef.current = true;
    setOpen(true);
    announceDropdownOpen(DROPDOWN_ID);
    void load();
  }

  const newCount = unreadCount;
  const badge = newCount > 99 ? "99+" : String(newCount);
  const label =
    newCount > 0 ? `Notifications, ${newCount} unread` : "Notifications";

  return (
    <div className="notif-bell" ref={rootRef}>
      <button
        type="button"
        className="accountant-icon-button notif-bell-button"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={toggle}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 17H5l1.4-1.4A2 2 0 0 0 7 14.2V10a5 5 0 0 1 10 0v4.2a2 2 0 0 0 .6 1.4L19 17h-4" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {newCount > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-panel-head">
            <strong>Notifications</strong>
            {newCount > 0 && (
              <button
                type="button"
                className="notif-link-button"
                onClick={() => markRead({ all: true })}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="notif-panel-body">
            {status === "loading" && items.length === 0 && (
              <ul className="notif-list" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="notif-row notif-row-skeleton">
                    <span className="notif-skel notif-skel-title" />
                    <span className="notif-skel notif-skel-body" />
                  </li>
                ))}
              </ul>
            )}

            {status === "error" && items.length === 0 && (
              <div className="notif-empty">
                <p>Notifications couldn&apos;t load.</p>
                <button type="button" className="notif-link-button" onClick={() => void load()}>
                  Try again
                </button>
              </div>
            )}

            {status === "ready" && items.length === 0 && (
              <div className="notif-empty">
                <p>No notifications yet.</p>
                <span>
                  {role === "client"
                    ? "When your accountant makes changes to your properties, entities or transactions, they'll appear here."
                    : "When your clients add or change their records, it'll appear here."}
                </span>
              </div>
            )}

            {items.length > 0 && (
              <ul className="notif-list">
                {items.map((n) => {
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
                          className="notif-row notif-row-action"
                          onClick={() => {
                            if (fresh) markRead({ ids: [n.id] });
                            close();
                            router.push(href);
                          }}
                        >
                          {fresh && <span className="sr-only">New: </span>}
                          {content}
                        </button>
                      ) : (
                        <div className="notif-row">
                          {fresh && <span className="sr-only">New: </span>}
                          {content}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="notif-panel-foot">
            <Link href={notificationsPagePath(role)} onClick={close}>
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
