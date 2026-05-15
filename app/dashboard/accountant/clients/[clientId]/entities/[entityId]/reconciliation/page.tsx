"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

type ReconciliationDocument = {
  name: string;
  size: string;
  date: string;
  uploadedAt: string;
  transactions: number;
  closingBalance: string;
};

type ReconciliationRow = {
  payee: string;
  date: string;
  property: string | null;
  category: string;
  subcategory?: string;
  expense?: string;
  income?: string;
  status: "matched" | "uncategorized";
};

type ReconciliationFilter = "all" | "matched" | "uncategorized" | "categorized";
type ReconciliationDateRange = "all" | "past30";
type ReconciliationSort = "desc" | "asc";

const existingDocuments: ReconciliationDocument[] = [
  {
    name: "Bank Statement - March 2026.pdf",
    size: "2.4 MB",
    date: "Mar 15, 2026",
    uploadedAt: "2026-03-31",
    transactions: 8,
    closingBalance: "$45,680.50",
  },
  {
    name: "Bank Statement - February 2026.pdf",
    size: "2.1 MB",
    date: "Feb 15, 2026",
    uploadedAt: "2026-03-31",
    transactions: 8,
    closingBalance: "$45,680.50",
  },
  {
    name: "Bank Statement - January 2026.pdf",
    size: "2.3 MB",
    date: "Jan 15, 2026",
    uploadedAt: "2026-03-31",
    transactions: 8,
    closingBalance: "$45,680.50",
  },
  {
    name: "Q4 2025 Statement.pdf",
    size: "2.8 MB",
    date: "Dec 31, 2025",
    uploadedAt: "2026-01-08",
    transactions: 12,
    closingBalance: "$44,910.10",
  },
  {
    name: "Q3 2025 Statement.pdf",
    size: "2.6 MB",
    date: "Sep 30, 2025",
    uploadedAt: "2025-10-05",
    transactions: 10,
    closingBalance: "$43,820.00",
  },
];

const uploadedDocumentTemplate: ReconciliationDocument = {
  name: "Uploaded Bank Statement - May 2026.pdf",
  size: "2.5 MB",
  date: "May 15, 2026",
  uploadedAt: "2026-05-15",
  transactions: 8,
  closingBalance: "$46,120.20",
};

const rows: ReconciliationRow[] = [
  {
    payee: "ABC Property Management",
    date: "2026-03-15",
    property: "Sunset Villa",
    category: "Property Management",
    subcategory: "Management Fees",
    expense: "-$450.00",
    status: "matched",
  },
  {
    payee: "John Smith - Rent",
    date: "2026-03-14",
    property: "Ocean View Apartment",
    category: "Rental Income",
    subcategory: "Monthly Rent",
    income: "$2,200.00",
    status: "matched",
  },
  {
    payee: "City Plumbing Services",
    date: "2026-03-12",
    property: null,
    category: "Property Management",
    expense: "-$385.50",
    status: "uncategorized",
  },
  {
    payee: "Council Rates Payment",
    date: "2026-03-10",
    property: "Ocean View Apartment",
    category: "Council Rates",
    expense: "-$520.00",
    status: "matched",
  },
  {
    payee: "Green Lawn Services",
    date: "2026-03-08",
    property: null,
    category: "Uncategorized",
    expense: "-$120.00",
    status: "uncategorized",
  },
  {
    payee: "Insurance Premium - Building",
    date: "2026-03-05",
    property: "Ocean View Apartment",
    category: "Insurance",
    subcategory: "Building Insurance",
    expense: "-$890.00",
    status: "matched",
  },
  {
    payee: "Sarah Wilson - Rent",
    date: "2026-03-03",
    property: "Sunset Villa",
    category: "Rental Income",
    subcategory: "Monthly Rent",
    income: "$1,800.00",
    status: "matched",
  },
  {
    payee: "Elite Cleaning Co",
    date: "2026-03-01",
    property: null,
    category: "Uncategorized",
    expense: "-$180.00",
    status: "uncategorized",
  },
];

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 21h14" />
    </svg>
  );
}

export default function AccountantReconciliationPage() {
  const params = useParams<{ clientId: string; entityId: string }>();
  const clientId = String(params?.clientId || "");
  const entityId = String(params?.entityId || "");
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [uploadedDocuments, setUploadedDocuments] = useState<ReconciliationDocument[]>([]);
  const [hasImported, setHasImported] = useState(false);
  const [activeTab, setActiveTab] = useState<"unreviewed" | "reviewed">("unreviewed");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ReconciliationFilter>("all");
  const [dateRange, setDateRange] = useState<ReconciliationDateRange>("past30");
  const [sortDirection, setSortDirection] = useState<ReconciliationSort>("desc");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const selectedDocuments = useMemo(
    () => existingDocuments.filter((document) => selectedDocs.includes(document.name)),
    [selectedDocs],
  );
  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const newestRowTime = Math.max(...rows.map((row) => new Date(row.date).getTime()));
    const cutoff = newestRowTime - 30 * 24 * 60 * 60 * 1000;

    return rows
      .filter((row) => {
        if (activeTab === "reviewed" && row.status === "uncategorized") return false;
        if (filter === "matched" && row.status !== "matched") return false;
        if (filter === "uncategorized" && row.status !== "uncategorized") return false;
        if (
          filter === "categorized" &&
          (row.status === "uncategorized" || row.category === "Uncategorized")
        ) {
          return false;
        }
        if (dateRange === "past30" && new Date(row.date).getTime() < cutoff) {
          return false;
        }
        if (!normalizedQuery) return true;

        return [
          row.payee,
          row.date,
          row.property ?? "Not assigned",
          row.category,
          row.subcategory ?? "",
          row.expense ?? "",
          row.income ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((a, b) => {
        const aTime = new Date(a.date).getTime();
        const bTime = new Date(b.date).getTime();
        return sortDirection === "desc" ? bTime - aTime : aTime - bTime;
      });
  }, [activeTab, dateRange, filter, query, sortDirection]);

  function toggleDocument(name: string) {
    setSelectedDocs((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name],
    );
  }

  function importSelectedDocuments() {
    if (selectedDocs.length === 0) return;
    setUploadedDocuments((current) => {
      const byName = new Map(current.map((document) => [document.name, document]));
      selectedDocuments.forEach((document) => byName.set(document.name, document));
      return Array.from(byName.values());
    });
    setFeedbackMessage(`${selectedDocs.length} statement${selectedDocs.length === 1 ? "" : "s"} imported.`);
    setHasImported(true);
  }

  function openUploadArea() {
    setSelectedDocs([]);
    setFeedbackMessage("");
    setHasImported(false);
  }

  function addUploadedStatement() {
    setUploadedDocuments((current) => {
      const existingNames = new Set(current.map((document) => document.name));
      if (!existingNames.has(uploadedDocumentTemplate.name)) {
        return [uploadedDocumentTemplate, ...current];
      }

      const nextIndex = current.length + 1;
      return [
        {
          ...uploadedDocumentTemplate,
          name: `Uploaded Bank Statement - May 2026 (${nextIndex}).pdf`,
        },
        ...current,
      ];
    });
    setFeedbackMessage("Bank statement uploaded.");
    setHasImported(true);
  }

  function deleteUploadedDocument(name: string) {
    setUploadedDocuments((current) =>
      current.filter((document) => document.name !== name),
    );
    setSelectedDocs((current) => current.filter((documentName) => documentName !== name));
    setFeedbackMessage("Statement removed.");
  }

  function switchTab(tab: "unreviewed" | "reviewed") {
    setActiveTab(tab);
    setFilter("all");
  }

  function handleRowAction(row: ReconciliationRow) {
    if (activeTab === "reviewed") {
      setFeedbackMessage(`${row.payee} was reset for review.`);
      setActiveTab("unreviewed");
      return;
    }
    setFeedbackMessage(`${row.payee} marked for match review.`);
  }

  function handleExportReport() {
    setFeedbackMessage(`Export prepared for ${visibleRows.length} visible transactions.`);
  }

  function handleCompleteReconciliation() {
    setFeedbackMessage("Reconciliation marked complete.");
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
        <h1>Bank Reconciliation</h1>
        {hasImported && (
          <button
            type="button"
            className="accountant-reconciliation-upload-button"
            onClick={openUploadArea}
          >
            <UploadIcon />
            Upload Document
          </button>
        )}
      </div>

      {!hasImported ? (
        <div className="accountant-reconciliation-import-grid">
          <section className="accountant-upload-statement-card">
            <div>
              <span>
                <UploadIcon />
              </span>
              <h2>Upload Bank Statement</h2>
              <p>Upload a new bank statement file to begin reconciliation</p>
              <button type="button" onClick={addUploadedStatement}>
                <UploadIcon />
                Add Bank Statement
              </button>
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

            {existingDocuments.length === 0 ? (
              <div className="accountant-document-empty-state">
                <DocumentIcon />
                <strong>No bank statements found</strong>
                <p>Upload a bank statement to begin reconciliation.</p>
              </div>
            ) : (
              <div className="accountant-document-select-list">
                {existingDocuments.map((document) => {
                  const selected = selectedDocs.includes(document.name);
                  return (
                    <button
                      key={document.name}
                      type="button"
                      className={selected ? "is-selected" : ""}
                      onClick={() => toggleDocument(document.name)}
                    >
                      <span className="accountant-checkbox-fake">
                        {selected ? "✓" : ""}
                      </span>
                      <DocumentIcon />
                      <strong>
                        {document.name}
                        <em>{document.size} • {document.date}</em>
                      </strong>
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              className="accountant-import-documents-button"
              disabled={selectedDocs.length === 0}
              onClick={importSelectedDocuments}
            >
              {selectedDocs.length > 0
                ? `Import ${selectedDocs.length} Selected Documents`
                : "Import Selected Documents"}
            </button>
          </section>
        </div>
      ) : (
        <>
          {feedbackMessage && (
            <div className="accountant-reconciliation-feedback" role="status">
              {feedbackMessage}
            </div>
          )}

          <section className="accountant-uploaded-statements-card">
            <div className="accountant-existing-documents-head">
              <h2>Uploaded Statements</h2>
              <button type="button" onClick={openUploadArea}>
                + Add Statement
              </button>
            </div>

            {uploadedDocuments.length === 0 ? (
              <div className="accountant-document-empty-state is-inline">
                <DocumentIcon />
                <strong>No uploaded statements yet</strong>
                <p>Add or import a bank statement to see reconciliation details.</p>
              </div>
            ) : (
              uploadedDocuments.map((document) => (
                <article key={document.name}>
                  <DocumentIcon />
                  <div>
                    <strong>{document.name}</strong>
                    <span>
                      {document.date} · Uploaded: {document.uploadedAt} ·{" "}
                      {document.transactions} transactions
                    </span>
                  </div>
                  <p>
                    <strong>{document.closingBalance}</strong>
                    <span>Closing Balance</span>
                  </p>
                  <button
                    type="button"
                    aria-label={`Remove ${document.name}`}
                    onClick={() => deleteUploadedDocument(document.name)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M6 6l1 15h10l1-15" />
                    </svg>
                  </button>
                </article>
              ))
            )}
          </section>

          <div className="accountant-reconciliation-kpis">
            <article>
              <div>
                <span>Balance Difference</span>
                <mark>Review</mark>
              </div>
              <strong>$480.50</strong>
              <small>Bank: $45,680.5 | Portfolio: $45,200</small>
            </article>
            <article>
              <span>Transactions to Review</span>
              <strong>8</strong>
              <small>3 uncategorized</small>
            </article>
            <article>
              <span>Matched Transactions</span>
              <strong className="is-good-text">5</strong>
              <small>63% complete</small>
            </article>
          </div>

          <section className="accountant-reconciliation-filter-card">
            <div className="accountant-reconciliation-tabs">
              <button
                type="button"
                className={activeTab === "unreviewed" ? "is-active" : ""}
                onClick={() => switchTab("unreviewed")}
              >
                Unreviewed
              </button>
              <button
                type="button"
                className={activeTab === "reviewed" ? "is-active" : ""}
                onClick={() => switchTab("reviewed")}
              >
                Reviewed (5)
              </button>
            </div>
            <div className="accountant-reconciliation-controls">
              <label>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m16 16 4 4" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by payee or reference..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <button
                type="button"
                className={filter === "all" ? "is-active" : ""}
                onClick={() => setFilter("all")}
              >
                {activeTab === "reviewed" ? "All Reviewed" : "All (8)"}
              </button>
              <button
                type="button"
                className={filter === "matched" ? "is-active" : ""}
                onClick={() => setFilter("matched")}
              >
                {activeTab === "reviewed" ? "Matched Only" : "Matched (5)"}
              </button>
              <button
                type="button"
                className={
                  filter === (activeTab === "reviewed" ? "categorized" : "uncategorized")
                    ? "is-active"
                    : ""
                }
                onClick={() =>
                  setFilter(activeTab === "reviewed" ? "categorized" : "uncategorized")
                }
              >
                {activeTab === "reviewed" ? "Categorized Only" : "Uncategorized (3)"}
              </button>
              <button
                type="button"
                className={dateRange === "past30" ? "is-active" : ""}
                onClick={() =>
                  setDateRange((current) => (current === "past30" ? "all" : "past30"))
                }
              >
                {dateRange === "past30" ? "Past 30 Days" : "All Dates"}
              </button>
              <button
                type="button"
                onClick={() =>
                  setSortDirection((current) => (current === "desc" ? "asc" : "desc"))
                }
              >
                Sort: Date {sortDirection === "desc" ? "↓" : "↑"}
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </div>
          </section>

          <section className="accountant-reconciliation-table">
            <div className="accountant-reconciliation-table-head">
              <span>Date & Payee</span>
              <span>Property</span>
              <span>Category</span>
              <span>Expense</span>
              <span>Income</span>
              <span>Action</span>
            </div>
            {visibleRows.length === 0 ? (
              <div className="accountant-reconciliation-table-empty">
                <strong>No transactions match these filters.</strong>
                <span>Try changing the search, status, or date range.</span>
              </div>
            ) : (
              visibleRows.map((row) => (
                <div key={row.payee} className="accountant-reconciliation-table-row">
                  <div className="accountant-reconciliation-status-cell">
                    <span className={row.status === "uncategorized" ? "is-alert" : ""}>
                      {row.status === "uncategorized" ? "!" : "✓"}
                    </span>
                  </div>
                  <div>
                    <strong>{row.payee}</strong>
                    <small>{row.date}</small>
                    {row.status === "matched" && <em>✓ 1 Match Found</em>}
                  </div>
                  <span className={row.property ? "is-link" : "is-muted"}>
                    {row.property ?? "Not assigned"}
                  </span>
                  <div>
                    <strong>{row.category}</strong>
                    {row.subcategory && <small>{row.subcategory}</small>}
                    <mark className={row.status === "uncategorized" ? "is-warning" : ""}>
                      {row.status === "uncategorized" ? "Categorize" : "Matched"}
                    </mark>
                  </div>
                  <strong>{row.expense ?? "—"}</strong>
                  <strong className={row.income ? "is-good-text" : ""}>
                    {row.income ?? "—"}
                  </strong>
                  <button
                    type="button"
                    className={row.status === "uncategorized" ? "is-placeholder" : ""}
                    disabled={row.status === "uncategorized"}
                    onClick={() => handleRowAction(row)}
                  >
                    {activeTab === "reviewed"
                      ? "Reset"
                      : row.status === "uncategorized"
                        ? "—"
                        : "Review Match"}
                  </button>
                </div>
              ))
            )}
          </section>

          <footer className="accountant-reconciliation-footer">
            <span>
              Showing <strong>{visibleRows.length}</strong> of <strong>8</strong>{" "}
              transactions
            </span>
            <div>
              <button type="button" onClick={handleExportReport}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3v12" />
                  <path d="m7 10 5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
                Export Report
              </button>
              <button type="button" onClick={handleCompleteReconciliation}>
                Complete Reconciliation
              </button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
