"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Skeleton } from "boneyard-js/react";
import { PropertyDetailSkeleton } from "@/app/components/PortalSkeletons";
import { getSession } from "@/src/lib/session";
import type {
  CoreEntity,
  CoreProperty,
  CoreTransactionCategory,
  CoreTransactionListItem,
  CoreTransactionSubcategory,
} from "@/src/lib/coreApi";
import {
  BORROWING_EXPENSE_CATEGORY_NAME,
  findBorrowingExpenseCategory,
} from "@/src/lib/borrowingCost";
import {
  announceDropdownOpen,
  dropdownRegistryEvent,
  isDropdownRegistryEvent,
} from "@/src/lib/dropdownRegistry";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

/**
 * One row of the expense grid, backed by a real transaction.
 *
 * `transactionId` is empty on a row the accountant has added but not yet saved;
 * that is what tells the save which rows to POST and which to PATCH. Amount and
 * date stay strings so the inputs can hold a half-typed value without the
 * schedule recalculating against NaN.
 */
type BorrowingExpense = {
  /** Row identity in React. Stable across a save so inputs keep focus. */
  key: string;
  transactionId: string;
  subcategoryId: number | null;
  amount: string;
  date: string;
  description: string;
};

type BorrowingCostViewProps = {
  propertyId: string;
  backHref: string;
};

const CURRENCY_SYMBOL = "A$ ";

/** Row keys for expenses the accountant has added but not yet saved. */
let draftKeySeq = 0;
function nextDraftKey() {
  draftKeySeq += 1;
  return `draft-${draftKeySeq}`;
}

function transactionToExpense(row: CoreTransactionListItem): BorrowingExpense {
  return {
    key: row.id,
    transactionId: row.id,
    subcategoryId: row.subcategoryId,
    // The grid edits amounts as text; grossAmount is the authoritative number.
    amount: row.grossAmount.toFixed(2),
    date: row.invoiceDate ? row.invoiceDate.slice(0, 10) : "",
    description: row.description || "",
  };
}

function formatMoney(value: number) {
  const formattedNumber = new Intl.NumberFormat("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
  return `${CURRENCY_SYMBOL}${formattedNumber}`;
}

// Convert YYYY-MM-DD to DD/MM/YYYY
function formatDateToDDMMYYYY(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

type SubcategoryOption = { id: number; name: string };

interface TableDropdownSelectProps {
  value: number | null;
  options: SubcategoryOption[];
  onChange: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
}

function TableDropdownSelect({
  value,
  options,
  onChange,
  placeholder = "Select subcategory",
  disabled = false,
}: TableDropdownSelectProps) {
  const reactId = useId();
  const dropdownId = `table-select-${reactId}`;
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeIfAnotherOpened(event: Event) {
      if (
        isDropdownRegistryEvent(event) &&
        event.detail?.id &&
        event.detail.id !== dropdownId
      ) {
        setIsOpen(false);
      }
    }
    window.addEventListener(dropdownRegistryEvent, closeIfAnotherOpened);
    return () =>
      window.removeEventListener(dropdownRegistryEvent, closeIfAnotherOpened);
  }, [dropdownId]);

  useEffect(() => {
    if (isOpen) {
      announceDropdownOpen(dropdownId);
    }
  }, [dropdownId, isOpen]);

  const selectedLabel =
    options.find((option) => option.id === value)?.name ?? "";

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={`borrowing-cost-dropdown-container ${isOpen ? "is-open" : ""} ${
        disabled ? "is-disabled" : ""
      }`}
    >
      <button
        type="button"
        className="borrowing-cost-dropdown-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <span
          className="borrowing-cost-dropdown-value"
          style={selectedLabel ? undefined : { color: "#98a2b3" }}
        >
          {selectedLabel || placeholder}
        </span>
        <svg
          className="borrowing-cost-dropdown-arrow"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <div className="borrowing-cost-dropdown-menu" role="listbox">
          {options.length === 0 && (
            <div className="borrowing-cost-dropdown-empty">
              No borrowing subcategories configured.
            </div>
          )}
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={option.id === value}
              className={`borrowing-cost-dropdown-item ${
                option.id === value ? "is-selected" : ""
              }`}
              onClick={() => {
                onChange(option.id);
                setIsOpen(false);
              }}
            >
              <span>{option.name}</span>
              {option.id === value && (
                <svg
                  className="borrowing-cost-dropdown-check"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BorrowingCostView({
  propertyId,
  backHref,
}: BorrowingCostViewProps) {
  const router = useRouter();
  const [property, setProperty] = useState<CoreProperty | null>(null);
  const [entity, setEntity] = useState<CoreEntity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form State
  const [borrowingExpenses, setBorrowingExpenses] = useState<BorrowingExpense[]>([]);
  const [loanStartDate, setLoanStartDate] = useState("");
  const [loanEndDate, setLoanEndDate] = useState("");
  const [sessionToken, setSessionToken] = useState("");

  // The borrowing expense taxonomy, read from the database rather than a
  // constant so an admin adding a subcategory shows up here without a release.
  const [category, setCategory] = useState<CoreTransactionCategory | null>(null);
  const [subcategories, setSubcategories] = useState<CoreTransactionSubcategory[]>([]);

  // Transaction ids present when the page loaded. Diffed against the grid on
  // save to work out which rows the accountant deleted.
  const loadedTransactionIdsRef = useRef<string[]>([]);

  // Load Data
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;
        if (!session) {
          router.replace("/login/user");
          return;
        }

        const token = session.getIdToken().getJwtToken();
        if (!cancelled) setSessionToken(token);
        const authHeaders = { Authorization: `Bearer ${token}` };

        const propertyRes = await fetch(
          `/api/properties/${encodeURIComponent(propertyId)}`,
          { headers: authHeaders }
        );

        if (cancelled) return;
        if (!propertyRes.ok) {
          setLoadError("Failed to load property details.");
          return;
        }

        const loadedProperty = (await propertyRes.json()) as CoreProperty;
        setProperty(loadedProperty);

        // Load entity details if property has entityId
        if (loadedProperty.entityId) {
          const entityRes = await fetch(
            `/api/entities/${encodeURIComponent(loadedProperty.entityId)}`,
            { headers: authHeaders }
          );
          if (!cancelled && entityRes.ok) {
            setEntity((await entityRes.json()) as CoreEntity);
          }
        }

        // Only the loan dates live on the property now. The expenses themselves
        // are transactions, loaded below — keeping a second copy in the JSON
        // blob is what let the two drift apart.
        const loanDetails = loadedProperty.loanDetails;
        if (!cancelled && loanDetails) {
          if (loanDetails.loan_start_date) {
            setLoanStartDate(String(loanDetails.loan_start_date).slice(0, 10));
          }
          if (loanDetails.loan_end_date) {
            setLoanEndDate(String(loanDetails.loan_end_date).slice(0, 10));
          }
        }

        // Resolve the borrowing expense category by name: its id is a
        // BIGSERIAL that differs per environment, so there is nothing stable to
        // hardcode.
        const categoryRes = await fetch(
          `/api/transactions/categories?type=expense`,
          { headers: authHeaders }
        );
        if (cancelled) return;
        if (!categoryRes.ok) {
          setLoadError("Failed to load borrowing expense categories.");
          return;
        }
        const categoryData = (await categoryRes.json()) as {
          items?: CoreTransactionCategory[];
        };
        const borrowingCategory = findBorrowingExpenseCategory(
          categoryData.items || []
        );
        if (!borrowingCategory) {
          setLoadError(
            `The "${BORROWING_EXPENSE_CATEGORY_NAME}" category is missing from this organisation's chart of accounts.`
          );
          return;
        }
        if (cancelled) return;
        setCategory(borrowingCategory);

        const [subcategoryRes, transactionsRes] = await Promise.all([
          fetch(
            `/api/transactions/categories/${borrowingCategory.id}/sub-categories`,
            { headers: authHeaders }
          ),
          fetch(
            `/api/transactions?property_id=${encodeURIComponent(propertyId)}` +
              `&category_id=${borrowingCategory.id}&grain=top&limit=200`,
            { headers: authHeaders }
          ),
        ]);
        if (cancelled) return;

        if (subcategoryRes.ok) {
          const subcategoryData = (await subcategoryRes.json()) as {
            items?: CoreTransactionSubcategory[];
          };
          setSubcategories(subcategoryData.items || []);
        }

        if (transactionsRes.ok) {
          const page = (await transactionsRes.json()) as {
            items?: CoreTransactionListItem[];
          };
          const rows = (page.items || []).map(transactionToExpense);
          setBorrowingExpenses(rows);
          loadedTransactionIdsRef.current = rows.map((row) => row.transactionId);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error loading borrowing cost details:", err);
          setLoadError("An unexpected error occurred loading details.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [propertyId, router]);

  /**
   * Re-reads the expense grid from the transactions behind it. Called after a
   * save so freshly created rows learn their transaction id; until they do,
   * they still look like drafts and a second save would create them again.
   */
  const reloadExpenses = async (token: string, categoryId: number) => {
    const res = await fetch(
      `/api/transactions?property_id=${encodeURIComponent(propertyId)}` +
        `&category_id=${categoryId}&grain=top&limit=200`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return;
    const page = (await res.json()) as { items?: CoreTransactionListItem[] };
    const rows = (page.items || []).map(transactionToExpense);
    setBorrowingExpenses(rows);
    loadedTransactionIdsRef.current = rows.map((row) => row.transactionId);
  };

  // Calculations
  const totalBorrowingCost = useMemo(() => {
    return borrowingExpenses.reduce((sum, exp) => {
      const val = Number.parseFloat(exp.amount);
      return sum + (Number.isFinite(val) ? val : 0);
    }, 0);
  }, [borrowingExpenses]);

  // Derive Period End Date (system) and Number of Days (system) for the first period
  const systemValues = useMemo(() => {
    if (!loanStartDate || !loanEndDate) {
      return { periodEndDateStr: "", days: 0 };
    }

    const startParts = loanStartDate.split("-");
    const endParts = loanEndDate.split("-");
    if (startParts.length !== 3 || endParts.length !== 3) {
      return { periodEndDateStr: "", days: 0 };
    }

    const start = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2]));
    const end = new Date(Number(endParts[0]), Number(endParts[1]) - 1, Number(endParts[2]));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return { periodEndDateStr: "", days: 0 };
    }

    const startYear = start.getFullYear();
    const startMonth = start.getMonth();
    const fyEndYear = startMonth <= 5 ? startYear : startYear + 1;
    const firstFyEnd = new Date(fyEndYear, 5, 30); // June 30 of target end fiscal year

    const targetEnd = end < firstFyEnd ? end : firstFyEnd;
    const diffTime = targetEnd.getTime() - start.getTime();
    const days = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const formattedEnd = `${String(targetEnd.getFullYear())}-${String(targetEnd.getMonth() + 1).padStart(2, "0")}-${String(targetEnd.getDate()).padStart(2, "0")}`;

    return {
      periodEndDateStr: formattedEnd,
      days,
    };
  }, [loanStartDate, loanEndDate]);

  // Build full Schedule
  const schedule = useMemo(() => {
    if (!loanStartDate || !loanEndDate || totalBorrowingCost <= 0) {
      return [];
    }

    const startParts = loanStartDate.split("-");
    const endParts = loanEndDate.split("-");
    if (startParts.length !== 3 || endParts.length !== 3) return [];

    const start = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2]));
    const end = new Date(Number(endParts[0]), Number(endParts[1]) - 1, Number(endParts[2]));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

    type Period = {
      label: string;
      days: number;
      cost: number;
      closingBalance: number;
    };

    const periods: Period[] = [];
    let currentStart = new Date(start);

    while (currentStart <= end) {
      const year = currentStart.getFullYear();
      const month = currentStart.getMonth();
      const fyEndYear = month <= 5 ? year : year + 1;
      const currentFyEnd = new Date(fyEndYear, 5, 30);

      const currentEnd = end < currentFyEnd ? end : currentFyEnd;
      const diffTime = currentEnd.getTime() - currentStart.getTime();
      const days = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

      let label = "";
      if (currentEnd.getTime() === end.getTime() && currentEnd.getTime() !== currentFyEnd.getTime()) {
        const dStr = String(currentEnd.getDate()).padStart(2, "0");
        const mStr = String(currentEnd.getMonth() + 1).padStart(2, "0");
        const yStr = currentEnd.getFullYear();
        label = `Final Period (to ${dStr}/${mStr}/${yStr})`;
      } else {
        label = `FY ${fyEndYear - 1}–${String(fyEndYear).slice(-2)}`;
      }

      periods.push({
        label,
        days,
        cost: 0,
        closingBalance: 0,
      });

      currentStart = new Date(currentEnd);
      currentStart.setDate(currentStart.getDate() + 1);
    }

    const totalDays = periods.reduce((sum, p) => sum + p.days, 0);
    if (totalDays <= 0) return [];

    const dailyRate = totalBorrowingCost / totalDays;
    let runningCostSum = 0;
    let balance = totalBorrowingCost;

    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      let cost = 0;
      if (i === periods.length - 1) {
        cost = totalBorrowingCost - runningCostSum;
      } else {
        cost = Math.round(p.days * dailyRate * 100) / 100;
        runningCostSum += cost;
      }
      balance = Math.max(0, Math.round((balance - cost) * 100) / 100);

      p.cost = cost;
      p.closingBalance = i === periods.length - 1 ? 0 : balance;
    }

    return periods;
  }, [loanStartDate, loanEndDate, totalBorrowingCost]);

  // Total Schedule Days helper
  const totalScheduleDays = useMemo(() => {
    return schedule.reduce((sum, p) => sum + p.days, 0);
  }, [schedule]);

  // Add Row — appended as a draft; it becomes a transaction on save.
  const handleAddExpense = () => {
    setBorrowingExpenses((prev) => [
      ...prev,
      {
        key: nextDraftKey(),
        transactionId: "",
        subcategoryId: null,
        amount: "",
        date: new Date().toISOString().slice(0, 10),
        description: "",
      },
    ]);
  };

  // Delete Row. The transaction itself is deleted on save, so a mis-click is
  // recoverable by leaving the page.
  const handleDeleteExpense = (key: string) => {
    setBorrowingExpenses((prev) => prev.filter((exp) => exp.key !== key));
  };

  // Update field
  const handleUpdateField = <K extends keyof BorrowingExpense>(
    key: string,
    field: K,
    value: BorrowingExpense[K],
  ) => {
    setBorrowingExpenses((prev) =>
      prev.map((exp) => (exp.key === key ? { ...exp, [field]: value } : exp))
    );
  };

  /**
   * Builds the create/update body for one expense row.
   *
   * Every borrowing expense is an ordinary expense transaction: type and
   * category are fixed by this page (the general Add Transaction form no longer
   * offers the category), and the single split puts 100% of it on this
   * property, which is what the property-level reports read.
   */
  const expenseRequestBody = (exp: BorrowingExpense, categoryId: number) => ({
    type: "expense",
    category_id: categoryId,
    subcategory_id: exp.subcategoryId,
    invoice_date: exp.date,
    gross_amount: Number.parseFloat(exp.amount),
    description: exp.description.trim() || null,
    splits: [{ property_id: propertyId, split_percentage: 100 }],
  });

  // Save details — reconciles the grid against the transactions behind it, then
  // stores the loan dates on the property.
  const handleSave = async () => {
    if (!sessionToken || !property || !category) return;

    const entityId = property.entityId;
    if (!entityId) {
      setSaveError("This property is not linked to an entity, so borrowing expenses cannot be recorded against it.");
      return;
    }

    // Validate before writing anything: a partial save would leave some
    // expenses created and others not, with no way to tell which from the UI.
    for (const exp of borrowingExpenses) {
      if (!exp.subcategoryId) {
        setSaveError("Every borrowing expense needs a subcategory.");
        return;
      }
      const amount = Number.parseFloat(exp.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        setSaveError("Every borrowing expense needs an amount greater than zero.");
        return;
      }
      if (!exp.date) {
        setSaveError("Every borrowing expense needs a date.");
        return;
      }
    }

    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError("");
    try {
      const authHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      };

      const remainingIds = new Set(
        borrowingExpenses.map((exp) => exp.transactionId).filter(Boolean)
      );
      const deletedIds = loadedTransactionIdsRef.current.filter(
        (id) => !remainingIds.has(id)
      );

      const responses = await Promise.all([
        ...borrowingExpenses.map((exp) =>
          exp.transactionId
            ? fetch(`/api/transactions/${encodeURIComponent(exp.transactionId)}`, {
                method: "PATCH",
                headers: authHeaders,
                body: JSON.stringify(expenseRequestBody(exp, category.id)),
              })
            : fetch(`/api/entities/${encodeURIComponent(entityId)}/transactions`, {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify(expenseRequestBody(exp, category.id)),
              })
        ),
        ...deletedIds.map((id) =>
          fetch(`/api/transactions/${encodeURIComponent(id)}`, {
            method: "DELETE",
            headers: authHeaders,
          })
        ),
        fetch(`/api/properties/${encodeURIComponent(propertyId)}`, {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({
            loan_details: {
              ...(property.loanDetails || {}),
              // Superseded by the transactions this page now writes. Sent as
              // null so a property saved under the old shape stops carrying a
              // stale second copy of the expenses.
              borrowing_expenses: null,
              loan_start_date: loanStartDate || null,
              loan_end_date: loanEndDate || null,
            },
          }),
        }),
      ]);

      const failed = responses.filter((res) => !res.ok);
      if (failed.length > 0) {
        const detail = (await failed[0].json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;
        setSaveError(
          detail?.message || detail?.error || "Failed to save borrowing cost details."
        );
        return;
      }

      // Re-read so new rows pick up their transaction ids — without this a
      // second save would create duplicates of everything just added.
      await reloadExpenses(sessionToken, category.id);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving borrowing expenses:", err);
      setSaveError("Error saving borrowing cost details.");
    } finally {
      setIsSaving(false);
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    if (schedule.length === 0) {
      alert("No schedule to export.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "YEAR / PERIOD,NUMBER OF DAYS,BORROWING COST,CLOSING BALANCE\n";

    schedule.forEach((p) => {
      csvContent += `"${p.label}",${p.days},${p.cost.toFixed(2)},${p.closingBalance.toFixed(2)}\n`;
    });

    // Total Row
    csvContent += `"Total",${totalScheduleDays},${totalBorrowingCost.toFixed(2)},0.00\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `borrowing_cost_schedule_${propertyId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="client-detail-page property-detail-page property-detail-shell" style={{ padding: "40px 32px" }}>
        <PropertyDetailSkeleton />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="client-detail-page property-detail-page property-detail-shell" style={{ padding: "40px 32px" }}>
        <div style={{ color: "#d92d20", fontSize: "16px", fontWeight: 600 }}>{loadError}</div>
        <Link href={backHref} style={{ display: "inline-block", marginTop: "16px", color: "#233069", fontWeight: 600 }}>
          Back to Property
        </Link>
      </div>
    );
  }

  const propName = property?.name || "-";
  const entityName = entity?.name || "-";

  return (
    <div className="client-detail-page property-detail-page property-detail-shell borrowing-cost-container">
      <style>{`
        .borrowing-cost-container {
          padding: 0 32px 60px;
        }
        @media (max-width: 768px) {
          .borrowing-cost-container {
            padding: 0 16px 40px;
          }
        }
        .borrowing-cost-card {
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #e4e7ef;
          padding: 32px;
          box-shadow: 0 1px 3px rgba(16, 24, 40, 0.04);
        }
        .borrowing-cost-input, .borrowing-cost-select {
          width: 100%;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid #d0d5dd;
          font-size: 14px;
          color: #1d2939;
          background-color: #ffffff;
          transition: all 0.2s ease;
          outline: none;
        }
        .borrowing-cost-input:focus, .borrowing-cost-select:focus {
          border-color: #28336e;
          box-shadow: 0 0 0 3px rgba(40, 51, 110, 0.12);
        }
        .borrowing-cost-input[readonly] {
          background-color: #f8f9fc;
          border-color: #eaecf0;
          color: #475467;
          cursor: not-allowed;
        }
        .borrowing-cost-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .borrowing-cost-table th {
          background-color: #f9fafb;
          padding: 12px 16px;
          font-size: 12px;
          font-weight: 700;
          color: #475467;
          letter-spacing: 0.05em;
          border-bottom: 1.5px solid #eaecf0;
        }
        .borrowing-cost-table td {
          padding: 12px 8px;
          vertical-align: middle;
        }
        .borrowing-cost-dropdown-container {
          position: relative;
          width: 100%;
        }
        .borrowing-cost-dropdown-container.is-open {
          z-index: 100;
        }
        .borrowing-cost-dropdown-trigger {
          width: 100%;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid #d0d5dd;
          font-size: 14px;
          color: #1d2939;
          background-color: #ffffff;
          transition: all 0.2s ease;
          outline: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          height: 42px;
        }
        .borrowing-cost-dropdown-trigger:hover:not(:disabled) {
          border-color: #98a2b3;
          background-color: #fcfcfd;
        }
        .borrowing-cost-dropdown-container.is-open .borrowing-cost-dropdown-trigger {
          border-color: #28336e;
          box-shadow: 0 0 0 3px rgba(40, 51, 110, 0.12);
        }
        .borrowing-cost-dropdown-arrow {
          width: 16px;
          height: 16px;
          color: #667085;
          transition: transform 0.2s ease;
          flex-shrink: 0;
        }
        .borrowing-cost-dropdown-container.is-open .borrowing-cost-dropdown-arrow {
          transform: rotate(180deg);
        }
        .borrowing-cost-dropdown-value {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 500;
        }
        .borrowing-cost-dropdown-menu {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          z-index: 99;
          background-color: #ffffff;
          border: 1px solid #e4e7ef;
          border-radius: 8px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          max-height: 200px;
          overflow-y: auto;
          padding: 4px;
        }
        .borrowing-cost-dropdown-item {
          width: 100%;
          padding: 10px 12px;
          font-size: 14px;
          color: #344054;
          background: transparent;
          border: none;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          transition: background-color 0.15s ease, color 0.15s ease;
        }
        .borrowing-cost-dropdown-item:hover {
          background-color: #f4f5f9;
          color: #1e295b;
        }
        .borrowing-cost-dropdown-item.is-selected {
          background-color: #f0f2f9;
          color: #1e295b;
          font-weight: 600;
        }
        .borrowing-cost-dropdown-check {
          width: 16px;
          height: 16px;
          color: #28336e;
          flex-shrink: 0;
        }
        .borrowing-cost-dropdown-container.is-disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .borrowing-cost-dropdown-trigger:disabled {
          cursor: not-allowed;
          background-color: #f8f9fc;
        }
        .borrowing-cost-btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          background-color: #ffffff;
          color: #1e295b;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .borrowing-cost-btn-secondary:hover {
          background-color: #f9fafb;
          border-color: #bac2de;
        }
        .borrowing-cost-dropdown-empty {
          padding: 10px 12px;
          font-size: 13px;
          color: #667085;
        }
      `}</style>

      {/* Breadcrumbs Back */}
      <Link href={backHref} className="entity-wizard-back">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Back to Property
      </Link>

      <header className="logit-review-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: "12px", marginBottom: "32px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#1c244b", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
            Borrowing Cost
          </h1>
          <p style={{ color: "#475467", fontSize: "14px", margin: 0, fontWeight: 500 }}>
            {propName} · {entityName} — borrowing expenses, loan details & amortisation schedule
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          {/* Save Changes button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              border: "none",
              borderRadius: "10px",
              backgroundColor: "#28336e",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s",
              height: "42px",
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>

          {/* Export Borrowing Cost Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              border: "1.5px solid #d0d5dd",
              borderRadius: "10px",
              backgroundColor: "#ffffff",
              color: "#1b2559",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s",
              height: "42px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f9fafb";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#ffffff";
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "16px", height: "16px", flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Borrowing Cost
          </button>
        </div>
      </header>

      {saveSuccess && (
        <div
          style={{
            backgroundColor: "#ecfdf3",
            color: "#027a48",
            border: "1px solid #d1fadf",
            padding: "12px 16px",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "20px", height: "20px" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Changes saved successfully!
        </div>
      )}

      {saveError && (
        <div
          style={{
            backgroundColor: "#fef3f2",
            color: "#b42318",
            border: "1px solid #fecdca",
            padding: "12px 16px",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            marginBottom: "24px",
          }}
        >
          {saveError}
        </div>
      )}

      <div className="logit-review-form">
        {/* Section 1: Borrowing Expenses */}
        <section className="entity-wizard-card logit-card borrowing-cost-card">
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1c244b", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
                Borrowing Expenses
              </h2>
            </div>
            <button
              type="button"
              onClick={() => handleAddExpense()}
              className="borrowing-cost-btn-secondary"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ width: "12px", height: "12px" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Another Borrowing Expense
            </button>
          </header>

          <div style={{ overflow: "visible" }}>
            <table className="borrowing-cost-table">
              <thead>
                <tr>
                  <th>SUBCATEGORY</th>
                  <th style={{ width: "150px" }}>AMOUNT</th>
                  <th style={{ width: "180px" }}>DATE</th>
                  <th>DESCRIPTION</th>
                  <th style={{ width: "50px" }}></th>
                </tr>
              </thead>
              <tbody>
                {borrowingExpenses.map((exp) => (
                  <tr key={exp.key} style={{ borderBottom: "1px solid #f2f4f7" }}>
                    {/* Subcategory Dropdown */}
                    <td>
                      <TableDropdownSelect
                        value={exp.subcategoryId}
                        options={subcategories}
                        onChange={(val) => handleUpdateField(exp.key, "subcategoryId", val)}
                      />
                    </td>

                    {/* Amount Input */}
                    <td>
                      <input
                        type="number"
                        placeholder="0"
                        value={exp.amount}
                        onChange={(e) => handleUpdateField(exp.key, "amount", e.target.value)}
                        className="borrowing-cost-input"
                        style={{ textAlign: "right" }}
                      />
                    </td>

                    {/* Date Picker */}
                    <td>
                      <input
                        type="date"
                        value={exp.date}
                        onChange={(e) => handleUpdateField(exp.key, "date", e.target.value)}
                        className="borrowing-cost-input"
                      />
                    </td>

                    {/* Description */}
                    <td>
                      <input
                        type="text"
                        placeholder="Description"
                        value={exp.description}
                        onChange={(e) => handleUpdateField(exp.key, "description", e.target.value)}
                        className="borrowing-cost-input"
                      />
                    </td>

                    {/* Delete Button */}
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(exp.key)}
                        aria-label="Delete borrowing expense"
                        style={{
                          background: "none",
                          border: "1px solid #fecdca",
                          borderRadius: "6px",
                          padding: "6px 8px",
                          cursor: "pointer",
                          color: "#f04438",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          height: "36px",
                          width: "36px",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#fee4e2";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "16px", height: "16px" }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Total Row */}
                <tr style={{ backgroundColor: "#f9fafb", borderTop: "2px solid #eaecf0" }}>
                  <td style={{ padding: "16px", fontSize: "14px", fontWeight: 700, color: "#1d2939" }}>
                    Total Borrowing Cost
                  </td>
                  <td style={{ padding: "16px", fontSize: "14px", fontWeight: 700, color: "#1e295b", textAlign: "right" }} colSpan={1}>
                    {formatMoney(totalBorrowingCost)}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Loan Details */}
        <section className="entity-wizard-card logit-card borrowing-cost-card">
          <header style={{ marginBottom: "8px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1c244b", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
              Loan Details
            </h2>
            <p style={{ color: "#475467", fontSize: "14px", margin: 0 }}>
              Used to spread the total borrowing cost across the loan period
            </p>
          </header>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "24px", marginTop: "16px" }}>
            {/* Start Date */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#344054", marginBottom: "6px" }}>
                Loan Start Date
              </label>
              <input
                type="date"
                value={loanStartDate}
                onChange={(e) => setLoanStartDate(e.target.value)}
                className="borrowing-cost-input"
              />
            </div>

            {/* End Date */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#344054", marginBottom: "6px" }}>
                Loan End Date
              </label>
              <input
                type="date"
                value={loanEndDate}
                onChange={(e) => setLoanEndDate(e.target.value)}
                className="borrowing-cost-input"
              />
            </div>

            {/* Period End Date (system) */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#344054", marginBottom: "6px" }}>
                Period End Date (system)
              </label>
              <input
                type="text"
                readOnly
                value={formatDateToDDMMYYYY(systemValues.periodEndDateStr)}
                className="borrowing-cost-input"
              />
            </div>

            {/* Number of Days (system) */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#344054", marginBottom: "6px" }}>
                Number of Days (system)
              </label>
              <input
                type="text"
                readOnly
                value={systemValues.days || "0"}
                className="borrowing-cost-input"
              />
            </div>
          </div>
        </section>

        {/* Section 3: Borrowing Cost Schedule */}
        <section className="entity-wizard-card logit-card borrowing-cost-card">
          <header style={{ marginBottom: "16px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#1c244b", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
              Borrowing Cost Schedule
            </h2>
            {schedule.length > 0 && (
              <p style={{ color: "#475467", fontSize: "14px", margin: 0 }}>
                Total Borrowing Cost of {formatMoney(totalBorrowingCost)} spread across {totalScheduleDays} days of the loan period.
              </p>
            )}
          </header>

          <div style={{ overflowX: "auto" }}>
            <table className="borrowing-cost-table">
              <thead>
                <tr>
                  <th>YEAR / PERIOD</th>
                  <th style={{ width: "200px" }}>NUMBER OF DAYS</th>
                  <th style={{ width: "220px", textAlign: "right" }}>BORROWING COST</th>
                  <th style={{ width: "220px", textAlign: "right" }}>CLOSING BALANCE</th>
                </tr>
              </thead>
              <tbody>
                {schedule.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: "32px 16px", textAlign: "center", color: "#667085", fontSize: "14px" }}>
                      Provide valid Loan Start Date and Loan End Date to display the borrowing cost schedule.
                    </td>
                  </tr>
                ) : (
                  schedule.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #f2f4f7" }}>
                      <td style={{ padding: "16px", fontSize: "14px", fontWeight: 600, color: "#344054" }}>
                        {p.label}
                      </td>
                      <td style={{ padding: "16px", fontSize: "14px", color: "#475467" }}>
                        {p.days}
                      </td>
                      <td style={{ padding: "16px", fontSize: "14px", fontWeight: 600, color: "#1d2939", textAlign: "right" }}>
                        {formatMoney(p.cost)}
                      </td>
                      <td style={{ padding: "16px", fontSize: "14px", fontWeight: 600, color: "#344054", textAlign: "right" }}>
                        {formatMoney(p.closingBalance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
