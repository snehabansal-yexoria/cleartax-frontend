"use client";

import { useCallback, useMemo, useState } from "react";
import type { CoreChartAccount, CoreJournalEntry } from "@/src/lib/coreApi";
import {
  gstCodeAllowedFor,
  gstCodesFor,
  isPostableCategory,
} from "@/src/lib/journalGst";

export interface JournalLineDraft {
  /** Client-only React key. */
  id: string;
  accountId: number | null;
  accountCode: string;
  accountName: string;
  accountCategory: string;
  accountSubcategory: string;
  propertyId: string;
  debit: string;
  credit: string;
  description: string;
  name: string;
  gstCode: string;
  /** Set once the accountant edits GST, so re-picking an account never overwrites a deliberate choice. */
  gstTouched: boolean;
}

export type JournalLineField = keyof JournalLineDraft;

export interface JournalDraft {
  entryDate: string;
  reference: string;
  memo: string;
  lines: JournalLineDraft[];
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

let seq = 0;
export function emptyLine(propertyId = ""): JournalLineDraft {
  seq += 1;
  return {
    id: `line-${Date.now()}-${seq}`,
    accountId: null,
    accountCode: "",
    accountName: "",
    accountCategory: "",
    accountSubcategory: "",
    propertyId,
    debit: "",
    credit: "",
    description: "",
    name: "",
    gstCode: "",
    gstTouched: false,
  };
}

export function parseAmount(raw: string): number {
  const v = Number.parseFloat(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(v) ? v : 0;
}

export interface JournalTotals {
  debit: number;
  credit: number;
  difference: number;
  balanced: boolean;
}

export interface DraftValidation {
  /** Keyed `${lineId}:${field}`. */
  cellErrors: Map<string, string>;
  entryErrors: string[];
  canSave: boolean;
}

/**
 * Draft state for the manual entry grid.
 *
 * Two invariants are enforced by the shape rather than validated afterwards:
 * debit and credit are mutually exclusive (typing in one clears the other), and
 * the account decides the name, category and subcategory (they are never typed).
 */
export function useJournalDraft(defaultPropertyId: string, initial?: CoreJournalEntry) {
  const [draft, setDraft] = useState<JournalDraft>(() => {
    if (initial) {
      return {
        entryDate: initial.entryDate,
        reference: initial.reference ?? "",
        memo: initial.memo ?? "",
        lines: initial.lines.map((l) => {
          seq += 1;
          return {
            id: `line-${l.id}-${seq}`,
            accountId: l.chartOfAccountId,
            accountCode: l.accountCode,
            accountName: l.accountName,
            accountCategory: l.accountCategory,
            accountSubcategory: "",
            propertyId: l.propertyId ?? "",
            debit: l.debit ? String(l.debit) : "",
            credit: l.credit ? String(l.credit) : "",
            description: l.description ?? "",
            name: l.name ?? "",
            gstCode: l.gstCode ?? "",
            gstTouched: true,
          };
        }),
      };
    }
    // Seeded once via the lazy initialiser, never in an effect: the old grid
    // re-seeded on a dependency change and wiped whatever had been typed.
    return {
      entryDate: todayISO(),
      reference: "",
      memo: "",
      lines: [emptyLine(defaultPropertyId), emptyLine(defaultPropertyId)],
    };
  });

  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [attemptedSave, setAttemptedSave] = useState(false);

  const markTouched = useCallback((lineId: string, field: JournalLineField) => {
    setTouched((prev) => new Set(prev).add(`${lineId}:${field}`));
  }, []);

  const setHeader = useCallback(
    (patch: Partial<Pick<JournalDraft, "entryDate" | "reference" | "memo">>) => {
      setDraft((d) => ({ ...d, ...patch }));
    },
    [],
  );

  const setCell = useCallback(
    (lineId: string, field: JournalLineField, value: string) => {
      setDraft((d) => ({
        ...d,
        lines: d.lines.map((line) => {
          if (line.id !== lineId) return line;
          const next = { ...line };

          if (field === "debit" || field === "credit") {
            const cleaned = value.replace(/[^0-9.]/g, "");
            const parts = cleaned.split(".");
            const normalised =
              parts.length > 2
                ? `${parts[0]}.${parts.slice(1).join("")}`
                : cleaned;
            next[field] = normalised;
            // Mutual exclusivity as an affordance, not a post-hoc error.
            if (normalised) {
              if (field === "debit") next.credit = "";
              else next.debit = "";
            }
            return next;
          }

          if (field === "gstCode") {
            next.gstCode = value;
            next.gstTouched = true;
            return next;
          }

          (next as unknown as Record<string, string>)[field] = value;
          return next;
        }),
      }));
      markTouched(lineId, field);
    },
    [markTouched],
  );

  const setAccount = useCallback(
    (lineId: string, account: CoreChartAccount | null, rawText: string) => {
      setDraft((d) => ({
        ...d,
        lines: d.lines.map((line) => {
          if (line.id !== lineId) return line;
          if (!account) {
            return {
              ...line,
              accountId: null,
              accountCode: rawText,
              accountName: "",
              accountCategory: "",
              accountSubcategory: "",
            };
          }
          const next: JournalLineDraft = {
            ...line,
            accountId: account.id,
            accountCode: account.accountCode,
            accountName: account.accountName,
            accountCategory: account.category,
            accountSubcategory: account.subcategory,
          };
          // A balance-sheet account takes neither GST nor a property.
          if (!isPostableCategory(account.category)) {
            next.gstCode = "";
            next.propertyId = "";
          } else if (!line.gstTouched) {
            next.gstCode = gstCodesFor(account.category).suggested;
          }
          return next;
        }),
      }));
      markTouched(lineId, "accountCode");
    },
    [markTouched],
  );

  const addLine = useCallback(
    (propertyId = defaultPropertyId) => {
      setDraft((d) => ({ ...d, lines: [...d.lines, emptyLine(propertyId)] }));
    },
    [defaultPropertyId],
  );

  const duplicateLine = useCallback((lineId: string) => {
    setDraft((d) => {
      const at = d.lines.findIndex((l) => l.id === lineId);
      if (at < 0) return d;
      seq += 1;
      const copy: JournalLineDraft = {
        ...d.lines[at],
        id: `line-${Date.now()}-${seq}`,
      };
      const lines = [...d.lines];
      lines.splice(at + 1, 0, copy);
      return { ...d, lines };
    });
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setDraft((d) =>
      d.lines.length <= 1
        ? d
        : { ...d, lines: d.lines.filter((l) => l.id !== lineId) },
    );
  }, []);

  const clearAll = useCallback(() => {
    setDraft((d) => ({
      ...d,
      lines: [emptyLine(defaultPropertyId), emptyLine(defaultPropertyId)],
    }));
    setTouched(new Set());
    setAttemptedSave(false);
  }, [defaultPropertyId]);

  /** Add a line pre-filled with the shortfall on the opposite side. */
  const addBalancingLine = useCallback(
    (totals: JournalTotals) => {
      const diff = round2(Math.abs(totals.difference));
      if (diff === 0) return;
      const line = emptyLine(defaultPropertyId);
      if (totals.debit > totals.credit) line.credit = diff.toFixed(2);
      else line.debit = diff.toFixed(2);
      setDraft((d) => ({ ...d, lines: [...d.lines, line] }));
    },
    [defaultPropertyId],
  );

  const totals: JournalTotals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const l of draft.lines) {
      debit = round2(debit + parseAmount(l.debit));
      credit = round2(credit + parseAmount(l.credit));
    }
    const difference = round2(debit - credit);
    return {
      debit,
      credit,
      difference,
      balanced: difference === 0 && debit > 0,
    };
  }, [draft.lines]);

  const validation: DraftValidation = useMemo(() => {
    const cellErrors = new Map<string, string>();
    const entryErrors: string[] = [];

    if (!draft.entryDate) entryErrors.push("Journal date is required.");
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.entryDate)) {
      entryErrors.push("Journal date must be a valid date.");
    }

    const usedLines = draft.lines.filter(
      (l) =>
        l.accountCode.trim() ||
        l.debit ||
        l.credit ||
        l.description.trim() ||
        l.name.trim() ||
        l.gstCode,
    );

    if (usedLines.length === 0) {
      entryErrors.push("Enter at least one line.");
    } else if (usedLines.length < 2) {
      entryErrors.push(
        "A journal entry needs at least two lines: one debit and one credit.",
      );
    }

    for (const line of draft.lines) {
      const err = (field: JournalLineField, message: string) =>
        cellErrors.set(`${line.id}:${field}`, message);

      const isBlank =
        !line.accountCode.trim() &&
        !line.debit &&
        !line.credit &&
        !line.description.trim() &&
        !line.name.trim() &&
        !line.gstCode;
      if (isBlank) continue;

      if (!line.accountId) {
        err(
          "accountCode",
          line.accountCode.trim()
            ? "Not a valid account code."
            : "Account code is required.",
        );
      }

      const d = parseAmount(line.debit);
      const c = parseAmount(line.credit);
      if (d === 0 && c === 0) {
        err("debit", "Enter either a debit or a credit.");
      } else if (d > 0 && c > 0) {
        err("debit", "A line cannot have both a debit and a credit.");
      }

      if (line.accountCategory) {
        const gst = gstCodeAllowedFor(line.accountCategory, line.gstCode);
        if (!gst.ok) err("gstCode", gst.reason ?? "Invalid GST code.");

        if (isPostableCategory(line.accountCategory) && !line.propertyId) {
          err("propertyId", "Property is required on an income or expense account.");
        }
      }
    }

    if (usedLines.length >= 2 && !totals.balanced) {
      entryErrors.push(
        totals.debit === 0 && totals.credit === 0
          ? "Enter the amounts."
          : `Out of balance by ${Math.abs(totals.difference).toFixed(2)} — debits must equal credits.`,
      );
    }

    return {
      cellErrors,
      entryErrors,
      canSave: cellErrors.size === 0 && entryErrors.length === 0,
    };
  }, [draft, totals]);

  /** Show an error only once the cell has been touched or Save was pressed. */
  const errorFor = useCallback(
    (lineId: string, field: JournalLineField): string | undefined => {
      const key = `${lineId}:${field}`;
      if (!attemptedSave && !touched.has(key)) return undefined;
      return validation.cellErrors.get(key);
    },
    [validation, touched, attemptedSave],
  );

  const toRequestBody = useCallback(() => {
    const lines = draft.lines
      .filter((l) => l.accountId && (l.debit || l.credit))
      .map((l, i) => ({
        line_no: i + 1,
        chart_of_account_id: l.accountId,
        property_id: l.propertyId || null,
        debit: parseAmount(l.debit),
        credit: parseAmount(l.credit),
        gst_code: l.gstCode || null,
        description: l.description.trim() || null,
        name: l.name.trim() || null,
      }));
    return {
      entry_date: draft.entryDate,
      reference: draft.reference.trim() || null,
      memo: draft.memo.trim() || null,
      lines,
    };
  }, [draft]);

  /** Replace the grid from a pasted or parsed matrix. */
  const replaceLines = useCallback((lines: JournalLineDraft[]) => {
    setDraft((d) => ({ ...d, lines }));
  }, []);

  return {
    draft,
    totals,
    validation,
    errorFor,
    attemptedSave,
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
  };
}
