"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

const documents = [
  ["Bank Statement - March 2026.pdf", "2.4 MB", "Mar 15, 2026"],
  ["Bank Statement - February 2026.pdf", "2.1 MB", "Feb 15, 2026"],
  ["Bank Statement - January 2026.pdf", "2.3 MB", "Jan 15, 2026"],
  ["Q4 2025 Statement.pdf", "2.8 MB", "Dec 31, 2025"],
  ["Q3 2025 Statement.pdf", "2.6 MB", "Sep 30, 2025"],
];

const rows = [
  ["ABC Property Management", "2026-03-15", "Sunset Villa", "Property Management", "Management Fees", "-$450.00", "-", "Review Match"],
  ["John Smith - Rent", "2026-03-14", "Ocean View Apartment", "Rental Income", "Monthly Rent", "-", "$2,200.00", "Review Match"],
  ["City Plumbing Services", "2026-03-12", "Not assigned", "Property Management", "", "-$385.50", "-", "Categorize"],
  ["Council Rates Payment", "2026-03-10", "Ocean View Apartment", "Council Rates", "", "-$520.00", "-", "Review Match"],
  ["Green Lawn Services", "2026-03-08", "Not assigned", "Uncategorized", "", "-$120.00", "-", "Categorize"],
  ["Insurance Premium - Building", "2026-03-05", "Ocean View Apartment", "Insurance", "Building Insurance", "-$890.00", "-", "Review Match"],
  ["Sarah Wilson - Rent", "2026-03-03", "Sunset Villa", "Rental Income", "Monthly Rent", "-", "$1,800.00", "Review Match"],
  ["Elite Cleaning Co", "2026-03-01", "Not assigned", "Uncategorized", "", "-$180.00", "-", "Categorize"],
];

export default function AccountantReconciliationPage() {
  const params = useParams<{ clientId: string; entityId: string }>();
  const clientId = String(params?.clientId || "");
  const entityId = String(params?.entityId || "");
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [hasImported, setHasImported] = useState(false);

  function toggleDocument(name: string) {
    setSelectedDocs((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name],
    );
  }

  return (
    <section className="accountant-reconciliation-page">
      <Link
        href={`/dashboard/accountant/clients/${clientId}/entities/${entityId}`}
        className="accountant-back-link"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
          <path d="M9 12h10" />
        </svg>
        Back to Entity
      </Link>

      <div className="accountant-reconciliation-title">
        <h1>Bank Reconcilliation</h1>
        {hasImported && (
          <button type="button" className="accountant-outline-button">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v12" />
              <path d="m7 8 5-5 5 5" />
              <path d="M5 21h14" />
            </svg>
            Upload Document
          </button>
        )}
      </div>

      {!hasImported ? (
        <div className="accountant-reconciliation-import-grid">
          <section className="accountant-upload-statement-card">
            <div>
              <span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3v12" />
                  <path d="m7 8 5-5 5 5" />
                  <path d="M5 21h14" />
                </svg>
              </span>
              <h2>Upload Bank Statement</h2>
              <p>Upload a new bank statement file to begin reconciliation</p>
              <button type="button">Add Bank Statement</button>
              <small>Supports PDF, CSV, OFX, and QBO files</small>
            </div>
          </section>

          <section className="accountant-existing-documents-card">
            <div className="accountant-existing-documents-head">
              <div>
                <h2>Choose from Existing Documents</h2>
                <p>Select previously uploaded bank statements</p>
              </div>
              {selectedDocs.length > 0 && <span>{selectedDocs.length} selected</span>}
            </div>

            <div className="accountant-document-select-list">
              {documents.map((document) => {
                const selected = selectedDocs.includes(document[0]);
                return (
                  <button
                    key={document[0]}
                    type="button"
                    className={selected ? "is-selected" : ""}
                    onClick={() => toggleDocument(document[0])}
                  >
                    <span className="accountant-checkbox-fake">{selected ? "✓" : ""}</span>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7 3h7l5 5v13H7z" />
                      <path d="M14 3v5h5" />
                      <path d="M9 13h6" />
                      <path d="M9 17h6" />
                    </svg>
                    <strong>{document[0]}<em>{document[1]} • {document[2]}</em></strong>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="accountant-import-documents-button"
              disabled={selectedDocs.length === 0}
              onClick={() => setHasImported(true)}
            >
              {selectedDocs.length > 0
                ? `Import ${selectedDocs.length} Selected Documents`
                : "Import Selected Documents"}
            </button>
          </section>
        </div>
      ) : (
        <>
          <section className="accountant-uploaded-statements-card">
            <div className="accountant-existing-documents-head">
              <h2>Uploaded Statements</h2>
              <button type="button">+ Add Statement</button>
            </div>
            {documents.slice(0, 3).map((document) => (
              <article key={document[0]}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 3h7l5 5v13H7z" />
                  <path d="M14 3v5h5" />
                  <path d="M9 13h6" />
                  <path d="M9 17h6" />
                </svg>
                <div>
                  <strong>{document[0]}</strong>
                  <span>{document[2]} · Uploaded: 2026-03-31 · 8 transactions</span>
                </div>
                <p><strong>$45,680.50</strong><span>Closing Balance</span></p>
              </article>
            ))}
          </section>

          <div className="accountant-reconciliation-kpis">
            <article><span>Balance Difference</span><strong>$480.50</strong><small>Bank: $45,680.5 | Portfolio: $45,200</small></article>
            <article><span>Transactions to Review</span><strong>8</strong><small>3 uncategorized</small></article>
            <article><span>Matched Transactions</span><strong className="is-good-text">5</strong><small>63% complete</small></article>
          </div>

          <section className="accountant-reconciliation-filter-card">
            <div className="accountant-reconciliation-tabs">
              <button type="button" className="is-active">Unreviewed</button>
              <button type="button">Reviewed (5)</button>
            </div>
            <div className="accountant-reconciliation-controls">
              <input type="text" placeholder="Search by payee or reference..." />
              <button type="button">All (8)</button>
              <button type="button">Matched (5)</button>
              <button type="button">Uncategorized (3)</button>
              <button type="button">Past 30 Days</button>
              <button type="button">Sort: Date⌄</button>
            </div>
          </section>

          <section className="accountant-reconciliation-table">
            <div className="accountant-reconciliation-table-head">
              <span>Date & Payee</span><span>Property</span><span>Category</span><span>Expense</span><span>Income</span><span>Action</span>
            </div>
            {rows.map((row) => (
              <div key={row[0]} className="accountant-reconciliation-table-row">
                <div><strong>{row[0]}</strong><span>{row[1]}</span><em>✓ 1 Match Found</em></div>
                <span className={row[2] === "Not assigned" ? "is-muted" : ""}>{row[2]}</span>
                <div><strong>{row[3]}</strong><span>{row[4]}</span></div>
                <strong>{row[5]}</strong>
                <strong className="is-good-text">{row[6] !== "-" ? row[6] : "-"}</strong>
                <button type="button" className={row[7] === "Categorize" ? "is-warning" : ""}>{row[7]}</button>
              </div>
            ))}
          </section>

          <footer className="accountant-reconciliation-footer">
            <span>Showing <strong>8</strong> of <strong>8</strong> transactions</span>
            <div>
              <button type="button">Export Report</button>
              <button type="button">Complete Reconciliation</button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
