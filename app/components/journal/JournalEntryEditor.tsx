"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  CoreEntity,
  CoreJournalEntry,
  CoreProperty,
} from "@/src/lib/coreApi";
import { normalizeCsvDate, parseCsvMoney } from "@/src/lib/journalCsv";
import { gstCodesFor, isPostableCategory, normalizeGstCode } from "@/src/lib/journalGst";
import BulkUploadTab from "./BulkUploadTab";
import ManualEntryGrid from "./ManualEntryGrid";
import { useChartOfAccounts } from "./useChartOfAccounts";
import {
  emptyLine,
  useJournalDraft,
  type JournalLineDraft,
  type ServerIssue,
} from "./useJournalDraft";

interface ClientRecord {
  id: string;
  name: string;
  email: string;
}

interface Props {
  clientId: string;
  entityId: string;
  client: ClientRecord;
  entity: CoreEntity;
  properties: CoreProperty[];
  token: string;
  backHref: string;
  backLabel: string;
  /** Present when editing; absent when creating. */
  initialEntry?: CoreJournalEntry;
}

export default function JournalEntryEditor({
  entityId,
  client,
  entity,
  properties,
  token,
  backHref,
  backLabel,
  initialEntry,
}: Props) {
  const router = useRouter();
  const isEdit = !!initialEntry;

  const [activeTab, setActiveTab] = useState<"manual" | "bulk">("manual");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const errorRef = useRef<HTMLDivElement | null>(null);

  const chart = useChartOfAccounts(token);
  const defaultPropertyId = properties[0]?.id ?? "";

  const {
    draft,
    totals,
    validation,
    errorFor,
    setAttemptedSave,
    setHeader,
    setCell,
    setAccount,
    addLine,
    duplicateLine,
    removeLine,
    clearAll,
    addBalancingLine,
    replaceLines,
    toRequestBody,
    setServerIssues,
  } = useJournalDraft(defaultPropertyId, initialEntry);

  /**
   * Turn a spreadsheet paste into lines, resolving codes, properties and GST
   * against the same lookups the CSV importer uses.
   */
  const handlePasteMatrix = useCallback(
    (matrix: string[][], startLineId: string) => {
      const propertyByName = new Map(
        properties.map((p) => [p.name.trim().toLowerCase(), p]),
      );

      const pasted: JournalLineDraft[] = matrix.map((cells) => {
        // Column order follows the template: date, property, code, name,
        // debit, credit, description, name, gst.
        const [
          rawDate = "",
          rawProperty = "",
          rawCode = "",
          ,
          rawDebit = "",
          rawCredit = "",
          rawDescription = "",
          rawName = "",
          rawGst = "",
        ] = cells;

        const line = emptyLine(defaultPropertyId);
        const account = chart.byCode.get(rawCode.trim().toUpperCase());
        if (account) {
          line.accountId = account.id;
          line.accountCode = account.accountCode;
          line.accountName = account.accountName;
          line.accountCategory = account.category;
          line.accountSubcategory = account.subcategory;
        } else {
          line.accountCode = rawCode.trim();
        }

        const property = propertyByName.get(rawProperty.trim().toLowerCase());
        line.propertyId =
          account && !isPostableCategory(account.category)
            ? ""
            : (property?.id ?? "");

        const debit = parseCsvMoney(rawDebit);
        const credit = parseCsvMoney(rawCredit);
        if (debit.ok && debit.value) line.debit = debit.value.toFixed(2);
        if (credit.ok && credit.value) line.credit = credit.value.toFixed(2);

        line.description = rawDescription.trim();
        line.name = rawName.trim();

        if (account && isPostableCategory(account.category)) {
          const gst = rawGst.trim() ? normalizeGstCode(rawGst) : null;
          line.gstCode = gst ?? gstCodesFor(account.category).suggested;
          line.gstTouched = !!gst;
        }

        // A pasted date applies to the whole entry, since an entry has one date.
        const date = normalizeCsvDate(rawDate);
        if (date) setHeader({ entryDate: date });

        return line;
      });

      // Replace from the pasted-into row onwards, keeping earlier rows.
      const at = draft.lines.findIndex((l) => l.id === startLineId);
      const head = at > 0 ? draft.lines.slice(0, at) : [];
      replaceLines([...head, ...pasted]);
    },
    [chart.byCode, defaultPropertyId, draft.lines, properties, replaceLines, setHeader],
  );

  const handleSave = async () => {
    setAttemptedSave(true);
    setSaveError("");
    setServerIssues([]);

    if (!validation.canSave) {
      // Every entry-level problem, not just the first. Three wrong things used
      // to be reported as one sentence, so fixing it revealed the next.
      setSaveError(
        validation.entryErrors.length > 0
          ? validation.entryErrors.join(" ")
          : "Some lines need attention — the highlighted cells show what.",
      );
      return;
    }

    setIsSaving(true);
    try {
      const url = isEdit
        ? `/api/journal-entries/${encodeURIComponent(initialEntry.id)}`
        : `/api/entities/${encodeURIComponent(entityId)}/journal-entries`;

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(toRequestBody()),
      });

      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        issues?: ServerIssue[];
      };
      if (!res.ok) {
        // `issues` locates each rejection at a row and column, so the grid can
        // highlight the offending cell instead of printing one sentence above
        // twenty lines. It is additive — `message` is always populated, and is
        // still what the banner shows.
        if (Array.isArray(data.issues) && data.issues.length > 0) {
          setServerIssues(data.issues);
        }
        setSaveError(
          data.message ||
            data.error ||
            // Keeping the status makes an unexpected failure reportable, rather
            // than indistinguishable from every other failure.
            `The journal entry could not be saved (${res.status}).`,
        );
        return;
      }
      router.push(backHref);
      router.refresh();
    } catch (err) {
      setSaveError(
        (err as Error)?.message ?? "The journal entry could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Bring the banner into view and announce it. With a twenty-line grid the
  // Save button is well below the fold, so the error could land off-screen and
  // read as "nothing happened".
  useEffect(() => {
    if (saveError) {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [saveError]);

  return (
    <div className="journal-page">
      <header className="journal-page-head">
        <Link href={backHref} className="entity-wizard-back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {backLabel}
        </Link>
        <h1>{isEdit ? `Edit ${initialEntry.entryNo}` : "Add journal entry"}</h1>
        <p className="journal-page-sub">
          {client.name} · {entity.name}
        </p>
      </header>

      {chart.error && (
        <div className="entity-wizard-error">
          {chart.error}{" "}
          <button type="button" className="journal-link-button" onClick={chart.reload}>
            Try again
          </button>
        </div>
      )}

      {!isEdit && (
        <div className="journal-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "manual"}
            className={activeTab === "manual" ? "is-active" : ""}
            onClick={() => setActiveTab("manual")}
          >
            Manual entry
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "bulk"}
            className={activeTab === "bulk" ? "is-active" : ""}
            onClick={() => setActiveTab("bulk")}
          >
            Bulk upload (CSV)
          </button>
        </div>
      )}

      {activeTab === "bulk" && !isEdit ? (
        <BulkUploadTab
          entityId={entityId}
          token={token}
          accounts={chart.accounts}
          properties={properties}
          disabled={chart.isLoading || !!chart.error}
          onImported={() => {
            router.refresh();
          }}
        />
      ) : (
        <>
          <div className="journal-entry-header">
            <label className="journal-field">
              <span>Journal date</span>
              <input
                type="date"
                value={draft.entryDate}
                onChange={(e) => setHeader({ entryDate: e.target.value })}
              />
              <small>
                One date for the whole entry — debits and credits have to balance
                on the same day.
              </small>
            </label>

            <label className="journal-field">
              <span>Reference</span>
              <input
                type="text"
                value={draft.reference}
                placeholder="e.g. YE-ADJ-01"
                /* journal_entry.reference is VARCHAR(64). Without this a longer
                   value reached Postgres as SQLSTATE 22001 and came back as a
                   500 "internal server error" on an otherwise valid entry. */
                maxLength={64}
                onChange={(e) => setHeader({ reference: e.target.value })}
              />
            </label>

            <label className="journal-field is-wide">
              <span>Memo</span>
              <input
                type="text"
                value={draft.memo}
                placeholder="What this entry is for"
                /* No maxLength: memo is TEXT, so there is nothing to truncate
                   to and capping it would only lose the user's words. */
                onChange={(e) => setHeader({ memo: e.target.value })}
              />
            </label>
          </div>

          {chart.isLoading ? (
            <p className="journal-hint">Loading the chart of accounts…</p>
          ) : (
            <ManualEntryGrid
              lines={draft.lines}
              accounts={chart.accounts}
              properties={properties}
              totals={totals}
              disabled={isSaving || !!chart.error}
              errorFor={errorFor}
              onCell={setCell}
              onAccount={setAccount}
              onAddLine={() => addLine()}
              onDuplicate={duplicateLine}
              onRemove={removeLine}
              onAddBalancingLine={() => addBalancingLine(totals)}
              onPasteMatrix={handlePasteMatrix}
            />
          )}

          {saveError && (
            <div ref={errorRef} className="entity-wizard-error" role="alert">
              {saveError}
            </div>
          )}

          <div className="journal-page-actions">
            <button
              type="button"
              className="entity-wizard-secondary"
              onClick={() => addLine()}
              disabled={isSaving}
            >
              + Add line
            </button>
            <button
              type="button"
              className="entity-wizard-secondary"
              onClick={() => setShowConfirmClear(true)}
              disabled={isSaving}
            >
              Clear all
            </button>
            <div className="journal-page-actions-end">
              <Link href={backHref} className="entity-wizard-secondary">
                Cancel
              </Link>
              <button
                type="button"
                className="entity-wizard-primary is-orange"
                onClick={handleSave}
                disabled={isSaving || chart.isLoading}
              >
                {isSaving
                  ? "Saving…"
                  : isEdit
                    ? "Save changes"
                    : "Save journal entry"}
              </button>
            </div>
          </div>
        </>
      )}

      {showConfirmClear && (
        <div className="transaction-modal-layer" role="dialog" aria-modal="true">
          <div className="transaction-modal">
            <div className="transaction-modal-header">
              <h2>Clear all lines?</h2>
            </div>
            <div className="transaction-modal-body">
              <p>
                This removes every line from the grid. It cannot be undone.
              </p>
            </div>
            <div className="transaction-modal-footer">
              <button
                type="button"
                className="entity-wizard-secondary"
                onClick={() => setShowConfirmClear(false)}
              >
                Keep editing
              </button>
              <button
                type="button"
                className="entity-wizard-primary is-orange"
                onClick={() => {
                  clearAll();
                  setShowConfirmClear(false);
                }}
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
