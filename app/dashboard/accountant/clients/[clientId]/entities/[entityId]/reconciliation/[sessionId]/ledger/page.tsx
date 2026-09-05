"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  formatLedgerDate,
  formatLedgerRange,
  ledgerBearerToken,
  ledgerSearchParams,
  resolveLedgerPreset,
  useLedger,
  LEDGER_DATE_PRESETS,
  type LedgerDatePreset,
  type LedgerQueryState,
} from "@/app/components/useLedger";
import type { CoreLedgerRow } from "@/src/lib/coreApi";

interface SelectOption {
  label: string;
  value: string;
  isHeader?: boolean;
}

/**
 * Ledger transaction-type tabs.
 *
 * The spec also lists Transfer and Journal Entry. `transaction.type` has no such
 * values, and adding them would reach into the P&L row filter, the GST
 * sales/purchases split and the migration-0036 grain rules — so they are absent
 * rather than shown as tabs that can never match anything.
 */
const TYPE_TABS: { label: string; value: string }[] = [
  { label: "All", value: "" },
  { label: "Income", value: "revenue" },
  { label: "Expense", value: "expense" },
  { label: "Personal", value: "personal" },
  { label: "Capital", value: "cost_base" },
];

const PAGE_SIZES = [50, 100, 200];

const DATE_PRESET_OPTIONS: SelectOption[] = LEDGER_DATE_PRESETS.map((p) => ({
  label: p,
  value: p,
}));

interface CustomSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

function CustomSelect({ value, options, onChange, placeholder, className = "" }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((opt) => opt.value === value);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = () => setIsOpen(false);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [isOpen]);

  return (
    <div className={`custom-select-container ${className}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="custom-select-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{selected ? selected.label : placeholder || "Select"}</span>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {isOpen && (
        <div className="custom-select-dropdown" role="listbox">
          {options.map((opt) => {
            if (opt.isHeader) {
              return (
                <div key={opt.value} className="custom-select-header">
                  {opt.label}
                </div>
              );
            }
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                className={`custom-select-option${opt.value === value ? " is-selected" : ""}`}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const formatMoneyAbs = (n: number) => {
  const parts = Math.abs(n).toFixed(2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return "$" + parts[0] + "." + parts[1];
};

const formatMoney = (n: number) => (n < 0 ? "−" : "") + formatMoneyAbs(n);
const formatAmount = (n: number) => (n < 0 ? "−" : "+") + formatMoneyAbs(n);

function badgeClassFor(row: CoreLedgerRow) {
  switch (row.transactionType) {
    case "revenue":
      return "badge-income";
    case "expense":
      return "badge-expense";
    case "personal":
      return "badge-journal";
    case "cost_base":
      return "badge-transfer";
    default:
      return "badge-unreconciled";
  }
}

function amountClassFor(amount: number) {
  if (amount > 0) return "amount-income";
  if (amount < 0) return "amount-expense";
  return "amount-neutral";
}

export default function GeneralLedgerPage() {
  const params = useParams<{ clientId: string; entityId: string; sessionId: string }>();

  const clientId = params?.clientId ?? "";
  const entityId = params?.entityId ?? "";
  const sessionId = params?.sessionId ?? "";

  // Filters
  const [accountId, setAccountId] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [datePreset, setDatePreset] = useState<LedgerDatePreset>("All Dates");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  // Paging
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[1]);
  const [page, setPage] = useState<number>(1);

  // Editing
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Opening balance prompt
  const [openingDraft, setOpeningDraft] = useState("");
  const [savingOpening, setSavingOpening] = useState(false);

  const [toastMessage, setToastMessage] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(""), 3200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const range = useMemo(
    () => resolveLedgerPreset(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo],
  );

  const query: LedgerQueryState = useMemo(
    () => ({
      reconciliationId: accountId || undefined,
      from: range.from,
      to: range.to,
      categoryId: categoryFilter === "All" ? undefined : Number(categoryFilter),
      type: typeFilter || undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    [accountId, range.from, range.to, categoryFilter, typeFilter, pageSize, page],
  );

  const { ledger, isLoading, error, notCompleted, reload, applyRowName } =
    useLedger(entityId, sessionId, query);

  // Any filter change re-reads from the first page; leaving the offset behind
  // would show an empty table on a narrowed result set.
  useEffect(() => {
    setPage(1);
  }, [accountId, range.from, range.to, categoryFilter, typeFilter, pageSize]);

  // The selector shows whichever statement the API resolved until the
  // accountant picks one. Copying that id into state instead would change the
  // query and refetch the same ledger a second time on every mount.
  const selectedAccountId = accountId || ledger?.account.reconciliationId || "";

  const categoryOptions: SelectOption[] = useMemo(() => {
    const options: SelectOption[] = [{ label: "All Categories", value: "All" }];
    const income = (ledger?.categories ?? []).filter((c) => c.type === "revenue");
    const expense = (ledger?.categories ?? []).filter((c) => c.type !== "revenue");
    if (income.length) {
      options.push({ label: "Income Categories", value: "header-income", isHeader: true });
      income.forEach((c) =>
        options.push({ label: c.categoryName, value: String(c.categoryId) }),
      );
    }
    if (expense.length) {
      options.push({ label: "Expense Categories", value: "header-expense", isHeader: true });
      expense.forEach((c) =>
        options.push({ label: c.categoryName, value: String(c.categoryId) }),
      );
    }
    return options;
  }, [ledger?.categories]);

  const accountOptions: SelectOption[] = useMemo(
    () =>
      (ledger?.accounts ?? []).map((a) => ({
        label: a.label,
        value: a.reconciliationId,
      })),
    [ledger?.accounts],
  );

  const rows = ledger?.rows ?? [];
  const total = ledger?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);

  // The balance column is always the true account balance, and the ledger only
  // ever lists reviewed, reconciled lines — so it has visible jumps even with no
  // filter applied. Say so unconditionally rather than letting it read as an
  // arithmetic error.
  const balanceIsFiltered = categoryFilter !== "All" || typeFilter !== "";
  // Drives the empty state: with nothing filtered, an empty ledger means
  // nothing has been reconciled and reviewed yet, which is a different problem
  // from "your filters are too narrow".
  const hasActiveFilters = balanceIsFiltered || datePreset !== "All Dates";

  const handleStartEdit = (row: CoreLedgerRow) => {
    setEditingIndex(row.bankTxIndex);
    setDraftName(row.name);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setDraftName("");
  };

  const handleSaveEdit = useCallback(
    async (row: CoreLedgerRow) => {
      const next = draftName.trim();
      if (next === row.name) {
        handleCancelEdit();
        return;
      }
      setSavingName(true);
      try {
        const token = await ledgerBearerToken();
        const res = await fetch(
          `/api/entities/${encodeURIComponent(entityId)}/reconciliation-sessions/${encodeURIComponent(sessionId)}/ledger/entries/${row.bankTxIndex}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              reconciliation_id: ledger?.account.reconciliationId,
              name: next,
            }),
          },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message || `Could not save the name (${res.status}).`);
        }
        const saved = (await res.json()) as { name: string };
        applyRowName(row.bankTxIndex, saved.name);
        handleCancelEdit();
      } catch (err) {
        // The row keeps its previous name — nothing is applied until the write
        // is confirmed.
        setToastMessage(err instanceof Error ? err.message : "Could not save the name.");
      } finally {
        setSavingName(false);
      }
    },
    [draftName, entityId, sessionId, ledger?.account.reconciliationId, applyRowName],
  );

  const handleSaveOpening = useCallback(async () => {
    const value = Number(openingDraft);
    if (!Number.isFinite(value)) {
      setToastMessage("Enter the opening balance as a number.");
      return;
    }
    const reconciliationId = ledger?.account.reconciliationId;
    if (!reconciliationId) return;

    setSavingOpening(true);
    try {
      const token = await ledgerBearerToken();
      const res = await fetch(
        `/api/entities/${encodeURIComponent(entityId)}/reconciliations/${encodeURIComponent(reconciliationId)}/account`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ opening_balance: value }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message || `Could not save the opening balance (${res.status}).`,
        );
      }
      setOpeningDraft("");
      setToastMessage("Opening balance saved.");
      reload();
    } catch (err) {
      setToastMessage(
        err instanceof Error ? err.message : "Could not save the opening balance.",
      );
    } finally {
      setSavingOpening(false);
    }
  }, [openingDraft, entityId, ledger?.account.reconciliationId, reload]);

  const doExport = useCallback(
    async (format: "csv" | "xlsx" | "pdf", label: string) => {
      setIsExporting(true);
      setToastMessage(`Preparing the ${label} export…`);
      try {
        const token = await ledgerBearerToken();
        const sp = ledgerSearchParams(query);
        // An export is the whole filter set, never the visible page.
        sp.delete("limit");
        sp.delete("offset");
        sp.set("format", format);

        const res = await fetch(
          `/api/entities/${encodeURIComponent(entityId)}/reconciliation-sessions/${encodeURIComponent(sessionId)}/ledger/export?${sp.toString()}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message || `Export failed (${res.status}).`);
        }

        // The endpoint needs the bearer token, so a plain <a download> cannot
        // fetch it — the blob is built here and handed to a click.
        const blob = await res.blob();
        const disposition = res.headers.get("content-disposition") || "";
        const match = disposition.match(/filename="?([^"]+)"?/);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = match?.[1] || `ledger.${format}`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        setToastMessage(`${label} export downloaded.`);
      } catch (err) {
        setToastMessage(err instanceof Error ? err.message : "Export failed.");
      } finally {
        setIsExporting(false);
      }
    },
    [entityId, sessionId, query],
  );

  const accountLabel = ledger?.account.label || "Bank Account";
  const backHref = `/dashboard/accountant/clients/${clientId}/entities/${entityId}?tab=reconciliation`;

  return (
    <div className="ledger-page">
      <style dangerouslySetInnerHTML={{ __html: `
        .ledger-page {
          min-height: 100vh;
          padding: 24px 20px 64px;
          background: linear-gradient(180deg, #f8faff 0%, #eef2fb 100%);
        }
        .ledger-page .wrap {
          width: min(1320px, 100%);
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 22px;
        }
        .ledger-page a {
          color: #28336e; /* Global blue color */
          text-decoration: none;
        }
        .ledger-page a:hover {
          color: #1a224c;
        }
        .ledger-page ::placeholder {
          color: #a3adc4;
        }

        /* Custom Dropdown select styles */
        .ledger-page .custom-select-container {
          position: relative;
          min-width: 180px;
        }
        .ledger-page .custom-select-container.category {
          min-width: 200px;
        }
        .ledger-page .custom-select-trigger {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(203,211,234,0.9);
          background: #f8faff;
          color: #28336e;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          outline: none;
        }
        .ledger-page .custom-select-trigger:hover {
          background: #f1f5f9;
          border-color: rgba(203, 211, 234, 1);
        }
        .ledger-page .custom-select-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          width: 100%;
          max-height: 280px;
          overflow-y: auto;
          background: #ffffff;
          border: 1px solid rgba(203, 211, 234, 0.9);
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(31, 42, 95, 0.1);
          z-index: 100;
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .ledger-page .custom-select-option {
          width: 100%;
          text-align: left;
          padding: 8px 12px;
          border: none;
          background: transparent;
          border-radius: 8px;
          color: #28336e;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .ledger-page .custom-select-option:hover {
          background: #f1f5f9;
        }
        .ledger-page .custom-select-option.is-selected {
          background: #e4e9ff;
          color: #28336e;
        }
        .ledger-page .custom-select-header {
          padding: 8px 12px 4px;
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #8892ab;
        }



        .ledger-page .crumbs-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .ledger-page .crumbs {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .ledger-page .crumb-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 10px;
          border-radius: 10px;
          font-size: 0.85rem;
          font-weight: 700;
          color: #586682;
        }
        .ledger-page .crumb-sep {
          color: #b7bfd6;
          font-size: 0.85rem;
        }
        .ledger-page .crumb-muted {
          font-size: 0.85rem;
          color: #586682;
          font-weight: 600;
        }
        .ledger-page .crumb-current {
          font-size: 0.85rem;
          color: #28336e; /* Global blue color */
          font-weight: 800;
        }
        .ledger-page .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 700;
          background: #e6f7ef;
          color: #1f8a5f;
        }

        .ledger-page .hero {
          border-radius: 28px;
          padding: 32px 34px;
          background: linear-gradient(135deg, #28336e 0%, #3e4c9c 100%); /* Global blue card background */
          color: #ffffff;
          box-shadow: 0 26px 60px rgba(31, 42, 95, 0.18);
        }
        .ledger-page .hero-eyebrow {
          margin: 0;
          color: rgba(255,255,255,0.68);
          text-transform: uppercase;
          letter-spacing: 0.09em;
          font-size: 0.76rem;
          font-weight: 700;
        }
        .ledger-page .hero h1 {
          margin: 12px 0 0;
          font-size: clamp(1.9rem, 3vw, 2.5rem);
          font-weight: 800;
          letter-spacing: -0.03em;
        }
        .ledger-page .hero-meta {
          display: flex;
          gap: 48px;
          flex-wrap: wrap;
          margin-top: 24px;
        }
        .ledger-page .hero-meta-label {
          margin: 0;
          color: rgba(255,255,255,0.62);
          font-size: 0.74rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .ledger-page .hero-meta-value {
          margin: 6px 0 0;
          font-size: 1.15rem;
          font-weight: 700;
          color: #ffffff;
        }
        .ledger-page .hero-meta-divider {
          border-left: 1px solid rgba(255,255,255,0.18);
          padding-left: 48px;
        }

        .ledger-page .card {
          border-radius: 24px;
          padding: 22px 24px;
          background: rgba(255,255,255,0.96);
          border: 1px solid rgba(203, 211, 234, 0.8);
          box-shadow: 0 18px 40px rgba(48, 59, 109, 0.08);
        }
        .ledger-page .table-card {
          border-radius: 24px;
          padding: 26px;
          background: rgba(255,255,255,0.97);
          border: 1px solid rgba(203, 211, 234, 0.8);
          box-shadow: 0 18px 40px rgba(48, 59, 109, 0.08);
        }

        .ledger-page .filters-row {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          align-items: flex-end;
          justify-content: space-between;
        }
        .ledger-page .filters-left {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          align-items: flex-end;
        }
        .ledger-page .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .ledger-page .field label {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #5d6787;
        }
        .ledger-page .field input[type="date"] {
          padding: 9px 12px;
          border-radius: 12px;
          border: 1px solid rgba(203,211,234,0.9);
          background: #f8faff;
          color: #28336e; /* Global blue color */
          font-size: 0.85rem;
          font-weight: 600;
          font-family: inherit;
          outline: none;
        }

        .ledger-page .export-buttons {
          display: flex;
          gap: 8px;
        }
        .ledger-page .export-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 10px 16px;
          border-radius: 12px;
          border: 1px solid rgba(203,211,234,0.9);
          background: #ffffff;
          color: #28336e; /* Global blue color */
          font-size: 0.83rem;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .ledger-page .export-btn:hover {
          background: #f8faff;
          border-color: rgba(203, 211, 234, 1);
        }
        .ledger-page .export-btn.pdf {
          border: none;
          background: linear-gradient(180deg, #ffb425 0%, #f4a117 100%);
          color: #28336e; /* Global blue color */
          box-shadow: 0 10px 20px rgba(244,161,23,0.24);
        }
        .ledger-page .export-btn.pdf:hover {
          background: linear-gradient(180deg, #ffa71a 0%, #e68a00 100%);
        }

        .ledger-page .type-tabs {
          display: flex;
          gap: 8px;
          margin-top: 20px;
          flex-wrap: wrap;
        }
        .ledger-page .type-tab {
          padding: 9px 16px;
          border-radius: 999px;
          border: 1px solid rgba(203,211,234,0.9);
          background: #ffffff;
          color: #586682;
          font-size: 0.83rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .ledger-page .type-tab:hover {
          background: #f8faff;
          color: #28336e; /* Global blue color */
        }
        .ledger-page .type-tab.active {
          border: 1px solid transparent;
          background: #28336e; /* Global blue color */
          color: #fff;
        }

        .ledger-page .toast {
          border-radius: 14px;
          padding: 13px 18px;
          background: #28336e; /* Global blue color */
          color: #ffffff;
          font-size: 0.85rem;
          font-weight: 600;
          box-shadow: 0 14px 30px rgba(31,42,95,0.2);
          display: inline-flex;
          align-items: center;
          gap: 10px;
          width: fit-content;
          animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from { transform: translateY(8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .ledger-page .table-scroll {
          overflow-x: auto;
        }
        .ledger-page table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
          min-width: 1040px;
        }
        .ledger-page thead th {
          text-align: left;
          padding: 11px 14px;
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #5d6787;
          border-bottom: 1px solid rgba(203,211,234,0.8);
          white-space: nowrap;
        }
        .ledger-page thead th.num {
          text-align: right;
        }
        .ledger-page tbody td {
          padding: 13px 14px;
          border-bottom: 1px solid rgba(226,231,245,0.7);
          color: #28336e; /* Global blue color */
          vertical-align: middle;
        }
        .ledger-page tbody tr:hover td {
          background: rgba(228,233,255,0.28);
        }
        .ledger-page .col-account {
          color: #8892ab;
          font-size: 0.8rem;
          white-space: nowrap;
        }
        .ledger-page .col-date {
          white-space: nowrap;
        }
        .ledger-page .col-type {
          white-space: nowrap;
        }
        .ledger-page .badge {
          display: inline-flex;
          align-items: center;
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 0.76rem;
          font-weight: 700;
          white-space: nowrap;
        }
        .ledger-page .badge-income {
          background: #e6f7ef;
          color: #1f8a5f;
        }
        .ledger-page .badge-expense {
          background: #fbe9e9;
          color: #c23b3b;
        }
        .ledger-page .badge-transfer {
          background: #e4e9ff;
          color: #28336e; /* Global blue color */
        }
        .ledger-page .badge-journal {
          background: #f3eefc;
          color: #6d4aad;
        }
        .ledger-page .col-desc {
          color: #586682;
        }
        .ledger-page .col-split {
          color: #586682;
          white-space: nowrap;
        }
        .ledger-page .col-amount {
          text-align: right;
          white-space: nowrap;
          font-weight: 700;
        }
        .ledger-page .amount-income {
          color: #1f8a5f;
        }
        .ledger-page .amount-expense {
          color: #c23b3b;
        }
        .ledger-page .amount-neutral {
          color: #28336e; /* Global blue color */
        }
        .ledger-page .col-balance {
          text-align: right;
          white-space: nowrap;
          color: #28336e; /* Global blue color */
          font-weight: 700;
        }
        .ledger-page .opening-row td {
          padding: 13px 14px;
          border-bottom: 1px solid rgba(203,211,234,0.9);
        }
        .ledger-page .opening-label {
          color: #586682;
          font-weight: 800;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .ledger-page .name-cell {
          min-width: 190px;
        }
        .ledger-page .name-display {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .ledger-page .name-display span {
          font-weight: 600;
        }
        .ledger-page .icon-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: #a3adc4;
          cursor: pointer;
          padding: 0;
          transition: all 0.15s ease;
        }
        .ledger-page .icon-btn:hover {
          color: #28336e; /* Global blue color */
          background: rgba(228, 233, 255, 0.4);
        }
        .ledger-page .name-edit {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .ledger-page .name-edit input {
          padding: 6px 9px;
          border-radius: 8px;
          border: 1px solid #28336e; /* Global blue color */
          font-size: 0.85rem;
          font-weight: 600;
          color: #28336e; /* Global blue color */
          width: 140px;
          font-family: inherit;
          outline: none;
        }
        .ledger-page .icon-btn.save {
          background: #e6f7ef;
          color: #1f8a5f;
        }
        .ledger-page .icon-btn.cancel {
          background: #fbe9e9;
          color: #c23b3b;
        }

        .ledger-page .unused-section {
          margin-top: 30px;
          padding-top: 24px;
          border-top: 1px dashed rgba(203,211,234,0.9);
        }
        .ledger-page .unused-section h3 {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 800;
          color: #28336e; /* Global blue color */
        }
        .ledger-page .unused-section p {
          margin: 6px 0 0;
          font-size: 0.82rem;
          color: #8892ab;
          max-width: 60ch;
        }
        .ledger-page .unused-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 10px;
          margin-top: 16px;
        }
        .ledger-page .unused-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 14px;
          background: #f8faff;
          border: 1px solid rgba(226,231,245,0.9);
        }
        .ledger-page .unused-item span:first-child {
          font-size: 0.85rem;
          font-weight: 600;
          color: #586682;
        }
        .ledger-page .unused-item span:last-child {
          font-size: 0.85rem;
          font-weight: 700;
          color: #a3adc4;
        }

        .ledger-page .no-results {
          padding: 32px 14px;
          text-align: center;
          color: #8892ab;
          font-size: 0.88rem;
        }

        /* ── Added when the page was wired to the API ───────────────── */

        .ledger-page .status-pill.is-open {
          background: #fef3c7;
          color: #92400e;
        }
        .ledger-page .hero-note {
          margin: 14px 0 0;
          font-size: 0.82rem;
          color: #dbe2f5;
          max-width: 62ch;
          line-height: 1.5;
        }
        .ledger-page .opening-prompt {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
        }
        .ledger-page .opening-prompt input {
          width: 130px;
          padding: 7px 10px;
          border-radius: 7px;
          border: 1px solid rgba(255, 255, 255, 0.35);
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
          font-size: 0.9rem;
          font-weight: 700;
        }
        .ledger-page .opening-prompt input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }
        .ledger-page .opening-prompt button {
          padding: 7px 14px;
          border-radius: 7px;
          border: none;
          background: #ffd166;
          color: #28336e;
          font-weight: 800;
          font-size: 0.82rem;
          cursor: pointer;
        }
        .ledger-page .opening-prompt button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .ledger-page .export-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .ledger-page .icon-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .ledger-page .badge-unreconciled {
          background: #f1f3f9;
          color: #6b7590;
        }
        .ledger-page .name-empty {
          color: #a3adc4;
          font-style: italic;
        }
        .ledger-page .opening-row.is-closing td {
          border-top: 2px solid #d8dff0;
        }
        .ledger-page .balance-note {
          margin: 0;
          padding: 11px 18px;
          background: #f6f8ff;
          border-bottom: 1px solid #e6ebf7;
          color: #5a6484;
          font-size: 0.8rem;
        }
        .ledger-page .ledger-state {
          background: #fff;
          border-radius: 14px;
          padding: 34px 28px;
          text-align: center;
          box-shadow: 0 10px 30px rgba(40, 51, 110, 0.07);
        }
        .ledger-page .ledger-state h3 {
          margin: 0 0 8px;
          color: #28336e;
          font-size: 1.05rem;
        }
        .ledger-page .ledger-state p {
          margin: 0 auto 18px;
          max-width: 58ch;
          color: #6b7590;
          font-size: 0.88rem;
          line-height: 1.55;
        }
        .ledger-page .ledger-state.is-error h3 {
          color: #b42318;
        }
        .ledger-page .ledger-state-action {
          display: inline-block;
          padding: 9px 18px;
          border-radius: 8px;
          border: none;
          background: #28336e;
          color: #fff !important;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
        }
        .ledger-page .ledger-skeleton {
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .ledger-page .ledger-skeleton-row {
          height: 34px;
          border-radius: 8px;
          background: linear-gradient(90deg, #eef1f8 25%, #f7f9ff 50%, #eef1f8 75%);
          background-size: 400% 100%;
          animation: ledger-shimmer 1.4s ease infinite;
        }
        @keyframes ledger-shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: 0 0; }
        }
        .ledger-page .ledger-pagination {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          border-top: 1px solid #e6ebf7;
          font-size: 0.83rem;
          color: #5a6484;
        }
        .ledger-page .ledger-pagination-left,
        .ledger-page .ledger-pagination-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .ledger-page .ledger-pagination select {
          padding: 6px 9px;
          border-radius: 7px;
          border: 1px solid #dbe1ef;
          background: #fff;
          color: #28336e;
          font-size: 0.8rem;
        }
        .ledger-page .ledger-pagination button {
          padding: 6px 13px;
          border-radius: 7px;
          border: 1px solid #dbe1ef;
          background: #fff;
          color: #28336e;
          font-weight: 700;
          font-size: 0.8rem;
          cursor: pointer;
        }
        .ledger-page .ledger-pagination button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
      ` }} />

      <div className="wrap">

        {/* Breadcrumbs & Status */}
        <div className="crumbs-row">
          <div className="crumbs">
            <Link className="crumb-back" href={backHref}>
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Reconciliation
            </Link>
            <span className="crumb-sep">/</span>
            <span className="crumb-muted">{accountLabel}</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">Ledger</span>
          </div>
          {ledger && (
            <span className={`status-pill${ledger.session.status === "completed" ? "" : " is-open"}`}>
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              {ledger.session.status === "completed"
                ? "Reconciliation Completed"
                : "Reconciliation Open"}
            </span>
          )}
        </div>

        {/* Hero Card */}
        <div className="hero">
          <p className="hero-eyebrow">General Ledger</p>
          <h1>{accountLabel}</h1>
          <div className="hero-meta">
            <div>
              <p className="hero-meta-label">Reporting Period</p>
              <p className="hero-meta-value">
                {ledger
                  ? formatLedgerRange(ledger.period.from, ledger.period.to)
                  : "—"}
              </p>
            </div>
            <div className="hero-meta-divider">
              <p className="hero-meta-label">Opening Balance</p>
              {ledger && !ledger.account.hasOpeningBalance ? (
                <div className="opening-prompt">
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={openingDraft}
                    onChange={(e) => setOpeningDraft(e.target.value)}
                    aria-label="Opening balance"
                  />
                  <button
                    type="button"
                    onClick={handleSaveOpening}
                    disabled={savingOpening || openingDraft.trim() === ""}
                  >
                    {savingOpening ? "Saving…" : "Set"}
                  </button>
                </div>
              ) : (
                <p className="hero-meta-value" style={{ color: "#ffd166" }}>
                  {ledger ? formatMoney(ledger.openingBalance) : "—"}
                </p>
              )}
            </div>
            {ledger && (
              <div className="hero-meta-divider">
                <p className="hero-meta-label">Closing Balance</p>
                <p className="hero-meta-value">{formatMoney(ledger.closingBalance)}</p>
              </div>
            )}
          </div>
          {ledger && !ledger.account.hasOpeningBalance && (
            <p className="hero-note">
              This statement was uploaded as a CSV, which carries no account
              balance. Set the opening balance so the running balance reflects
              the real account.
            </p>
          )}
        </div>

        {/* Filters Card */}
        <div className="card">
          <div className="filters-row">
            <div className="filters-left">
              {accountOptions.length > 1 && (
                <div className="field">
                  <label>Bank Account</label>
                  <CustomSelect
                    className="category"
                    value={selectedAccountId}
                    options={accountOptions}
                    onChange={setAccountId}
                  />
                </div>
              )}

              <div className="field">
                <label>Date Range</label>
                <CustomSelect
                  value={datePreset}
                  options={DATE_PRESET_OPTIONS}
                  onChange={(val) => setDatePreset(val as LedgerDatePreset)}
                />
              </div>

              {datePreset === "Custom Date Range" && (
                <>
                  <div className="field">
                    <label>From Date</label>
                    <input
                      type="date"
                      value={customFrom}
                      max={customTo || undefined}
                      onChange={(e) => setCustomFrom(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>To Date</label>
                    <input
                      type="date"
                      value={customTo}
                      min={customFrom || undefined}
                      onChange={(e) => setCustomTo(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="field">
                <label>Category</label>
                <CustomSelect
                  className="category"
                  value={categoryFilter}
                  options={categoryOptions}
                  onChange={setCategoryFilter}
                />
              </div>
            </div>

            <div className="export-buttons">
              {([
                ["csv", "CSV", ""],
                ["xlsx", "Excel", ""],
                ["pdf", "PDF", "pdf"],
              ] as const).map(([format, label, modifier]) => (
                <button
                  key={format}
                  className={`export-btn ${modifier}`}
                  disabled={isExporting || !ledger}
                  onClick={() => doExport(format, label)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    width="15"
                    height="15"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 3v12" />
                    <path d="M7 10l5 5 5-5" />
                    <path d="M4 19h16" />
                  </svg>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="type-tabs">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.label}
                className={`type-tab${typeFilter === tab.value ? " active" : ""}`}
                onClick={() => setTypeFilter(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {toastMessage && (
          <div>
            <div className="toast">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                width="15"
                height="15"
                fill="none"
                stroke="#ffd166"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              {toastMessage}
            </div>
          </div>
        )}

        {/* States */}
        {notCompleted && (
          <div className="ledger-state">
            <h3>This reconciliation is still open</h3>
            <p>
              The ledger is generated once the reconciliation is marked as
              completed. Finish matching the statement, then complete the
              session.
            </p>
            <Link className="ledger-state-action" href={backHref}>
              Back to Reconciliation
            </Link>
          </div>
        )}

        {error && !notCompleted && (
          <div className="ledger-state is-error">
            <h3>Could not load the ledger</h3>
            <p>{error}</p>
            <button type="button" className="ledger-state-action" onClick={reload}>
              Try again
            </button>
          </div>
        )}

        {isLoading && !ledger && !error && (
          <div className="table-card">
            <div className="ledger-skeleton">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="ledger-skeleton-row" />
              ))}
            </div>
          </div>
        )}

        {/* Table Card */}
        {ledger && !notCompleted && (
          <div className="table-card">
            <p className="balance-note">
              This ledger lists reconciled transactions that are not awaiting
              review or rejected. Balance stays the full account balance, so it
              still counts every statement line
              {balanceIsFiltered
                ? " — including the ones hidden here by the category or type filter."
                : " — including any not listed here."}
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Distribution Account</th>
                    <th>Transaction Date</th>
                    <th>Transaction Type</th>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Split</th>
                    <th className="num">Amount</th>
                    <th className="num">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="opening-row">
                    <td colSpan={6} className="opening-label">
                      Opening Balance
                    </td>
                    <td style={{ textAlign: "right", color: "#a3adc4" }}>—</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap", color: "#28336e", fontWeight: 800 }}>
                      {formatMoney(ledger.openingBalance)}
                    </td>
                  </tr>

                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="no-results">
                        {hasActiveFilters
                          ? "No transactions match the selected filters."
                          : "Nothing to show yet. The ledger lists statement lines reconciled to a transaction that is not awaiting review or rejected."}
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const isEditing = editingIndex === row.bankTxIndex;
                      return (
                        <tr key={row.bankTxIndex}>
                          <td className="col-account">{row.distributionAccount}</td>
                          <td className="col-date">{formatLedgerDate(row.date)}</td>
                          <td className="col-type">
                            <span className={`badge ${badgeClassFor(row)}`}>
                              {row.transactionTypeLabel}
                            </span>
                          </td>
                          <td className="name-cell">
                            {isEditing ? (
                              <div className="name-edit">
                                <input
                                  type="text"
                                  value={draftName}
                                  maxLength={255}
                                  disabled={savingName}
                                  onChange={(e) => setDraftName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") void handleSaveEdit(row);
                                    if (e.key === "Escape") handleCancelEdit();
                                  }}
                                  autoFocus
                                />
                                <button
                                  className="icon-btn save"
                                  disabled={savingName}
                                  onClick={() => void handleSaveEdit(row)}
                                  aria-label="Save name"
                                >
                                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 6L9 17l-5-5" />
                                  </svg>
                                </button>
                                <button
                                  className="icon-btn cancel"
                                  disabled={savingName}
                                  onClick={handleCancelEdit}
                                  aria-label="Cancel edit"
                                >
                                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <div className="name-display">
                                <span>{row.name || <em className="name-empty">Unnamed</em>}</span>
                                <button
                                  className="icon-btn"
                                  onClick={() => handleStartEdit(row)}
                                  aria-label="Edit name"
                                >
                                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 20h9" />
                                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="col-desc">{row.description}</td>
                          {/* Every row is reconciled now, so the only gap left
                              is a category that has since been deactivated. */}
                          <td className="col-split">{row.split || "—"}</td>
                          <td className={`col-amount ${amountClassFor(row.amount)}`}>
                            {formatAmount(row.amount)}
                          </td>
                          <td className="col-balance">{formatMoney(row.balance)}</td>
                        </tr>
                      );
                    })
                  )}

                  <tr className="opening-row is-closing">
                    <td colSpan={6} className="opening-label">
                      Closing Balance
                    </td>
                    <td style={{ textAlign: "right", color: "#a3adc4" }}>—</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap", color: "#28336e", fontWeight: 800 }}>
                      {formatMoney(ledger.closingBalance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="ledger-pagination">
              <div className="ledger-pagination-left">
                <span>
                  {total === 0 ? "No lines" : `${firstRow}–${lastRow} of ${total} lines`}
                </span>
                <select
                  value={pageSize}
                  aria-label="Lines per page"
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size} / page
                    </option>
                  ))}
                </select>
              </div>
              <div className="ledger-pagination-right">
                <button
                  type="button"
                  disabled={page <= 1 || isLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages || isLoading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>

            {/* Unused Categories */}
            <div className="unused-section">
              <h3>Unused Categories</h3>
              <p>Configured categories with no reconciled transactions in this reporting period.</p>
              <div className="unused-grid">
                {ledger.unusedCategories.length === 0 ? (
                  <div className="unused-item" style={{ gridColumn: "1 / -1", justifyContent: "center" }}>
                    <span>All categories have reconciled transactions.</span>
                  </div>
                ) : (
                  ledger.unusedCategories.map((cat) => (
                    <div key={cat.categoryId} className="unused-item">
                      <span>{cat.categoryName}</span>
                      <span>{formatMoneyAbs(cat.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
