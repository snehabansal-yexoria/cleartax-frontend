"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CoreInboxDocument, CoreInboxStatus } from "@/src/lib/coreApi";
import { formatFullTime, formatRelativeTime } from "../notifications/notificationClient";
import {
  ACCOUNTANT_INBOX_PATH,
  actionInboxDocument,
  fetchInbox,
  fetchInboxDocument,
  filingHref,
  formatFileSize,
} from "./inboxClient";
import "./documentInbox.css";

const PAGE_SIZE = 50;

const TABS: { id: CoreInboxStatus; label: string }[] = [
  { id: "pending", label: "To file" },
  { id: "filed", label: "Filed" },
  { id: "rejected", label: "Rejected" },
  { id: "discarded", label: "Discarded" },
];

type Status = "loading" | "ready" | "error";

type Dialog =
  | { kind: "reject"; doc: CoreInboxDocument }
  | { kind: "discard"; doc: CoreInboxDocument }
  | null;

// The accountant's emailed-documents inbox. With clientId it is the per-client
// "Emailed" tab; without, every client the accountant can see. Filing opens the
// Add Transaction screen; reject and discard happen here.
export default function DocumentInboxView({
  clientId,
  returnTo = ACCOUNTANT_INBOX_PATH,
  compact = false,
}: {
  clientId?: string;
  returnTo?: string;
  compact?: boolean;
}) {
  const [tab, setTab] = useState<CoreInboxStatus>("pending");
  const [items, setItems] = useState<CoreInboxDocument[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const page = await fetchInbox({ status: tab, clientId, limit: PAGE_SIZE, signal: controller.signal });
        if (controller.signal.aborted) return;
        setItems(page.items);
        setCursor(page.nextCursor);
        setPendingCount(page.pendingCount);
        setStatus("ready");
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Could not load the inbox");
        setStatus("error");
      }
    })();
    return () => controller.abort();
  }, [tab, clientId, reloadKey]);

  function chooseTab(next: CoreInboxStatus) {
    if (next === tab) return;
    setStatus("loading");
    setItems([]);
    setCursor(null);
    setTab(next);
  }

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await fetchInbox({ status: tab, clientId, cursor, limit: PAGE_SIZE });
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch (err) {
      setRowError({ id: "__more", message: err instanceof Error ? err.message : "Could not load more" });
    } finally {
      setLoadingMore(false);
    }
  }

  // The list carries no presigned URL (it would expire before anyone clicked);
  // fetch one on demand. The window is opened first so the popup blocker
  // treats it as a direct result of the click.
  async function preview(doc: CoreInboxDocument) {
    setPreviewing(doc.id);
    setRowError(null);
    const win = window.open("", "_blank");
    try {
      const detail = await fetchInboxDocument(doc.id);
      if (detail.viewUrl && win) {
        win.opener = null;
        win.location.href = detail.viewUrl;
      } else {
        win?.close();
      }
    } catch (err) {
      win?.close();
      setRowError({ id: doc.id, message: err instanceof Error ? err.message : "Could not open the document" });
    } finally {
      setPreviewing(null);
    }
  }

  function onActioned(updated: CoreInboxDocument) {
    setDialog(null);
    setItems((prev) => prev.filter((d) => d.id !== updated.id));
    setPendingCount((n) => Math.max(0, n - 1));
  }

  return (
    <section className={`inbox-page${compact ? " is-compact" : ""}`}>
      {!compact && (
        <header className="inbox-head">
          <div>
            <h1>Emailed documents</h1>
            <p>
              Receipts and invoices your clients emailed in. File each one into a transaction, or
              reject it with a note the client will see.
            </p>
          </div>
        </header>
      )}

      <div className="inbox-tabs" role="tablist" aria-label="Inbox status">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`inbox-tab${tab === t.id ? " is-active" : ""}`}
            onClick={() => chooseTab(t.id)}
          >
            {t.label}
            {t.id === "pending" && pendingCount > 0 ? <span className="inbox-count">{pendingCount}</span> : null}
          </button>
        ))}
      </div>

      {status === "loading" && (
        <div className="inbox-list" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="inbox-row is-skeleton" />
          ))}
        </div>
      )}

      {status === "error" && (
        <div className="inbox-empty">
          <strong>Couldn&apos;t load emailed documents</strong>
          <p>{error}</p>
          <button type="button" className="inbox-button" onClick={() => { setStatus("loading"); setReloadKey((k) => k + 1); }}>
            Try again
          </button>
        </div>
      )}

      {status === "ready" && items.length === 0 && (
        <div className="inbox-empty">
          <strong>{tab === "pending" ? "Nothing to file" : "Nothing here yet"}</strong>
          <p>
            {tab === "pending"
              ? "Documents clients email in will appear here."
              : `No ${TABS.find((t) => t.id === tab)?.label.toLowerCase()} documents.`}
          </p>
        </div>
      )}

      {status === "ready" && items.length > 0 && (
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
                    {!clientId && <span className="inbox-client">{doc.clientName}</span>}
                    {doc.emailSubject ? <span title={doc.emailSubject}>“{doc.emailSubject}”</span> : null}
                    {formatFileSize(doc.fileSize) ? <span>{formatFileSize(doc.fileSize)}</span> : null}
                    <time dateTime={doc.receivedAt || doc.createdAt} title={formatFullTime(doc.receivedAt || doc.createdAt)}>
                      {formatRelativeTime(doc.receivedAt || doc.createdAt)}
                    </time>
                  </span>
                  <span className="inbox-flags">
                    {doc.duplicate && <span className="inbox-flag is-warn">Possible duplicate</span>}
                    {doc.clientUnassigned && <span className="inbox-flag">No accountant assigned</span>}
                    {doc.status !== "pending" && doc.actionedByName ? (
                      <span className="inbox-flag">
                        {TABS.find((t) => t.id === doc.status)?.label} by {doc.actionedByName}
                      </span>
                    ) : null}
                  </span>
                  {doc.note ? <span className="inbox-note">{doc.note}</span> : null}
                  {rowError?.id === doc.id ? <span className="inbox-row-error">{rowError.message}</span> : null}
                </div>
              </div>
              <div className="inbox-actions">
                <button type="button" className="inbox-button is-ghost" onClick={() => preview(doc)} disabled={previewing === doc.id}>
                  {previewing === doc.id ? "Opening…" : "View"}
                </button>
                {doc.status === "pending" && (
                  <>
                    <Link className="inbox-button is-primary" href={filingHref(doc.id, returnTo)}>
                      File
                    </Link>
                    <button type="button" className="inbox-button" onClick={() => setDialog({ kind: "reject", doc })}>
                      Reject
                    </button>
                    <button type="button" className="inbox-button is-ghost" onClick={() => setDialog({ kind: "discard", doc })}>
                      Discard
                    </button>
                  </>
                )}
                {doc.status === "filed" && doc.transactionId && doc.transactionEntityId ? (
                  <Link
                    className="inbox-button is-ghost"
                    href={`/dashboard/accountant/clients/${encodeURIComponent(doc.clientId)}/entities/${encodeURIComponent(doc.transactionEntityId)}`}
                  >
                    Open entity
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {status === "ready" && cursor && (
        <div className="inbox-more">
          <button type="button" className="inbox-button" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </button>
          {rowError?.id === "__more" ? <span className="inbox-row-error">{rowError.message}</span> : null}
        </div>
      )}

      {dialog && (
        <ActionDialog
          dialog={dialog}
          onClose={() => setDialog(null)}
          onDone={onActioned}
        />
      )}
    </section>
  );
}

function ActionDialog({
  dialog,
  onClose,
  onDone,
}: {
  dialog: NonNullable<Dialog>;
  onClose: () => void;
  onDone: (doc: CoreInboxDocument) => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isReject = dialog.kind === "reject";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isReject && !text.trim()) {
      setError("Tell the client what's wrong so they can resend it.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      onDone(await actionInboxDocument(dialog.doc.id, dialog.kind, text.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <div className="inbox-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="inbox-dialog-title">
      <div className="inbox-dialog-backdrop" onClick={() => !saving && onClose()} />
      <form className="inbox-dialog" onSubmit={submit}>
        <h2 id="inbox-dialog-title">{isReject ? "Reject document" : "Discard document"}</h2>
        <p className="inbox-dialog-file">{dialog.doc.fileName}</p>
        <p>
          {isReject
            ? `${dialog.doc.clientName || "The client"} will see this note and be notified.`
            : "Use this for things that aren't documents (signatures, newsletters, duplicates). Nobody is notified."}
        </p>
        <label className="inbox-field">
          <span>{isReject ? "Note to client" : "Reason (optional)"}</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            rows={4}
            autoFocus
            placeholder={isReject ? "e.g. The receipt is cut off, please send a full photo." : "e.g. Email signature image"}
          />
        </label>
        {error ? <p className="inbox-row-error">{error}</p> : null}
        <div className="inbox-dialog-actions">
          <button type="button" className="inbox-button is-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={`inbox-button ${isReject ? "is-danger" : "is-primary"}`} disabled={saving}>
            {saving ? "Saving…" : isReject ? "Reject" : "Discard"}
          </button>
        </div>
      </form>
    </div>
  );
}
