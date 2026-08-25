"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface LedgerRow {
  id: string;
  date: string; // DD/MM/YYYY
  type: "Income" | "Expense" | "Transfer" | "Journal Entry";
  name: string;
  description: string;
  split: string;
  amount: number;
  balance: number;
  distributionAccount: string;
}

interface SelectOption {
  label: string;
  value: string;
  isHeader?: boolean;
}

const ALL_CATEGORIES = [
  "Sales",
  "Interest Income",
  "Rental Income",
  "Office Expenses",
  "Electricity",
  "Depreciation",
  "Borrowing Expenses",
  "Insurance Expense",
  "Repairs & Maintenance",
  "Marketing Expense",
];

const DISTRIBUTION_ACCOUNT = "Business Account – ANZ";
const OPENING_BALANCE = 10000.00;

const DATE_PRESETS: SelectOption[] = [
  { label: "Today", value: "Today" },
  { label: "Last 7 Days", value: "Last 7 Days" },
  { label: "Last Month", value: "Last Month" },
  { label: "This Month", value: "This Month" },
  { label: "Custom Date Range", value: "Custom Date Range" },
];

const CATEGORY_OPTIONS: SelectOption[] = [
  { label: "All Categories", value: "All" },
  { label: "Income Categories", value: "header-income", isHeader: true },
  { label: "Sales", value: "Sales" },
  { label: "Interest Income", value: "Interest Income" },
  { label: "Rental Income", value: "Rental Income" },
  { label: "Expense Categories", value: "header-expense", isHeader: true },
  { label: "Office Expenses", value: "Office Expenses" },
  { label: "Electricity", value: "Electricity" },
  { label: "Depreciation", value: "Depreciation" },
  { label: "Borrowing Expenses", value: "Borrowing Expenses" },
  { label: "Insurance Expense", value: "Insurance Expense" },
  { label: "Repairs & Maintenance", value: "Repairs & Maintenance" },
  { label: "Marketing Expense", value: "Marketing Expense" },
];

const BASE_ROWS: LedgerRow[] = [
  { id: "t1", date: "01/07/2026", type: "Expense", name: "Adobe Creative Cloud", description: "Adobe Subscription", split: "Office Expenses", amount: -200.00, balance: 9800.00, distributionAccount: DISTRIBUTION_ACCOUNT },
  { id: "t2", date: "03/07/2026", type: "Income", name: "Stripe Payout", description: "Stripe Deposit", split: "Sales", amount: 500.00, balance: 10300.00, distributionAccount: DISTRIBUTION_ACCOUNT },
  { id: "t3", date: "05/07/2026", type: "Expense", name: "Origin Energy", description: "Electricity Bill Payment", split: "Electricity", amount: -150.00, balance: 10150.00, distributionAccount: DISTRIBUTION_ACCOUNT },
  { id: "t4", date: "08/07/2026", type: "Transfer", name: "Business Savings Transfer", description: "Transfer to Savings Account", split: "Transfer", amount: -1200.00, balance: 8950.00, distributionAccount: DISTRIBUTION_ACCOUNT },
  { id: "t5", date: "10/07/2026", type: "Income", name: "Rental Income – Unit 4", description: "Rental Income Deposit", split: "Rental Income", amount: 2400.00, balance: 11350.00, distributionAccount: DISTRIBUTION_ACCOUNT },
  { id: "t6", date: "12/07/2026", type: "Expense", name: "Dropbox", description: "Dropbox Subscription", split: "Office Expenses", amount: -45.00, balance: 11305.00, distributionAccount: DISTRIBUTION_ACCOUNT },
  { id: "t7", date: "15/07/2026", type: "Journal Entry", name: "Depreciation Adjustment", description: "Monthly Depreciation Adjustment", split: "Depreciation", amount: -300.00, balance: 11005.00, distributionAccount: DISTRIBUTION_ACCOUNT },
  { id: "t8", date: "18/07/2026", type: "Expense", name: "Woolworths", description: "Woolworths Payment", split: "Office Expenses", amount: -85.50, balance: 10919.50, distributionAccount: DISTRIBUTION_ACCOUNT },
  { id: "t9", date: "22/07/2026", type: "Income", name: "ANZ Bank", description: "Interest Payment", split: "Interest Income", amount: 32.10, balance: 10951.60, distributionAccount: DISTRIBUTION_ACCOUNT },
  { id: "t10", date: "28/07/2026", type: "Expense", name: "Telstra", description: "Phone & Internet Bill", split: "Office Expenses", amount: -120.00, balance: 10831.60, distributionAccount: DISTRIBUTION_ACCOUNT },
  { id: "t11", date: "30/07/2026", type: "Transfer", name: "Business Savings Transfer", description: "Transfer from Savings Account", split: "Transfer", amount: 800.00, balance: 11631.60, distributionAccount: DISTRIBUTION_ACCOUNT }
];

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

export default function GeneralLedgerPage() {
  const params = useParams<{ clientId: string; entityId: string; sessionId: string }>();

  const clientId = params?.clientId ?? "";
  const entityId = params?.entityId ?? "";
  const sessionId = params?.sessionId ?? "";

  // State (using mockup's exact data values)
  const [rows, setRows] = useState<LedgerRow[]>(BASE_ROWS);
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [datePreset, setDatePreset] = useState<string>("This Month");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  // Toast notifications
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (toastMessage) {
      timer = setTimeout(() => {
        setToastMessage("");
      }, 2600);
    }
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Date parser helper
  const parseDateStr = (str: string): Date => {
    const [day, month, year] = str.split("/").map(Number);
    return new Date(year, month - 1, day);
  };

  // Filter rows dynamically
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      // 1. Type filter
      if (typeFilter !== "All" && r.type !== typeFilter) return false;

      // 2. Category filter
      if (categoryFilter !== "All" && r.split !== categoryFilter) return false;

      // 3. Date range filter
      const rDate = parseDateStr(r.date);
      if (datePreset === "Today") {
        const today = new Date(2026, 7, 25); // August 25, 2026
        return rDate.toDateString() === today.toDateString();
      } else if (datePreset === "Last 7 Days") {
        const start = new Date(2026, 7, 18);
        const end = new Date(2026, 7, 25);
        return rDate >= start && rDate <= end;
      } else if (datePreset === "Last Month") {
        // June 2026
        return rDate.getMonth() === 5 && rDate.getFullYear() === 2026;
      } else if (datePreset === "This Month") {
        // July 2026 (as per mockup reporting period)
        return rDate.getMonth() === 6 && rDate.getFullYear() === 2026;
      } else if (datePreset === "Custom Date Range") {
        if (customFrom) {
          const fromDate = new Date(customFrom);
          if (rDate < fromDate) return false;
        }
        if (customTo) {
          const toDate = new Date(customTo);
          if (rDate > toDate) return false;
        }
      }
      return true;
    });
  }, [rows, typeFilter, categoryFilter, datePreset, customFrom, customTo]);

  // Unused categories mapping
  const unusedCategories = useMemo(() => {
    const used = new Set(filteredRows.map((r) => r.split));
    return ALL_CATEGORIES.filter((cat) => !used.has(cat));
  }, [filteredRows]);

  // Formatter functions
  const formatMoneyAbs = (n: number) => {
    const parts = Math.abs(n).toFixed(2).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return "$" + parts[0] + "." + parts[1];
  };

  const formatMoney = (n: number) => {
    const sign = n < 0 ? "−" : "";
    return sign + formatMoneyAbs(n);
  };

  const formatAmount = (n: number) => {
    const sign = n < 0 ? "−" : "+";
    return sign + formatMoneyAbs(n);
  };

  const badgeClassFor = (type: string) => {
    if (type === "Income") return "badge-income";
    if (type === "Expense") return "badge-expense";
    if (type === "Transfer") return "badge-transfer";
    if (type === "Journal Entry") return "badge-journal";
    return "";
  };

  const amountClassFor = (type: string) => {
    if (type === "Income") return "amount-income";
    if (type === "Expense") return "amount-expense";
    return "amount-neutral";
  };

  // Actions
  const handleStartEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setDraftName(currentName);
  };

  const handleSaveEdit = (id: string) => {
    setRows(rows.map((r) => (r.id === id ? { ...r, name: draftName } : r)));
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter") handleSaveEdit(id);
    if (e.key === "Escape") handleCancelEdit();
  };

  const doExport = (kind: string) => {
    setToastMessage(`Preparing ${kind} export with the current filters…`);
  };

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
      ` }} />

      <div className="wrap">


        {/* Breadcrumbs & Status */}
        <div className="crumbs-row">
          <div className="crumbs">
            <Link
              className="crumb-back"
              href={`/dashboard/accountant/clients/${clientId}/entities/${entityId}?tab=reconciliation`}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Reconciliation
            </Link>
            <span className="crumb-sep">/</span>
            <span className="crumb-muted">{DISTRIBUTION_ACCOUNT}</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">Ledger</span>
          </div>
          <span className="status-pill">
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
            Reconciliation Completed
          </span>
        </div>

        {/* Hero Card */}
        <div className="hero">
          <p className="hero-eyebrow">General Ledger</p>
          <h1>{DISTRIBUTION_ACCOUNT}</h1>
          <div className="hero-meta">
            <div>
              <p className="hero-meta-label">Reporting Period</p>
              <p className="hero-meta-value">01 Jul 2026 – 31 Jul 2026</p>
            </div>
            <div className="hero-meta-divider">
              <p className="hero-meta-label">Opening Balance</p>
              <p className="hero-meta-value" style={{ color: "#ffd166" }}>
                $10,000.00
              </p>
            </div>
          </div>
        </div>

        {/* Filters Card */}
        <div className="card">
          <div className="filters-row">
            <div className="filters-left">
              {/* Date Preset */}
              <div className="field">
                <label>Date Range</label>
                <CustomSelect
                  value={datePreset}
                  options={DATE_PRESETS}
                  onChange={(val) => setDatePreset(val)}
                />
              </div>

              {/* Custom Date Picker */}
              {datePreset === "Custom Date Range" && (
                <>
                  <div className="field">
                    <label>From Date</label>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>To Date</label>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* Category Filter */}
              <div className="field">
                <label>Category</label>
                <CustomSelect
                  className="category"
                  value={categoryFilter}
                  options={CATEGORY_OPTIONS}
                  onChange={(val) => setCategoryFilter(val)}
                />
              </div>
            </div>

            {/* Export Buttons */}
            <div className="export-buttons">
              <button className="export-btn" onClick={() => doExport("CSV")}>
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
                CSV
              </button>
              <button className="export-btn" onClick={() => doExport("Excel")}>
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
                Excel
              </button>
              <button className="export-btn pdf" onClick={() => doExport("PDF")}>
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
                PDF
              </button>
            </div>
          </div>

          {/* Type Tabs */}
          <div className="type-tabs">
            {["All", "Income", "Expense", "Transfer", "Journal Entry"].map((t) => (
              <button
                key={t}
                className={`type-tab${typeFilter === t ? " active" : ""}`}
                onClick={() => setTypeFilter(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Toast holder */}
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

        {/* Table Card */}
        <div className="table-card">
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
                {/* Opening Balance Row */}
                <tr className="opening-row">
                  <td colSpan={6} className="opening-label">
                    Opening Balance
                  </td>
                  <td style={{ textAlign: "right", color: "#a3adc4" }}>—</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap", color: "#28336e", fontWeight: 800 }}>
                    {formatMoney(OPENING_BALANCE)}
                  </td>
                </tr>

                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="no-results">
                      No transactions match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const isEditing = editingId === row.id;
                    return (
                      <tr key={row.id}>
                        <td className="col-account">{row.distributionAccount}</td>
                        <td className="col-date">{row.date}</td>
                        <td className="col-type">
                          <span className={`badge ${badgeClassFor(row.type)}`}>
                            {row.type}
                          </span>
                        </td>
                        <td className="name-cell">
                          {isEditing ? (
                            <div className="name-edit">
                              <input
                                type="text"
                                value={draftName}
                                onChange={(e) => setDraftName(e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, row.id)}
                                autoFocus
                              />
                              <button
                                className="icon-btn save"
                                onClick={() => handleSaveEdit(row.id)}
                                aria-label="Save name"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  width="14"
                                  height="14"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M20 6L9 17l-5-5" />
                                </svg>
                              </button>
                              <button
                                className="icon-btn cancel"
                                onClick={handleCancelEdit}
                                aria-label="Cancel edit"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  width="14"
                                  height="14"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <div className="name-display">
                              <span>{row.name}</span>
                              <button
                                className="icon-btn"
                                onClick={() => handleStartEdit(row.id, row.name)}
                                aria-label="Edit name"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  width="14"
                                  height="14"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.9"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M12 20h9" />
                                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="col-desc">{row.description}</td>
                        <td className="col-split">{row.split}</td>
                        <td className={`col-amount ${amountClassFor(row.type)}`}>
                          {formatAmount(row.amount)}
                        </td>
                        <td className="col-balance">{formatMoney(row.balance)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Unused Categories Section */}
          <div className="unused-section">
            <h3>Unused Categories</h3>
            <p>Configured categories with no reconciled transactions in this reporting period.</p>
            <div className="unused-grid">
              {unusedCategories.length === 0 ? (
                <div className="unused-item" style={{ gridColumn: "1 / -1", justifyContent: "center" }}>
                  <span>All categories have reconciled transactions.</span>
                </div>
              ) : (
                unusedCategories.map((cat) => (
                  <div key={cat} className="unused-item">
                    <span>{cat}</span>
                    <span>$0.00</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
