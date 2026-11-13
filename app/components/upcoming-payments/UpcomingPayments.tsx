"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getIdToken } from "@/src/lib/authToken";
import { aud, daysUntil, displayDate, loadUpcomingPayments, type UpcomingPayment } from "./upcomingPaymentsApi";
import { Icon, tone } from "./PaySheet";
import "./upcoming-payments.css";

/**
 * Client dashboard → Upcoming payments. Regular payments the client set up
 * on Add Transaction, closest due date first, coloured within 15 days.
 *
 * Read-only for the client: their accountant marks a payment as paid (or
 * dismisses the alert) from the accountant's transaction pages, which clears
 * it here too. Desktop/tablet: a short list that scrolls inside the card.
 * Phone: one card at a time, swiped sideways.
 */
export default function UpcomingPayments({
  variant = "desktop",
  addTransactionHref,
}: {
  variant?: "desktop" | "phone";
  addTransactionHref: string;
}) {
  const [token, setToken] = useState("");
  const [items, setItems] = useState<UpcomingPayment[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState<"all" | "15">("all");

  const reload = useCallback(async (tk: string) => {
    try {
      setItems(await loadUpcomingPayments(tk));
      setLoadError("");
    } catch (err) {
      setLoadError((err as Error)?.message || "Could not load upcoming payments.");
      setItems([]);
    }
  }, []);

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

  const live = useMemo(
    () => (items ?? []).map((i) => ({ ...i, days: daysUntil(i.dueDate) })).sort((a, b) => a.days - b.days),
    [items],
  );
  const overdue = live.filter((i) => i.days < 0).length;
  const soon = live.filter((i) => i.days >= 0 && i.days <= 15).length;
  const urgent = live.some((i) => i.days <= 3);
  const shown = filter === "15" ? live.filter((i) => i.days <= 15) : live;

  if (items === null) return null; // the dashboard's own skeleton covers the first paint

  if (live.length === 0) {
    return (
      <section className="upd upd--slim" aria-label="Upcoming payments">
        <span className="upd-slim-ic">{Icon.check}</span>
        <b>{loadError ? "Upcoming payments couldn’t load" : "No upcoming payments"}</b>
        <span className="upd-slim-sub">
          {loadError ? loadError : "Regular payments show here before they’re due."}
        </span>
        {loadError ? (
          <button type="button" className="upd-slim-link" onClick={() => void reload(token)}>
            Try again
          </button>
        ) : (
          <Link className="upd-slim-link" href={addTransactionHref}>
            Add transaction
          </Link>
        )}
      </section>
    );
  }

  return (
    <section
      className={`upd upd--readonly${variant === "phone" ? " upd--phone" : ""}`}
      aria-labelledby="upd-title"
    >
      <div className="upd-head">
        <span className="upd-hic">{Icon.calendar}</span>
        <h3 className="upd-title" id="upd-title">
          Upcoming payments
        </h3>
        <div className="upd-counts">
          {overdue > 0 && <span className="upd-count">{overdue} overdue</span>}
          {soon > 0 && <span className={`upd-count${urgent ? "" : " amb"}`}>{soon} due within 15 days</span>}
        </div>
        {variant === "phone" ? (
          shown.length > 1 && <span className="upd-swipe">Swipe for {shown.length - 1} more</span>
        ) : (
          <div className="upd-tabs" role="group" aria-label="Show payments">
            <button type="button" className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>
              All ({live.length})
            </button>
            <button type="button" className={filter === "15" ? "on" : ""} onClick={() => setFilter("15")}>
              Within 15 days ({overdue + soon})
            </button>
          </div>
        )}
      </div>
      <div className="upd-list">
        {shown.map((i, n) => {
          const t = tone(i.days);
          const first = n === 0 && t.tone === "red";
          const meta = [i.propertyNames.join(", "), i.entityName].filter(Boolean).join(" · ");
          return (
            <div key={i.id} className={`upd-row ${t.tone}${first ? " first" : ""}`}>
              <span className="upd-ric">{Icon.clock}</span>
              <div className="upd-main">
                <div className="upd-name">
                  <span>{i.alertName}</span>
                  {first && <span className="upd-next">Next due</span>}
                </div>
                <div className="upd-meta">{meta}</div>
                <div className="upd-dl">
                  Due {displayDate(i.dueDate)} <span className="upd-chip">{t.chip}</span>
                </div>
              </div>
              <div className="upd-due">{displayDate(i.dueDate)}</div>
              <span className="upd-chip upd-chip--col">{t.chip}</span>
              <div className="upd-amt">{aud(i.amount)}</div>
            </div>
          );
        })}
        {shown.length === 0 && <div className="upd-none">Nothing due in the next 15 days.</div>}
      </div>
      <p className="upd-foot-note">Your accountant marks these as paid once the payment is recorded.</p>
    </section>
  );
}
