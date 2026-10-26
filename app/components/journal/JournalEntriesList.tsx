"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TableRowsSkeleton } from "@/app/components/PortalSkeletons";
import ValidatedDateInput from "@/app/components/ValidatedDateInput";
import { StaticSelect } from "@/app/components/TransactionsFeature";
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

const SOURCE_OPTIONS = [
  { label: "All", value: "" },
  { label: "Manual", value: "manual" },
  { label: "CSV import", value: "csv" },
];

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
  const [pageInputValue, setPageInputValue] = useState<string>("1");
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

  // Sync page input value with current page
  useEffect(() => {
    setPageInputValue(String(page));
  }, [page]);

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
        <div className="journal-search-field">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            placeholder="Search reference, memo, account or description"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            aria-label="Search journal entries"
          />
        </div>
        <div className="journal-filter-field">
          <span className="journal-filter-field-label">From</span>
          <ValidatedDateInput
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="journal-filter-field">
          <span className="journal-filter-field-label">To</span>
          <ValidatedDateInput
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="journal-filter-field">
          <span className="journal-filter-field-label">Source</span>
          <StaticSelect
            value={source}
            options={SOURCE_OPTIONS}
            onChange={(val) => setSource(val)}
          />
        </div>
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
              <th scope="col" className="journal-col-actions">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableRowsSkeleton rows={4} columns={11} />}

            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={11} className="journal-empty-cell">
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
                      <td className="journal-col-actions">
                        <div className="journal-row-actions">
                          <button
                            type="button"
                            className="journal-icon-button"
                            disabled={disabled}
                            title={disabled ? disabledReason : "Edit entry"}
                            aria-label={`Edit ${entry.entryNo}`}
                            onClick={() => router.push(editHref(entry.id))}
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="journal-icon-button is-danger"
                            disabled={disabled}
                            title={disabled ? disabledReason : "Delete entry"}
                            aria-label={`Delete ${entry.entryNo}`}
                            onClick={() => setPendingDelete(entry)}
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
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
        {/* Left Section: Items per page and page range details */}
        <div className="premium-pagination-left">
          <span className="premium-pagination-label">Items per page</span>
          <div className="premium-pagination-select-wrapper">
            <select
              className="premium-pagination-select"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <span className="premium-pagination-info">
            {total === 0
              ? "0 entries"
              : `${firstRow}–${lastRow} of ${total} entries`}
          </span>
        </div>

        {/* Right Section: First, Previous, Page Input, Next, Last */}
        <div className="premium-pagination-right">
          {/* First Page */}
          <button
            type="button"
            className="premium-pagination-btn premium-pagination-icon-btn"
            title="First Page"
            onClick={() => setPage(1)}
            disabled={page === 1 || totalPages <= 1}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "14px", height: "14px" }}>
              <line x1="5" y1="5" x2="5" y2="19" />
              <polyline points="19 5 12 12 19 19" />
            </svg>
          </button>

          {/* Previous Page */}
          <button
            type="button"
            className="premium-pagination-btn"
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={page === 1 || totalPages <= 1}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "14px", height: "14px" }}>
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="premium-pagination-btn-text">Previous</span>
          </button>

          {/* Page Selector Input Box */}
          <div className="premium-pagination-page-input-wrapper">
            <input
              type="number"
              className="premium-pagination-page-input"
              value={pageInputValue}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "") {
                  setPageInputValue("");
                  return;
                }
                if (/^[1-9]\d*$/.test(value)) {
                  const pageNum = Number(value);
                  if (pageNum <= totalPages) {
                    setPageInputValue(value);
                  }
                }
              }}
              onBlur={() => {
                const pageNum = Number(pageInputValue);
                if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                  setPage(pageNum);
                } else {
                  setPageInputValue(String(page));
                }
              }}
              onKeyDown={(e) => {
                if (["e", "E", "-", "+", "."].includes(e.key)) {
                  e.preventDefault();
                  return;
                }
                if (e.key === "Enter") {
                  const pageNum = Number(pageInputValue);
                  if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                    setPage(pageNum);
                    e.currentTarget.blur();
                  } else {
                    setPageInputValue(String(page));
                    e.currentTarget.blur();
                  }
                }
              }}
              onPaste={(e) => {
                const pastedData = e.clipboardData.getData("text");
                if (!/^[1-9]\d*$/.test(pastedData) || Number(pastedData) > totalPages) {
                  e.preventDefault();
                }
              }}
              min={1}
              max={totalPages}
            />
            <span className="premium-pagination-label">of {totalPages}</span>
          </div>

          {/* Next Page */}
          <button
            type="button"
            className="premium-pagination-btn"
            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={page === totalPages || totalPages <= 1}
          >
            <span className="premium-pagination-btn-text">Next</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "14px", height: "14px" }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          {/* Last Page */}
          <button
            type="button"
            className="premium-pagination-btn premium-pagination-icon-btn"
            title="Last Page"
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages || totalPages <= 1}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "14px", height: "14px" }}>
              <line x1="19" y1="5" x2="19" y2="19" />
              <polyline points="5 5 12 12 5 19" />
            </svg>
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
