"use client";

import { useState } from "react";

export const CLIENT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

/**
 * Page-based navigation for a server-paged client list.
 *
 * The same controls as the accountant grid's footer (TransactionsFeature) —
 * page size, "21–40 of 132", First / Previous / page box / Next / Last — but
 * styled from the client portal's theme tokens (client.css `.client-pager`),
 * because that footer's classes are light-only and the portal has dark mode.
 * `compact` (phones) keeps Previous / "Page 2 of 7" / Next.
 */
export default function ClientPagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  disabled = false,
  compact = false,
}: {
  /** 1-based. */
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  /** While a page is loading: the buttons wait rather than queue requests. */
  disabled?: boolean;
  compact?: boolean;
}) {
  const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
  const current = Math.min(Math.max(page, 1), totalPages);
  const first = totalItems === 0 ? 0 : (current - 1) * pageSize + 1;
  const last = Math.min(current * pageSize, totalItems);

  // The box holds what is typed; the page only changes on Enter or blur. It
  // follows the page whenever the page moves (adjusted during render, React's
  // pattern for state derived from a prop, rather than in an effect).
  const [draft, setDraft] = useState(String(current));
  const [draftFor, setDraftFor] = useState(current);
  if (draftFor !== current) {
    setDraftFor(current);
    setDraft(String(current));
  }

  const go = (next: number) => {
    const clamped = Math.min(Math.max(next, 1), totalPages);
    if (clamped !== current) onPageChange(clamped);
  };
  const commitDraft = () => {
    const n = Number(draft);
    if (Number.isInteger(n) && n >= 1 && n <= totalPages) go(n);
    else setDraft(String(current));
  };

  const atFirst = current <= 1 || disabled;
  const atLast = current >= totalPages || disabled;

  if (compact) {
    return (
      <nav className="client-pager is-compact" aria-label="Pagination">
        <button type="button" className="client-pager-btn" onClick={() => go(current - 1)} disabled={atFirst}>
          <Chevron dir="left" />
          Previous
        </button>
        <span className="client-pager-info" aria-live="polite">
          Page {current} of {totalPages}
        </span>
        <button type="button" className="client-pager-btn" onClick={() => go(current + 1)} disabled={atLast}>
          Next
          <Chevron dir="right" />
        </button>
      </nav>
    );
  }

  return (
    <nav className="client-pager" aria-label="Pagination">
      <div className="client-pager-left">
        {onPageSizeChange ? (
          <label className="client-pager-size">
            <span>Items per page</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              disabled={disabled}
            >
              {CLIENT_PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <span className="client-pager-info" aria-live="polite">
          {first}–{last} of {totalItems}
        </span>
      </div>
      <div className="client-pager-right">
        <button type="button" className="client-pager-btn is-icon" onClick={() => go(1)} disabled={atFirst} title="First page" aria-label="First page">
          <Chevron dir="first" />
        </button>
        <button type="button" className="client-pager-btn" onClick={() => go(current - 1)} disabled={atFirst}>
          <Chevron dir="left" />
          Previous
        </button>
        <label className="client-pager-page">
          <span className="sr-only">Page</span>
          <input
            type="text"
            inputMode="numeric"
            value={draft}
            disabled={disabled}
            onChange={(e) => {
              if (/^\d*$/.test(e.target.value)) setDraft(e.target.value);
            }}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitDraft();
                e.currentTarget.blur();
              }
            }}
            aria-label={`Page, of ${totalPages}`}
          />
          <span>of {totalPages}</span>
        </label>
        <button type="button" className="client-pager-btn" onClick={() => go(current + 1)} disabled={atLast}>
          Next
          <Chevron dir="right" />
        </button>
        <button type="button" className="client-pager-btn is-icon" onClick={() => go(totalPages)} disabled={atLast} title="Last page" aria-label="Last page">
          <Chevron dir="last" />
        </button>
      </div>
    </nav>
  );
}

function Chevron({ dir }: { dir: "left" | "right" | "first" | "last" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: "14px", height: "14px" }}>
      {dir === "left" && <polyline points="15 18 9 12 15 6" />}
      {dir === "right" && <polyline points="9 18 15 12 9 6" />}
      {dir === "first" && (
        <>
          <line x1="5" y1="5" x2="5" y2="19" />
          <polyline points="19 5 12 12 19 19" />
        </>
      )}
      {dir === "last" && (
        <>
          <line x1="19" y1="5" x2="19" y2="19" />
          <polyline points="5 5 12 12 5 19" />
        </>
      )}
    </svg>
  );
}
