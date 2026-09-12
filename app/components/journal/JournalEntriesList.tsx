"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TableRowsSkeleton } from "@/app/components/PortalSkeletons";
import ValidatedDateInput from "@/app/components/ValidatedDateInput";
import type {
  CoreJournalEntry,
  CoreJournalEntrySummary,
} from "@/src/lib/coreApi";

interface Props {
  entityId: string;
  clientId: string;
  token: string;
  disabled?: boolean;
  disabledReason?: string;
}

const PAGE_SIZES = [10, 20, 50, 100, 200];

export default function JournalEntriesList({
  entityId,
  clientId,
  token,
  disabled,
  disabledReason,
}: Props) {
  const router = useRouter();

  const [items, setItems] = useState<CoreJournalEntrySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [source, setSource] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<
    Record<string, CoreJournalEntry | "loading" | "error">
  >({});
  const [pendingDelete, setPendingDelete] = useState<CoreJournalEntrySummary | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search so a keystroke does not become a request.
  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchDraft.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchDraft]);

  // Any filter change invalidates the page number and the expansion set.
  useEffect(() => {
    setPage(1);
    setExpanded(new Set());
  }, [search, from, to, source, pageSize]);

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    if (search) sp.set("search", search);
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) sp.set("from", from);
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) sp.set("to", to);
    if (source) sp.set("source", source);
    sp.set("limit", String(pageSize));
    sp.set("offset", String((page - 1) * pageSize));
    return sp.toString();
  }, [search, from, to, source, page, pageSize]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();

    (async () => {
      setIsLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/entities/${encodeURIComponent(entityId)}/journal-entries?${query}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body?.message || body?.error || "Could not load journal entries.",
          );
        }
        const data = await res.json();
        setItems(Array.isArray(data.items) ? data.items : []);
        setTotal(Number(data.total) || 0);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setError((err as Error)?.message ?? "Could not load journal entries.");
        setItems([]);
        setTotal(0);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [entityId, token, query, nonce]);

  const toggleExpand = useCallback(
    async (entry: CoreJournalEntrySummary) => {

      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(entry.id)) next.delete(entry.id);
        else next.add(entry.id);
        return next;
      });

      if (details[entry.id]) return;
      setDetails((d) => ({ ...d, [entry.id]: "loading" }));
      try {
        const res = await fetch(
          `/api/journal-entries/${encodeURIComponent(entry.id)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) {
          // The server's reason was thrown away and replaced with "load
          // failed", so an expired session and a deleted entry looked the same.
          const body = await res.json().catch(() => ({}));
          setError(
            body?.message ||
              body?.error ||
              `Could not load the lines for this entry (${res.status}).`,
          );
          setDetails((d) => ({ ...d, [entry.id]: "error" }));
          return;
        }
        const detail = await res.json();
        setDetails((d) => ({ ...d, [entry.id]: detail }));
      } catch {
        setDetails((d) => ({ ...d, [entry.id]: "error" }));
      }
    },
    [details, token],
  );

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/journal-entries/${encodeURIComponent(pendingDelete.id)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        setError(
          body?.message ||
            body?.error ||
            `Could not delete that entry (${res.status}).`,
        );
        // Close the confirm dialog. The error banner renders above the table,
        // behind the modal layer, so leaving it open showed the user a dialog
        // that appeared to do nothing when they pressed Delete.
        setPendingDelete(null);
        return;
      }
      setPendingDelete(null);
      setNonce((n) => n + 1);
    } finally {
      setIsDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);

  const editHref = (id: string) =>
    `/dashboard/accountant/clients/${clientId}/entities/${entityId}/journal-entry/${id}/edit`;

  return (
    <div className="journal-list">
      <div className="journal-list-filters">
        <input
          type="search"
          placeholder="Search reference, memo, account or description"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
        />
        <label>
          <span>From</span>
          <ValidatedDateInput
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          <span>To</span>
          <ValidatedDateInput
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          <span>Source</span>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All</option>
            <option value="manual">Manual</option>
            <option value="csv">CSV import</option>
          </select>
        </label>
      </div>

      {error && <div className="entity-wizard-error">{error}</div>}

      <div className="transactions-table-wrap">
        <table className="transactions-table journal-list-table">
          <thead>
            <tr>
              <th scope="col" className="transactions-expand-col" />
              <th scope="col">Entry</th>
              <th scope="col">Date</th>
              <th scope="col">Reference</th>
              <th scope="col">Property</th>
              <th scope="col" className="is-numeric">Lines</th>
              <th scope="col" className="is-numeric">Debit</th>
              <th scope="col" className="is-numeric">Credit</th>
              <th scope="col">Source</th>
              <th scope="col">Created by</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableRowsSkeleton rows={4} columns={11} />}

            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={11} className="transactions-empty-state">
                  No journal entries yet.
                </td>
              </tr>
            )}

            {!isLoading &&
              items.map((entry) => {
                const isOpen = expanded.has(entry.id);
                const detail = details[entry.id];
                return (
                  <Fragment key={entry.id}>
                    <tr>
                      <td className="transactions-expand-col">
                        <button
                          type="button"
                          className="journal-expand-button"
                          aria-expanded={isOpen}
                          aria-label={`${isOpen ? "Hide" : "Show"} lines for ${entry.entryNo}`}
                          onClick={() => void toggleExpand(entry)}
                        >
                          {isOpen ? "▾" : "▸"}
                        </button>
                      </td>
                      <td>{entry.entryNo}</td>
                      <td>{entry.entryDate}</td>
                      <td>{entry.reference || entry.memo || "—"}</td>
                      <td>
                        {entry.propertyNames.length === 0
                          ? "—"
                          : entry.propertyNames.length === 1
                            ? entry.propertyNames[0]
                            : `${entry.propertyNames.length} properties`}
                      </td>
                      <td className="is-numeric">{entry.lineCount}</td>
                      <td className="is-numeric">{entry.totalDebit.toFixed(2)}</td>
                      <td className="is-numeric">{entry.totalCredit.toFixed(2)}</td>
                      <td>
                        <span className="journal-status-chip">
                          {entry.source === "csv" ? "CSV import" : "Manual"}
                        </span>
                      </td>
                      <td>{entry.createdByName || entry.createdBy || "—"}</td>
                      <td>
                        <div className="journal-row-actions">
                          <button
                            type="button"
                            className="journal-link-button"
                            disabled={disabled}
                            title={disabled ? disabledReason : undefined}
                            onClick={() => router.push(editHref(entry.id))}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="journal-link-button is-danger"
                            disabled={disabled}
                            title={disabled ? disabledReason : undefined}
                            onClick={() => setPendingDelete(entry)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="transaction-child-row">
                        <td colSpan={11}>
                          {detail === "loading" && <p>Loading lines…</p>}
                          {detail === "error" && (
                            <p className="entity-wizard-error">
                              Could not load the lines for this entry.
                            </p>
                          )}
                          {detail && detail !== "loading" && detail !== "error" && (
                            <table className="journal-grid journal-line-table">
                              <thead>
                                <tr>
                                  <th scope="col">Account</th>
                                  <th scope="col">Property</th>
                                  <th scope="col" className="is-numeric">Debit</th>
                                  <th scope="col" className="is-numeric">Credit</th>
                                  <th scope="col">GST code</th>
                                  <th scope="col" className="is-numeric">GST</th>
                                  <th scope="col">Name</th>
                                  <th scope="col">Description</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detail.lines.map((line) => (
                                  <tr key={line.id}>
                                    <td>
                                      {line.accountCode} {line.accountName}
                                      <span
                                        className={`journal-account-chip is-${line.accountCategory}`}
                                      >
                                        {line.accountCategory}
                                      </span>
                                    </td>
                                    <td>{line.propertyName || "—"}</td>
                                    <td className="is-numeric">
                                      {line.debit ? line.debit.toFixed(2) : "—"}
                                    </td>
                                    <td className="is-numeric">
                                      {line.credit ? line.credit.toFixed(2) : "—"}
                                    </td>
                                    <td>{line.gstCode || "—"}</td>
                                    <td className="is-numeric">
                                      {line.gstAmount ? line.gstAmount.toFixed(2) : "—"}
                                    </td>
                                    <td>{line.name || "—"}</td>
                                    <td>{line.description || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
          </tbody>
        </table>
      </div>

      <footer className="premium-pagination-container">
        <div className="premium-pagination-size">
          <label>
            Rows per page
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="transactions-showing-copy">
          {total === 0
            ? "No entries"
            : `${firstRow}–${lastRow} of ${total} entries`}
        </div>
        <div className="premium-pagination-controls">
          <button type="button" disabled={page <= 1} onClick={() => setPage(1)}>
            First
          </button>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span className="premium-pagination-page">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(totalPages)}
          >
            Last
          </button>
        </div>
      </footer>

      {pendingDelete && (
        <div className="transaction-modal-layer" role="dialog" aria-modal="true">
          <div className="transaction-modal">
            <div className="transaction-modal-header">
              <h2>Delete {pendingDelete.entryNo}?</h2>
            </div>
            <div className="transaction-modal-body">
              <p>
                This removes the entry and reverses everything it posted — the
                P&amp;L, All Transactions and the General Ledger all update.
              </p>
              <p>
                {pendingDelete.entryDate} ·{" "}
                {pendingDelete.reference || "no reference"} · A${" "}
                {pendingDelete.totalDebit.toFixed(2)}
              </p>
            </div>
            <div className="transaction-modal-footer">
              <button
                type="button"
                className="entity-wizard-secondary"
                disabled={isDeleting}
                onClick={() => setPendingDelete(null)}
              >
                Keep it
              </button>
              <button
                type="button"
                className="entity-wizard-primary is-orange"
                disabled={isDeleting}
                onClick={() => void handleDelete()}
              >
                {isDeleting ? "Deleting…" : "Delete entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
