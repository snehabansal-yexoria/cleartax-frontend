"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getIdToken } from "@/src/lib/authToken";
import {
  aud,
  daysUntil,
  displayDate,
  loadUpcomingPayments,
  reopenReminder,
  type ReminderScope,
  type UpcomingPayment,
} from "./upcomingPaymentsApi";
import { Icon, PaySheet, tone, type Mode } from "./PaySheet";
import "./upcoming-payments.css";

/** Most transactions read per load in the all-clients view (200 a request). */
const MAX_ROWS_ALL_CLIENTS = 1000;
const MAX_ROWS_SCOPED = 400;

const BELL = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
const CHEVRON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/**
 * Accountant → Upcoming payments alert, above the transactions list on the
 * Transactions page (all clients) and on a client's, entity's or property's
 * Transactions tab (that scope only).
 *
 * The regular payments clients set up on Add Transaction, closest due date
 * first. Collapsed to one line by default; "Review payments" opens the list,
 * where Mark as paid opens the same overlay clients used to have (Add a new
 * transaction / Select an existing transaction / Dismiss). Hidden when nothing
 * is due.
 */
export default function AccountantUpcomingPayments({
  scope,
  scopeLabel,
  showClient,
  addTransactionHref,
  onChanged,
}: {
  /** Which reminders to show; empty = every client the accountant manages. */
  scope: ReminderScope;
  /** "this client", "this entity", "this property"; omitted for all clients. */
  scopeLabel?: string;
  /** Show the Client column (the all-clients page). */
  showClient: boolean;
  addTransactionHref: string;
  /** A payment was added or linked: the page's list should reload. */
  onChanged?: () => void;
}) {
  const [token, setToken] = useState("");
  const [items, setItems] = useState<UpcomingPayment[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<"all" | "15">("all");
  const [sheet, setSheet] = useState<{ id: string; mode: Mode } | null>(null);
  const [toast, setToast] = useState<{ text: string; item?: UpcomingPayment } | null>(null);

  const scopeKey = `${scope.clientId ?? ""}|${scope.entityId ?? ""}|${scope.propertyId ?? ""}`;

  const reload = useCallback(
    async (tk: string) => {
      try {
        const max = scope.clientId || scope.entityId || scope.propertyId ? MAX_ROWS_SCOPED : MAX_ROWS_ALL_CLIENTS;
        setItems(await loadUpcomingPayments(tk, scope, max));
        setLoadError("");
      } catch (err) {
        setLoadError((err as Error)?.message || "Could not load upcoming payments.");
        setItems([]);
      }
    },
    // scopeKey stands for the scope object, which callers rebuild every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scopeKey],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tk = await getIdToken();
        if (cancelled) return;
        setToken(tk);
        await reload(tk);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 7000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const live = useMemo(
    () => (items ?? []).map((i) => ({ ...i, days: daysUntil(i.dueDate) })).sort((a, b) => a.days - b.days),
    [items],
  );
  const overdue = live.filter((i) => i.days < 0).length;
  const soon = live.filter((i) => i.days >= 0 && i.days <= 15).length;
  const urgent = live.some((i) => i.days <= 3);
  const clientCount = new Set(live.map((i) => i.clientId || i.clientName)).size;
  const shown = filter === "15" ? live.filter((i) => i.days <= 15) : live;
  const current = sheet ? live.find((i) => i.id === sheet.id) ?? null : null;

  const removeLocally = (id: string) => setItems((list) => (list ?? []).filter((i) => i.id !== id));

  const finish = (item: UpcomingPayment, text: string) => {
    removeLocally(item.id);
    setSheet(null);
    setToast({ text, item });
    onChanged?.();
  };

  const undo = async () => {
    const item = toast?.item;
    setToast(null);
    if (!item) return;
    setItems((list) => [...(list ?? []).filter((i) => i.id !== item.id), item]);
    try {
      await reopenReminder(token, item.id);
    } catch {
      /* the list reloads from the server next visit */
    }
  };

  const toastEl = toast && (
    <div className="upd-toast" role="status">
      <span className="upd-toast-ok">{Icon.check}</span>
      <span>{toast.text}</span>
      {toast.item && (
        <button type="button" onClick={() => void undo()}>
          Undo
        </button>
      )}
    </div>
  );

  // Nothing due (or still loading): the page stays exactly as it was.
  if (items === null) return null;
  if (live.length === 0) {
    if (!loadError) return toastEl || null;
    return (
      <section className="upa upa--error" aria-label="Upcoming payments">
        <span>Upcoming payments couldn’t load. {loadError}</span>
        <button type="button" className="upa-link" onClick={() => void reload(token)}>
          Try again
        </button>
      </section>
    );
  }

  const n = live.length;
  const title = showClient
    ? `${n} upcoming payment${n === 1 ? "" : "s"} across ${clientCount} client${clientCount === 1 ? "" : "s"}`
    : `${n} upcoming payment${n === 1 ? "" : "s"}${scopeLabel ? ` for ${scopeLabel}` : ""}`;

  return (
    <>
      <section className="upa" aria-labelledby="upa-title">
        <div className="upa-head">
          <span className="upa-hic">{BELL}</span>
          <div className="upa-htext">
            <h2 className="upa-title" id="upa-title">
              {title}
              {overdue > 0 && <span className="upd-count">{overdue} overdue</span>}
              {soon > 0 && <span className={`upd-count${urgent ? "" : " amb"}`}>{soon} due within 15 days</span>}
            </h2>
            <p className="upa-sub">
              {showClient
                ? "Regular payments your clients set up. Link the payment once it shows, or add it."
                : "Regular payments set up on these transactions. Link the payment once it shows, or add it."}
            </p>
          </div>
          <button
            type="button"
            className={`upa-toggle${expanded ? " is-open" : ""}`}
            aria-expanded={expanded}
            aria-controls="upa-list"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Hide" : "Review payments"}
            {CHEVRON}
          </button>
        </div>

        {expanded && (
          <div className="upa-body" id="upa-list">
            <div className="upa-tools">
              <div className="upa-seg" role="group" aria-label="Show payments">
                <button type="button" className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>
                  All ({n})
                </button>
                <button type="button" className={filter === "15" ? "on" : ""} onClick={() => setFilter("15")}>
                  Within 15 days ({overdue + soon})
                </button>
              </div>
              <span className="upa-sort">Sorted by due date, earliest first</span>
            </div>
            <div className={`upa-cols${showClient ? " with-client" : ""}`} aria-hidden="true">
              {showClient && <span>Client</span>}
              <span>Payment</span>
              <span>Due date</span>
              <span>Status</span>
              <span className="r">Amount</span>
              <span />
            </div>
            <div className="upa-list">
              {shown.map((i) => {
                const t = tone(i.days);
                const meta = [i.propertyNames.join(", "), i.entityName].filter(Boolean).join(" · ");
                return (
                  <div key={i.id} className={`upa-row ${t.tone}${showClient ? " with-client" : ""}`}>
                    {showClient && (
                      <Link
                        className="upa-client"
                        href={i.clientId ? `/dashboard/accountant/clients/${encodeURIComponent(i.clientId)}` : "#"}
                      >
                        <span className="upa-av">{initials(i.clientName)}</span>
                        <span className="upa-cname">{i.clientName || "Client"}</span>
                      </Link>
                    )}
                    <div className="upa-main">
                      <div className="upa-name">{i.alertName}</div>
                      {meta && <div className="upa-meta">{meta}</div>}
                    </div>
                    <div className="upa-due">
                      <span className="upa-due-l">Due </span>
                      {displayDate(i.dueDate)}
                    </div>
                    <div>
                      <span className="upd-chip">{t.chip}</span>
                    </div>
                    <div className="upa-amt">{aud(i.amount)}</div>
                    <div className="upa-act">
                      <button
                        type="button"
                        className="upd-btn pri sm"
                        onClick={() => setSheet({ id: i.id, mode: "choose" })}
                      >
                        {Icon.check}
                        Mark as paid
                      </button>
                      <button
                        type="button"
                        className="upd-ibtn"
                        aria-label={`Dismiss alert: ${i.clientName ? `${i.clientName}, ` : ""}${i.alertName}`}
                        title="Dismiss alert"
                        onClick={() => setSheet({ id: i.id, mode: "dismiss" })}
                      >
                        {Icon.x}
                      </button>
                    </div>
                  </div>
                );
              })}
              {shown.length === 0 && <div className="upd-none">Nothing due in the next 15 days.</div>}
            </div>
          </div>
        )}
      </section>

      {sheet && current && (
        <PaySheet
          token={token}
          item={current}
          mode={sheet.mode}
          phone={false}
          addTransactionHref={addTransactionHref}
          clientName={current.clientName || undefined}
          onMode={(mode) => setSheet({ id: current.id, mode })}
          onClose={() => setSheet(null)}
          onDone={(text) => finish(current, text)}
        />
      )}

      {toastEl}
    </>
  );
}
