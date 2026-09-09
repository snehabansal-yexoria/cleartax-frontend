"use client";

import { useMemo, useRef, useState } from "react";
import type { CoreChartAccount, CoreProperty } from "@/src/lib/coreApi";
import type { CoreJournalImportResult } from "@/src/lib/coreApi";
import {
  errorRowsCsv,
  journalCsvTemplate,
  parseJournalCsv,
  toImportRows,
  validateJournalCsv,
  type JournalCsvRow,
  type JournalCsvValidation,
} from "@/src/lib/journalCsv";

interface Props {
  entityId: string;
  token: string;
  accounts: CoreChartAccount[];
  properties: CoreProperty[];
  disabled?: boolean;
  onImported: () => void;
}

function download(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function BulkUploadTab({
  entityId,
  token,
  accounts,
  properties,
  disabled,
  onImported,
}: Props) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<JournalCsvRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [positional, setPositional] = useState(false);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<CoreJournalImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const validation: JournalCsvValidation | null = useMemo(
    () => (rows.length ? validateJournalCsv(rows, accounts, properties) : null),
    [rows, accounts, properties],
  );

  const handleFile = async (file: File) => {
    setResult(null);
    setParseError("");
    setFileName(file.name);
    const text = await file.text();
    const parsed = parseJournalCsv(text);
    if (parsed.error) {
      setParseError(parsed.error);
      setRows([]);
      return;
    }
    setPositional(parsed.positional);
    setRows(parsed.rows);
  };

  const handleImport = async () => {
    if (!validation) return;
    const valid = validation.entries.filter(
      (e) => e.issues.length === 0 && e.balanced,
    );
    if (valid.length === 0) return;

    setIsImporting(true);
    setResult(null);
    try {
      const res = await fetch(
        `/api/entities/${encodeURIComponent(entityId)}/journal-entries/import`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ rows: toImportRows(valid) }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setParseError(data?.message || data?.error || "The import failed.");
        return;
      }
      setResult(data as CoreJournalImportResult);
      if ((data as CoreJournalImportResult).imported > 0) onImported();
    } catch (err) {
      setParseError((err as Error)?.message ?? "The import failed.");
    } finally {
      setIsImporting(false);
    }
  };

  const validEntries =
    validation?.entries.filter((e) => e.issues.length === 0 && e.balanced) ?? [];

  return (
    <div className="journal-bulk">
      <div className="csv-template-card">
        <div>
          <h3>Download the CSV template</h3>
          <p>
            One row per journal line. Rows are grouped into entries by the{" "}
            <strong>Entry Reference</strong> column when it is filled in;
            otherwise an entry ends as soon as its debits and credits balance.
            Amounts are GST-exclusive.
          </p>
        </div>
        <button
          type="button"
          className="entity-wizard-primary is-green"
          onClick={() =>
            download("journal-entries-template.csv", journalCsvTemplate())
          }
        >
          Download template
        </button>
      </div>

      <label className={`csv-dropzone${fileName ? " has-file" : ""}`}>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
        <span className="csv-dropzone-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </span>
        <span className="csv-dropzone-title">
          {fileName || "Choose a CSV file"}
        </span>
        <span className="csv-dropzone-hint">
          Every row is checked before anything is imported.
        </span>
      </label>

      {parseError && <div className="entity-wizard-error">{parseError}</div>}

      {positional && (
        <div className="journal-hint is-warning">
          The header row was not recognised, so columns were read in order:
          date, property, account code, account name, debit, credit,
          description, name, GST code. Check the preview carefully.
        </div>
      )}

      {validation && !result && (
        <>
          <div className="journal-import-summary">
            <span>
              <strong>{validation.entries.length}</strong> entries
            </span>
            <span>
              <strong>{rows.length}</strong> lines
            </span>
            <span className="is-ok">
              <strong>{validation.okEntryCount}</strong> ready to import
            </span>
            <span className={validation.errorEntryCount ? "is-error" : ""}>
              <strong>{validation.errorEntryCount}</strong> need attention
            </span>

            <label className="journal-import-toggle">
              <input
                type="checkbox"
                checked={showErrorsOnly}
                onChange={(e) => setShowErrorsOnly(e.target.checked)}
              />
              Show only entries with problems
            </label>
          </div>

          <div className="journal-grid-wrap">
            <table className="journal-grid journal-preview-grid">
              <thead>
                <tr>
                  <th scope="col">Entry</th>
                  <th scope="col">Line</th>
                  <th scope="col">Date</th>
                  <th scope="col">Property</th>
                  <th scope="col">Account</th>
                  <th scope="col" className="is-numeric">Debit</th>
                  <th scope="col" className="is-numeric">Credit</th>
                  <th scope="col">GST code</th>
                  <th scope="col">Description</th>
                </tr>
              </thead>
              <tbody>
                {validation.entries.map((entry) => {
                  const ok = entry.issues.length === 0 && entry.balanced;
                  if (showErrorsOnly && ok) return null;
                  return entry.rows.map((row, i) => (
                    <tr
                      key={`${entry.index}-${row.line}`}
                      className={ok ? "" : "journal-preview-row is-error"}
                    >
                      {i === 0 && (
                        // The entry gutter: the grouping the importer inferred,
                        // shown before anything is written. A grouping the
                        // accountant cannot see is one they cannot trust.
                        <td rowSpan={entry.rows.length} className="journal-entry-gutter">
                          <span className="journal-entry-index">
                            Entry {entry.index}
                          </span>
                          {entry.reference && (
                            <span className="journal-entry-ref">{entry.reference}</span>
                          )}
                          <span className="journal-entry-totals">
                            Dr {entry.totalDebit.toFixed(2)} / Cr{" "}
                            {entry.totalCredit.toFixed(2)}
                          </span>
                          <span
                            className={`journal-balance-pill ${ok ? "is-balanced" : "is-unbalanced"}`}
                          >
                            {ok ? "Balanced" : "Problem"}
                          </span>
                          {entry.issues
                            .filter((issue) => issue.line === 0 || !issue.field)
                            .map((issue, n) => (
                              <span className="journal-cell-error" key={n}>
                                {issue.reason}
                              </span>
                            ))}
                        </td>
                      )}
                      <td className="journal-col-num">{row.line}</td>
                      <PreviewCell
                        value={row.journalDate}
                        error={validation.cellErrors.get(`${row.line}:journalDate`)}
                      />
                      <PreviewCell
                        value={row.propertyName || "—"}
                        error={validation.cellErrors.get(`${row.line}:propertyName`)}
                      />
                      <PreviewCell
                        value={`${row.accountCode} ${row.accountName}`.trim()}
                        error={
                          validation.cellErrors.get(`${row.line}:accountCode`) ??
                          validation.cellErrors.get(`${row.line}:accountName`)
                        }
                      />
                      <PreviewCell
                        value={row.debit || "—"}
                        numeric
                        error={validation.cellErrors.get(`${row.line}:debit`)}
                      />
                      <PreviewCell
                        value={row.credit || "—"}
                        numeric
                        error={validation.cellErrors.get(`${row.line}:credit`)}
                      />
                      <PreviewCell
                        value={row.gstCode || "—"}
                        error={validation.cellErrors.get(`${row.line}:gstCode`)}
                      />
                      <PreviewCell value={row.description || "—"} />
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>

          <div className="journal-import-actions">
            <button
              type="button"
              className="entity-wizard-primary is-orange"
              disabled={disabled || isImporting || validEntries.length === 0}
              onClick={handleImport}
            >
              {isImporting
                ? "Importing…"
                : `Import ${validEntries.length} ${
                    validEntries.length === 1 ? "entry" : "entries"
                  }${
                    validation.errorEntryCount
                      ? ` (${validation.errorEntryCount} skipped)`
                      : ""
                  }`}
            </button>

            {validation.errorEntryCount > 0 && (
              <button
                type="button"
                className="entity-wizard-secondary"
                onClick={() =>
                  download("journal-entries-errors.csv", errorRowsCsv(validation))
                }
              >
                Download rows that need fixing
              </button>
            )}
          </div>

          {validation.errorEntryCount > 0 && (
            <p className="journal-hint">
              A line that fails takes its whole entry with it, and no other
              entry. Importing part of an entry would leave the ledger
              permanently out of balance.
            </p>
          )}
        </>
      )}

      {result && (
        <div className="journal-import-result">
          <h3>
            Imported {result.imported}{" "}
            {result.imported === 1 ? "entry" : "entries"}
            {result.failed > 0 ? `, ${result.failed} failed` : ""}
          </h3>
          <div className="journal-grid-wrap">
            <table className="journal-grid">
              <thead>
                <tr>
                  <th scope="col">Entry</th>
                  <th scope="col">Lines</th>
                  <th scope="col">Date</th>
                  <th scope="col">Reference</th>
                  <th scope="col">Status</th>
                  <th scope="col">Detail</th>
                </tr>
              </thead>
              <tbody>
                {result.entries.map((e) => (
                  <tr key={e.index}>
                    <td>{e.index}</td>
                    <td>{e.lines.join(", ")}</td>
                    <td>{e.entryDate}</td>
                    <td>{e.reference || "—"}</td>
                    <td>
                      <span
                        className={`journal-status-chip is-${e.status === "imported" ? "ok" : "error"}`}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td>
                      {e.entryNo ||
                        e.errors?.map((x) => x.reason).join(" ") ||
                        "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewCell({
  value,
  error,
  numeric,
}: {
  value: string;
  error?: string;
  numeric?: boolean;
}) {
  return (
    <td className={numeric ? "is-numeric" : ""}>
      <span className={error ? "journal-preview-cell is-invalid" : undefined}>
        {value}
      </span>
      {error && <span className="journal-cell-error">{error}</span>}
    </td>
  );
}
