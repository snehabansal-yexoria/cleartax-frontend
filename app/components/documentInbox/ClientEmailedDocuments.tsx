"use client";

import { useEffect, useState } from "react";
import type { CoreInboxDocument, CoreInboxStatus } from "@/src/lib/coreApi";
import { formatFullTime, formatRelativeTime } from "../notifications/notificationClient";
import { fetchInbox, fetchInboxAddress } from "./inboxClient";
import "./documentInbox.css";

const STATUS_LABEL: Record<CoreInboxStatus, string> = {
  pending: "Received",
  filed: "Filed",
  rejected: "Needs attention",
  discarded: "Not filed",
};

// "Email your documents to …" with a copy button. Renders nothing until the
// address loads, and nothing at all while intake is switched off.
export function EmailDocumentsHint({ compact = false }: { compact?: boolean }) {
  const [address, setAddress] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchInboxAddress()
      .then((a) => {
        if (!cancelled && a.enabled) setAddress(a.address);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!address) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: the address is still on screen to select by hand.
    }
  }

  return (
    <div className={`inbox-hint${compact ? " is-compact" : ""}`}>
      <span className="inbox-hint-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      </span>
      <div className="inbox-hint-text">
        <strong>Prefer email?</strong>
        <span>
          Send receipts and invoices (PDF, JPG or PNG) from your login email to{" "}
          <a href={`mailto:${address}`}>{address}</a>. Your accountant will file them.
        </span>
      </div>
      <button type="button" className="inbox-button is-ghost" onClick={copy}>
        {copied ? "Copied" : "Copy address"}
      </button>
    </div>
  );
}

// The client's own emailed documents and what happened to each. Hidden when
// they have never emailed anything.
export default function ClientEmailedDocuments({ limit = 10 }: { limit?: number }) {
  const [items, setItems] = useState<CoreInboxDocument[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchInbox({ status: "all", limit, signal: controller.signal })
      .then((page) => {
        if (controller.signal.aborted) return;
        setItems(page.items);
        setLoaded(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoaded(true);
      });
    return () => controller.abort();
  }, [limit]);

  if (!loaded || items.length === 0) return null;

  return (
    <section className="inbox-page is-compact inbox-client-list" aria-labelledby="client-emailed-title">
      <h2 id="client-emailed-title" className="inbox-section-title">Emailed documents</h2>
      <ul className="inbox-list">
        {items.map((doc) => (
          <li key={doc.id} className="inbox-row">
            <div className="inbox-file">
              <span className="inbox-file-icon" aria-hidden="true">
                {doc.mimeType === "application/pdf" ? "PDF" : "IMG"}
              </span>
              <div className="inbox-file-text">
                <strong title={doc.fileName}>{doc.fileName}</strong>
                <span className="inbox-meta">
                  <time dateTime={doc.receivedAt || doc.createdAt} title={formatFullTime(doc.receivedAt || doc.createdAt)}>
                    Sent {formatRelativeTime(doc.receivedAt || doc.createdAt)}
                  </time>
                </span>
                {doc.status === "rejected" && doc.note ? <span className="inbox-note">{doc.note}</span> : null}
              </div>
            </div>
            <span className={`inbox-status is-${doc.status}`}>{STATUS_LABEL[doc.status]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
