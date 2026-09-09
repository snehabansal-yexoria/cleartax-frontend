"use client";

import { useCallback, useRef } from "react";
import type { CoreChartAccount, CoreProperty } from "@/src/lib/coreApi";
import { gstCodesFor, isPostableCategory } from "@/src/lib/journalGst";
import AccountCodeCombobox from "./AccountCodeCombobox";
import type {
  JournalLineDraft,
  JournalLineField,
  JournalTotals,
} from "./useJournalDraft";

interface Props {
  lines: JournalLineDraft[];
  accounts: CoreChartAccount[];
  properties: CoreProperty[];
  totals: JournalTotals;
  disabled?: boolean;
  errorFor: (lineId: string, field: JournalLineField) => string | undefined;
  onCell: (lineId: string, field: JournalLineField, value: string) => void;
  onAccount: (
    lineId: string,
    account: CoreChartAccount | null,
    rawText: string,
  ) => void;
  onAddLine: () => void;
  onDuplicate: (lineId: string) => void;
  onRemove: (lineId: string) => void;
  onAddBalancingLine: () => void;
  onPasteMatrix: (matrix: string[][], startLineId: string) => void;
}

export default function ManualEntryGrid({
  lines,
  accounts,
  properties,
  totals,
  disabled,
  errorFor,
  onCell,
  onAccount,
  onAddLine,
  onDuplicate,
  onRemove,
  onAddBalancingLine,
  onPasteMatrix,
}: Props) {
  // A ref registry keyed `${lineId}:${field}`, so Enter can move down a column.
  const cellRefs = useRef(new Map<string, HTMLElement>());

  const register = useCallback(
    (lineId: string, field: JournalLineField) => (el: HTMLElement | null) => {
      const key = `${lineId}:${field}`;
      if (el) cellRefs.current.set(key, el);
      else cellRefs.current.delete(key);
    },
    [],
  );

  const focusCell = useCallback(
    (lineIndex: number, field: JournalLineField) => {
      const line = lines[lineIndex];
      if (!line) return;
      const el = cellRefs.current.get(`${line.id}:${field}`);
      el?.focus();
      if (el instanceof HTMLInputElement) el.select();
    },
    [lines],
  );

  /**
   * Enter moves down the same column, Shift+Enter moves up, and Enter on the
   * last row appends one. Arrow keys are deliberately NOT bound: inside a text
   * input they must move the caret, and hijacking them would fight the account
   * combobox, which needs Up/Down for its own list.
   */
  const handleKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLElement>,
      lineIndex: number,
      field: JournalLineField,
    ) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (e.shiftKey) {
        focusCell(Math.max(0, lineIndex - 1), field);
        return;
      }
      if (lineIndex === lines.length - 1) {
        onAddLine();
        // The new row mounts after this tick.
        window.setTimeout(() => focusCell(lineIndex + 1, field), 0);
        return;
      }
      focusCell(lineIndex + 1, field);
    },
    [focusCell, lines.length, onAddLine],
  );

  /**
   * Paste a block copied from a spreadsheet. It runs through the same parser
   * and validator the CSV tab uses, so a pasted row is checked exactly as an
   * uploaded one is.
   */
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLElement>, lineId: string) => {
      const text = e.clipboardData.getData("text/plain");
      if (!text.includes("\t") && !text.includes("\n")) return; // single cell
      e.preventDefault();
      const matrix = text
        .replace(/\r/g, "")
        .split("\n")
        .filter((row) => row.trim() !== "")
        .map((row) => row.split("\t"));
      if (matrix.length > 0) onPasteMatrix(matrix, lineId);
    },
    [onPasteMatrix],
  );

  const cellClass = (lineId: string, field: JournalLineField) =>
    `journal-cell-input${errorFor(lineId, field) ? " is-invalid" : ""}`;

  return (
    <>
      <div className="journal-hint is-info">
        <strong>Enter amounts excluding GST.</strong> The GST code decides the
        tax, which is calculated and shown when the entry is saved. Use{" "}
        <kbd>Tab</kbd> or <kbd>Enter</kbd> to move between cells, or paste rows
        straight from a spreadsheet with <kbd>Ctrl</kbd>+<kbd>V</kbd>.
      </div>

      <div className="journal-grid-wrap">
        <table className="journal-grid">
          <thead>
            <tr>
              <th scope="col" className="journal-col-num">#</th>
              <th scope="col">Account code</th>
              <th scope="col">Account name</th>
              <th scope="col">Property</th>
              <th scope="col" className="is-numeric">Debit (excl. GST)</th>
              <th scope="col" className="is-numeric">Credit (excl. GST)</th>
              <th scope="col">Description</th>
              <th scope="col">Name</th>
              <th scope="col">GST code</th>
              <th scope="col" className="journal-col-actions">
                <span className="sr-only">Row actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const postable = isPostableCategory(line.accountCategory);
              const gstOptions = gstCodesFor(line.accountCategory);
              const accountError = errorFor(line.id, "accountCode");
              const propertyError = errorFor(line.id, "propertyId");
              const amountError = errorFor(line.id, "debit");
              const gstError = errorFor(line.id, "gstCode");

              return (
                <tr key={line.id}>
                  <td className="journal-col-num">{index + 1}</td>

                  <td>
                    <AccountCodeCombobox
                      accounts={accounts}
                      value={line.accountCode}
                      invalid={!!accountError}
                      disabled={disabled}
                      onSelect={(account, rawText) =>
                        onAccount(line.id, account, rawText)
                      }
                      inputRef={register(line.id, "accountCode")}
                    />
                    {accountError && (
                      <span className="journal-cell-error">{accountError}</span>
                    )}
                  </td>

                  <td>
                    {/* Derived from the code and never editable, per the spec.
                        tabIndex -1 so it does not eat a tab stop. */}
                    <input
                      type="text"
                      className="journal-cell-input is-readonly"
                      value={line.accountName}
                      readOnly
                      tabIndex={-1}
                      placeholder="—"
                    />
                    {line.accountCategory && (
                      <span className="journal-cell-sub">
                        <span className={`journal-account-chip is-${line.accountCategory}`}>
                          {line.accountCategory}
                        </span>
                        {line.accountSubcategory}
                      </span>
                    )}
                  </td>

                  <td>
                    <select
                      className={cellClass(line.id, "propertyId")}
                      value={line.propertyId}
                      disabled={disabled || (!!line.accountCategory && !postable)}
                      ref={register(line.id, "propertyId")}
                      onKeyDown={(e) => handleKeyDown(e, index, "propertyId")}
                      onChange={(e) => onCell(line.id, "propertyId", e.target.value)}
                    >
                      <option value="">
                        {line.accountCategory && !postable ? "—" : "Select property"}
                      </option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {propertyError && (
                      <span className="journal-cell-error">{propertyError}</span>
                    )}
                  </td>

                  <td className="is-numeric">
                    <input
                      type="text"
                      inputMode="decimal"
                      className={cellClass(line.id, "debit")}
                      value={line.debit}
                      disabled={disabled}
                      placeholder="0.00"
                      ref={register(line.id, "debit")}
                      onKeyDown={(e) => handleKeyDown(e, index, "debit")}
                      onPaste={(e) => handlePaste(e, line.id)}
                      onChange={(e) => onCell(line.id, "debit", e.target.value)}
                    />
                  </td>

                  <td className="is-numeric">
                    <input
                      type="text"
                      inputMode="decimal"
                      className={cellClass(line.id, "credit")}
                      value={line.credit}
                      disabled={disabled}
                      placeholder="0.00"
                      ref={register(line.id, "credit")}
                      onKeyDown={(e) => handleKeyDown(e, index, "credit")}
                      onPaste={(e) => handlePaste(e, line.id)}
                      onChange={(e) => onCell(line.id, "credit", e.target.value)}
                    />
                    {amountError && (
                      <span className="journal-cell-error">{amountError}</span>
                    )}
                  </td>

                  <td>
                    <input
                      type="text"
                      className="journal-cell-input"
                      value={line.description}
                      disabled={disabled}
                      placeholder="Description"
                      ref={register(line.id, "description")}
                      onKeyDown={(e) => handleKeyDown(e, index, "description")}
                      onChange={(e) => onCell(line.id, "description", e.target.value)}
                    />
                  </td>

                  <td>
                    <input
                      type="text"
                      className="journal-cell-input"
                      value={line.name}
                      disabled={disabled}
                      placeholder="Payee / reference"
                      ref={register(line.id, "name")}
                      onKeyDown={(e) => handleKeyDown(e, index, "name")}
                      onChange={(e) => onCell(line.id, "name", e.target.value)}
                    />
                  </td>

                  <td>
                    <select
                      className={cellClass(line.id, "gstCode")}
                      value={line.gstCode}
                      disabled={disabled || (!!line.accountCategory && !postable)}
                      ref={register(line.id, "gstCode")}
                      onKeyDown={(e) => handleKeyDown(e, index, "gstCode")}
                      onChange={(e) => onCell(line.id, "gstCode", e.target.value)}
                    >
                      <option value="">
                        {line.accountCategory && !postable
                          ? "Not applicable"
                          : "Select GST code"}
                      </option>
                      {gstOptions.preferred.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                      {gstOptions.rest.length > 0 && (
                        <optgroup label="Other GST codes">
                          {gstOptions.rest.map((code) => (
                            <option key={code} value={code}>
                              {code}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    {gstError && (
                      <span className="journal-cell-error">{gstError}</span>
                    )}
                  </td>

                  <td className="journal-col-actions">
                    <div className="journal-row-actions">
                      <button
                        type="button"
                        className="journal-icon-button"
                        title="Duplicate this line"
                        aria-label={`Duplicate line ${index + 1}`}
                        disabled={disabled}
                        onClick={() => onDuplicate(line.id)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                          strokeLinejoin="round" aria-hidden="true">
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="journal-icon-button is-danger"
                        title={
                          lines.length === 1
                            ? "An entry needs at least one line"
                            : "Delete this line"
                        }
                        aria-label={`Delete line ${index + 1}`}
                        disabled={disabled || lines.length === 1}
                        onClick={() => onRemove(line.id)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                          strokeLinejoin="round" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="journal-totals">
        <div className="journal-total-figure">
          <span className="journal-total-label">Total debit</span>
          <span className="journal-total-value">
            A$ {totals.debit.toFixed(2)}
          </span>
        </div>
        <div className="journal-total-figure">
          <span className="journal-total-label">Total credit</span>
          <span className="journal-total-value">
            A$ {totals.credit.toFixed(2)}
          </span>
        </div>

        <div
          className={`journal-balance-pill ${totals.balanced ? "is-balanced" : "is-unbalanced"}`}
          role="status"
        >
          {totals.balanced
            ? "Balanced"
            : `Out of balance by A$ ${Math.abs(totals.difference).toFixed(2)}`}
        </div>

        {!totals.balanced && (totals.debit > 0 || totals.credit > 0) && (
          <button
            type="button"
            className="entity-wizard-primary is-green"
            disabled={disabled}
            onClick={onAddBalancingLine}
          >
            + Add balancing line
          </button>
        )}
      </div>
    </>
  );
}
