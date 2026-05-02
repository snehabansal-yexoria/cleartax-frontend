"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getSession } from "../../../../src/lib/session";
import { parseCsv, parseFlexibleRows } from "../../../../src/lib/csv";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

interface BulkResult {
  row: number;
  email: string;
  role: string;
  success: boolean;
  temporaryPassword?: string;
  message?: string;
  error?: string;
}

type InputMode = "csv" | "table";

const DEFAULT_HEADERS = ["role", "email", "full_name"];

export default function AdminBulkUploadPage() {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BulkResult[]>([]);
  const [uploadMessage, setUploadMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("csv");
  const [importSource, setImportSource] = useState<InputMode>("csv");
  const [pendingRows, setPendingRows] = useState<Record<string, string>[]>([]);
  const [pendingFileName, setPendingFileName] = useState("");
  const [pastedValue, setPastedValue] = useState("");
  const [modalError, setModalError] = useState("");

  const template = useMemo(
    () =>
      [
        "role,email,full_name",
        "accountant,accountant1@example.com,Jamie Parker",
        "client,client1@example.com,Riley Harper",
      ].join("\n"),
    [],
  );

  function resetModalState() {
    setFileName("");
    setPendingRows([]);
    setPendingFileName("");
    setPastedValue("");
    setModalError("");
    setInputMode("csv");
  }

  function openModal() {
    resetModalState();
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    resetModalState();
  }

  function applyParsedRows(
    parsedRows: Record<string, string>[],
    nextFileName: string,
    nextImportSource: InputMode,
  ) {
    setRows(parsedRows);
    setFileName(nextFileName);
    setImportSource(nextImportSource);
    setResults([]);
    setUploadMessage("");
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const text = await file.text();
    const parsedRows = parseCsv(text);

    if (parsedRows.length === 0) {
      setModalError("We could not find any rows in that CSV.");
      return;
    }

    setPendingRows(parsedRows);
    setPendingFileName(file.name);
    setModalError("");
  }

  function handleContinueImport() {
    if (inputMode === "csv") {
      if (pendingRows.length === 0) {
        setModalError("Choose a CSV before continuing.");
        return;
      }

      applyParsedRows(pendingRows, pendingFileName, "csv");
      closeModal();
      return;
    }

    const parsedRows = parseFlexibleRows(pastedValue, DEFAULT_HEADERS);

    if (parsedRows.length === 0) {
      setModalError("Add at least one valid table row before continuing.");
      return;
    }

    applyParsedRows(parsedRows, "Pasted table", "table");
    closeModal();
  }

  async function handleUpload() {
    try {
      setLoading(true);
      const session = (await getSession()) as SessionWithIdToken | null;

      if (!session) {
        alert("Session expired. Please login again.");
        return;
      }

      const token = session.getIdToken().getJwtToken();
      const res = await fetch("/api/invite-user/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rows }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Bulk upload failed");
        return;
      }

      setResults(data.results || []);
      setUploadMessage(
        `${data.successful || 0} of ${data.total || rows.length} invites processed successfully`,
      );
    } catch (error) {
      console.error("Bulk upload error:", error);
      alert("Something went wrong during bulk upload.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="portal-page">
      <div className="portal-page-header">
        <div>
          <p className="portal-kicker">Bulk Upload</p>
          <h1>Bulk Invite Users</h1>
          <p>Upload accountants and clients in one batch for your organization.</p>
        </div>

        <Link href="/dashboard/admin" className="portal-secondary-link">
          Back to Dashboard
        </Link>
      </div>

      <div className="portal-list-card">
        <div className="portal-list-header">
          <div>
            <h2>Import Users</h2>
            <p>Choose a CSV from your device or paste rows directly into a modal.</p>
          </div>
          <span className="portal-list-count">{rows.length} rows</span>
        </div>

        <pre className="portal-code-block">{template}</pre>

        <div className="portal-upload-actions">
          <button type="button" className="portal-primary-link" onClick={openModal}>
            Bulk Upload
          </button>
          {fileName && <span className="portal-upload-filename">{fileName}</span>}
          <button
            type="button"
            className="portal-primary-link"
            onClick={handleUpload}
            disabled={loading || rows.length === 0}
          >
            {loading
              ? "Uploading..."
              : importSource === "table"
                ? "Upload Table"
                : "Upload CSV"}
          </button>
          {uploadMessage && (
            <span className="portal-upload-success">{uploadMessage}</span>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="portal-modal-backdrop" role="presentation" onClick={closeModal}>
          <div
            className="portal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-bulk-upload-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="portal-modal-header">
              <div>
                <p className="portal-kicker">Bulk Upload</p>
                <h2 id="admin-bulk-upload-title">Bulk Upload</h2>
                <p>Use a CSV file or paste a table with role, email, and name.</p>
              </div>
              <button
                type="button"
                className="portal-modal-close"
                onClick={closeModal}
                aria-label="Close import modal"
              >
                ×
              </button>
            </div>

            <div className="portal-modal-tabs">
              <button
                type="button"
                className={`portal-modal-tab${inputMode === "csv" ? " is-active" : ""}`}
                onClick={() => {
                  setInputMode("csv");
                  setModalError("");
                }}
              >
                Upload CSV
              </button>
              <button
                type="button"
                className={`portal-modal-tab${inputMode === "table" ? " is-active" : ""}`}
                onClick={() => {
                  setInputMode("table");
                  setModalError("");
                }}
              >
                Add Table
              </button>
            </div>

            {inputMode === "csv" ? (
              <div className="portal-modal-section">
                <p className="portal-modal-help">
                  Upload a CSV with `role`, `email`, and optional `full_name`.
                </p>
                <input
                  className="portal-file-input"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                />
                {pendingFileName && (
                  <span className="portal-upload-filename">{pendingFileName}</span>
                )}
              </div>
            ) : (
              <div className="portal-modal-section">
                <p className="portal-modal-help">
                  Paste CSV, tab-separated data, or rows like `accountant
                  jane@example.com Jane Doe`.
                </p>
                <textarea
                  className="portal-modal-textarea"
                  value={pastedValue}
                  onChange={(event) => setPastedValue(event.target.value)}
                  placeholder={template}
                  rows={10}
                />
              </div>
            )}

            {modalError && <p className="portal-modal-error">{modalError}</p>}

            <div className="portal-modal-actions">
              <button
                type="button"
                className="portal-secondary-link"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="portal-primary-link"
                onClick={handleContinueImport}
                disabled={
                  inputMode === "csv"
                    ? pendingRows.length === 0
                    : !pastedValue.trim()
                }
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="portal-list-card">
          <div className="portal-list-header">
            <div>
              <h2>Preview</h2>
              <p>Only `accountant` and `client` roles are allowed here.</p>
            </div>
          </div>

          <div className="portal-list-table">
            <div className="portal-list-head portal-list-head-admin">
              <div>Role</div>
              <div>Email</div>
              <div>Name</div>
              <div>Status</div>
            </div>

            {rows.map((row, index) => {
              const validRole = ["accountant", "client"].includes(
                String(row.role || "").toLowerCase(),
              );

              return (
                <article key={`${row.email}-${index}`} className="portal-list-row portal-list-row-admin">
                  <div>{row.role || "-"}</div>
                  <div>{row.email || "-"}</div>
                  <div>{row.full_name || "-"}</div>
                  <div>{validRole ? "Ready" : "Invalid role"}</div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="portal-list-card">
          <div className="portal-list-header">
            <div>
              <h2>Results</h2>
              <p>Each row shows whether the invite succeeded.</p>
            </div>
          </div>

          <div className="portal-list-table">
            <div className="portal-list-head portal-list-head-admin">
              <div>Row</div>
              <div>Email</div>
              <div>Status</div>
              <div>Details</div>
            </div>

            {results.map((result) => (
              <article key={`${result.row}-${result.email}`} className="portal-list-row portal-list-row-admin">
                <div>{result.row}</div>
                <div>{result.email}</div>
                <div>
                  <span className={`portal-status${result.success ? "" : " is-pending"}`}>
                    {result.success ? "SUCCESS" : "FAILED"}
                  </span>
                </div>
                <div>
                  {result.success
                    ? result.temporaryPassword
                      ? `Temp password: ${result.temporaryPassword}`
                      : result.message || "Already invited"
                    : result.error}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
