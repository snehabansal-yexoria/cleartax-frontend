"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useRef } from "react";

import { parseCsv } from "@/src/lib/csv";
import { getSession } from "@/src/lib/session";
import { formatCurrency, formatTransactionCurrency } from "@/src/lib/currency";
import type {
  CoreAssetClass,
  CorePropertyTransactionRow,
  CoreTransactionCategory,
  CoreTransactionDetail,
  CoreTransactionListItem,
  CoreTransactionSubcategory,
  CoreTransactionType,
} from "@/src/lib/coreApi";
import {
  DocumentDropZone,
  type ExtractedDocumentData,
  type ExtractedMeta,
} from "@/app/components/DocumentDropZone";
import { DocumentPreviewPanel } from "@/app/components/DocumentPreviewPanel";
import {
  announceDropdownOpen,
  dropdownRegistryEvent,
  isDropdownRegistryEvent,
} from "@/src/lib/dropdownRegistry";

interface SessionWithIdToken {
  getIdToken(): { getJwtToken(): string };
}

export type TransactionsContext =
  | { kind: "client"; clientId: string }
  | { kind: "entity"; entityId: string }
  | { kind: "property"; propertyId: string }
  | { kind: "none" };

type TransactionTableScope = "global" | "client" | "entity";

type DisplayTransactionRow = CoreTransactionListItem;
type TransactionModalMode = "view" | "edit";
type TransactionFeedbackTone = "success" | "warning";

type TransactionFilters = {
  client: string;
  entity: string;
  property: string;
  type: string;
  category: string;
};

type TransactionFilterOptions = {
  clients: SelectOption[];
  entities: SelectOption[];
  properties: SelectOption[];
  types: SelectOption[];
  categories: SelectOption[];
};

const defaultTransactionFilters: TransactionFilters = {
  client: "all",
  entity: "all",
  property: "all",
  type: "all",
  category: "all",
};

function appendUrlParam(href: string, key: string, value: string) {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}${key}=${encodeURIComponent(value)}`;
}

function isSafeInternalHref(value: string | null) {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//"));
}

function getLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatInvoiceDate(value: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type CoreTransactionRule = {
  id: number;
  orgId: string;
  entityId: string;
  propertyId: string | null;
  name: string;
  matchMode: string;
  conditions: { field: string; operator: string; value: unknown }[];
  assignedType: string;
  assignedCategoryId: number;
  assignedSubcategoryId: number;
  autoConfirm: boolean;
  isEnabled: boolean;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  clientName?: string;
};

type SelectOption = {
  label: string;
  value: string;
  type?: "revenue" | "expense" | string;
};

type StaticSelectProps = {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  error?: string;
  showSearch?: boolean;
};

function normalizeRule(raw: Record<string, unknown>): CoreTransactionRule {
  const conditions = Array.isArray(raw.conditions) ? raw.conditions : [];
  return {
    id: Number(raw.id ?? 0),
    orgId: String(raw.org_id ?? ""),
    entityId: String(raw.entity_id ?? ""),
    propertyId: raw.property_id != null ? String(raw.property_id) : null,
    name: String(raw.name ?? ""),
    matchMode: String(raw.match_mode ?? "all"),
    conditions: conditions.map((c: unknown) => {
      const cond = c as Record<string, unknown>;
      return { field: String(cond.field ?? ""), operator: String(cond.operator ?? ""), value: cond.value };
    }),
    assignedType: String(raw.assigned_type ?? ""),
    assignedCategoryId: Number(raw.assigned_category_id ?? 0),
    assignedSubcategoryId: Number(raw.assigned_subcategory_id ?? 0),
    autoConfirm: Boolean(raw.auto_confirm),
    isEnabled: Boolean(raw.is_enabled),
    metadata: (raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata))
      ? (raw.metadata as Record<string, unknown>)
      : {},
    createdBy: String(raw.created_by ?? ""),
    updatedBy: String(raw.updated_by ?? ""),
    createdAt: String(raw.created_at ?? ""),
    updatedAt: String(raw.updated_at ?? ""),
    clientName: raw.clientName != null ? String(raw.clientName) : (raw.client_name != null ? String(raw.client_name) : undefined),
  };
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 16V5" />
      <path d="m7 10 5-5 5 5" />
      <path d="M5 19h14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}


export function StaticSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
  required,
  className = "",
  disabled = false,
  error,
  showSearch = false,
}: StaticSelectProps) {
  const reactId = useId();
  const dropdownId = `transaction-select-${reactId}`;
  const [isOpen, setIsOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const selected = options.find((option) => option.value === value);
  const isAllOrEmpty = !value || value === "all";
  const searchPlaceholder = isAllOrEmpty
    ? (label ? `Search ${label.toLowerCase().replace(/\s*name\s*/g, "").trim()}...` : "Search...")
    : (selected?.label || placeholder || "Search...");

  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeIfAnotherOpened(event: Event) {
      if (
        isDropdownRegistryEvent(event) &&
        event.detail?.id &&
        event.detail.id !== dropdownId
      ) {
        setIsOpen(false);
        setLocalSearch("");
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

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setLocalSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const filteredOptions = showSearch
    ? options.filter(
      (option) =>
        option.label.toLowerCase().includes(localSearch.toLowerCase()) ||
        option.value === "all" ||
        option.value === "",
    )
    : options;

  return (
    <div className={`transaction-field ${className}`}>
      {label && (
        <span className="transaction-field-label">
          {label}
          {required && <em>*</em>}
        </span>
      )}
      <div
        ref={selectRef}
        className={`property-status-select transaction-select${isOpen ? " is-open" : ""
          }${disabled ? " is-disabled" : ""}`}
        onBlur={(event) => {
          // Only close when focus genuinely moves to an element outside this
          // select. A null relatedTarget (e.g. Safari/Firefox not focusing the
          // clicked option button) must NOT close the menu here, or the option's
          // click is lost before it registers — outside clicks are handled by the
          // document mousedown listener instead.
          if (
            event.relatedTarget &&
            !event.currentTarget.contains(event.relatedTarget)
          ) {
            setIsOpen(false);
            setLocalSearch("");
          }
        }}
      >
        {isOpen && showSearch && !disabled ? (
          <div
            className="property-status-trigger select-search-wrapper"
            style={{ padding: 0, overflow: "hidden", display: "flex", alignItems: "center" }}
          >
            <input
              type="text"
              className="select-search-input"
              value={localSearch}
              placeholder={searchPlaceholder}
              onChange={(e) => setLocalSearch(e.target.value)}
              autoFocus
              role="combobox"
              aria-expanded={true}
              aria-haspopup="listbox"
              aria-autocomplete="list"
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                outline: "none",
                background: "transparent",
                padding: "12px 16px",
                fontFamily: "inherit",
                fontSize: "14px",
                fontWeight: 600,
                color: "#101828",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                }
                if (e.key === "Escape") {
                  setIsOpen(false);
                  setLocalSearch("");
                }
              }}
            />
            <span style={{ paddingRight: "16px", display: "flex", alignItems: "center", pointerEvents: "none" }}>
              <ChevronIcon />
            </span>
          </div>
        ) : (
          <button
            type="button"
            className="property-status-trigger"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                if (isOpen) {
                  setIsOpen(false);
                  setLocalSearch("");
                } else {
                  setIsOpen(true);
                }
              }
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center" }}>
              {selected?.type && (
                <span
                  className="category-dot"
                  style={{
                    display: "inline-block",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    marginRight: "8px",
                    backgroundColor: selected.type === "revenue" ? "#12a150" : "#e11d48",
                    flexShrink: 0,
                  }}
                />
              )}
              {selected?.label || placeholder || "Select"}
            </span>
            <ChevronIcon />
          </button>
        )}
        {isOpen && !disabled && (
          <div className={`property-status-menu${showSearch ? " has-search" : ""}`} role="listbox">
            <div className={showSearch ? "dropdown-options-list" : ""}>
              {filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={value === option.value}
                  className={value === option.value ? "is-selected" : ""}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setLocalSearch("");
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center" }}>
                    {option.type && (
                      <span
                        className="category-dot"
                        style={{
                          display: "inline-block",
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          marginRight: "8px",
                          backgroundColor: option.type === "revenue" ? "#12a150" : "#e11d48",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    {option.label}
                  </span>
                  {value === option.value && (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 12l4 4 10-10" />
                    </svg>
                  )}
                </button>
              ))}
              {filteredOptions.length === 0 && (
                <div className="dropdown-no-results" style={{ padding: "12px 6px", color: "#667085", fontSize: "13px" }}>
                  No results found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {error && (
        <p className="transaction-split-row-error" style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4.5px" }}>
          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

function transactionDetailToRow(
  detail: CoreTransactionDetail,
  fallback?: DisplayTransactionRow | null,
): DisplayTransactionRow {
  const propertyIds = detail.splits.map((split) => split.propertyId).filter(Boolean);
  const propertyNames = detail.splits
    .map((split) => split.propertyName)
    .filter(Boolean);

  return {
    id: detail.id,
    type: detail.type,
    categoryId: detail.categoryId,
    categoryName: detail.categoryName,
    subcategoryId: detail.subcategoryId,
    subcategoryName: detail.subcategoryName,
    invoiceDate: detail.invoiceDate,
    grossAmount: detail.grossAmount,
    gstAmount: detail.gstAmount,
    netAmount: detail.netAmount,
    description: detail.description,
    internalRemarks: detail.internalRemarks,
    isAssetPurchase: detail.isAssetPurchase,
    assetClass: detail.assetClass,
    effectiveLifeYears: detail.effectiveLifeYears,
    ruleId: detail.ruleId,
    reviewStatus: detail.reviewStatus,
    clientId: fallback?.clientId || "",
    clientName: fallback?.clientName || "",
    entityId: detail.entityId,
    entityName: detail.entityName,
    propertyIds: propertyIds.length ? propertyIds : fallback?.propertyIds || [],
    propertyNames: propertyNames.length
      ? propertyNames
      : fallback?.propertyNames || [],
    clientShareGross: fallback?.clientShareGross ?? null,
    clientShareGst: fallback?.clientShareGst ?? null,
    clientShareNet: fallback?.clientShareNet ?? null,
    metadata: detail.metadata,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };
}

function propertyRowToDisplayRow(row: CorePropertyTransactionRow): DisplayTransactionRow {
  return {
    id: row.transactionId,
    type: row.transactionType,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    subcategoryId: row.subcategoryId,
    subcategoryName: row.subcategoryName,
    invoiceDate: row.invoiceDate,
    grossAmount: row.transactionGrossAmount,
    gstAmount: row.transactionGstAmount,
    netAmount: row.transactionNetAmount,
    description: row.description,
    internalRemarks: null,
    isAssetPurchase: row.isAssetPurchase,
    assetClass: null,
    effectiveLifeYears: null,
    ruleId: row.ruleId,
    reviewStatus: row.reviewStatus,
    clientId: "",
    clientName: "",
    entityId: "",
    entityName: "",
    propertyIds: [],
    propertyNames: [],
    clientShareGross: row.splitGrossAmount,
    clientShareGst: row.splitGstAmount,
    clientShareNet: row.splitNetAmount,
    metadata: {},
    createdAt: "",
    updatedAt: "",
  };
}

function DetailField({
  label,
  value,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="transaction-detail-field">
      <span>{label}</span>
      <strong>{children ?? value ?? "—"}</strong>
    </div>
  );
}

function TransactionDetailPopup({
  row,
  detail,
  mode,
  isLoading,
  error,
  isSaving,
  isDeleting,
  relatedRules,
  onClose,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  disabled = false,
  disabledReason,
}: {
  row: DisplayTransactionRow;
  detail: CoreTransactionDetail | null;
  mode: TransactionModalMode;
  isLoading: boolean;
  error: string;
  isSaving: boolean;
  isDeleting: boolean;
  relatedRules: CoreTransactionRule[];
  onClose: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (body: Record<string, unknown>) => Promise<void>;
  onDelete: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [description, setDescription] = useState(row.description || "");
  const [internalRemarks, setInternalRemarks] = useState(row.internalRemarks || "");
  const [reviewStatus, setReviewStatus] = useState(row.reviewStatus);
  const [isAssetPurchase, setIsAssetPurchase] = useState(row.isAssetPurchase);
  const [type, setType] = useState<CoreTransactionType>(row.type);
  const [categories, setCategories] = useState<CoreTransactionCategory[]>([]);
  const [subcategories, setSubcategories] = useState<CoreTransactionSubcategory[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(row.categoryId);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(row.subcategoryId);
  const [invoiceDate, setInvoiceDate] = useState(row.invoiceDate?.slice(0, 10) || "");
  const [invoiceDateTouched, setInvoiceDateTouched] = useState(false);
  const [grossAmount, setGrossAmount] = useState(String(row.grossAmount || ""));
  const [grossAmountTouched, setGrossAmountTouched] = useState(false);
  const [showGstBreakdown, setShowGstBreakdown] = useState(row.gstAmount > 0);
  const [gstAmount, setGstAmount] = useState(String(row.gstAmount || ""));
  const [modeOfTransaction, setModeOfTransaction] = useState(
    typeof row.metadata.mode_of_transaction === "string"
      ? row.metadata.mode_of_transaction
      : "",
  );
  const [assetItemName, setAssetItemName] = useState(
    typeof row.metadata.asset_item_name === "string"
      ? row.metadata.asset_item_name
      : "",
  );
  const [assetClass, setAssetClass] = useState<CoreAssetClass | "">(
    row.assetClass || "",
  );
  const [effectiveLifeYears, setEffectiveLifeYears] = useState(
    row.effectiveLifeYears == null ? "" : String(row.effectiveLifeYears),
  );
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [isSplit, setIsSplit] = useState(row.propertyIds.length > 1);
  const [editSplitRows, setEditSplitRows] = useState<SplitRowState[]>(() =>
    row.propertyIds.length
      ? row.propertyIds.map((propertyId) => ({
        id: makeSplitRowId(),
        propertyId,
        amount:
          row.propertyIds.length === 1
            ? String(row.grossAmount || "")
            : "",
      }))
      : [{ id: makeSplitRowId(), propertyId: "", amount: String(row.grossAmount || "") }],
  );
  const invoiceDateError = useMemo(() => {
    if (!invoiceDate) {
      return "Invoice date is required.";
    }
    const yearPart = invoiceDate.split("-")[0];
    if (yearPart && yearPart.length > 4) {
      return "Year cannot exceed 4 digits.";
    }
    const yearVal = parseInt(yearPart, 10);
    if (!isNaN(yearVal) && yearVal < 1900) {
      return "Year must be 1900 or later.";
    }
    const todayStr = getLocalDateString();
    if (invoiceDate > todayStr) {
      return "Invoice date cannot be in the future.";
    }
    return "";
  }, [invoiceDate]);

  const showDateError = !!invoiceDateError && (invoiceDateTouched || invoiceDateError !== "Invoice date is required.");

  const grossAmountError = useMemo(() => {
    if (!grossAmount) {
      return "Amount is required.";
    }
    const val = Number.parseFloat(grossAmount);
    if (Number.isNaN(val) || val <= 0) {
      return "Amount must be greater than 0.";
    }
    return "";
  }, [grossAmount]);

  const showGrossAmountError = !!grossAmountError && (grossAmountTouched || grossAmountError !== "Amount is required.");

  const [editError, setEditError] = useState("");
  const [isOpeningInvoice, setIsOpeningInvoice] = useState(false);
  const [pendingExitAction, setPendingExitAction] = useState<"cancel" | "close" | null>(null);

  const hasChanges = useMemo(() => {
    if (mode !== "edit") return false;
    const initial = detail ? transactionDetailToRow(detail, row) : row;

    if ((description || "") !== (initial.description || "")) return true;
    if ((internalRemarks || "") !== (initial.internalRemarks || "")) return true;
    if (reviewStatus !== initial.reviewStatus) return true;
    if (isAssetPurchase !== initial.isAssetPurchase) return true;
    if (type !== initial.type) return true;
    if (categoryId !== initial.categoryId) return true;
    if (subcategoryId !== initial.subcategoryId) return true;
    if (invoiceDate !== (initial.invoiceDate?.slice(0, 10) || "")) return true;
    if (grossAmount !== String(initial.grossAmount || "")) return true;
    if (gstAmount !== String(initial.gstAmount || "")) return true;

    const initialMode = typeof initial.metadata.mode_of_transaction === "string" ? initial.metadata.mode_of_transaction : "";
    if (modeOfTransaction !== initialMode) return true;

    const initialAssetName = typeof initial.metadata.asset_item_name === "string" ? initial.metadata.asset_item_name : "";
    if (assetItemName !== initialAssetName) return true;

    if ((assetClass || "") !== (initial.assetClass || "")) return true;

    const initialLife = initial.effectiveLifeYears == null ? "" : String(initial.effectiveLifeYears);
    if (effectiveLifeYears !== initialLife) return true;

    const initialSplits = detail?.splits || [];
    if (isSplit !== (initialSplits.length > 1)) return true;

    if (editSplitRows.length !== (initialSplits.length || 1)) return true;
    for (let i = 0; i < editSplitRows.length; i++) {
      const editRow = editSplitRows[i];
      if (initialSplits.length > 0) {
        const initSplit = initialSplits[i];
        if (editRow.propertyId !== initSplit.propertyId) return true;
        if (editRow.amount !== String(initSplit.splitGrossAmount || "")) return true;
      } else {
        const initPropId = initial.propertyIds[0] || "";
        if (editRow.propertyId !== initPropId) return true;
        if (editRow.amount !== String(initial.grossAmount || "")) return true;
      }
    }

    return false;
  }, [
    mode, detail, row, description, internalRemarks, reviewStatus, isAssetPurchase,
    type, categoryId, subcategoryId, invoiceDate, grossAmount, gstAmount,
    modeOfTransaction, assetItemName, assetClass, effectiveLifeYears, isSplit, editSplitRows
  ]);

  function handleAttemptExit(action: "cancel" | "close") {
    if (hasChanges) {
      setPendingExitAction(action);
    } else {
      if (action === "cancel") {
        onCancelEdit();
      } else {
        onClose();
      }
    }
  }

  useEffect(() => {
    const source = detail ? transactionDetailToRow(detail, row) : row;
    setDescription(source.description || "");
    setInternalRemarks(source.internalRemarks || "");
    setReviewStatus(source.reviewStatus);
    setIsAssetPurchase(source.isAssetPurchase);
    setType(source.type);
    setCategoryId(source.categoryId);
    setSubcategoryId(source.subcategoryId);
    setInvoiceDate(source.invoiceDate?.slice(0, 10) || "");
    setInvoiceDateTouched(false);
    setGrossAmount(String(source.grossAmount || ""));
    setShowGstBreakdown(source.gstAmount > 0);
    setGstAmount(String(source.gstAmount || ""));
    setModeOfTransaction(
      typeof source.metadata.mode_of_transaction === "string"
        ? source.metadata.mode_of_transaction
        : "",
    );
    setAssetItemName(
      typeof source.metadata.asset_item_name === "string"
        ? source.metadata.asset_item_name
        : "",
    );
    setAssetClass(source.assetClass || "");
    setEffectiveLifeYears(
      source.effectiveLifeYears == null ? "" : String(source.effectiveLifeYears),
    );
    if (detail?.splits.length) {
      setIsSplit(detail.splits.length > 1);
      setEditSplitRows(
        detail.splits.map((split) => ({
          id: String(split.id),
          propertyId: split.propertyId,
          amount: String(split.splitGrossAmount || ""),
        })),
      );
    } else {
      setIsSplit(source.propertyIds.length > 1);
      setEditSplitRows(
        source.propertyIds.length
          ? source.propertyIds.map((propertyId) => ({
            id: makeSplitRowId(),
            propertyId,
            amount:
              source.propertyIds.length === 1
                ? String(source.grossAmount || "")
                : "",
          }))
          : [
            {
              id: makeSplitRowId(),
              propertyId: "",
              amount: String(source.grossAmount || ""),
            },
          ],
      );
    }
    setEditError("");
  }, [detail, row]);

  async function handleOpenInvoice() {
    const docId = detail?.documentId || (display.metadata.document_id as string | undefined);
    if (!docId) {
      alert("No invoice document ID found.");
      return;
    }

    setIsOpeningInvoice(true);
    try {
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) {
        alert("You're signed out.");
        return;
      }
      const token = session.getIdToken().getJwtToken();
      const res = await fetch(`/api/documents/${encodeURIComponent(docId)}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to get download URL");
      const data = (await res.json()) as { download_url: string };
      window.open(data.download_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Failed to open invoice:", err);
      alert("Failed to open the attached invoice. Please try again.");
    } finally {
      setIsOpeningInvoice(false);
    }
  }

  const display = detail ? transactionDetailToRow(detail, row) : row;
  const isRevenue = display.type === "revenue";
  const splitRows =
    detail?.splits.map((split) => ({
      id: String(split.id),
      propertyId: split.propertyId,
      propertyName: split.propertyName,
      category: display.categoryName,
      subcategory: display.subcategoryName,
      amount: split.splitGrossAmount,
      percentage: split.splitPercentage,
    })) || [];
  const hasPropertySplit =
    new Set(splitRows.map((split) => split.propertyId).filter(Boolean)).size > 1;
  const purchasedAssetName =
    typeof display.metadata.asset_item_name === "string"
      ? display.metadata.asset_item_name
      : "";
  const invoiceName =
    detail?.documentFileName ||
    (typeof display.metadata.invoice_name === "string"
      ? display.metadata.invoice_name
      : "");
  const categorySelectOptions: SelectOption[] = [
    { label: "Select category", value: "" },
    ...categories.map((category) => ({
      label: category.name,
      value: String(category.id),
      type: type,
    })),
  ];
  const subcategorySelectOptions: SelectOption[] = [
    { label: "Select sub-category", value: "" },
    ...subcategories.map((subcategory) => ({
      label: subcategory.name,
      value: String(subcategory.id),
    })),
  ];
  const showSubcategorySelect =
    !!categoryId &&
    subcategories.some((s) => s.name.toLowerCase() !== "general");
  const propertySelectOptions: SelectOption[] = [
    { label: "Select property", value: "" },
    ...properties.map((property) => ({ label: pickerLabel(property), value: property.id })),
  ];

  useEffect(() => {
    if (type !== "expense" && isAssetPurchase) {
      setIsAssetPurchase(false);
    }
  }, [isAssetPurchase, type]);

  useEffect(() => {
    if (!isAssetPurchase) {
      setAssetItemName("");
      setAssetClass("");
      setEffectiveLifeYears("");
    } else if (!assetClass) {
      setAssetClass("capital_allowance");
    }
  }, [assetClass, isAssetPurchase]);

  useEffect(() => {
    if (!showGstBreakdown) setGstAmount("");
  }, [showGstBreakdown]);

  useEffect(() => {
    let cancelled = false;
    async function loadCategories() {
      const session = (await getSession()) as SessionWithIdToken | null;
      const token = session?.getIdToken().getJwtToken();
      if (!token || !type) {
        if (!cancelled) setCategories([]);
        return;
      }
      const res = await fetch(
        `/api/transactions/categories?type=${encodeURIComponent(type)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { items?: CoreTransactionCategory[] };
      if (!cancelled) setCategories(data.items || []);
    }
    loadCategories();
    return () => {
      cancelled = true;
    };
  }, [type]);

  useEffect(() => {
    setSubcategories([]);
    let cancelled = false;
    async function loadSubcategories() {
      const session = (await getSession()) as SessionWithIdToken | null;
      const token = session?.getIdToken().getJwtToken();
      if (!token || !categoryId) {
        if (!cancelled) setSubcategories([]);
        return;
      }
      const res = await fetch(
        `/api/transactions/categories/${categoryId}/sub-categories`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { items?: CoreTransactionSubcategory[] };
      if (!cancelled) {
        const loaded = data.items || [];
        setSubcategories(loaded);
        const actual = loaded.filter((s) => s.name.toLowerCase() !== "general");
        if (actual.length === 0 && loaded.length > 0) {
          setSubcategoryId(loaded[0].id);
        }
      }
    }
    loadSubcategories();
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  useEffect(() => {
    let cancelled = false;
    async function loadProperties() {
      const session = (await getSession()) as SessionWithIdToken | null;
      const token = session?.getIdToken().getJwtToken();
      if (!token || !display.entityId) {
        if (!cancelled) setProperties([]);
        return;
      }
      const res = await fetch(
        `/api/entities/${encodeURIComponent(display.entityId)}/properties`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { items?: PropertyOption[] };
      if (!cancelled) setProperties(data.items || []);
    }
    loadProperties();
    return () => {
      cancelled = true;
    };
  }, [display.entityId]);

  function updateEditSplitRow(id: string, patch: Partial<SplitRowState>) {
    setEditSplitRows((rows) =>
      rows.map((split) => (split.id === id ? { ...split, ...patch } : split)),
    );
  }

  function addEditSplitRow() {
    setEditSplitRows((rows) => [
      ...rows,
      { id: makeSplitRowId(), propertyId: "", amount: "" },
    ]);
  }

  function removeEditSplitRow(id: string) {
    setEditSplitRows((rows) =>
      rows.length <= 1 ? rows : rows.filter((split) => split.id !== id),
    );
  }

  async function handleSave() {
    const grossNum = Number.parseFloat(grossAmount);
    if (!type || !categoryId || !subcategoryId || !invoiceDate) {
      setInvoiceDateTouched(true);
      setEditError("Please complete type, category, sub-category, and date.");
      return;
    }
    if (invoiceDateError) {
      setInvoiceDateTouched(true);
      setEditError(invoiceDateError);
      return;
    }
    if (grossAmountError) {
      setGrossAmountTouched(true);
      setEditError(grossAmountError);
      return;
    }
    const allBlank = isSplit && editSplitRows.every((row) => !row.amount || !row.amount.trim());
    if (!allBlank) {
      if (Number.isNaN(grossNum) || grossNum <= 0) {
        setEditError("Amount must be a positive number.");
        return;
      }
    } else {
      if (!Number.isNaN(grossNum) && grossNum <= 0) {
        setEditError("Amount must be a positive number.");
        return;
      }
    }
    let gstNum: number | null = null;
    if (showGstBreakdown && gstAmount) {
      const parsed = Number.parseFloat(gstAmount);
      if (Number.isNaN(parsed) || parsed < 0) {
        setEditError("GST must be a non-negative number.");
        return;
      }
      gstNum = parsed;
    }
    const selectedSplits = isSplit
      ? editSplitRows
      : [editSplitRows[0] || { id: makeSplitRowId(), propertyId: "", amount: grossAmount }];
    const seenProperties = new Set<string>();
    for (const split of selectedSplits) {
      if (!split.propertyId) {
        setEditError("Please select a property for each split row.");
        return;
      }
      if (seenProperties.has(split.propertyId)) {
        setEditError("Each split row must use a different property.");
        return;
      }
      seenProperties.add(split.propertyId);
    }
    if (isSplit && seenProperties.size < 2) {
      setEditError("Split transactions must include more than one property.");
      return;
    }
    const splitTotal = selectedSplits.reduce(
      (sum, split) => sum + (Number.parseFloat(split.amount) || 0),
      0,
    );
    if (isSplit && !allBlank && Math.abs(splitTotal - grossNum) >= 0.01) {
      setEditError(`Split amounts must total ${grossNum.toFixed(2)}.`);
      return;
    }
    if (
      isAssetPurchase &&
      assetClass === "capital_allowance" &&
      (!effectiveLifeYears || Number.parseFloat(effectiveLifeYears) <= 0)
    ) {
      setEditError("Effective life must be a positive number.");
      return;
    }
    const splits = isSplit
      ? (allBlank
        ? selectedSplits.map((split) => ({ property_id: split.propertyId }))
        : selectedSplits.map((split) => {
          const amount = Number.parseFloat(split.amount);
          return {
            property_id: split.propertyId,
            split_percentage: Number(((amount / grossNum) * 100).toFixed(4)),
            split_gross_amount: Number(amount.toFixed(2)),
          };
        }))
      : [{ property_id: selectedSplits[0].propertyId, split_percentage: 100 }];
    const body: Record<string, unknown> = {
      type,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      invoice_date: invoiceDate,
      gross_amount: Number.isNaN(grossNum) ? null : grossNum,
      description: description.trim() || null,
      internal_remarks: internalRemarks.trim() || null,
      review_status: reviewStatus,
      is_asset_purchase: isAssetPurchase,
      metadata: {
        ...display.metadata,
        mode_of_transaction: modeOfTransaction || null,
      },
      splits,
    };
    body.gst_amount = gstNum ?? 0;
    if (isAssetPurchase) {
      body.asset_class = assetClass || null;
      if (assetItemName.trim()) {
        body.metadata = {
          ...(body.metadata as Record<string, unknown>),
          asset_item_name: assetItemName.trim(),
        };
      }
      if (assetClass === "capital_allowance") {
        body.effective_life_years = Number.parseFloat(effectiveLifeYears);
      }
    }
    setEditError("");
    await onSave(body);
  }

  return (
    <div className="transaction-modal-layer">
      <button
        type="button"
        className="transaction-modal-backdrop"
        aria-label="Close transaction details"
        onClick={() => handleAttemptExit("close")}
      />
      <section className="transaction-detail-modal" aria-label="Transaction Details">
        <header className="transaction-detail-header">
          <h2>Transaction Details</h2>
          <button type="button" aria-label="Close transaction details" onClick={() => handleAttemptExit("close")}>
            <CloseIcon />
          </button>
        </header>

        <div className="transaction-detail-body">
          {isLoading ? (
            <div className="transaction-detail-loading">
              <span className="skeleton-line skeleton-line-lg" />
              <span className="skeleton-line skeleton-line-md" />
              <span className="skeleton-line skeleton-line-xl" />
            </div>
          ) : null}
          {error ? (
            <div className="transaction-detail-error" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          ) : null}

          <DetailField label="Transaction ID">
            <a>{display.id.slice(0, 8).toUpperCase()}</a>
          </DetailField>

          <div className="transaction-detail-grid is-two">
            <DetailField label="Client Name" value={display.clientName || "—"} />
            <DetailField
              label="Property Name"
              value={display.propertyNames.join(", ") || "—"}
            />
          </div>

          <DetailField label="Entity Name" value={display.entityName || "—"} />

          {mode === "edit" ? (
            <div className="transaction-detail-edit">
              {editError ? (
                <div className="transaction-detail-error" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  <span>{editError}</span>
                </div>
              ) : null}
              <div className="transaction-type-control">
                <span className="transaction-field-label">Transaction Type<em>*</em></span>
                <div>
                  <button
                    type="button"
                    className={type === "expense" ? "is-selected" : ""}
                    onClick={() => {
                      setType("expense");
                      setCategoryId(null);
                      setSubcategoryId(null);
                    }}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    className={type === "revenue" ? "is-selected is-revenue" : ""}
                    onClick={() => {
                      setType("revenue");
                      setCategoryId(null);
                      setSubcategoryId(null);
                    }}
                  >
                    Revenue
                  </button>
                </div>
              </div>
              {type === "expense" ? (
                <div className="transaction-asset-card">
                  <label className="transaction-checkbox-row">
                    <input
                      type="checkbox"
                      checked={isAssetPurchase}
                      onChange={(event) => setIsAssetPurchase(event.target.checked)}
                    />
                    <span>Asset Purchase</span>
                  </label>
                  {isAssetPurchase ? (
                    <div className="transaction-asset-options">
                      <label className="transaction-field">
                        <span className="transaction-field-label">Purchased Asset</span>
                        <input
                          type="text"
                          value={assetItemName}
                          onChange={(event) => setAssetItemName(event.target.value)}
                        />
                      </label>
                      <label className="transaction-radio-card">
                        <input
                          type="radio"
                          checked={assetClass === "capital_allowance"}
                          onChange={() => setAssetClass("capital_allowance")}
                        />
                        <span>
                          <b>Capital Allowance</b>
                          <small>Depreciate assets over their effective life</small>
                        </span>
                      </label>
                      {assetClass === "capital_allowance" ? (
                        <label className="transaction-field">
                          <span className="transaction-field-label">
                            Effective life (years)<em>*</em>
                          </span>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.1"
                            min="0"
                            value={effectiveLifeYears}
                            onChange={(event) =>
                              setEffectiveLifeYears(event.target.value)
                            }
                          />
                        </label>
                      ) : null}
                      <label className="transaction-radio-card">
                        <input
                          type="radio"
                          checked={assetClass === "capital_works"}
                          onChange={() => setAssetClass("capital_works")}
                        />
                        <span>
                          <b>Capital Works</b>
                          <small>Fixed depreciation period for capital improvements</small>
                        </span>
                      </label>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="transaction-detail-grid is-two">
                <StaticSelect
                  label="Category"
                  required
                  value={categoryId == null ? "" : String(categoryId)}
                  options={categorySelectOptions}
                  onChange={(value) => {
                    setCategoryId(value ? Number(value) : null);
                    setSubcategoryId(null);
                  }}
                />
                {showSubcategorySelect && (
                  <div className="transaction-field-animate">
                    <StaticSelect
                      label="Sub-Category"
                      required
                      value={subcategoryId == null ? "" : String(subcategoryId)}
                      options={subcategorySelectOptions}
                      onChange={(value) =>
                        setSubcategoryId(value ? Number(value) : null)
                      }
                    />
                  </div>
                )}
                <label className={`transaction-field${showDateError ? " has-error" : ""}`}>
                  <span className="transaction-field-label">Invoice Date<em>*</em></span>
                  <input
                    type="date"
                    value={invoiceDate}
                    min="1900-01-01"
                    max="9999-12-31"
                    onChange={(event) => {
                      const val = event.target.value;
                      const yearPart = val.split("-")[0];
                      if (yearPart && yearPart.length > 4) {
                        return;
                      }
                      setInvoiceDate(val);
                      setInvoiceDateTouched(true);
                    }}
                    onBlur={() => setInvoiceDateTouched(true)}
                  />
                  {showDateError && (
                    <p className="transaction-field-error">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      {invoiceDateError}
                    </p>
                  )}
                </label>
                <label className={`transaction-field${showGrossAmountError ? " has-error" : ""}`}>
                  <span className="transaction-field-label">Amount<em>*</em></span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={grossAmount}
                    onKeyDown={(e) => {
                      if (e.key === "-" || e.key === "Minus") {
                        e.preventDefault();
                      }
                    }}
                    onChange={(event) => {
                      const val = event.target.value.replace(/-/g, "");
                      setGrossAmount(val);
                      setGrossAmountTouched(true);
                    }}
                    onBlur={() => setGrossAmountTouched(true)}
                  />
                  {showGrossAmountError && (
                    <p className="transaction-field-error">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      {grossAmountError}
                    </p>
                  )}
                </label>
              </div>
              <label className="transaction-checkbox-row">
                <input
                  type="checkbox"
                  checked={showGstBreakdown}
                  onChange={(event) => setShowGstBreakdown(event.target.checked)}
                />
                <span>Add GST Breakdown</span>
              </label>
              {showGstBreakdown ? (
                <label className="transaction-field">
                  <span className="transaction-field-label">GST Amount<em>*</em></span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={gstAmount}
                    onKeyDown={(e) => {
                      if (e.key === "-" || e.key === "Minus") {
                        e.preventDefault();
                      }
                    }}
                    onChange={(event) => {
                      const val = event.target.value.replace(/-/g, "");
                      setGstAmount(val);
                    }}
                  />
                </label>
              ) : null}
              <label className="transaction-checkbox-row">
                <input
                  type="checkbox"
                  checked={isSplit}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setIsSplit(checked);
                    if (checked && properties.length < 2) {
                      const msg = properties.length === 1
                        ? "Split transactions need at least two properties in this entity. This entity only has one property."
                        : "Add at least two properties to this entity before creating a split transaction.";
                      setEditError(msg);
                    } else {
                      if (editError && editError.toLowerCase().includes("split")) {
                        setEditError("");
                      }
                    }
                    if (!checked) {
                      setEditSplitRows((rows) => [
                        {
                          ...(rows[0] || { id: makeSplitRowId(), propertyId: "" }),
                          amount: grossAmount,
                        },
                      ]);
                    } else if (editSplitRows.length < 2) {
                      setEditSplitRows((rows) => [
                        rows[0] || {
                          id: makeSplitRowId(),
                          propertyId: "",
                          amount: "",
                        },
                        { id: makeSplitRowId(), propertyId: "", amount: "" },
                      ]);
                    }
                  }}
                />
                <span>Is this a split transaction?</span>
              </label>
              <div className="transaction-split-section">
                {editSplitRows.map((split, index) => (
                  <div key={split.id} className="transaction-split-row">
                    <StaticSelect
                      label={index === 0 ? "Property Name" : undefined}
                      required
                      value={split.propertyId}
                      options={propertySelectOptions}
                      onChange={(value) =>
                        updateEditSplitRow(split.id, { propertyId: value })
                      }
                    />
                    {isSplit ? (
                      <label className="transaction-field">
                        {index === 0 ? (
                          <span className="transaction-field-label">Amount<em>*</em></span>
                        ) : null}
                        <span className="transaction-money-input">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={split.amount}
                            onKeyDown={(e) => {
                              if (e.key === "-" || e.key === "Minus") {
                                e.preventDefault();
                              }
                            }}
                            onChange={(event) => {
                              const val = event.target.value.replace(/-/g, "");
                              updateEditSplitRow(split.id, {
                                amount: val,
                              });
                            }}
                          />
                          <b>$</b>
                        </span>
                      </label>
                    ) : null}
                    {isSplit ? (
                      <button
                        type="button"
                        className="transaction-split-remove"
                        aria-label="Remove split row"
                        disabled={editSplitRows.length <= 1}
                        onClick={() => removeEditSplitRow(split.id)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
                {isSplit ? (
                  <div className="transaction-split-footer">
                    <button
                      type="button"
                      className="transaction-split-add"
                      onClick={addEditSplitRow}
                      disabled={properties.length < 2}
                    >
                      + Add Property
                    </button>
                  </div>
                ) : null}
              </div>
              <StaticSelect
                label="Mode of Transaction"
                required
                value={modeOfTransaction}
                options={MODE_OF_TRANSACTION_OPTIONS}
                onChange={setModeOfTransaction}
              />
            </div>
          ) : (
            <>
              <div className={`transaction-detail-grid ${display.subcategoryName && display.subcategoryName.toLowerCase() !== "general" ? "is-three" : "is-two"}`}>
                <DetailField label="Type">
                  <span
                    className={`transaction-type-pill ${isRevenue ? "is-income" : "is-expense"
                      }`}
                  >
                    {isRevenue ? "Income" : "Expense"}
                  </span>
                </DetailField>
                <DetailField label="Category" value={display.categoryName} />
                {display.subcategoryName && display.subcategoryName.toLowerCase() !== "general" && (
                  <div className="transaction-field-animate">
                    <DetailField label="Subcategory" value={display.subcategoryName} />
                  </div>
                )}
              </div>

              <DetailField label="Date" value={formatInvoiceDate(display.invoiceDate)} />

              <div className="transaction-detail-grid is-three">
                <DetailField label="Gross Amount">
                  <span className={isRevenue ? "amount-positive" : "amount-negative"}>
                    {formatTransactionCurrency(display.grossAmount, isRevenue)}
                  </span>
                </DetailField>
                <DetailField label="GST" value={formatCurrency(display.gstAmount)} />
                <DetailField label="Net Amount">
                  <span className={isRevenue ? "amount-positive" : "amount-negative"}>
                    {formatTransactionCurrency(display.netAmount, isRevenue)}
                  </span>
                </DetailField>
              </div>

              <DetailField label="Rule Applied">
                <span className={`transaction-rule-pill ${display.ruleId != null ? "is-yes" : "is-no"}`}>
                  {display.ruleId != null ? "Yes" : "No"}
                </span>
              </DetailField>
            </>
          )}

          {mode === "edit" ? (
            <div className="transaction-detail-edit">
              <label className="transaction-field">
                <span className="transaction-field-label">Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <label className="transaction-field">
                <span className="transaction-field-label">Internal Remarks</span>
                <textarea
                  value={internalRemarks}
                  onChange={(event) => setInternalRemarks(event.target.value)}
                />
              </label>
              <StaticSelect
                label="Review Status"
                value={reviewStatus}
                options={[
                  { label: "Unreviewed", value: "unreviewed" },
                  { label: "Reviewed", value: "reviewed" },
                ]}
                onChange={(value) =>
                  setReviewStatus(value === "reviewed" ? "reviewed" : "unreviewed")
                }
              />
            </div>
          ) : (
            <>
              <DetailField label="Description" value={display.description || "—"} />
              <DetailField
                label="Internal Remarks"
                value={display.internalRemarks || "—"}
              />
              <DetailField label="Asset Purchase">
                <span className={`transaction-rule-pill ${display.isAssetPurchase ? "is-yes" : "is-no"}`}>
                  {display.isAssetPurchase ? "Yes" : "No"}
                </span>
              </DetailField>
              {display.isAssetPurchase && purchasedAssetName ? (
                <DetailField label="Purchased Asset" value={purchasedAssetName} />
              ) : null}
            </>
          )}

          {mode !== "edit" && hasPropertySplit ? (
            <section className="transaction-detail-splits">
              <h3>Split Transaction</h3>
              {splitRows.map((split) => (
                <div key={split.id} className="transaction-detail-split-card">
                  <DetailField label="Property" value={split.propertyName || "—"} />
                  <DetailField label="Category" value={split.category} />
                  {split.subcategory && split.subcategory.toLowerCase() !== "general" && (
                    <div className="transaction-field-animate">
                      <DetailField label="Subcategory" value={split.subcategory} />
                    </div>
                  )}
                  <DetailField
                    label={`Amount (${split.percentage.toFixed(0)}%)`}
                    value={formatCurrency(split.amount)}
                  />
                </div>
              ))}
            </section>
          ) : null}

          <DetailField label="Invoice Attached">
            <button
              type="button"
              className="transaction-invoice-chip"
              disabled={!invoiceName || isOpeningInvoice}
              onClick={handleOpenInvoice}
            >
              {isOpeningInvoice ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                  style={{ animation: "spin 0.9s linear infinite" }}
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 3h7l4 4v14H7z" />
                  <path d="M14 3v5h5" />
                </svg>
              )}
              {isOpeningInvoice ? "Opening Invoice…" : (invoiceName || "No invoice attached")}
            </button>
          </DetailField>

          {mode !== "edit" ? (
            <section className="transaction-detail-related-rules">
              <h3>Related Rules</h3>
              {relatedRules.length === 0 ? (
                <p>No rules configured for this entity.</p>
              ) : (
                relatedRules.map((rule) => {
                  const matched =
                    detail?.ruleId != null && rule.id === detail.ruleId;
                  const cat = categories.find(
                    (c) => c.id === rule.assignedCategoryId,
                  );
                  const sub = subcategories.find(
                    (s) => s.id === rule.assignedSubcategoryId,
                  );
                  return (
                    <div
                      key={rule.id}
                      className={`transaction-detail-rule-card${matched ? " is-matched" : ""
                        }`}
                    >
                      <div className="rule-card-head">
                        <strong>{rule.name}</strong>
                        {matched ? (
                          <span className="rule-matched-badge">Matched</span>
                        ) : null}
                      </div>
                      <DetailField label="Match Mode" value={rule.matchMode} />
                      <DetailField
                        label="Conditions"
                        value={String(rule.conditions.length)}
                      />
                      <DetailField
                        label="Assigned"
                        value={`${cat?.name ?? rule.assignedCategoryId} / ${sub?.name ?? rule.assignedSubcategoryId}`}
                      />
                      <DetailField
                        label="Enabled"
                        value={rule.isEnabled ? "Yes" : "No"}
                      />
                    </div>
                  );
                })
              )}
            </section>
          ) : null}
        </div>

        <footer className="transaction-detail-actions">
          {mode === "edit" ? (
            <>
              <button
                type="button"
                className="transaction-cancel-button"
                onClick={() => handleAttemptExit("cancel")}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="transaction-save-button"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? "Saving…" : "Save Changes"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="transaction-detail-edit-button"
                onClick={onEdit}
                disabled={disabled}
                title={disabled ? disabledReason : undefined}
                style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                </svg>
                Edit Transaction
              </button>
              <button
                type="button"
                className="transaction-detail-delete-button"
                onClick={onDelete}
                disabled={disabled || isDeleting}
                title={disabled ? disabledReason : undefined}
                style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14H6L5 6" />
                </svg>
                {isDeleting ? "Deleting…" : "Delete Transaction"}
              </button>
            </>
          )}
        </footer>
      </section>
      {pendingExitAction && (
        <ConfirmationDialog
          title="Discard Changes"
          message="You have unsaved changes. Are you sure you want to discard them and exit?"
          confirmLabel="Yes, Discard"
          cancelLabel="No, Keep Editing"
          onConfirm={() => {
            const action = pendingExitAction;
            setPendingExitAction(null);
            if (action === "cancel") {
              onCancelEdit();
            } else {
              onClose();
            }
          }}
          onCancel={() => setPendingExitAction(null)}
          isDanger={false}
        />
      )}
    </div>
  );
}

function TransactionTable({
  rows,
  scope,
  showClientShare = false,
  onView,
  onEdit,
  onDelete,
  disabled = false,
  disabledReason,
}: {
  rows: DisplayTransactionRow[];
  scope: TransactionTableScope;
  showClientShare?: boolean;
  onView: (row: DisplayTransactionRow) => void;
  onEdit: (row: DisplayTransactionRow) => void;
  onDelete: (row: DisplayTransactionRow) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const showClientName = scope === "global";
  const showEntityName = scope !== "entity";
  const [hoveredDescription, setHoveredDescription] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  return (
    <div className="transactions-table-container">
      <div className="transactions-table-wrap">
        <table className="transactions-table">
          <thead>
            <tr>
              <th>Transaction ID</th>
              {showClientName ? <th>Client Name</th> : null}
              {showEntityName ? <th>Entity</th> : null}
              <th>Properties</th>
              <th>Description</th>
              <th>Type</th>
              <th>Category</th>
              <th>Subcategory</th>
              <th>Date</th>
              <th>Gross</th>
              <th>GST</th>
              <th>Net</th>
              {showClientShare ? <th>Client Share</th> : null}
              <th>Rule</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isRevenue = row.type === "revenue";
              const propertyLabel =
                row.propertyNames.length === 0
                  ? "—"
                  : row.propertyNames.length === 1
                    ? row.propertyNames[0]
                    : `${row.propertyNames[0]} +${row.propertyNames.length - 1}`;
              return (
                <tr key={row.id}>
                  <td>
                    <button
                      type="button"
                      className="transaction-id-button"
                      onClick={() => onView(row)}
                    >
                      {row.id.slice(0, 8)}…
                    </button>
                  </td>
                  {showClientName ? <td>{row.clientName || "—"}</td> : null}
                  {showEntityName ? <td>{row.entityName || "—"}</td> : null}
                  <td title={row.propertyNames.join(", ")}>{propertyLabel}</td>
                  <td
                    style={{
                      maxWidth: '180px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      if (row.description) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredDescription({
                          text: row.description,
                          x: rect.left + rect.width / 2,
                          y: rect.top,
                        });
                      }
                    }}
                    onMouseLeave={() => setHoveredDescription(null)}
                  >
                    {row.description || "—"}
                  </td>
                  <td>
                    <span
                      className={`transaction-type-pill ${isRevenue ? "is-income" : "is-expense"
                        }`}
                    >
                      {isRevenue ? "Revenue" : "Expense"}
                    </span>
                  </td>
                  <td>{row.categoryName}</td>
                  <td>{row.subcategoryName}</td>
                  <td>{formatInvoiceDate(row.invoiceDate)}</td>
                  <td className={isRevenue ? "amount-positive" : "amount-negative"}>
                    {formatTransactionCurrency(row.grossAmount, isRevenue)}
                  </td>
                  <td>{formatCurrency(row.gstAmount)}</td>
                  <td className={isRevenue ? "amount-positive" : "amount-negative"}>
                    {formatTransactionCurrency(row.netAmount, isRevenue)}
                  </td>
                  {showClientShare ? (
                    <td>
                      {row.clientShareNet != null
                        ? formatCurrency(row.clientShareNet)
                        : "—"}
                    </td>
                  ) : null}
                  <td>
                    <span
                      className={`transaction-rule-pill ${row.ruleId != null ? "is-yes" : "is-no"
                        }`}
                    >
                      {row.ruleId != null ? "Yes" : "No"}
                    </span>
                  </td>
                  <td>
                    <div className="transaction-action-set">
                      <button
                        type="button"
                        aria-label={`Edit ${row.id}`}
                        disabled={disabled}
                        title={disabled ? disabledReason : undefined}
                        style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                        onClick={() => onEdit(row)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="is-danger"
                        aria-label={`Delete ${row.id}`}
                        disabled={disabled}
                        title={disabled ? disabledReason : undefined}
                        style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                        onClick={() => onDelete(row)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v5" />
                          <path d="M14 11v5" />
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
      {hoveredDescription && (
        <div
          style={{
            position: 'fixed',
            left: `${hoveredDescription.x}px`,
            top: `${hoveredDescription.y - 8}px`,
            transform: 'translate(-50%, -100%)',
            backgroundColor: '#ffffff',
            color: '#344054',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            maxWidth: '280px',
            zIndex: 99999,
            boxShadow: '0 10px 15px -3px rgba(16, 24, 40, 0.1), 0 4px 6px -2px rgba(16, 24, 40, 0.05)',
            pointerEvents: 'none',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            border: '1px solid #cbd5e1',
            lineHeight: '1.45',
            fontFamily: 'inherit',
          }}
        >
          <div style={{ color: '#475467' }}>
            {hoveredDescription.text}
          </div>
          {/* Arrow border */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%) translateY(-1px)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #cbd5e1',
            }}
          />
          {/* Arrow fill */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%) translateY(-2px)',
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid #ffffff',
            }}
          />
        </div>
      )}
    </div>
  );
}

function PropertyTransactionTable({
  rows,
  onView,
  onEdit,
  onDelete,
  disabled = false,
  disabledReason,
}: {
  rows: CorePropertyTransactionRow[];
  onView: (row: DisplayTransactionRow) => void;
  onEdit: (row: DisplayTransactionRow) => void;
  onDelete: (row: DisplayTransactionRow) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <div className="transactions-table-container">
      <div className="transactions-table-wrap">
        <table className="transactions-table">
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Type</th>
              <th>Category</th>
              <th>Subcategory</th>
              <th>Date</th>
              <th>Bill total</th>
              <th>Split %</th>
              <th>Property share</th>
              <th>GST</th>
              <th>Net</th>
              <th>Rule</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isRevenue = row.transactionType === "revenue";
              const displayRow = propertyRowToDisplayRow(row);
              return (
                <tr key={`${row.transactionId}-${row.splitId}`}>
                  <td>
                    <button
                      type="button"
                      className="transaction-id-button"
                      onClick={() => onView(displayRow)}
                    >
                      {row.transactionId.slice(0, 8)}…
                    </button>
                  </td>
                  <td>
                    <span
                      className={`transaction-type-pill ${isRevenue ? "is-income" : "is-expense"
                        }`}
                    >
                      {isRevenue ? "Revenue" : "Expense"}
                    </span>
                  </td>
                  <td>{row.categoryName}</td>
                  <td>{row.subcategoryName}</td>
                  <td>{formatInvoiceDate(row.invoiceDate)}</td>
                  <td>{formatCurrency(row.transactionGrossAmount)}</td>
                  <td>{row.splitPercentage.toFixed(2)}%</td>
                  <td className={isRevenue ? "amount-positive" : "amount-negative"}>
                    {formatTransactionCurrency(row.splitGrossAmount, isRevenue)}
                  </td>
                  <td>{formatCurrency(row.splitGstAmount)}</td>
                  <td className={isRevenue ? "amount-positive" : "amount-negative"}>
                    {formatTransactionCurrency(row.splitNetAmount, isRevenue)}
                  </td>
                  <td>
                    <span
                      className={`transaction-rule-pill ${row.ruleId != null ? "is-yes" : "is-no"
                        }`}
                    >
                      {row.ruleId != null ? "Yes" : "No"}
                    </span>
                  </td>
                  <td>
                    <div className="transaction-action-set">
                      <button
                        type="button"
                        aria-label={`Edit ${row.transactionId}`}
                        disabled={disabled}
                        title={disabled ? disabledReason : undefined}
                        style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                        onClick={() => onEdit(displayRow)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="is-danger"
                        aria-label={`Delete ${row.transactionId}`}
                        disabled={disabled}
                        title={disabled ? disabledReason : undefined}
                        style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                        onClick={() => onDelete(displayRow)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v5" />
                          <path d="M14 11v5" />
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
    </div>
  );
}

function Pagination({ copy }: { copy: string }) {
  return (
    <div className="transactions-pagination-row">
      <span>{copy}</span>
      <div className="transactions-pagination">
        <button type="button" disabled>
          Previous
        </button>
        <button type="button" className="is-current">
          1
        </button>
        <button type="button" disabled>
          Next
        </button>
      </div>
    </div>
  );
}

type SortOption = {
  label: string;
  value: string;
};

const SORT_OPTIONS: SortOption[] = [
  { label: "Date (Newest first)", value: "date-desc" },
  { label: "Date (Oldest first)", value: "date-asc" },
  { label: "Amount (High to Low)", value: "gross-desc" },
  { label: "Amount (Low to High)", value: "gross-asc" },
  { label: "Client Name (A-Z)", value: "client-asc" },
  { label: "Client Name (Z-A)", value: "client-desc" },
];

function Filters({
  context,
  filters,
  options,
  onChange,
  onReset,
  activeCount,
  sortBy,
  onChangeSort,
}: {
  context: TransactionsContext;
  filters: TransactionFilters;
  options: TransactionFilterOptions;
  onChange: <K extends keyof TransactionFilters>(
    key: K,
    value: TransactionFilters[K],
  ) => void;
  onReset: () => void;
  activeCount: number;
  sortBy: string;
  onChangeSort: (value: string) => void;
}) {
  const showClientFilter = context.kind === "none";
  const showEntityFilter = context.kind === "none" || context.kind === "client";
  const showPropertyFilter = context.kind !== "property";

  return (
    <section className="transaction-filter-card" aria-label="Transaction filters">
      <div className="transaction-filter-title">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V22h-4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.8 15a1.7 1.7 0 0 0-1.5-1H3v-4h.3a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V2h4v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1h.3v4h-.3a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
        <strong>Filters</strong>
        {activeCount > 0 ? (
          <button type="button" className="transaction-filter-reset" onClick={onReset}>
            Clear filters
          </button>
        ) : null}
      </div>
      <div className="transaction-filter-grid">
        {showClientFilter ? (
          <StaticSelect
            label="Client Name"
            value={filters.client}
            options={options.clients}
            onChange={(value) => onChange("client", value)}
            showSearch
          />
        ) : null}
        {showEntityFilter ? (
          <StaticSelect
            label="Entity Name"
            value={filters.entity}
            options={options.entities}
            onChange={(value) => onChange("entity", value)}
          />
        ) : null}
        {showPropertyFilter ? (
          <StaticSelect
            label="Property Name"
            value={filters.property}
            options={options.properties}
            onChange={(value) => onChange("property", value)}
          />
        ) : null}
        <StaticSelect
          label="Transaction Type"
          value={filters.type}
          options={options.types}
          onChange={(value) => onChange("type", value)}
        />
        <StaticSelect
          label="Category"
          value={filters.category}
          options={options.categories}
          onChange={(value) => onChange("category", value)}
        />
        <StaticSelect
          label="Sort By"
          value={sortBy}
          options={SORT_OPTIONS}
          onChange={onChangeSort}
        />
      </div>
    </section>
  );
}

function TransactionLoadingSkeleton({
  scope,
}: {
  scope: "transaction" | "property";
}) {
  const columns = scope === "property" ? 11 : 13;
  return (
    <div className="transaction-loading-stack" aria-label="Loading transactions">
      <div className="transactions-showing-copy">
        <span className="skeleton-line skeleton-line-md" />
      </div>
      <div className="transactions-table-wrap transaction-skeleton-table">
        {Array.from({ length: 5 }).map((_, rowIndex) => (
          <div key={rowIndex} className="transaction-skeleton-row">
            {Array.from({ length: columns }).map((__, columnIndex) => (
              <span
                key={columnIndex}
                className={
                  columnIndex === 0
                    ? "skeleton-line skeleton-line-md"
                    : columnIndex % 3 === 0
                      ? "skeleton-pill"
                      : "skeleton-line skeleton-line-sm"
                }
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function makeOptions(
  label: string,
  values: string[],
  fallbackPrefix = "Unknown",
): SelectOption[] {
  const unique = Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  return [
    { label, value: "all" },
    ...unique.map((value) => ({
      label: value || fallbackPrefix,
      value,
    })),
  ];
}

function makeNamedOptions(
  label: string,
  values: Array<{ id: string; name: string }>,
  fallbackPrefix = "Unknown",
): SelectOption[] {
  const byValue = new Map<string, string>();
  for (const item of values) {
    const id = item.id.trim();
    const name = item.name.trim();
    const value = id || name;
    if (!value) continue;
    byValue.set(value, name || id || fallbackPrefix);
  }

  return [
    { label, value: "all" },
    ...Array.from(byValue.entries())
      .map(([value, optionLabel]) => ({ label: optionLabel, value }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];
}

function makeCategoryOptions(
  label: string,
  rows: DisplayTransactionRow[],
  propertyRows: CorePropertyTransactionRow[],
  contextKind: string,
  fallbackPrefix = "Unknown",
): SelectOption[] {
  const categoryMap = new Map<string, string>();
  if (contextKind === "property") {
    for (const row of propertyRows) {
      const name = (row.categoryName || "").trim();
      if (name) {
        categoryMap.set(name, row.transactionType);
      }
    }
  } else {
    for (const row of rows) {
      const name = (row.categoryName || "").trim();
      if (name) {
        categoryMap.set(name, row.type);
      }
    }
  }

  const unique = Array.from(categoryMap.keys()).sort((a, b) =>
    a.localeCompare(b),
  );

  return [
    { label, value: "all" },
    ...unique.map((name) => ({
      label: name || fallbackPrefix,
      value: name,
      type: categoryMap.get(name) as "revenue" | "expense" | undefined,
    })),
  ];
}

function getRowClientFilterValue(row: CoreTransactionListItem) {
  return row.clientId || row.clientName;
}

function getRowEntityFilterValue(row: CoreTransactionListItem) {
  return row.entityId || row.entityName;
}

export function AllTransactionsView({
  context = { kind: "none" },
  addTransactionHref = "/dashboard/accountant/transactions/new",
  addTransactionDisabled = false,
  addTransactionDisabledReason,
  rulesHref = "/dashboard/accountant/transactions/rules",
  rulesButtonLabel = "Transaction Rules",
  rulesButtonClassName = "transaction-outline-button",
  rulesButtonIcon = "rules",
  compact = false,
  showRulesButton = true,
}: {
  context?: TransactionsContext;
  addTransactionHref?: string;
  addTransactionDisabled?: boolean;
  addTransactionDisabledReason?: string;
  rulesHref?: string;
  rulesButtonLabel?: string;
  rulesButtonClassName?: string;
  rulesButtonIcon?: "rules" | "reconcile";
  compact?: boolean;
  showRulesButton?: boolean;
}) {
  const pathname = usePathname();
  const [rows, setRows] = useState<DisplayTransactionRow[]>([]);
  const [propertyRows, setPropertyRows] = useState<CorePropertyTransactionRow[]>([]);
  const [filters, setFilters] = useState<TransactionFilters>(
    defaultTransactionFilters,
  );
  const [sortBy, setSortBy] = useState<string>("date-desc");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pageSize, setPageSize] = useState<string>("10");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageInputValue, setPageInputValue] = useState<string>("1");

  useEffect(() => {
    setPageInputValue(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, sortBy]);
  const [selectedTransaction, setSelectedTransaction] =
    useState<DisplayTransactionRow | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<CoreTransactionDetail | null>(
    null,
  );
  const [detailMode, setDetailMode] = useState<TransactionModalMode>("view");
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [isDetailSaving, setIsDetailSaving] = useState(false);
  const [isDetailDeleting, setIsDetailDeleting] = useState(false);
  const [relatedRules, setRelatedRules] = useState<CoreTransactionRule[]>([]);
  const [transactionToDelete, setTransactionToDelete] = useState<DisplayTransactionRow | null>(null);
  const contextKind = context.kind;
  const contextId =
    context.kind === "client"
      ? context.clientId
      : context.kind === "entity"
        ? context.entityId
        : context.kind === "property"
          ? context.propertyId
          : "";

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setErrorMessage("");

    async function load() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;
        if (!session) {
          if (!cancelled) setErrorMessage("You're signed out.");
          return;
        }
        const token = session.getIdToken().getJwtToken();

        if (contextKind === "none") {
          const res = await fetch("/api/transactions", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) {
            if (!cancelled) setErrorMessage("Failed to load transactions.");
            return;
          }
          const data = (await res.json()) as {
            items?: CoreTransactionListItem[];
          };
          if (!cancelled) {
            setRows(data.items || []);
            setPropertyRows([]);
          }
          return;
        }

        let url = "";
        switch (contextKind) {
          case "client":
            url = `/api/clients/${encodeURIComponent(contextId)}/transactions`;
            break;
          case "entity":
            url = `/api/entities/${encodeURIComponent(contextId)}/transactions`;
            break;
          case "property":
            url = `/api/properties/${encodeURIComponent(contextId)}/transactions`;
            break;
        }

        console.log(`[AllTransactionsView] Fetching ${contextKind} transactions from: ${url}`);
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log(`[AllTransactionsView] Response status: ${res.status}`);
        if (!res.ok) {
          console.error(`[AllTransactionsView] Failed to load transactions. Status: ${res.status}`);
          if (!cancelled) setErrorMessage("Failed to load transactions.");
          return;
        }
        const data = await res.json();
        console.log(`[AllTransactionsView] Fetched ${(data.items || []).length} items`);
        if (cancelled) return;
        if (contextKind === "property") {
          setPropertyRows((data.items as CorePropertyTransactionRow[]) || []);
          setRows([]);
        } else {
          setRows((data.items as DisplayTransactionRow[]) || []);
          setPropertyRows([]);
        }
      } catch (error) {
        console.error("Failed to load transactions:", error);
        if (!cancelled) {
          setErrorMessage("Unexpected error loading transactions.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [contextId, contextKind]);

  useEffect(() => {
    setFilters(defaultTransactionFilters);
    setCurrentPage(1);
    setPageSize("10");
  }, [contextId, contextKind]);

  const filterOptions = useMemo<TransactionFilterOptions>(() => {
    const clientValues = rows.map((row) => ({
      id: row.clientId,
      name: row.clientName,
    }));
    const entityValues = rows.map((row) => ({
      id: row.entityId,
      name: row.entityName,
    }));
    const propertyValues = rows.flatMap((row) =>
      row.propertyNames.map((name, index) => ({
        id: row.propertyIds[index] || name,
        name,
      })),
    );
    const transactionTypes =
      contextKind === "property"
        ? propertyRows.map((row) => row.transactionType)
        : rows.map((row) => row.type);
    const categories =
      contextKind === "property"
        ? propertyRows.map((row) => row.categoryName)
        : rows.map((row) => row.categoryName);

    return {
      clients: makeNamedOptions("All Clients", clientValues, "Unknown Client"),
      entities: makeNamedOptions("All Entities", entityValues, "Unknown Entity"),
      properties: makeNamedOptions(
        "All Properties",
        propertyValues,
        "Unknown Property",
      ),
      types: [
        { label: "All Types", value: "all" },
        ...(transactionTypes.includes("expense")
          ? [{ label: "Expense", value: "Expense" }]
          : []),
        ...(transactionTypes.includes("revenue")
          ? [{ label: "Income", value: "Revenue" }]
          : []),
      ],
      categories: makeCategoryOptions(
        "All Categories",
        rows,
        propertyRows,
        contextKind,
        "Uncategorized",
      ),
    };
  }, [contextKind, propertyRows, rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const rowClient = getRowClientFilterValue(row);
      const rowEntity = getRowEntityFilterValue(row);
      const rowType = row.type === "revenue" ? "Revenue" : "Expense";

      return (
        (filters.client === "all" || rowClient === filters.client) &&
        (filters.entity === "all" || rowEntity === filters.entity) &&
        (filters.property === "all" ||
          row.propertyIds.includes(filters.property) ||
          row.propertyNames.includes(filters.property)) &&
        (filters.type === "all" || rowType === filters.type) &&
        (filters.category === "all" || row.categoryName === filters.category)
      );
    });
  }, [filters, rows]);

  const filteredPropertyRows = useMemo(() => {
    return propertyRows.filter((row) => {
      const rowType = row.transactionType === "revenue" ? "Revenue" : "Expense";

      return (
        (filters.type === "all" || rowType === filters.type) &&
        (filters.category === "all" || row.categoryName === filters.category)
      );
    });
  }, [filters.category, filters.type, propertyRows]);

  const sortedRows = useMemo(() => {
    const items = [...filteredRows];
    switch (sortBy) {
      case "date-desc":
        return items.sort((a, b) => {
          const dateA = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0;
          const dateB = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0;
          return dateB - dateA;
        });
      case "date-asc":
        return items.sort((a, b) => {
          const dateA = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0;
          const dateB = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0;
          return dateA - dateB;
        });
      case "gross-desc":
        return items.sort((a, b) => {
          const valA = (a.type === "revenue" ? 1 : -1) * (a.grossAmount || 0);
          const valB = (b.type === "revenue" ? 1 : -1) * (b.grossAmount || 0);
          return valB - valA;
        });
      case "gross-asc":
        return items.sort((a, b) => {
          const valA = (a.type === "revenue" ? 1 : -1) * (a.grossAmount || 0);
          const valB = (b.type === "revenue" ? 1 : -1) * (b.grossAmount || 0);
          return valA - valB;
        });
      case "client-asc":
        return items.sort((a, b) => (a.clientName || "").localeCompare(b.clientName || ""));
      case "client-desc":
        return items.sort((a, b) => (b.clientName || "").localeCompare(a.clientName || ""));
      default:
        return items;
    }
  }, [filteredRows, sortBy]);

  const sortedPropertyRows = useMemo(() => {
    const items = [...filteredPropertyRows];
    switch (sortBy) {
      case "date-desc":
        return items.sort((a, b) => {
          const dateA = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0;
          const dateB = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0;
          return dateB - dateA;
        });
      case "date-asc":
        return items.sort((a, b) => {
          const dateA = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0;
          const dateB = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0;
          return dateA - dateB;
        });
      case "gross-desc":
        return items.sort((a, b) => {
          const valA = (a.transactionType === "revenue" ? 1 : -1) * (a.transactionGrossAmount || 0);
          const valB = (b.transactionType === "revenue" ? 1 : -1) * (b.transactionGrossAmount || 0);
          return valB - valA;
        });
      case "gross-asc":
        return items.sort((a, b) => {
          const valA = (a.transactionType === "revenue" ? 1 : -1) * (a.transactionGrossAmount || 0);
          const valB = (b.transactionType === "revenue" ? 1 : -1) * (b.transactionGrossAmount || 0);
          return valA - valB;
        });
      case "client-asc":
      case "client-desc":
      default:
        return items;
    }
  }, [filteredPropertyRows, sortBy]);

  function updateFilter<K extends keyof TransactionFilters>(
    key: K,
    value: TransactionFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function getAuthToken() {
    const session = (await getSession()) as SessionWithIdToken | null;
    return session?.getIdToken().getJwtToken() || "";
  }

  async function openTransactionDetail(
    row: DisplayTransactionRow,
    mode: TransactionModalMode = "view",
  ) {
    setSelectedTransaction(row);
    setSelectedDetail(null);
    setRelatedRules([]);
    setDetailMode(mode);
    setDetailError("");
    setIsDetailLoading(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setDetailError("You're signed out.");
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };
      const detailRes = await fetch(
        `/api/transactions/${encodeURIComponent(row.id)}`,
        { headers },
      );
      if (!detailRes.ok) {
        const data = (await detailRes.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;
        setDetailError(
          data?.message ||
          data?.error ||
          "Showing table data. Full details could not be loaded.",
        );
        return;
      }
      const detail = (await detailRes.json()) as CoreTransactionDetail;
      setSelectedDetail(detail);
      if (detail.entityId) {
        const rulesRes = await fetch(
          `/api/entities/${encodeURIComponent(detail.entityId)}/transaction-rules`,
          { headers },
        );
        if (rulesRes.ok) {
          const data = (await rulesRes.json()) as {
            items?: Record<string, unknown>[];
          };
          setRelatedRules((data.items ?? []).map(normalizeRule));
        }
      }
    } catch (error) {
      console.error("Failed to load transaction detail:", error);
      setDetailError("Showing table data. Full details could not be loaded.");
    } finally {
      setIsDetailLoading(false);
    }
  }

  function applyUpdatedTransaction(detail: CoreTransactionDetail) {
    setRows((current) =>
      current.map((item) =>
        item.id === detail.id ? transactionDetailToRow(detail, item) : item,
      ),
    );
    setPropertyRows((current) =>
      current.map((item) =>
        item.transactionId === detail.id
          ? {
            ...item,
            transactionType: detail.type,
            categoryId: detail.categoryId,
            categoryName: detail.categoryName,
            subcategoryId: detail.subcategoryId,
            subcategoryName: detail.subcategoryName,
            invoiceDate: detail.invoiceDate,
            description: detail.description,
            transactionGrossAmount: detail.grossAmount,
            transactionGstAmount: detail.gstAmount,
            transactionNetAmount: detail.netAmount,
            isAssetPurchase: detail.isAssetPurchase,
            ruleId: detail.ruleId,
            reviewStatus: detail.reviewStatus,
          }
          : item,
      ),
    );
  }

  async function saveTransactionDetail(body: Record<string, unknown>) {
    if (!selectedTransaction) return;
    setDetailError("");
    setIsDetailSaving(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setDetailError("You're signed out.");
        return;
      }
      const res = await fetch(
        `/api/transactions/${encodeURIComponent(selectedTransaction.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;
        setDetailError(data?.message || data?.error || "Update failed.");
        return;
      }
      const detail = (await res.json()) as CoreTransactionDetail;
      setSelectedDetail(detail);
      setSelectedTransaction((current) =>
        current ? transactionDetailToRow(detail, current) : current,
      );
      applyUpdatedTransaction(detail);
      setDetailMode("view");
    } catch (error) {
      console.error("Failed to update transaction:", error);
      setDetailError("Unexpected error updating transaction.");
    } finally {
      setIsDetailSaving(false);
    }
  }

  function deleteTransaction(row = selectedTransaction) {
    if (!row) return;
    setTransactionToDelete(row);
  }

  async function performDeleteTransaction(row: DisplayTransactionRow) {
    setDetailError("");
    setIsDetailDeleting(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setDetailError("You're signed out.");
        return;
      }
      const res = await fetch(`/api/transactions/${encodeURIComponent(row.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;
        setDetailError(
          data?.message ||
          data?.error ||
          "Delete failed. The backend may not support transaction deletion yet.",
        );
        return;
      }
      setRows((current) => current.filter((item) => item.id !== row.id));
      setPropertyRows((current) =>
        current.filter((item) => item.transactionId !== row.id),
      );
      setSelectedTransaction(null);
      setSelectedDetail(null);
    } catch (error) {
      console.error("Failed to delete transaction:", error);
      setDetailError("Unexpected error deleting transaction.");
    } finally {
      setIsDetailDeleting(false);
    }
  }

  const activeFilterCount = Object.values(filters).filter(
    (value) => value !== "all",
  ).length;
  const totalCount =
    contextKind === "property" ? filteredPropertyRows.length : filteredRows.length;
  const unfilteredCount =
    contextKind === "property" ? propertyRows.length : rows.length;

  const totalItems = totalCount;
  const numericPageSize = pageSize === "all" ? totalItems : Number(pageSize);
  const totalPages = Math.ceil(totalItems / numericPageSize) || 1;
  const activePage = Math.min(currentPage, totalPages);

  const displayedRows = useMemo(() => {
    const startIndex = (activePage - 1) * numericPageSize;
    const endIndex = startIndex + numericPageSize;
    return sortedRows.slice(startIndex, endIndex);
  }, [sortedRows, activePage, numericPageSize]);

  const displayedPropertyRows = useMemo(() => {
    const startIndex = (activePage - 1) * numericPageSize;
    const endIndex = startIndex + numericPageSize;
    return sortedPropertyRows.slice(startIndex, endIndex);
  }, [sortedPropertyRows, activePage, numericPageSize]);

  const showClientShare = contextKind === "client";
  const tableScope: TransactionTableScope =
    contextKind === "none"
      ? "global"
      : contextKind === "client"
        ? "client"
        : "entity";
  const returnToHref = appendUrlParam(pathname || "/dashboard/accountant/transactions", "tab", "transactions");
  const rulesTargetHref = appendUrlParam(
    contextKind === "entity" && contextId
      ? appendUrlParam(rulesHref, "entityId", contextId)
      : rulesHref,
    "returnTo",
    returnToHref,
  );
  const addTransactionTargetHref = appendUrlParam(
    addTransactionHref,
    "returnTo",
    returnToHref,
  );

  return (
    <section className={`transactions-page${compact ? " is-compact" : ""}`}>
      <div className="transactions-page-head">
        <div>
          <h1>All Transactions</h1>
          <p>View and manage all transactions across clients and properties</p>
        </div>
        <div className="transactions-head-actions">
          {showRulesButton && (
            <Link
              href={rulesTargetHref}
              className={rulesButtonClassName}
            >
              {rulesButtonIcon === "reconcile" ? (
                <svg width="20" height="19" viewBox="0 0 20 19" aria-hidden="true">
                  <path d="M12.8353 16.6232H17.7478C18.6193 16.6232 19.3324 15.9101 19.3324 15.0385V4.81741C19.3324 4.6114 19.2532 4.40539 19.1264 4.24692C19.1106 4.23108 19.0947 4.21523 19.0789 4.19938L15.1172 0.237701C15.1014 0.221854 15.0855 0.206007 15.0697 0.206007C14.9112 0.0792335 14.7052 0 14.4992 0H8.87371C8.00216 0 7.28906 0.713103 7.28906 1.58467C7.28906 1.75899 7.43168 1.90161 7.60599 1.90161C7.7803 1.90161 7.92292 1.75899 7.92292 1.58467C7.92292 1.06173 8.35078 0.633869 8.87371 0.633869H14.4992C14.5626 0.633869 14.626 0.665563 14.6735 0.697256C14.7211 0.744796 14.7369 0.808183 14.7369 0.87157V2.99503C14.7369 3.8666 15.45 4.57971 16.3216 4.57971H18.4609C18.5242 4.57971 18.5876 4.6114 18.6352 4.64309C18.6827 4.69063 18.6986 4.75402 18.6986 4.81741V15.0385C18.6986 15.5615 18.2707 15.9894 17.7478 15.9894H12.8353C12.661 15.9894 12.5184 16.132 12.5184 16.3063C12.5184 16.4806 12.8353 16.6232ZM15.3708 2.99503V1.37867L17.9379 3.94584H16.3216C15.7986 3.94584 15.3708 3.51797 15.3708 2.99503Z" />
                  <path d="M12.0434 17.0983V15.3552C12.0434 15.1808 11.9007 15.0382 11.7264 15.0382C11.5521 15.0382 11.4095 15.1808 11.4095 15.3552V17.0983C11.4095 17.7956 10.839 18.366 10.1418 18.366H1.58465C1.06172 18.366 0.633861 17.9382 0.633861 17.4152V7.19409C0.633861 7.13071 0.665554 7.06732 0.697246 7.01978C0.72894 6.97224 0.808172 6.95639 0.871558 6.95639H3.01084C3.8824 6.95639 4.59549 6.24329 4.59549 5.37172V3.23241C4.59549 3.16902 4.62718 3.10564 4.65887 3.0581C4.70641 3.01056 4.7698 2.99471 4.83319 2.99471H10.4587C10.9816 2.99471 11.4095 3.42257 11.4095 3.94551V6.79792C11.4095 6.97224 11.5521 7.11486 11.7264 7.11486C11.9007 7.11486 12.0434 6.97224 12.0434 6.79792V3.94551C12.0434 3.07394 11.3303 2.36084 10.4587 2.36084H4.83319C4.62718 2.36084 4.42118 2.44007 4.26271 2.56685C4.24687 2.58269 0.221851 6.60776 0.206005 6.62361C0.0792324 6.78208 0 6.98809 0 7.19409V17.4152C0 18.2868 0.713093 18.9999 1.58465 18.9999H10.1259C11.1876 18.9999 12.0434 18.1442 12.0434 17.0983ZM3.01084 6.32252H1.39449L3.96163 3.75535V5.37172C3.96163 5.89466 3.53377 6.32252 3.01084 6.32252Z" />
                  <path d="M12.9164 15.4979C12.9956 15.5296 13.0748 15.5455 13.154 15.5455C13.3125 15.5455 13.4868 15.4821 13.5978 15.3553L15.848 13.1051C16.1015 12.8515 16.1015 12.4554 15.848 12.2018L13.6136 9.96742C13.4393 9.7931 13.154 9.72972 12.9164 9.8248C12.6787 9.93572 12.5202 10.1576 12.5202 10.4111V10.7598H7.29084C7.11653 10.7598 6.97391 10.9024 6.97391 11.0767V11.7423L4.7237 9.49202L6.97391 7.24178V7.90734C6.97391 8.08166 7.11653 8.22428 7.29084 8.22428H12.8371C13.0114 8.22428 13.154 8.08166 13.154 7.90734C13.154 7.73303 13.0114 7.59041 12.8371 7.59041H7.60777V7.24178C7.60777 6.98823 7.4493 6.75053 7.21161 6.65545C6.97391 6.56037 6.70452 6.60791 6.51436 6.79807L4.28 9.04831C4.15323 9.17508 4.08984 9.33355 4.08984 9.49202C4.08984 9.65048 4.15323 9.8248 4.28 9.93572L6.53021 12.186C6.70452 12.3603 6.98976 12.4237 7.22745 12.3286C7.46515 12.2335 7.62362 11.9958 7.62362 11.7423V11.3936H12.853C13.0273 11.3936 13.1699 11.251 13.1699 11.0767V10.4111L15.4201 12.6614L13.154 14.9116V14.246C13.154 14.0717 13.0114 13.9291 12.8371 13.9291H7.29084C7.11653 13.9291 6.97391 14.0717 6.97391 14.246C6.97391 14.4203 7.11653 14.563 7.29084 14.563H12.5202V14.9116C12.5202 15.1651 12.6787 15.387 12.9164 15.4979Z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 4v16" />
                  <path d="M18 4v16" />
                  <path d="M4 8h4" />
                  <path d="M16 16h4" />
                  <path d="M10 12h4" />
                </svg>
              )}
              {rulesButtonLabel}
            </Link>
          )}
          {addTransactionDisabled ? (
            <button
              type="button"
              className="transaction-primary-button"
              disabled
              title={addTransactionDisabledReason || "Adding transactions is unavailable"}
              style={{ opacity: 0.5, cursor: "not-allowed" }}
            >
              <span>+</span>
              Add Transaction
            </button>
          ) : (
            <Link href={addTransactionTargetHref} className="transaction-primary-button">
              <span>+</span>
              Add Transaction
            </Link>
          )}
        </div>
      </div>

      <Filters
        context={context}
        filters={filters}
        options={filterOptions}
        onChange={updateFilter}
        onReset={() => setFilters(defaultTransactionFilters)}
        activeCount={activeFilterCount}
        sortBy={sortBy}
        onChangeSort={setSortBy}
      />

      {isLoading ? (
        <TransactionLoadingSkeleton
          scope={contextKind === "property" ? "property" : "transaction"}
        />
      ) : errorMessage ? (
        <div className="transactions-showing-copy">{errorMessage}</div>
      ) : totalCount === 0 ? (
        <div className="transactions-empty-state">
          <strong>
            {unfilteredCount === 0
              ? "No transactions yet."
              : "No transactions match these filters."}
          </strong>
          {unfilteredCount > 0 ? (
            <button
              type="button"
              className="transaction-filter-reset"
              onClick={() => setFilters(defaultTransactionFilters)}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="transactions-showing-copy">
            Showing <strong>{totalCount}</strong> of{" "}
            <strong>{unfilteredCount}</strong> transactions
          </div>
          {contextKind === "property" ? (
            <PropertyTransactionTable
              rows={displayedPropertyRows}
              onView={(row) => openTransactionDetail(row, "view")}
              onEdit={(row) => openTransactionDetail(row, "edit")}
              onDelete={(row) => deleteTransaction(row)}
              disabled={addTransactionDisabled}
              disabledReason={addTransactionDisabledReason}
            />
          ) : (
            <TransactionTable
              rows={displayedRows}
              scope={tableScope}
              showClientShare={showClientShare}
              onView={(row) => openTransactionDetail(row, "view")}
              onEdit={(row) => openTransactionDetail(row, "edit")}
              onDelete={(row) => deleteTransaction(row)}
              disabled={addTransactionDisabled}
              disabledReason={addTransactionDisabledReason}
            />
          )}
          {totalItems > 0 && (
            <footer className="premium-pagination-container">
              {/* Left Section: Items per page and page range details */}
              <div className="premium-pagination-left">
                <span className="premium-pagination-label">Items per page</span>
                <div className="premium-pagination-select-wrapper">
                  <select
                    className="premium-pagination-select"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="all">All</option>
                  </select>
                </div>
                <span className="premium-pagination-info">
                  {`${(activePage - 1) * numericPageSize + 1}–${Math.min(activePage * numericPageSize, totalItems)} of ${totalItems} items`}
                </span>
              </div>

              {/* Right Section: First, Previous, Page Input, Next, Last */}
              <div className="premium-pagination-right">
                {/* First Page */}
                <button
                  type="button"
                  className="premium-pagination-btn premium-pagination-icon-btn"
                  title="First Page"
                  onClick={() => setCurrentPage(1)}
                  disabled={activePage === 1}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}>
                    <line x1="5" y1="5" x2="5" y2="19" />
                    <polyline points="19 5 12 12 19 19" />
                  </svg>
                </button>

                {/* Previous Page */}
                <button
                  type="button"
                  className="premium-pagination-btn"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={activePage === 1}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}>
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  <span className="premium-pagination-btn-text">Previous</span>
                </button>

                {/* Page Selector Input Box */}
                <div className="premium-pagination-page-input-wrapper">
                  <input
                    type="number"
                    className="premium-pagination-page-input"
                    value={pageInputValue}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "") {
                        setPageInputValue("");
                        return;
                      }
                      if (/^[1-9]\d*$/.test(value)) {
                        const pageNum = Number(value);
                        if (pageNum <= totalPages) {
                          setPageInputValue(value);
                        }
                      }
                    }}
                    onBlur={() => {
                      const pageNum = Number(pageInputValue);
                      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                        setCurrentPage(pageNum);
                      } else {
                        setPageInputValue(String(activePage));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (["e", "E", "-", "+", "."].includes(e.key)) {
                        e.preventDefault();
                        return;
                      }
                      if (e.key === "Enter") {
                        const pageNum = Number(pageInputValue);
                        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                          setCurrentPage(pageNum);
                          e.currentTarget.blur();
                        } else {
                          setPageInputValue(String(activePage));
                          e.currentTarget.blur();
                        }
                      }
                    }}
                    onPaste={(e) => {
                      const pastedData = e.clipboardData.getData("text");
                      if (!/^[1-9]\d*$/.test(pastedData) || Number(pastedData) > totalPages) {
                        e.preventDefault();
                      }
                    }}
                    min={1}
                    max={totalPages}
                  />
                  <span className="premium-pagination-label">of {totalPages}</span>
                </div>

                {/* Next Page */}
                <button
                  type="button"
                  className="premium-pagination-btn"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={activePage === totalPages}
                >
                  <span className="premium-pagination-btn-text">Next</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>

                {/* Last Page */}
                <button
                  type="button"
                  className="premium-pagination-btn premium-pagination-icon-btn"
                  title="Last Page"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={activePage === totalPages}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}>
                    <line x1="19" y1="5" x2="19" y2="19" />
                    <polyline points="5 5 12 12 5 19" />
                  </svg>
                </button>
              </div>
            </footer>
          )}
        </>
      )}
      {selectedTransaction ? (
        <TransactionDetailPopup
          row={selectedTransaction}
          detail={selectedDetail}
          mode={detailMode}
          isLoading={isDetailLoading}
          error={detailError}
          isSaving={isDetailSaving}
          isDeleting={isDetailDeleting}
          relatedRules={relatedRules}
          onClose={() => {
            setSelectedTransaction(null);
            setSelectedDetail(null);
            setRelatedRules([]);
            setDetailError("");
          }}
          onEdit={() => setDetailMode("edit")}
          onCancelEdit={() => setDetailMode("view")}
          onSave={saveTransactionDetail}
          onDelete={() => deleteTransaction()}
          disabled={addTransactionDisabled}
          disabledReason={addTransactionDisabledReason}
        />
      ) : null}
      {transactionToDelete && (
        <ConfirmationDialog
          title="Delete Transaction"
          message="Are you sure you want to delete this transaction? This action is permanent and cannot be undone."
          confirmLabel="Yes, Delete"
          cancelLabel="No, Keep Transaction"
          onConfirm={() => {
            const row = transactionToDelete;
            setTransactionToDelete(null);
            performDeleteTransaction(row);
          }}
          onCancel={() => setTransactionToDelete(null)}
          isDanger={true}
        />
      )}
    </section>
  );
}

function BulkImportModal({
  entities,
  properties,
  defaultEntityId,
  defaultPropertyId,
  onEntityChange,
  onClose,
  onImport,
}: {
  entities: EntityOption[];
  properties: PropertyOption[];
  defaultEntityId: string;
  defaultPropertyId: string;
  onEntityChange: (id: string) => void;
  onClose: () => void;
  onImport: (params: {
    entityId: string;
    propertyId: string;
    rows: BulkImportRow[];
  }) => Promise<void>;
}) {
  const [entity, setEntity] = useState(defaultEntityId);
  const [property, setProperty] = useState(defaultPropertyId);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<BulkImportRow[]>([]);
  const [error, setError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const canImport = Boolean(entity && property && rows.length > 0 && !isImporting);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) {
      setError("We could not find any rows in that CSV.");
      setRows([]);
      setFileName("");
      return;
    }
    setRows(parsed);
    setFileName(file.name);
    setError("");
  }

  function downloadSampleCsv() {
    const template = [
      "type,category,subcategory,invoice_date,gross_amount,gst_amount,mode_of_transaction,description,internal_remarks,is_asset_purchase,asset_class,effective_life_years,split_properties,split_amounts,split_percentages",
      "expense,Repairs & Maintenance,Plumbing,2026-03-02,850,85,bank_transfer,Emergency plumbing repair,Approved by client,false,,,,,",
      "revenue,Rental Income,Monthly Rent,2026-03-05,3200,0,bank_transfer,March rental payment,,false,,,,,",
      "expense,Utilities,Electricity,2026-03-10,500,50,bank_transfer,Shared electricity bill,,false,,,Sunset Villa|Ocean View,300|200,",
    ].join("\n");
    const blob = new Blob([template], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "transactions-sample.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!canImport) return;
    setIsImporting(true);
    try {
      await onImport({ entityId: entity, propertyId: property, rows });
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="transaction-modal-layer">
      <button
        type="button"
        className="transaction-modal-backdrop"
        aria-label="Close bulk import"
        onClick={onClose}
      />
      <section className="transaction-modal transaction-bulk-modal">
        <header className="transaction-modal-header">
          <div>
            <h2>Bulk Import from CSV</h2>
            <p>Upload multiple transactions at once</p>
          </div>
          <button type="button" aria-label="Close bulk import" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>

        <div className="transaction-modal-body">
          <h3>Entity & Property</h3>
          <div className="transaction-two-grid">
            <StaticSelect
              label="Entity Name"
              required
              value={entity}
              options={[
                { label: "Select Entity", value: "" },
                ...entities.map((item) => ({ label: pickerLabel(item), value: item.id })),
              ]}
              onChange={(value) => {
                setEntity(value);
                setProperty("");
                onEntityChange(value);
              }}
            />
            <StaticSelect
              label="Property Name"
              required
              value={property}
              options={[
                { label: "Select Property", value: "" },
                ...properties.map((item) => ({ label: pickerLabel(item), value: item.id })),
              ]}
              onChange={setProperty}
            />
          </div>

          <div className="csv-template-card">
            <div>
              <strong>Download Sample CSV Template</strong>
              <span>Use this template to format your transaction data</span>
            </div>
            <button type="button" onClick={downloadSampleCsv}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
              Download
            </button>
          </div>

          <div>
            <span className="transaction-field-label">
              Upload CSV File<em>*</em>
            </span>
            <label className={`csv-dropzone${fileName ? " has-file" : ""}`}>
              <span className="csv-dropzone-icon">
                <UploadIcon />
              </span>
              <strong>{fileName || "Drop CSV file here or click to browse"}</strong>
              <small>Only .csv files are supported</small>
              <input type="file" accept=".csv,text/csv" onChange={handleFileChange} />
            </label>
            {rows.length > 0 ? (
              <span className="csv-import-count">
                {rows.length} row{rows.length === 1 ? "" : "s"} ready to import
              </span>
            ) : null}
            {error ? (
              <div className="transaction-detail-error" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            ) : null}
          </div>
        </div>

        <footer className="transaction-modal-footer">
          <button type="button" className="transaction-cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="transaction-save-button"
            disabled={!canImport}
            onClick={handleImport}
          >
            {isImporting ? "Importing…" : "Import Transactions"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function EditPencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

type ClientOption = { id: string; name: string };
type EntityOption = { id: string; name: string; createdFor?: string; enabled?: boolean };
type PropertyOption = { id: string; name: string; enabled?: boolean };

// Disabled entities/properties stay visible in pickers (so editors understand
// why a record can't be used) but are labelled; the backend rejects writes on
// them with a 409 either way.
function pickerLabel(item: { name: string; enabled?: boolean }) {
  return item.enabled === false ? `${item.name} (inactive)` : item.name;
}

const MODE_OF_TRANSACTION_OPTIONS: SelectOption[] = [
  { label: "Select mode of transaction", value: "" },
  { label: "Cash", value: "cash" },
  { label: "Bank Transfer", value: "bank_transfer" },
  { label: "Credit Card", value: "credit_card" },
  { label: "Cheque", value: "cheque" },
  { label: "Direct Debit", value: "direct_debit" },
  { label: "Other", value: "other" },
];

let splitRowCounter = 0;
function makeSplitRowId() {
  splitRowCounter += 1;
  return `split-${splitRowCounter}`;
}

type SplitRowState = { id: string; propertyId: string; amount: string };
type BulkImportRow = Record<string, string>;

function parseMoneyValue(value: string) {
  const cleaned = String(value || "").replace(/[$,\s]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBooleanValue(value: string) {
  return ["true", "yes", "y", "1"].includes(String(value || "").trim().toLowerCase());
}

function normalizeCsvLookup(value: string) {
  return String(value || "").trim().toLowerCase();
}

function normalizeCsvLooseLookup(value: string) {
  return normalizeCsvLookup(value)
    .replace(/&/g, "and")
    .replace(/\band\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function getCsvLookupTokens(value: string) {
  return normalizeCsvLookup(value)
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token && token !== "and")
    .map((token) => token.replace(/s$/, ""));
}

function namesMatchCsvLookup(candidate: string, expected: string) {
  const candidateExact = normalizeCsvLookup(candidate);
  const expectedExact = normalizeCsvLookup(expected);
  const candidateLoose = normalizeCsvLooseLookup(candidate);
  const expectedLoose = normalizeCsvLooseLookup(expected);
  const candidateSingularLoose = candidateLoose.replace(/s/g, "");
  const expectedSingularLoose = expectedLoose.replace(/s/g, "");
  const candidateTokens = getCsvLookupTokens(candidate);
  const expectedTokens = getCsvLookupTokens(expected);
  const expectedTokensMatch =
    expectedTokens.length > 0 &&
    expectedTokens.every((token) => candidateTokens.includes(token));
  const candidateTokensMatch =
    candidateTokens.length > 0 &&
    candidateTokens.every((token) => expectedTokens.includes(token));

  return (
    candidateExact === expectedExact ||
    candidateLoose === expectedLoose ||
    candidateSingularLoose === expectedSingularLoose ||
    expectedTokensMatch ||
    candidateTokensMatch ||
    (!!expectedLoose &&
      (candidateLoose.includes(expectedLoose) ||
        expectedLoose.includes(candidateLoose)))
  );
}

function parseDelimitedCsvValue(value: string) {
  return String(value || "")
    .split(/[|;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolvePropertyLookup(value: string, options: PropertyOption[]) {
  const normalized = normalizeCsvLookup(value);
  if (!normalized) return "";
  return (
    options.find(
      (property) =>
        normalizeCsvLookup(property.id) === normalized ||
        normalizeCsvLookup(property.name) === normalized,
    )?.id || ""
  );
}

function TransactionFeedbackModal({
  tone,
  title,
  message,
  onClose,
}: {
  tone: TransactionFeedbackTone;
  title: string;
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="transaction-feedback-layer" role="dialog" aria-modal="true">
      <button
        type="button"
        className="transaction-feedback-backdrop"
        aria-label="Close message"
        onClick={onClose}
      />
      <section className={`transaction-feedback-card is-${tone}`}>
        <div className="transaction-feedback-icon" aria-hidden="true">
          {tone === "success" ? (
            <svg viewBox="0 0 24 24">
              <path d="M5 12l4 4 10-10" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24">
              <path d="M12 8v5" />
              <path d="M12 17h.01" />
              <path d="M10.3 4.3 2.8 17.2A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.8L13.7 4.3a2 2 0 0 0-3.4 0z" />
            </svg>
          )}
        </div>
        <h1>{title}</h1>
        <p>{message}</p>
        <button type="button" className="transaction-primary-button" onClick={onClose}>
          Continue
        </button>
      </section>
    </div>
  );
}

function EntityPropertyHeaderCard({
  entities,
  properties,
  activeEntityId,
  activePropertyId,
  isEditingEntity,
  isEditingProperty,
  isPropertyRequired,
  isEntityLockable,
  isPropertyLockable,
  onSelectEntity,
  onSelectProperty,
  onEditEntity,
  onEditProperty,
  disabled = false,
}: {
  entities: EntityOption[];
  properties: PropertyOption[];
  activeEntityId: string;
  activePropertyId: string;
  isEditingEntity: boolean;
  isEditingProperty: boolean;
  isPropertyRequired: boolean;
  isEntityLockable: boolean;
  isPropertyLockable: boolean;
  onSelectEntity: (id: string) => void;
  onSelectProperty: (id: string) => void;
  onEditEntity: () => void;
  onEditProperty: () => void;
  disabled?: boolean;
}) {
  const entityName =
    entities.find((e) => e.id === activeEntityId)?.name || "Not selected";
  const propertyName =
    properties.find((p) => p.id === activePropertyId)?.name || "Not selected";

  return (
    <section className="transaction-entity-header">
      <div className="transaction-entity-row">
        <div className="transaction-entity-col">
          {isEditingEntity ? (
            <StaticSelect
              label="Entity Name"
              required
              value={activeEntityId}
              options={[
                { label: "Select Entity", value: "" },
                ...entities.map((e) => ({ label: pickerLabel(e), value: e.id })),
              ]}
              onChange={onSelectEntity}
              disabled={disabled}
            />
          ) : (
            <span>
              <small>Entity Name</small>
              <b>{entityName}</b>
            </span>
          )}
        </div>
        {!isEditingEntity && isEntityLockable && (
          <button type="button" className="transaction-entity-edit-btn" aria-label="Edit entity" onClick={onEditEntity} disabled={disabled}>
            <EditPencilIcon />
          </button>
        )}
      </div>

      <div className="transaction-entity-row">
        <div className="transaction-entity-col">
          {isEditingProperty ? (
            <StaticSelect
              label="Property Name"
              required={isPropertyRequired}
              value={activePropertyId}
              options={[
                { label: "Select Property", value: "" },
                ...properties.map((p) => ({ label: pickerLabel(p), value: p.id })),
              ]}
              onChange={onSelectProperty}
              disabled={disabled}
            />
          ) : (
            <span>
              <small>Property Name</small>
              <b>{propertyName}</b>
            </span>
          )}
        </div>
        {!isEditingProperty && isPropertyLockable && (
          <button
            type="button"
            className="transaction-entity-edit-btn"
            aria-label="Edit property"
            onClick={onEditProperty}
            disabled={disabled}
          >
            <EditPencilIcon />
          </button>
        )}
      </div>
    </section>
  );
}

export function AddTransactionView({
  clientId,
  entityId,
  requireClientSelection = false,
  backHref = "/dashboard/accountant/transactions",
  backLabel = "Back",
}: {
  clientId?: string;
  entityId?: string;
  requireClientSelection?: boolean;
  backHref?: string;
  backLabel?: string;
}) {
  const router = useRouter();
  const [effectiveBackHref, setEffectiveBackHref] = useState(backHref);

  const [token, setToken] = useState<string | null>(null);
  const [tokenLoaded, setTokenLoaded] = useState(false);

  const [type, setType] = useState<CoreTransactionType | "">("");
  const [categories, setCategories] = useState<CoreTransactionCategory[]>([]);
  const [subcategories, setSubcategories] = useState<CoreTransactionSubcategory[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);

  // When a document extraction matches a rule, the rule's category/subcategory
  // are stashed here so the async category→subcategory load effects can apply
  // them once their option lists arrive (instead of resetting to the default).
  const pendingRuleRef = useRef<{ categoryId: number; subcategoryId: number } | null>(null);

  // The id of the rule that matched the current extraction, stamped onto the
  // transaction at create time so the listing shows which rule was applied.
  // Lives from extraction → submit; cleared when the extraction is discarded.
  const appliedRuleIdRef = useRef<number | null>(null);

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [activeClientId, setActiveClientId] = useState<string>(clientId ?? "");
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [entitiesLoaded, setEntitiesLoaded] = useState(false);
  const [activeEntityId, setActiveEntityId] = useState<string>(entityId ?? "");
  const [isEditingEntity, setIsEditingEntity] = useState<boolean>(!entityId);

  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [propertiesLoaded, setPropertiesLoaded] = useState(false);
  const [defaultPropertyId, setDefaultPropertyId] = useState("");
  const [propertyId, setPropertyId] = useState<string>("");
  const [isEditingProperty, setIsEditingProperty] = useState<boolean>(true);

  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceDateTouched, setInvoiceDateTouched] = useState(false);
  const [grossAmount, setGrossAmount] = useState("");
  const [grossAmountTouched, setGrossAmountTouched] = useState(false);

  const [showGstBreakdown, setShowGstBreakdown] = useState(false);
  const [gstAmount, setGstAmount] = useState("");

  const [isSplit, setIsSplit] = useState(false);
  const [splitRows, setSplitRows] = useState<SplitRowState[]>(() => [
    { id: makeSplitRowId(), propertyId: "", amount: "" },
  ]);

  const [modeOfTransaction, setModeOfTransaction] = useState<string>("bank_transfer");

  const [description, setDescription] = useState("");
  const [internalRemarks, setInternalRemarks] = useState("");

  const [isAssetPurchase, setIsAssetPurchase] = useState(false);
  const [assetItemName, setAssetItemName] = useState("");
  const [assetClass, setAssetClass] = useState<CoreAssetClass | "">("");
  const [effectiveLifeYears, setEffectiveLifeYears] = useState("");

  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isMarked, setIsMarked] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: TransactionFeedbackTone;
    title: string;
    message: string;
  } | null>(null);
  const [prefilled, setPrefilled] = useState<Set<string>>(new Set());
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);

  // Resolve the bearer token once on mount.
  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;
        if (cancelled) return;
        setToken(session ? session.getIdToken().getJwtToken() : null);
      } finally {
        if (!cancelled) setTokenLoaded(true);
      }
    }
    resolve();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const returnToParam = new URLSearchParams(window.location.search).get("returnTo");
    setEffectiveBackHref(
      isSafeInternalHref(returnToParam) ? returnToParam || backHref : backHref,
    );

    const propertyIdParam = new URLSearchParams(window.location.search).get(
      "propertyId",
    );
    if (propertyIdParam) {
      setDefaultPropertyId(propertyIdParam);
      setPropertyId(propertyIdParam);
      setIsEditingProperty(false);
    }
  }, [backHref]);

  useEffect(() => {
    setActiveClientId(clientId ?? "");
  }, [clientId]);

  useEffect(() => {
    setActiveEntityId(entityId ?? "");
    setIsEditingEntity(!entityId);
  }, [entityId]);

  useEffect(() => {
    if (!token || !requireClientSelection) return;
    let cancelled = false;
    async function loadClients() {
      const res = await fetch("/api/users/me/clients?scope=mine", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { clients?: ClientOption[] };
      if (!cancelled) setClients(data.clients || []);
    }
    loadClients();
    return () => {
      cancelled = true;
    };
  }, [requireClientSelection, token]);

  // Load entities for the picker (and to look up the locked entity name).
  useEffect(() => {
    if (!token) return;
    if (requireClientSelection && !activeClientId) {
      setEntities([]);
      setEntitiesLoaded(true);
      setActiveEntityId("");
      setIsEditingEntity(true);
      return;
    }
    let cancelled = false;
    async function loadEntities() {
      setEntitiesLoaded(false);
      try {
        const query = activeClientId
          ? `?client_id=${encodeURIComponent(activeClientId)}`
          : "";
        const res = await fetch(`/api/entities${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { items?: EntityOption[] };
        if (!cancelled) {
          const loadedEntities = data.items || [];
          setEntities(loadedEntities);
          if (
            activeEntityId &&
            !loadedEntities.some((entity) => entity.id === activeEntityId)
          ) {
            setActiveEntityId("");
            setIsEditingEntity(true);
          }
        }
      } finally {
        if (!cancelled) {
          setEntitiesLoaded(true);
        }
      }
    }
    loadEntities();
    return () => {
      cancelled = true;
    };
  }, [activeClientId, activeEntityId, requireClientSelection, token]);

  // Load properties whenever the active entity changes.
  useEffect(() => {
    setPropertiesLoaded(false);
    if (!token || !activeEntityId) {
      setProperties([]);
      setPropertyId("");
      setIsSplit(false);
      setSplitRows([{ id: makeSplitRowId(), propertyId: "", amount: "" }]);
      return;
    }
    let cancelled = false;
    async function loadProperties() {
      const res = await fetch(
        `/api/entities/${encodeURIComponent(activeEntityId)}/properties`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { items?: PropertyOption[] };
      if (!cancelled) {
        const loadedProperties = data.items || [];
        setProperties(loadedProperties);
        setPropertiesLoaded(true);
        const hasDefaultProperty =
          !!defaultPropertyId &&
          loadedProperties.some((property) => property.id === defaultPropertyId);
        setPropertyId(hasDefaultProperty ? defaultPropertyId : "");
        setIsEditingProperty(!hasDefaultProperty);
        setSplitRows([{ id: makeSplitRowId(), propertyId: "", amount: "" }]);
        if (loadedProperties.length < 2) {
          setIsSplit(false);
        }
      }
    }
    loadProperties();
    return () => {
      cancelled = true;
    };
  }, [token, activeEntityId, defaultPropertyId]);

  // Load categories whenever the type changes.
  useEffect(() => {
    if (!token || !type) {
      setCategories([]);
      setCategoryId(null);
      return;
    }
    let cancelled = false;
    async function loadCategories() {
      const res = await fetch(
        `/api/transactions/categories?type=${encodeURIComponent(type)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { items?: CoreTransactionCategory[] };
      if (!cancelled) {
        const items = data.items || [];
        setCategories(items);
        // If a matched rule is pending and its category exists for this type,
        // select it (the subcategory effect will then apply the rule's subcat).
        const pending = pendingRuleRef.current;
        if (pending && items.some((c) => c.id === pending.categoryId)) {
          setCategoryId(pending.categoryId);
        } else {
          setCategoryId(null);
          setSubcategoryId(null);
        }
      }
    }
    loadCategories();
    return () => {
      cancelled = true;
    };
  }, [token, type]);

  // Load subcategories whenever the category changes.
  useEffect(() => {
    setSubcategories([]);
    if (!token || !categoryId) {
      setSubcategoryId(null);
      return;
    }
    let cancelled = false;
    async function loadSubcategories() {
      const res = await fetch(
        `/api/transactions/categories/${categoryId}/sub-categories`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { items?: CoreTransactionSubcategory[] };
      if (!cancelled) {
        const loaded = data.items || [];
        setSubcategories(loaded);
        // A matched rule takes precedence: select its subcategory if present,
        // then clear the pending rule so manual edits behave normally.
        const pending = pendingRuleRef.current;
        if (pending && pending.categoryId === categoryId) {
          if (loaded.some((s) => s.id === pending.subcategoryId)) {
            setSubcategoryId(pending.subcategoryId);
          } else {
            setSubcategoryId(null);
          }
          pendingRuleRef.current = null;
          return;
        }
        const actual = loaded.filter((s) => s.name.toLowerCase() !== "general");
        if (actual.length === 0 && loaded.length > 0) {
          setSubcategoryId(loaded[0].id);
        } else {
          setSubcategoryId(null);
        }
      }
    }
    loadSubcategories();
    return () => {
      cancelled = true;
    };
  }, [token, categoryId]);

  useEffect(() => {
    if (type !== "expense" && isAssetPurchase) {
      setIsAssetPurchase(false);
    }
  }, [isAssetPurchase, type]);

  // When the user un-checks "asset purchase", reset its dependent fields.
  useEffect(() => {
    if (!isAssetPurchase) {
      setAssetItemName("");
      setAssetClass("");
      setEffectiveLifeYears("");
    } else if (!assetClass) {
      setAssetClass("capital_allowance");
    }
  }, [assetClass, isAssetPurchase]);

  // When GST breakdown is unchecked, drop any entered GST so the body omits it.
  useEffect(() => {
    if (!showGstBreakdown) setGstAmount("");
  }, [showGstBreakdown]);

  useEffect(() => {
    if (!isMarked) return undefined;
    const timer = window.setTimeout(() => {
      router.push(effectiveBackHref);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [effectiveBackHref, isMarked, router]);

  useEffect(() => {
    if (feedback?.tone !== "success") return undefined;
    const timer = window.setTimeout(() => {
      setFeedback(null);
      router.push(effectiveBackHref);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [feedback, effectiveBackHref, router]);


  const grossNumberValue = Number.parseFloat(grossAmount);
  const splitTotal = splitRows.reduce(
    (sum, r) => sum + (Number.parseFloat(r.amount) || 0),
    0,
  );
  const splitPropertyCount = new Set(
    splitRows.map((row) => row.propertyId).filter(Boolean),
  ).size;
  const splitHasMultipleProperties = splitPropertyCount > 1;
  const splitMatches =
    !Number.isNaN(grossNumberValue) &&
    grossNumberValue > 0 &&
    Math.abs(splitTotal - grossNumberValue) < 0.01;

  const splitErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!isSplit) return errors;
    if (splitRows.length < 2) {
      errors.__form = "Add at least two property rows for a split transaction.";
    }
    const seen = new Set<string>();
    const allBlank = splitRows.every((row) => !row.amount || !row.amount.trim());
    for (const r of splitRows) {
      if (!r.propertyId) {
        errors[r.id] = "Choose a property.";
      } else if (seen.has(r.propertyId)) {
        errors[r.id] = "Property already used in another split.";
      } else if (!allBlank && (!r.amount || Number.parseFloat(r.amount) <= 0)) {
        errors[r.id] = "Enter a positive amount.";
      }
      if (r.propertyId) seen.add(r.propertyId);
    }
    if (seen.size > 0 && seen.size < 2) {
      errors.__form = "Choose more than one property for a split transaction.";
    }
    return errors;
  }, [isSplit, splitRows]);

  const lockAssetPurchaseCategory = type === "expense" && isAssetPurchase;
  const mustChooseClientFirst = requireClientSelection && !activeClientId;
  const hasNoProperties =
    !!activeEntityId && propertiesLoaded && properties.length === 0;
  const canSplitTransaction = properties.length > 1;

  useEffect(() => {
    if (lockAssetPurchaseCategory && !categoryId && categories[0]) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId, lockAssetPurchaseCategory]);

  useEffect(() => {
    if (lockAssetPurchaseCategory && !subcategoryId && subcategories[0]) {
      setSubcategoryId(subcategories[0].id);
    }
  }, [lockAssetPurchaseCategory, subcategories, subcategoryId]);



  const invoiceDateError = useMemo(() => {
    if (!invoiceDate) {
      return "Invoice date is required.";
    }
    const yearPart = invoiceDate.split("-")[0];
    if (yearPart && yearPart.length > 4) {
      return "Year cannot exceed 4 digits.";
    }
    const yearVal = parseInt(yearPart, 10);
    if (!isNaN(yearVal) && yearVal < 1900) {
      return "Year must be 1900 or later.";
    }
    const todayStr = getLocalDateString();
    if (invoiceDate > todayStr) {
      return "Invoice date cannot be in the future.";
    }
    return "";
  }, [invoiceDate]);

  const showDateError = !!invoiceDateError && (invoiceDateTouched || invoiceDateError !== "Invoice date is required.");

  const grossAmountError = useMemo(() => {
    if (!grossAmount) {
      return "Amount is required.";
    }
    const val = Number.parseFloat(grossAmount);
    if (Number.isNaN(val) || val <= 0) {
      return "Amount must be greater than 0.";
    }
    return "";
  }, [grossAmount]);

  const showGrossAmountError = !!grossAmountError && (grossAmountTouched || grossAmountError !== "Amount is required.");

  const canSubmit =
    !mustChooseClientFirst &&
    !hasNoProperties &&
    !!activeEntityId &&
    !!type &&
    (lockAssetPurchaseCategory || !!categoryId) &&
    (lockAssetPurchaseCategory || !!subcategoryId) &&
    !!invoiceDate &&
    !invoiceDateError &&
    !!grossAmount &&
    !grossAmountError &&
    !!modeOfTransaction &&
    (!isAssetPurchase ||
      (assetClass === "capital_works" ||
        (assetClass === "capital_allowance" && !!effectiveLifeYears))) &&
    (isSplit
      ? splitHasMultipleProperties &&
      Object.keys(splitErrors).length === 0 &&
      splitMatches
      : !!propertyId);

  function handleOpenBulkImport() {
    if (mustChooseClientFirst) {
      setFeedback({
        tone: "warning",
        title: "Select a client first",
        message: "Choose a client before importing transactions in bulk.",
      });
      return;
    }
    setIsBulkOpen(true);
  }

  function updateSplitRow(id: string, patch: Partial<SplitRowState>) {
    setSplitRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }

  function addSplitRow() {
    setSplitRows((rows) => [
      ...rows,
      { id: makeSplitRowId(), propertyId: "", amount: "" },
    ]);
  }

  function removeSplitRow(id: string) {
    setSplitRows((rows) =>
      rows.length <= 1 ? rows : rows.filter((r) => r.id !== id),
    );
  }

  function handleSplitToggle(checked: boolean) {
    if (checked && !canSplitTransaction) {
      const msg = properties.length === 1
        ? "Split transactions need at least two properties in this entity. This entity only has one property."
        : "Add at least two properties to this entity before creating a split transaction.";
      setSubmitError(msg);
    } else {
      if (submitError && submitError.toLowerCase().includes("split")) {
        setSubmitError("");
      }
    }
    setIsSplit(checked);
    if (checked) {
      setSplitRows((rows) => {
        if (
          rows.length === 1 &&
          !rows[0].propertyId &&
          !rows[0].amount &&
          propertyId
        ) {
          return [{ ...rows[0], propertyId, amount: grossAmount }];
        }
        return rows;
      });
      return;
    }

    setSplitRows([{ id: makeSplitRowId(), propertyId: "", amount: "" }]);
  }

  function handleEntityPicked(id: string) {
    setActiveEntityId(id);
    setSubmitError("");
    // If an actual entity was chosen, close the entity editor and
    // open the property editor. If the empty/placeholder option was
    // selected, keep the entity editor open so the user can choose again.
    if (id) {
      setIsEditingEntity(false);
      setIsEditingProperty(true);
    } else {
      setIsEditingEntity(true);
    }
  }

  function handleClientPicked(id: string) {
    setActiveClientId(id);
    setActiveEntityId("");
    setIsEditingEntity(true);
    setProperties([]);
    setPropertiesLoaded(false);
    setPropertyId("");
    setIsEditingProperty(true);
    setSplitRows([{ id: makeSplitRowId(), propertyId: "", amount: "" }]);
    setSubmitError("");
  }

  function handlePropertyPicked(id: string) {
    setPropertyId(id);
    if (id) setIsEditingProperty(false);
    setSubmitError("");
  }

  function handleExtracted(data: ExtractedDocumentData, docId: string, meta?: ExtractedMeta) {
    setDocumentId(docId);
    if (meta?.filename) setUploadedFilename(meta.filename);
    const filled = new Set<string>();

    // A matched rule decides type/category/subcategory. Stash its category +
    // subcategory in pendingRuleRef BEFORE setType triggers the async category
    // load, so the load effects apply the rule's values instead of defaults.
    const rule = meta?.matchedRule ?? null;
    // Remember the matched rule's id (or clear it if this extraction matched no
    // rule) so handleSubmit can stamp it onto the created transaction.
    appliedRuleIdRef.current = rule?.rule_id ?? null;
    const ruleType =
      rule?.assigned_type === "expense" || rule?.assigned_type === "revenue"
        ? rule.assigned_type
        : null;
    if (rule && rule.assigned_category_id && rule.assigned_subcategory_id) {
      pendingRuleRef.current = {
        categoryId: rule.assigned_category_id,
        subcategoryId: rule.assigned_subcategory_id,
      };
      filled.add("categoryId");
      filled.add("subcategoryId");
    }

    const effectiveType =
      ruleType ??
      (data.type === "expense" || data.type === "revenue" ? data.type : null);
    if (effectiveType) {
      setType(effectiveType);
      filled.add("type");
    }
    if (data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      setInvoiceDate(data.date);
      setInvoiceDateTouched(false);
      filled.add("invoiceDate");
    }
    if (typeof data.amount === "number" && Number.isFinite(data.amount)) {
      setGrossAmount(String(data.amount));
      filled.add("grossAmount");
    }
    if (
      data.gst_included &&
      typeof data.gst_amount === "number" &&
      Number.isFinite(data.gst_amount) &&
      data.gst_amount > 0
    ) {
      setShowGstBreakdown(true);
      setGstAmount(String(data.gst_amount));
      filled.add("gstAmount");
    }
    const desc = (data.description || data.title || "").trim();
    if (desc) {
      setDescription(desc);
      filled.add("description");
    }

    const remarkParts = [
      data.vendor && `Vendor: ${data.vendor}`,
      data.payer && `Payer: ${data.payer}`,
      data.reference && `Ref: ${data.reference}`,
      data.due_date &&
      /^\d{4}-\d{2}-\d{2}$/.test(data.due_date) &&
      `Due: ${data.due_date}`,
    ].filter(Boolean) as string[];
    if (remarkParts.length > 0) {
      setInternalRemarks(remarkParts.join(" · "));
      filled.add("internalRemarks");
    }

    setPrefilled(new Set());
    queueMicrotask(() => setPrefilled(filled));
    window.setTimeout(() => setPrefilled(new Set()), 2200);
  }

  async function resolveBulkCategory(
    importType: CoreTransactionType,
    row: BulkImportRow,
    tokenValue: string,
    cache: Map<CoreTransactionType, CoreTransactionCategory[]>,
  ) {
    const directId = Number.parseInt(row.category_id || "", 10);
    if (Number.isFinite(directId) && directId > 0) return directId;

    const categoryName = row.category || row.category_name || "";

    let options = cache.get(importType);
    if (!options) {
      const res = await fetch(
        `/api/transactions/categories?type=${encodeURIComponent(importType)}`,
        { headers: { Authorization: `Bearer ${tokenValue}` } },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { items?: CoreTransactionCategory[] };
      options = data.items || [];
      cache.set(importType, options);
    }

    if (!categoryName.trim()) return options[0]?.id ?? null;

    return options.find((category) =>
      namesMatchCsvLookup(category.name, categoryName),
    )?.id ?? (options[0]?.id ?? null);
  }

  async function resolveBulkSubcategory(
    categoryIdValue: number,
    row: BulkImportRow,
    tokenValue: string,
    cache: Map<number, CoreTransactionSubcategory[]>,
  ) {
    const directId = Number.parseInt(row.subcategory_id || row.sub_category_id || "", 10);
    if (Number.isFinite(directId) && directId > 0) return directId;

    const subcategoryName =
      row.subcategory || row.sub_category || row.subcategory_name || "";

    let options = cache.get(categoryIdValue);
    if (!options) {
      const res = await fetch(
        `/api/transactions/categories/${categoryIdValue}/sub-categories`,
        { headers: { Authorization: `Bearer ${tokenValue}` } },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { items?: CoreTransactionSubcategory[] };
      options = data.items || [];
      cache.set(categoryIdValue, options);
    }

    if (!subcategoryName.trim()) return options[0]?.id ?? null;

    return options.find((subcategory) =>
      namesMatchCsvLookup(subcategory.name, subcategoryName),
    )?.id ?? (options[0]?.id ?? null);
  }

  function resolveBulkSplits(
    row: BulkImportRow,
    fallbackPropertyId: string,
    grossNum: number,
    rowNumber: number,
  ) {
    const rawProperties =
      row.split_properties ||
      row.split_property_names ||
      row.split_property_ids ||
      row.property_splits ||
      "";
    const splitProperties = parseDelimitedCsvValue(rawProperties);

    if (splitProperties.length === 0) {
      return [{ property_id: fallbackPropertyId, split_percentage: 100 }];
    }

    if (splitProperties.length < 2) {
      throw new Error(
        `Row ${rowNumber}: split transactions must include more than one property.`,
      );
    }

    const propertyIds = splitProperties.map((value) =>
      resolvePropertyLookup(value, properties),
    );
    const missingPropertyIndex = propertyIds.findIndex((id) => !id);
    if (missingPropertyIndex >= 0) {
      throw new Error(
        `Row ${rowNumber}: split property "${splitProperties[missingPropertyIndex]}" was not found for the selected entity.`,
      );
    }

    const uniquePropertyIds = new Set(propertyIds);
    if (uniquePropertyIds.size !== propertyIds.length) {
      throw new Error(
        `Row ${rowNumber}: each split property must be used only once.`,
      );
    }

    const splitAmounts = parseDelimitedCsvValue(
      row.split_amounts || row.split_gross_amounts || "",
    ).map(parseMoneyValue);
    const splitPercentages = parseDelimitedCsvValue(
      row.split_percentages || row.split_percentage || "",
    ).map((value) => Number.parseFloat(value));

    if (splitAmounts.length > 0) {
      if (
        splitAmounts.length !== propertyIds.length ||
        splitAmounts.some((amount) => amount == null || amount <= 0)
      ) {
        throw new Error(
          `Row ${rowNumber}: split_amounts must contain one positive amount per split property.`,
        );
      }

      const amountTotal = splitAmounts.reduce<number>(
        (sum, amount) => sum + (amount ?? 0),
        0,
      );
      if (Math.abs(amountTotal - grossNum) > 0.01) {
        throw new Error(
          `Row ${rowNumber}: split_amounts must total ${grossNum.toFixed(2)}.`,
        );
      }

      return propertyIds.map((propertyIdValue, index) => {
        const amount = splitAmounts[index] ?? 0;
        return {
          property_id: propertyIdValue,
          split_percentage: Number(((amount / grossNum) * 100).toFixed(4)),
          split_gross_amount: Number(amount.toFixed(2)),
        };
      });
    }

    if (splitPercentages.length > 0) {
      if (
        splitPercentages.length !== propertyIds.length ||
        splitPercentages.some(
          (percentage) => !Number.isFinite(percentage) || percentage <= 0,
        )
      ) {
        throw new Error(
          `Row ${rowNumber}: split_percentages must contain one positive percentage per split property.`,
        );
      }

      const percentageTotal = splitPercentages.reduce(
        (sum, percentage) => sum + percentage,
        0,
      );
      if (Math.abs(percentageTotal - 100) > 0.01) {
        throw new Error(`Row ${rowNumber}: split_percentages must total 100.`);
      }

      return propertyIds.map((propertyIdValue, index) => {
        const percentage = splitPercentages[index] ?? 0;
        return {
          property_id: propertyIdValue,
          split_percentage: Number(percentage.toFixed(4)),
        };
      });
    }

    throw new Error(
      `Row ${rowNumber}: provide split_amounts or split_percentages with split_properties.`,
    );
  }

  async function handleBulkImport({
    entityId: bulkEntityId,
    propertyId: bulkPropertyId,
    rows,
  }: {
    entityId: string;
    propertyId: string;
    rows: BulkImportRow[];
  }) {
    if (!token) {
      setFeedback({
        tone: "warning",
        title: "Sign-in required",
        message: "Please sign in again before importing transactions.",
      });
      return;
    }

    const categoryCache = new Map<CoreTransactionType, CoreTransactionCategory[]>();
    const subcategoryCache = new Map<number, CoreTransactionSubcategory[]>();
    let imported = 0;

    try {
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const rowNumber = index + 2;
        const rawType = normalizeCsvLookup(row.type || row.transaction_type || "");
        const importType: CoreTransactionType =
          rawType === "revenue" || rawType === "income" ? "revenue" : "expense";
        const isAsset = parseBooleanValue(row.is_asset_purchase || row.asset_purchase || "");
        const categoryValue = await resolveBulkCategory(
          importType,
          row,
          token,
          categoryCache,
        );
        if (!categoryValue) {
          throw new Error(`Row ${rowNumber}: category is missing or unknown.`);
        }
        const subcategoryValue = await resolveBulkSubcategory(
          categoryValue,
          row,
          token,
          subcategoryCache,
        );
        if (!subcategoryValue) {
          throw new Error(`Row ${rowNumber}: sub-category is missing or unknown.`);
        }
        const grossNum = parseMoneyValue(row.gross_amount || row.amount || "");
        if (grossNum == null || grossNum < 0) {
          throw new Error(`Row ${rowNumber}: amount must be a positive number.`);
        }
        const gstNum = parseMoneyValue(row.gst_amount || row.gst || "") ?? 0;
        const invoiceDateValue = String(row.invoice_date || row.date || "").trim();
        if (!invoiceDateValue) {
          throw new Error(`Row ${rowNumber}: invoice_date is required.`);
        }
        const yearPart = invoiceDateValue.split("-")[0];
        if (yearPart && yearPart.length > 4) {
          throw new Error(`Row ${rowNumber}: year cannot exceed 4 digits.`);
        }
        const yearVal = parseInt(yearPart, 10);
        if (isNaN(yearVal) || yearVal < 1900) {
          throw new Error(`Row ${rowNumber}: year must be 1900 or later.`);
        }
        const splits = resolveBulkSplits(
          row,
          bulkPropertyId,
          grossNum,
          rowNumber,
        );
        const body: Record<string, unknown> = {
          type: importType,
          category_id: categoryValue,
          subcategory_id: subcategoryValue,
          invoice_date: invoiceDateValue,
          gross_amount: grossNum,
          gst_amount: gstNum,
          description: row.description?.trim() || null,
          internal_remarks: row.internal_remarks?.trim() || null,
          is_asset_purchase: isAsset,
          metadata: {
            mode_of_transaction:
              row.mode_of_transaction?.trim() || row.mode?.trim() || "other",
            ...(row.category || row.category_name
              ? { csv_category: row.category || row.category_name }
              : {}),
            ...(row.subcategory || row.sub_category || row.subcategory_name
              ? {
                csv_subcategory:
                  row.subcategory || row.sub_category || row.subcategory_name,
              }
              : {}),
          },
          splits,
        };
        if (isAsset) {
          body.asset_class = row.asset_class?.trim() || "capital_works";
          const lifeYears = parseMoneyValue(row.effective_life_years || "");
          if (lifeYears != null) body.effective_life_years = lifeYears;
        }

        const res = await fetch(
          `/api/entities/${encodeURIComponent(bulkEntityId)}/transactions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
          },
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: string;
            message?: string;
          } | null;
          throw new Error(
            `Row ${rowNumber}: ${data?.message || data?.error || "save failed"}`,
          );
        }
        imported += 1;
      }

      setIsBulkOpen(false);
      setFeedback({
        tone: "success",
        title: "Transactions imported",
        message: `${imported} transaction${imported === 1 ? "" : "s"} imported successfully.`,
      });
    } catch (error) {
      setFeedback({
        tone: "warning",
        title: "Import needs attention",
        message: error instanceof Error ? error.message : "Unable to import CSV rows.",
      });
    }
  }

  async function resolveLockedCategorySelection() {
    if (!token) return null;

    let resolvedCategoryId = categoryId;
    let categoryOptions = categories;

    if (!resolvedCategoryId) {
      if (categoryOptions.length === 0) {
        const categoryRes = await fetch(
          `/api/transactions/categories?type=${encodeURIComponent("expense")}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!categoryRes.ok) return null;
        const data = (await categoryRes.json()) as {
          items?: CoreTransactionCategory[];
        };
        categoryOptions = data.items || [];
        setCategories(categoryOptions);
      }
      resolvedCategoryId = categoryOptions[0]?.id ?? null;
    }

    if (!resolvedCategoryId) return null;

    let resolvedSubcategoryId = subcategoryId;
    let subcategoryOptions =
      categoryId === resolvedCategoryId ? subcategories : [];

    if (!resolvedSubcategoryId) {
      if (subcategoryOptions.length === 0) {
        const subcategoryRes = await fetch(
          `/api/transactions/categories/${resolvedCategoryId}/sub-categories`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!subcategoryRes.ok) return null;
        const data = (await subcategoryRes.json()) as {
          items?: CoreTransactionSubcategory[];
        };
        subcategoryOptions = data.items || [];
        setSubcategories(subcategoryOptions);
      }
      resolvedSubcategoryId = subcategoryOptions[0]?.id ?? null;
    }

    if (!resolvedSubcategoryId) return null;

    setCategoryId(resolvedCategoryId);
    setSubcategoryId(resolvedSubcategoryId);
    return { categoryId: resolvedCategoryId, subcategoryId: resolvedSubcategoryId };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mustChooseClientFirst) {
      setFeedback({
        tone: "warning",
        title: "Client required",
        message: "Please select a client before choosing an entity.",
      });
      return;
    }
    if (!activeEntityId || !token) {
      setFeedback({
        tone: "warning",
        title: "Selection required",
        message: "Please select Entity Name and Property Name to continue.",
      });
      return;
    }
    if (hasNoProperties) {
      setSubmitError("Add a property to this entity before recording transactions.");
      return;
    }
    setSubmitError("");
    if (invoiceDateError) {
      setInvoiceDateTouched(true);
      setSubmitError(invoiceDateError);
      return;
    }
    if (grossAmountError) {
      setGrossAmountTouched(true);
      setSubmitError(grossAmountError);
      return;
    }
    setIsSubmitting(true);
    try {
      const grossNum = Number.parseFloat(grossAmount);
      const allBlank = isSplit && splitRows.every((row) => !row.amount || !row.amount.trim());
      if (!allBlank) {
        if (Number.isNaN(grossNum) || grossNum <= 0) {
          setSubmitError("Amount must be a positive number.");
          return;
        }
      } else {
        if (!Number.isNaN(grossNum) && grossNum <= 0) {
          setSubmitError("Amount must be a positive number.");
          return;
        }
      }

      let gstNum: number | null = null;
      if (showGstBreakdown && gstAmount) {
        const parsed = Number.parseFloat(gstAmount);
        if (Number.isNaN(parsed) || parsed < 0) {
          setSubmitError("GST must be a non-negative number.");
          return;
        }
        gstNum = parsed;
      }

      let splits: Array<Record<string, unknown>>;
      if (isSplit) {
        if (!splitHasMultipleProperties) {
          setSubmitError(
            "Split transactions must include more than one property.",
          );
          return;
        }
        if (Object.keys(splitErrors).length > 0) {
          setSubmitError("Fix the errors in the split rows.");
          return;
        }
        if (!allBlank && !splitMatches) {
          setSubmitError(
            `Split amounts must total ${grossNum.toFixed(
              2,
            )} (currently ${splitTotal.toFixed(2)}).`,
          );
          return;
        }
        if (allBlank) {
          splits = splitRows.map((r) => {
            return {
              property_id: r.propertyId,
            };
          });
        } else {
          splits = splitRows.map((r) => {
            const rowAmount = Number.parseFloat(r.amount);
            return {
              property_id: r.propertyId,
              split_percentage: Number(((rowAmount / grossNum) * 100).toFixed(4)),
              split_gross_amount: Number(rowAmount.toFixed(2)),
            };
          });
        }
      } else {
        if (!propertyId) {
          setSubmitError("A property must be selected to continue.");
          return;
        }
        splits = [{ property_id: propertyId, split_percentage: 100 }];
      }

      let resolvedCategoryId = categoryId;
      let resolvedSubcategoryId = subcategoryId;
      if (lockAssetPurchaseCategory && (!resolvedCategoryId || !resolvedSubcategoryId)) {
        const selection = await resolveLockedCategorySelection();
        resolvedCategoryId = selection?.categoryId ?? null;
        resolvedSubcategoryId = selection?.subcategoryId ?? null;
      }

      if (!resolvedCategoryId || !resolvedSubcategoryId) {
        setSubmitError("Please select a category and sub-category.");
        return;
      }

      const body: Record<string, unknown> = {
        type,
        category_id: resolvedCategoryId,
        subcategory_id: resolvedSubcategoryId,
        invoice_date: invoiceDate,
        gross_amount: Number.isNaN(grossNum) ? null : grossNum,
        description: description.trim() || null,
        internal_remarks: internalRemarks.trim() || null,
        is_asset_purchase: isAssetPurchase,
        splits,
      };
      if (documentId) {
        body.document_id = documentId;
      }
      if (appliedRuleIdRef.current) {
        body.rule_id = appliedRuleIdRef.current;
      }
      if (gstNum !== null) {
        body.gst_amount = gstNum;
      }
      if (modeOfTransaction) {
        body.metadata = { mode_of_transaction: modeOfTransaction };
      }
      if (isAssetPurchase) {
        body.asset_class = assetClass || null;
        if (assetItemName.trim()) {
          body.metadata = {
            ...(body.metadata as Record<string, unknown> | undefined),
            asset_item_name: assetItemName.trim(),
          };
        }
        if (assetClass === "capital_allowance") {
          const yearsNum = Number.parseFloat(effectiveLifeYears);
          if (Number.isNaN(yearsNum) || yearsNum <= 0) {
            setSubmitError("Effective life must be a positive number.");
            return;
          }
          body.effective_life_years = yearsNum;
        }
      }

      const res = await fetch(
        `/api/entities/${encodeURIComponent(activeEntityId)}/transactions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;
        setSubmitError(
          data?.message || data?.error || `Save failed (${res.status}).`,
        );
        return;
      }
      setIsMarked(true);
    } catch (error) {
      console.error("Failed to save transaction:", error);
      setSubmitError("Unexpected error saving transaction.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isSelectionComplete = !!activeEntityId && (isSplit ? true : !!propertyId);
  const showSelectionMessage = !isSelectionComplete && (!requireClientSelection || !!activeClientId);

  const selectionMessage = useMemo(() => {
    if (isSelectionComplete) return null;
    if (!tokenLoaded) return null;

    const clientSelectedIfNeeded = !requireClientSelection || !!activeClientId;
    if (!clientSelectedIfNeeded) return null;

    if (!activeEntityId) {
      const zeroEntities = entitiesLoaded && entities.length === 0;
      if (zeroEntities) {
        return "Add an entity to proceed";
      }
      return "An entity must be selected to continue.";
    }

    const zeroProperties = propertiesLoaded && properties.length === 0;
    if (zeroProperties) {
      return "Add a property to proceed";
    }
    return "A property must be selected to continue.";
  }, [isSelectionComplete, tokenLoaded, requireClientSelection, activeClientId, entitiesLoaded, entities.length, activeEntityId, propertiesLoaded, properties.length]);

  if (isMarked) {
    return (
      <section className="transactions-page">
        <div className="entity-success-layer" role="dialog" aria-modal="true">
          <div className="entity-success-backdrop" aria-hidden="true" />
          <div className="entity-success-card">
            <div className="entity-success-animation" aria-hidden="true">
              <span className="entity-success-confetti is-one" />
              <span className="entity-success-confetti is-two" />
              <span className="entity-success-confetti is-three" />
              <span className="entity-success-confetti is-four" />
              <svg viewBox="0 0 72 72">
                <circle
                  className="entity-success-badge"
                  cx="36"
                  cy="36"
                  r="28"
                />
                <path
                  className="entity-success-check"
                  d="M22 37.5 31.5 47 51 25"
                />
              </svg>
            </div>
            <span className="entity-success-body">Transaction Added</span>
            <div className="entity-success-body">
              <strong>Transaction successfully recorded.</strong>
              <p>
                The property ledger has been updated. Returning to transactions.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (tokenLoaded && !token) {
    return (
      <section className="transactions-page">
        <div className="transaction-success-card">
          <h1>Sign-in required</h1>
          <p>Please sign in to add a transaction.</p>
        </div>
      </section>
    );
  }

  const categorySelectOptions: SelectOption[] = [
    { label: "Select category", value: "" },
    ...categories.map((c) => ({
      label: c.name,
      value: String(c.id),
      type: type || undefined,
    })),
  ];
  const subcategorySelectOptions: SelectOption[] = [
    { label: "Select sub-category", value: "" },
    ...subcategories.map((s) => ({ label: s.name, value: String(s.id) })),
  ];
  const showSubcategorySelect =
    !!categoryId &&
    subcategories.some((s) => s.name.toLowerCase() !== "general");
  const splitPropertyBaseOptions = properties.map((p) => ({
    label: pickerLabel(p),
    value: p.id,
  }));
  const flashClass = (key: string) =>
    prefilled.has(key) ? " is-prefilled" : "";



  return (
    <section className="transactions-page transaction-add-page">
      <Link href={effectiveBackHref} className="entity-wizard-back transaction-back-link">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        {backLabel}
      </Link>

      <div className="transactions-page-head">
        <div>
          <h1>Add Transactions</h1>
          <p>Upload and process transaction documents with automatic data extraction</p>
        </div>
        <button
          type="button"
          className={`transaction-outline-button${mustChooseClientFirst ? " is-disabled" : ""}`}
          aria-disabled={mustChooseClientFirst}
          title={mustChooseClientFirst ? "Select a client first" : undefined}
          onClick={handleOpenBulkImport}
        >
          <UploadIcon />
          Bulk Import from CSV
        </button>
      </div>

      <div className="transaction-add-layout">
        {documentId && uploadedFilename && token ? (
          <DocumentPreviewPanel
            documentId={documentId}
            filename={uploadedFilename}
            token={token}
            onReset={() => {
              setDocumentId(null);
              setUploadedFilename(null);
              appliedRuleIdRef.current = null;
            }}
          />
        ) : (
          <DocumentDropZone
            token={token}
            onExtracted={handleExtracted}
            scope={activeEntityId ? { entityId: activeEntityId } : undefined}
            isSubmitting={isSubmitting}
            submitError={submitError && !submitError.toLowerCase().includes("split") ? submitError : ""}
          />
        )}

        <form className="transaction-entry-form" onSubmit={handleSubmit} noValidate>
          {requireClientSelection ? (
            <StaticSelect
              label="Client"
              required
              value={activeClientId}
              options={[
                { label: "Select Client", value: "" },
                ...clients.map((client) => ({
                  label: client.name,
                  value: client.id,
                })),
              ]}
              onChange={handleClientPicked}
            />
          ) : null}

          {requireClientSelection && !activeClientId && (
            <p className="transaction-field-error" style={{ marginTop: "-12px", marginBottom: "4px" }}>
              <svg className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" viewBox="0 0 20 20" fill="white">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              A client must be selected to continue.
            </p>
          )}

          <EntityPropertyHeaderCard
            entities={entities}
            properties={properties}
            activeEntityId={activeEntityId}
            activePropertyId={propertyId}
            isEditingEntity={isEditingEntity}
            isEditingProperty={isEditingProperty}
            isPropertyRequired={!isSplit}
            isEntityLockable={!!activeEntityId}
            isPropertyLockable={!!propertyId}
            onSelectEntity={handleEntityPicked}
            onSelectProperty={handlePropertyPicked}
            onEditEntity={() => setIsEditingEntity(true)}
            onEditProperty={() => setIsEditingProperty(true)}
            disabled={requireClientSelection && !activeClientId}
          />

          {showSelectionMessage && selectionMessage && (
            <div className="transaction-detail-error" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <span>{selectionMessage}</span>
            </div>
          )}

          <fieldset className="transaction-detail-fields" disabled={!isSelectionComplete}>
            <div className={"transaction-type-control" + flashClass("type")}>
              <span className="transaction-field-label">
                Transaction Type<em>*</em>
              </span>
              <div>
                <button
                  type="button"
                  className={type === "expense" ? "is-selected" : ""}
                  onClick={() => setType("expense")}
                >
                  Expense
                </button>
                <button
                  type="button"
                  className={
                    type === "revenue" ? "is-selected is-revenue" : ""
                  }
                  onClick={() => setType("revenue")}
                >
                  Revenue
                </button>
              </div>
            </div>

            {type === "expense" ? (
              <div className="transaction-asset-card">
                <label className="transaction-checkbox-row">
                  <input
                    type="checkbox"
                    checked={isAssetPurchase}
                    onChange={(e) => setIsAssetPurchase(e.target.checked)}
                  />
                  <span>Is this an asset purchase?</span>
                </label>
                <small>Select if this expense should be depreciated over time</small>
                {isAssetPurchase ? (
                  <div className="transaction-asset-options">
                    <label className="transaction-field">
                      <span className="transaction-field-label">
                        Purchased Asset
                      </span>
                      <input
                        type="text"
                        placeholder="e.g., Fridge, AC, dishwasher"
                        value={assetItemName}
                        onChange={(e) => setAssetItemName(e.target.value)}
                      />
                    </label>
                    <label className="transaction-radio-card">
                      <input
                        type="radio"
                        checked={assetClass === "capital_allowance"}
                        onChange={() => setAssetClass("capital_allowance")}
                      />
                      <span>
                        <b>Capital Allowance</b>
                        <small>Depreciate assets over their effective life</small>
                      </span>
                    </label>
                    {assetClass === "capital_allowance" ? (
                      <label className="transaction-field">
                        <span className="transaction-field-label">
                          Effective life (years)<em>*</em>
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          min="0"
                          placeholder="Select years"
                          value={effectiveLifeYears}
                          onChange={(e) => setEffectiveLifeYears(e.target.value)}
                        />
                      </label>
                    ) : null}
                    <label className="transaction-radio-card">
                      <input
                        type="radio"
                        checked={assetClass === "capital_works"}
                        onChange={() => setAssetClass("capital_works")}
                      />
                      <span>
                        <b>Capital Works</b>
                        <small>Fixed depreciation period for capital improvements</small>
                      </span>
                    </label>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="transaction-form-grid">
              <StaticSelect
                label="Category"
                required
                value={categoryId == null ? "" : String(categoryId)}
                options={categorySelectOptions}
                onChange={(value) => setCategoryId(value ? Number(value) : null)}
                disabled={lockAssetPurchaseCategory}
              />
              {showSubcategorySelect && (
                <div className="transaction-field-animate">
                  <StaticSelect
                    label="Sub-Category"
                    required
                    value={subcategoryId == null ? "" : String(subcategoryId)}
                    options={subcategorySelectOptions}
                    onChange={(value) =>
                      setSubcategoryId(value ? Number(value) : null)
                    }
                    disabled={lockAssetPurchaseCategory}
                  />
                </div>
              )}
              <label className={`transaction-field${flashClass("invoiceDate")}${showDateError ? " has-error" : ""}`}>
                <span className="transaction-field-label">
                  Invoice Date<em>*</em>
                </span>
                <input
                  type="date"
                  value={invoiceDate}
                  min="1900-01-01"
                  max="9999-12-31"
                  onChange={(e) => {
                    const val = e.target.value;
                    const yearPart = val.split("-")[0];
                    if (yearPart && yearPart.length > 4) {
                      return;
                    }
                    setInvoiceDate(val);
                    setInvoiceDateTouched(true);
                  }}
                  onBlur={() => setInvoiceDateTouched(true)}
                />
                {showDateError && (
                  <p className="transaction-field-error">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="white">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    {invoiceDateError}
                  </p>
                )}
              </label>
              <label className={`transaction-field${flashClass("grossAmount")}${showGrossAmountError ? " has-error" : ""}`}>
                <span className="transaction-field-label">
                  Amount<em>*</em>
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="0.00"
                  value={grossAmount}
                  onKeyDown={(e) => {
                    if (e.key === "-" || e.key === "Minus") {
                      e.preventDefault();
                    }
                  }}
                  onChange={(e) => {
                    const val = e.target.value.replace(/-/g, "");
                    setGrossAmount(val);
                    setGrossAmountTouched(true);
                  }}
                  onBlur={() => setGrossAmountTouched(true)}
                />
                {showGrossAmountError && (
                  <p className="transaction-field-error">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    {grossAmountError}
                  </p>
                )}
              </label>
            </div>

            <label className="transaction-checkbox-row">
              <input
                type="checkbox"
                checked={showGstBreakdown}
                onChange={(e) => setShowGstBreakdown(e.target.checked)}
              />
              <span>Add GST Breakdown</span>
            </label>

            {showGstBreakdown ? (
              <label className={"transaction-field" + flashClass("gstAmount")}>
                <span className="transaction-field-label">
                  GST Amount<em>*</em>
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={gstAmount}
                  onKeyDown={(e) => {
                    if (e.key === "-" || e.key === "Minus") {
                      e.preventDefault();
                    }
                  }}
                  onChange={(e) => {
                    const val = e.target.value.replace(/-/g, "");
                    setGstAmount(val);
                  }}
                />
              </label>
            ) : null}

            <label className="transaction-checkbox-row">
              <input
                type="checkbox"
                checked={isSplit}
                onChange={(e) => handleSplitToggle(e.target.checked)}
              />
              <span>Is this a split transaction?</span>
            </label>

            {!isSplit && submitError && submitError.toLowerCase().includes("split") ? (
              <p className="transaction-warning-card" role="alert" style={{ marginTop: "-12px", marginBottom: "12px" }}>
                {submitError}
              </p>
            ) : null}

            {isSplit ? (
              <div className="transaction-split-section">
                {splitRows.map((row, index) => {
                  const rowError = splitErrors[row.id];
                  const propertyError = (rowError === "Choose a property." || rowError === "Property already used in another split.") ? rowError : undefined;
                  const amountError = rowError === "Enter a positive amount." ? rowError : undefined;

                  return (
                    <div key={row.id} className="transaction-split-row">
                      <StaticSelect
                        label={index === 0 ? "Property Name" : undefined}
                        required
                        value={row.propertyId}
                        options={[
                          { label: "Select Property", value: "" },
                          ...splitPropertyBaseOptions,
                        ]}
                        onChange={(value) =>
                          updateSplitRow(row.id, { propertyId: value })
                        }
                        error={propertyError}
                      />
                      <label className="transaction-field">
                        {index === 0 ? (
                          <span className="transaction-field-label">
                            Amount<em>*</em>
                          </span>
                        ) : null}
                        <span className="transaction-money-input">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            placeholder="0.00"
                            value={row.amount}
                            onKeyDown={(e) => {
                              if (e.key === "-" || e.key === "Minus") {
                                e.preventDefault();
                              }
                            }}
                            onChange={(e) => {
                              const val = e.target.value.replace(/-/g, "");
                              updateSplitRow(row.id, { amount: val });
                            }}
                          />
                          <b>A$</b>
                        </span>
                        {amountError && (
                          <p className="transaction-split-row-error" style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4.5px" }}>
                            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="white">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                            <span>{amountError}</span>
                          </p>
                        )}
                      </label>
                      <button
                        type="button"
                        className="transaction-split-remove"
                        aria-label="Remove split row"
                        disabled={splitRows.length <= 1}
                        onClick={() => removeSplitRow(row.id)}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
                {splitErrors.__form ? (
                  <p className="transaction-split-row-error" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="white">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <span>{splitErrors.__form}</span>
                  </p>
                ) : null}
                <div className="transaction-split-footer">
                  <span
                    className={`transaction-split-total${grossAmount && !splitMatches ? " is-mismatch" : ""
                      }`}
                  >
                    {grossAmount && !Number.isNaN(grossNumberValue)
                      ? `Split total: ${splitTotal.toFixed(
                        2,
                      )} of ${grossNumberValue.toFixed(2)}`
                      : "Enter the total amount above to validate splits."}
                  </span>
                  <button
                    type="button"
                    className="transaction-split-add"
                    onClick={addSplitRow}
                    disabled={properties.length < 2}
                  >
                    + Add Property
                  </button>
                </div>
              </div>
            ) : null}

            {isSplit && submitError && submitError.toLowerCase().includes("split") ? (
              <p className="transaction-warning-card" role="alert" style={{ marginTop: "12px", marginBottom: "12px" }}>
                {submitError}
              </p>
            ) : null}

            <StaticSelect
              label="Mode of Transaction"
              required
              value={modeOfTransaction}
              options={MODE_OF_TRANSACTION_OPTIONS}
              onChange={setModeOfTransaction}
            />

            <label className={"transaction-field" + flashClass("description")}>
              <span className="transaction-field-label">Description</span>
              <textarea
                placeholder="Add description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <label
              className={"transaction-field" + flashClass("internalRemarks")}
            >
              <span className="transaction-field-label">Add Internal Remarks</span>
              <input
                type="text"
                placeholder="Add Remarks"
                value={internalRemarks}
                onChange={(e) => setInternalRemarks(e.target.value)}
              />
            </label>

            {submitError && !submitError.toLowerCase().includes("split") ? (
              <p className="transaction-warning-card" role="alert">
                {submitError}
              </p>
            ) : null}

            <div className="transaction-form-actions">
              <Link href={effectiveBackHref} className="transaction-cancel-button">
                Cancel
              </Link>
              <button
                type="submit"
                className="transaction-save-button"
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? "Adding Transaction…" : "Add Transaction"}
              </button>
            </div>
          </fieldset>
        </form>
      </div>

      {isBulkOpen && (
        <BulkImportModal
          entities={entities}
          properties={properties}
          defaultEntityId={activeEntityId}
          defaultPropertyId={propertyId}
          onEntityChange={(id) => {
            setActiveEntityId(id);
            setIsEditingEntity(!id);
            setIsEditingProperty(true);
          }}
          onClose={() => setIsBulkOpen(false)}
          onImport={handleBulkImport}
        />
      )}
      {feedback ? (
        <TransactionFeedbackModal
          tone={feedback.tone}
          title={feedback.title}
          message={feedback.message}
          onClose={() => {
            setFeedback(null);
            if (feedback.tone === "success") {
              router.push(effectiveBackHref);
            }
          }}
        />
      ) : null}
    </section>
  );
}

type ConditionRow = { id: string; field: string; operator: string; value: string };

const RULE_FIELDS = ["description", "bank_text", "amount", "payee"];
const RULE_FIELD_LABELS: Record<string, string> = {
  description: "Description",
  bank_text: "Bank text",
  amount: "Amount",
  payee: "Payee",
};
const RULE_OPERATORS = ["contains", "equals", "starts_with", "greater_than"];
const RULE_OPERATOR_LABELS: Record<string, string> = {
  contains: "Contains",
  equals: "Equals",
  starts_with: "Starts with",
  greater_than: "Is greater than",
};

function makeConditionId() {
  return Math.random().toString(36).slice(2);
}

function RuleModal({
  entityId: fixedEntityId,
  rule,
  onClose,
  onSaved,
}: {
  entityId?: string;
  rule?: CoreTransactionRule | null;
  onClose: () => void;
  onSaved: (rule: CoreTransactionRule) => void;
}) {
  const mode = rule ? "edit" : "create";

  const [token, setToken] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<CoreTransactionCategory[]>([]);
  const [subcategories, setSubcategories] = useState<CoreTransactionSubcategory[]>([]);

  const [ruleName, setRuleName] = useState(rule?.name ?? "");
  const [clientId, setClientId] = useState("");
  const [entityId, setEntityId] = useState(fixedEntityId ?? rule?.entityId ?? "");
  const [propertyId, setPropertyId] = useState(rule?.propertyId ?? "");
  const [matchMode, setMatchMode] = useState(rule?.matchMode ?? "all");
  const [conditions, setConditions] = useState<ConditionRow[]>(() =>
    rule && rule.conditions.length > 0
      ? rule.conditions.map((c) => ({
        id: makeConditionId(),
        field: c.field,
        operator: c.operator,
        value: String(c.value ?? ""),
      }))
      : [{ id: makeConditionId(), field: "description", operator: "contains", value: "" }],
  );
  const [assignedType, setAssignedType] = useState<"expense" | "revenue">(
    (rule?.assignedType as "expense" | "revenue") ?? "expense",
  );
  const [categoryId, setCategoryId] = useState<string>(
    rule ? String(rule.assignedCategoryId) : "",
  );
  const [subcategoryId, setSubcategoryId] = useState<string>(
    rule ? String(rule.assignedSubcategoryId) : "",
  );
  const [autoConfirm, setAutoConfirm] = useState(rule?.autoConfirm ?? false);
  const [enabled, setEnabled] = useState(rule?.isEnabled ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [entitiesLoaded, setEntitiesLoaded] = useState(false);
  const [propertiesLoaded, setPropertiesLoaded] = useState(false);

  const isSelectionComplete = !!entityId && (!propertiesLoaded || properties.length > 0);
  const showSelectionMessage = !isSelectionComplete && (!!fixedEntityId || !!clientId);

  const selectionMessage = useMemo(() => {
    if (isSelectionComplete) return null;
    if (!token) return null;

    const clientSelectedIfNeeded = fixedEntityId || !!clientId;
    if (!clientSelectedIfNeeded) return null;

    if (!entityId) {
      const zeroEntities = !fixedEntityId && entitiesLoaded && entities.length === 0;
      if (zeroEntities) {
        return "Add an entity to proceed";
      }
      return "An entity must be selected to continue.";
    }

    const zeroProperties = propertiesLoaded && properties.length === 0;
    if (zeroProperties) {
      return "Add a property to proceed";
    }
    return "A property must be selected to continue.";
  }, [isSelectionComplete, token, fixedEntityId, clientId, entitiesLoaded, entities.length, entityId, propertiesLoaded, properties.length]);

  useEffect(() => {
    if (fixedEntityId) {
      setEntitiesLoaded(true);
    }
  }, [fixedEntityId]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const session = (await getSession()) as SessionWithIdToken | null;
      const t = session?.getIdToken().getJwtToken() ?? null;
      if (cancelled) return;
      setToken(t);
    }
    init();
    return () => { cancelled = true; };
  }, []);

  // Load the accountant's clients to drive the client → entity → property cascade.
  useEffect(() => {
    if (fixedEntityId || !token) return;
    let cancelled = false;
    fetch("/api/users/me/clients?scope=mine", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { clients?: ClientOption[] } | null) => {
        if (!cancelled && data) setClients(data.clients ?? []);
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [fixedEntityId, token]);

  // Load entities for the selected client.
  useEffect(() => {
    if (fixedEntityId || !token) return;
    if (!clientId) { setEntities([]); setEntitiesLoaded(true); return; }
    let cancelled = false;
    setEntitiesLoaded(false);
    fetch(`/api/entities?client_id=${encodeURIComponent(clientId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { items?: EntityOption[] } | null) => {
        if (!cancelled && data) setEntities(data.items ?? []);
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setEntitiesLoaded(true);
      });
    return () => { cancelled = true; };
  }, [fixedEntityId, token, clientId]);

  // Edit mode: resolve the client owning the rule's entity so the cascade is pre-filled.
  useEffect(() => {
    if (fixedEntityId || !token || !rule?.entityId || clientId) return;
    let cancelled = false;
    fetch(`/api/entities/${encodeURIComponent(rule.entityId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { createdFor?: string } | null) => {
        if (!cancelled && data?.createdFor) setClientId(String(data.createdFor));
      })
      .catch(() => null);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedEntityId, token, rule?.entityId]);

  useEffect(() => {
    if (!token || !entityId) { setProperties([]); setPropertiesLoaded(false); return; }
    let cancelled = false;
    setPropertiesLoaded(false);
    fetch(`/api/entities/${encodeURIComponent(entityId)}/properties`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { items?: { id: string; name: string }[] } | null) => {
        if (!cancelled && data) setProperties(data.items ?? []);
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setPropertiesLoaded(true);
      });
    return () => { cancelled = true; };
  }, [token, entityId]);

  useEffect(() => {
    if (!token || !assignedType) { setCategories([]); return; }
    let cancelled = false;
    fetch(`/api/transactions/categories?type=${encodeURIComponent(assignedType)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { items?: CoreTransactionCategory[] } | null) => {
        if (!cancelled && data) {
          setCategories(data.items ?? []);
          setCategoryId((prev) => {
            const valid = (data.items ?? []).some((c) => String(c.id) === prev);
            return valid ? prev : "";
          });
        }
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [token, assignedType]);

  useEffect(() => {
    setSubcategories([]);
    if (!token || !categoryId) { return; }
    let cancelled = false;
    fetch(`/api/transactions/categories/${encodeURIComponent(categoryId)}/sub-categories`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { items?: CoreTransactionSubcategory[] } | null) => {
        if (!cancelled && data) {
          const loaded = data.items ?? [];
          setSubcategories(loaded);
          const actual = loaded.filter((s) => s.name.toLowerCase() !== "general");
          if (actual.length === 0 && loaded.length > 0) {
            setSubcategoryId(String(loaded[0].id));
          } else {
            setSubcategoryId((prev) => {
              const valid = loaded.some((c) => String(c.id) === prev);
              return valid ? prev : "";
            });
          }
        }
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [token, categoryId]);

  function addCondition() {
    setConditions((prev) => [
      ...prev,
      { id: makeConditionId(), field: "description", operator: "contains", value: "" },
    ]);
  }

  function removeCondition(id: string) {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  }

  function updateCondition(id: string, patch: Partial<Omit<ConditionRow, "id">>) {
    setConditions((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c));
  }

  const canSave =
    isSelectionComplete &&
    Boolean(ruleName.trim()) &&
    Boolean(entityId) &&
    conditions.every((c) => c.field && c.operator && c.value.trim()) &&
    Boolean(categoryId) &&
    Boolean(subcategoryId) &&
    !isSaving;

  async function handleSave() {
    if (!token || !canSave) return;
    setIsSaving(true);
    setSaveError("");
    try {
      const body = {
        name: ruleName.trim(),
        property_id: propertyId || null,
        match_mode: matchMode,
        conditions: conditions.map((c) => ({ field: c.field, operator: c.operator, value: c.value })),
        assigned_type: assignedType,
        assigned_category_id: Number(categoryId),
        assigned_subcategory_id: Number(subcategoryId),
        auto_confirm: autoConfirm,
        is_enabled: enabled,
      };

      let res: Response;
      if (mode === "edit" && rule) {
        res = await fetch(
          `/api/entities/${encodeURIComponent(entityId)}/transaction-rules/${encodeURIComponent(rule.id)}`,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
      } else {
        res = await fetch(
          `/api/entities/${encodeURIComponent(entityId)}/transaction-rules`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        setSaveError(err.message || `Failed to save rule (${res.status})`);
        return;
      }
      const saved = (await res.json()) as Record<string, unknown>;
      onSaved(normalizeRule(saved));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setIsSaving(false);
    }
  }

  const clientSelectOptions: SelectOption[] = [
    { label: "Select client", value: "" },
    ...clients.map((c) => ({ label: c.name, value: c.id })),
  ];

  const entitySelectOptions: SelectOption[] = fixedEntityId
    ? []
    : [
      { label: "Select entity", value: "" },
      ...entities.map((e) => ({ label: e.name, value: e.id })),
    ];

  const propertySelectOptions: SelectOption[] = [
    { label: "All Properties", value: "" },
    ...properties.map((p) => ({ label: p.name, value: p.id })),
  ];

  const categorySelectOptions: SelectOption[] = [
    { label: "Select category", value: "" },
    ...categories.map((c) => ({ label: c.name, value: String(c.id) })),
  ];

  const subcategorySelectOptions: SelectOption[] = [
    { label: "Select sub-category", value: "" },
    ...subcategories.map((c) => ({ label: c.name, value: String(c.id) })),
  ];
  const showSubcategorySelect =
    !!categoryId &&
    subcategories.some((s) => s.name.toLowerCase() !== "general");

  const fieldSelectOptions: SelectOption[] = RULE_FIELDS.map((f) => ({
    label: RULE_FIELD_LABELS[f] ?? f,
    value: f,
  }));
  const operatorSelectOptions: SelectOption[] = RULE_OPERATORS.map((o) => ({
    label: RULE_OPERATOR_LABELS[o] ?? o,
    value: o,
  }));

  return (
    <div className="transaction-modal-layer">
      <button
        type="button"
        className="transaction-modal-backdrop"
        aria-label="Close rule"
        onClick={onClose}
      />
      <section className="transaction-modal transaction-rule-modal">
        <header className="transaction-modal-header">
          <div>
            <h2>{mode === "edit" ? "Edit Rule" : "Create Rule"}</h2>
            <p>Rules only apply to unreviewed transactions</p>
          </div>
          <button type="button" aria-label="Close rule" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>

        <div className="transaction-modal-body rule-modal-body">
          <label className="transaction-field">
            <span className="transaction-field-label">Rule Name<em>*</em></span>
            <input
              type="text"
              placeholder="e.g., Rental income"
              value={ruleName}
              onChange={(event) => setRuleName(event.target.value)}
            />
          </label>

          <h3>Entity & Property</h3>
          {!fixedEntityId && (
            <>
              <StaticSelect
                label="Client Name"
                value={clientId}
                options={clientSelectOptions}
                onChange={(v) => { setClientId(v); setEntityId(""); setPropertyId(""); }}
                showSearch
                className="is-full-width"
              />
              {clients.length > 0 && !clientId && (
                <p className="transaction-field-error" style={{ marginTop: "6px", marginBottom: "0px" }}>
                  <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="white">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  A client must be selected to continue.
                </p>
              )}
              {clients.length === 0 && (
                <p style={{ color: "#d92d20", fontSize: "14px", marginTop: "6px", marginBottom: "0px" }}>
                  To create a rule, please add a client to your account first.
                </p>
              )}
            </>
          )}
          <div className="transaction-two-grid">
            {!fixedEntityId && (
              <StaticSelect
                label="Entity"
                required
                value={entityId}
                options={entitySelectOptions}
                onChange={(v) => { setEntityId(v); setPropertyId(""); }}
                disabled={!clientId}
              />
            )}
            <StaticSelect
              label="Property"
              value={propertyId}
              options={propertySelectOptions}
              onChange={setPropertyId}
              disabled={!fixedEntityId && !clientId}
            />
          </div>

          {showSelectionMessage && selectionMessage && (
            <div className="transaction-detail-error" style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px", marginBottom: "12px" }}>
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <span>{selectionMessage}</span>
            </div>
          )}

          <fieldset className="transaction-detail-fields" disabled={!isSelectionComplete}>
            <h3>If</h3>
            <section className="rule-condition-card">
              <div className="rule-match-row">
                <span>Match</span>
                <StaticSelect
                  value={matchMode}
                  options={[
                    { label: "All", value: "all" },
                    { label: "Any", value: "any" },
                  ]}
                  onChange={setMatchMode}
                  className="is-mini"
                />
                <span>of the following:</span>
              </div>
              {conditions.map((cond, idx) => (
                <div key={cond.id} className={`rule-condition-row${conditions.length > 1 ? " has-remove-button" : ""}`}>
                  <StaticSelect
                    value={cond.field}
                    options={fieldSelectOptions}
                    onChange={(v) => updateCondition(cond.id, { field: v })}
                  />
                  <StaticSelect
                    value={cond.operator}
                    options={operatorSelectOptions}
                    onChange={(v) => updateCondition(cond.id, { operator: v })}
                  />
                  <input
                    type="text"
                    placeholder="Enter value"
                    value={cond.value}
                    onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                  />
                  {conditions.length > 1 && (
                    <button
                      type="button"
                      className="rule-condition-remove-btn"
                      aria-label={`Remove condition ${idx + 1}`}
                      onClick={() => removeCondition(cond.id)}
                      title="Remove condition"
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="rule-add-condition" onClick={addCondition}>
                + Add a condition
              </button>
            </section>

            <h3>Then Assign</h3>
            <div className="transaction-type-control">
              <span className="transaction-field-label">Transaction Type<em>*</em></span>
              <div>
                <button
                  type="button"
                  className={assignedType === "expense" ? "is-selected" : ""}
                  onClick={() => { setAssignedType("expense"); setCategoryId(""); setSubcategoryId(""); }}
                >
                  Expense
                </button>
                <button
                  type="button"
                  className={assignedType === "revenue" ? "is-selected is-revenue" : ""}
                  onClick={() => { setAssignedType("revenue"); setCategoryId(""); setSubcategoryId(""); }}
                >
                  Revenue
                </button>
              </div>
            </div>
            <StaticSelect
              label="Category"
              required
              value={categoryId}
              options={categorySelectOptions}
              onChange={(v) => { setCategoryId(v); setSubcategoryId(""); }}
            />
            {showSubcategorySelect && (
              <div className="transaction-field-animate">
                <StaticSelect
                  label="Sub Category"
                  required
                  value={subcategoryId}
                  options={subcategorySelectOptions}
                  onChange={setSubcategoryId}
                />
              </div>
            )}

            <ToggleCard
              checked={autoConfirm}
              onChange={setAutoConfirm}
              title="Automatically confirm transactions this rule applies to"
              subtitle="If disabled, the rule will suggest the category but require manual confirmation"
            />
            <ToggleCard
              checked={enabled}
              onChange={setEnabled}
              title="Enable this rule"
              subtitle="If disabled, the rule will not be applied to transactions"
              green
            />

            {saveError && (
              <p className="transaction-warning-card" role="alert">{saveError}</p>
            )}
          </fieldset>
        </div>

        <footer className="transaction-modal-footer">
          <button type="button" className="transaction-cancel-button" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            type="button"
            className="transaction-save-button"
            disabled={!canSave}
            onClick={handleSave}
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function ToggleCard({
  checked,
  onChange,
  title,
  subtitle,
  green = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  subtitle: string;
  green?: boolean;
}) {
  return (
    <button
      type="button"
      className="rule-toggle-card"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <span
        className={`rule-toggle${checked ? " is-on" : ""}${green ? " is-green" : ""
          }`}
      >
        <i />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
    </button>
  );
}

export function TransactionRulesView({
  backHref = "/dashboard/accountant/transactions",
  entityId,
  isPropertyPage = false,
  disabled = false,
  disabledReason,
}: {
  backHref?: string;
  entityId?: string;
  isPropertyPage?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [query, setQuery] = useState("");
  const [rules, setRules] = useState<CoreTransactionRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [selectedRule, setSelectedRule] = useState<CoreTransactionRule | null>(null);
  const [showModal, setShowModal] = useState<"create" | "edit" | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadRules() {
      setIsLoading(true);
      setLoadError("");
      try {
        const session = (await getSession()) as SessionWithIdToken | null;
        const token = session?.getIdToken().getJwtToken();
        if (!token || cancelled) return;
        const url = entityId
          ? `/api/entities/${encodeURIComponent(entityId)}/transaction-rules`
          : `/api/transaction-rules`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok || cancelled) {
          if (!cancelled) setLoadError(`Failed to load rules (${res.status})`);
          return;
        }
        const data = (await res.json()) as { items?: Record<string, unknown>[] };
        if (!cancelled) setRules((data.items ?? []).map(normalizeRule));
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Unexpected error");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadRules();
    return () => { cancelled = true; };
  }, [entityId]);

  async function handleDelete(rule: CoreTransactionRule) {
    const targetEntityId = entityId || rule.entityId;
    if (!targetEntityId) return;
    setDeletingId(rule.id);
    setDeleteError("");
    try {
      const session = (await getSession()) as SessionWithIdToken | null;
      const token = session?.getIdToken().getJwtToken();
      if (!token) {
        setDeleteError("Session expired. Please refresh the page.");
        return;
      }
      const res = await fetch(
        `/api/entities/${encodeURIComponent(targetEntityId)}/transaction-rules/${encodeURIComponent(rule.id)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== rule.id));
      } else {
        const err = await res.json().catch(() => ({})) as { message?: string };
        setDeleteError(err.message || `Failed to delete rule (${res.status})`);
      }
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Unexpected error deleting rule");
    } finally {
      setDeletingId(null);
    }
  }

  function handleSaved(saved: CoreTransactionRule) {
    setRules((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setShowModal(null);
    setSelectedRule(null);
  }

  const filteredRules = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rules;
    return rules.filter((rule) =>
      rule.name.toLowerCase().includes(normalized) ||
      rule.conditions.some((c) => `${c.field} ${c.operator} ${c.value}`.toLowerCase().includes(normalized)),
    );
  }, [query, rules]);

  if (isPropertyPage) {
    return (
      <div className="property-page-rules-container">
        {deleteError && (
          <p className="transaction-warning-card" role="alert">{deleteError}</p>
        )}

        {isLoading ? (
          <div className="transactions-showing-copy py-10">Loading rules…</div>
        ) : loadError ? (
          <div className="transactions-showing-copy">{loadError}</div>
        ) : rules.length === 0 ? (
          <div className="property-rules-empty-card">
            <div className="property-rules-empty-header">
              {/* <h2>Transaction Rules</h2> */}
            </div>
            <div className="property-rules-empty-content">
              <div className="property-rules-icon-box">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="property-rules-gear-icon"
                >
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <h3>No transaction rules yet</h3>
              <p>
                Create rules to automatically classify your transactions by category, subcategory, and type.
              </p>
              <button
                type="button"
                className="premium-docs-upload-btn"
                disabled={disabled}
                title={disabled ? disabledReason : undefined}
                style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                onClick={() => { setSelectedRule(null); setShowModal("create"); }}
              >
                Create Rule
              </button>
            </div>
          </div>
        ) : (
          <section className="transactions-page transaction-rules-page">
            <div className="transactions-page-head">
              <div>
                <h1>Transaction Rules</h1>
                <p>Automate transaction categorisation with custom rules</p>
              </div>
              <button
                type="button"
                className="transaction-green-button"
                disabled={disabled}
                title={disabled ? disabledReason : undefined}
                style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                onClick={() => { setSelectedRule(null); setShowModal("create"); }}
              >
                <span>+</span>
                New Rule
              </button>
            </div>

            <section className="transaction-rule-search-card">
              <div className="transaction-rule-search">
                <SearchIcon />
                <input
                  type="text"
                  value={query}
                  placeholder="Search by name or conditions"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </section>

            <div className="transaction-rule-table-wrap">
              <table className="transaction-rule-table">
                <thead>
                  <tr>
                    <th>Rule Name</th>
                    <th>Conditions</th>
                    <th>Assigns</th>
                    <th>Auto-Confirm</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRules.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="transactions-empty-state">
                          <strong>No rules match your search.</strong>
                        </div>
                      </td>
                    </tr>
                  ) : filteredRules.map((rule) => (
                    <tr key={rule.id}>
                      <td>
                        <button
                          type="button"
                          disabled={disabled}
                          title={disabled ? disabledReason : undefined}
                          style={disabled ? { cursor: "not-allowed" } : undefined}
                          onClick={() => { setSelectedRule(rule); setShowModal("edit"); }}
                        >
                          {rule.name}
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                          </svg>
                        </button>
                      </td>
                      <td>
                        {rule.conditions.map((c, i) => (
                          <span key={i} className="rule-property-pill">
                            {RULE_FIELD_LABELS[c.field] ?? c.field}{" "}
                            {RULE_OPERATOR_LABELS[c.operator] ?? c.operator}{" "}
                            &ldquo;{String(c.value)}&rdquo;
                          </span>
                        ))}
                      </td>
                      <td>
                        {rule.assignedType} — #{rule.assignedCategoryId} / #{rule.assignedSubcategoryId}
                      </td>
                      <td>{rule.autoConfirm ? "Yes" : "No"}</td>
                      <td>
                        <span className="rule-status-pill">{rule.isEnabled ? "Active" : "Inactive"}</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="transaction-detail-delete-button"
                          disabled={disabled || deletingId === rule.id}
                          title={disabled ? disabledReason : undefined}
                          style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                          onClick={() => handleDelete(rule)}
                          aria-label={`Delete rule ${rule.name}`}
                        >
                          {deletingId === rule.id ? "…" : (
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M19 6l-1 14H6L5 6" />
                            </svg>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination copy={`Showing ${filteredRules.length} of ${rules.length} items`} />
          </section>
        )}

        {showModal && (
          <RuleModal
            entityId={entityId}
            rule={showModal === "edit" ? selectedRule : null}
            onClose={() => { setShowModal(null); setSelectedRule(null); }}
            onSaved={handleSaved}
          />
        )}
      </div>
    );
  }

  return (
    <section className="transactions-page transaction-rules-page">
      <Link href={backHref} className="entity-wizard-back transaction-back-link">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back
      </Link>

      <div className="transactions-page-head">
        <div>
          <h1>Transaction Rules</h1>
          <p>Automate transaction categorisation with custom rules</p>
        </div>
        <button
          type="button"
          className="transaction-green-button"
          disabled={disabled}
          title={disabled ? disabledReason : undefined}
          style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
          onClick={() => { setSelectedRule(null); setShowModal("create"); }}
        >
          <span>+</span>
          New Rule
        </button>
      </div>

      <section className="transaction-rule-search-card">
        <div className="transaction-rule-search">
          <SearchIcon />
          <input
            type="text"
            value={query}
            placeholder="Search by name or conditions"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </section>

      {deleteError && (
        <p className="transaction-warning-card" role="alert">{deleteError}</p>
      )}

      {isLoading ? (
        <div className="transactions-showing-copy">Loading rules…</div>
      ) : loadError ? (
        <div className="transactions-showing-copy">{loadError}</div>
      ) : (
        <>
          <div className="transaction-rule-table-wrap">
            <table className="transaction-rule-table">
              <thead>
                <tr>
                  <th>Rule Name</th>
                  <th>Conditions</th>
                  <th>Assigns</th>
                  <th>Auto-Confirm</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="transactions-empty-state">
                        <strong>{rules.length === 0 ? "No rules yet." : "No rules match your search."}</strong>
                      </div>
                    </td>
                  </tr>
                ) : filteredRules.map((rule) => (
                  <tr key={rule.id}>
                    <td>
                      <button
                        type="button"
                        disabled={disabled}
                        title={disabled ? disabledReason : undefined}
                        style={disabled ? { cursor: "not-allowed" } : undefined}
                        onClick={() => { setSelectedRule(rule); setShowModal("edit"); }}
                      >
                        {rule.name}
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </button>
                    </td>
                    <td>
                      {rule.conditions.map((c, i) => (
                        <span key={i} className="rule-property-pill">
                          {RULE_FIELD_LABELS[c.field] ?? c.field}{" "}
                          {RULE_OPERATOR_LABELS[c.operator] ?? c.operator}{" "}
                          &ldquo;{String(c.value)}&rdquo;
                        </span>
                      ))}
                    </td>
                    <td>
                      {rule.assignedType} — #{rule.assignedCategoryId} / #{rule.assignedSubcategoryId}
                    </td>
                    <td>{rule.autoConfirm ? "Yes" : "No"}</td>
                    <td>
                      <span className="rule-status-pill">{rule.isEnabled ? "Active" : "Inactive"}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="transaction-detail-delete-button"
                        disabled={disabled || deletingId === rule.id}
                        title={disabled ? disabledReason : undefined}
                        style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                        onClick={() => handleDelete(rule)}
                        aria-label={`Delete rule ${rule.name}`}
                      >
                        {deletingId === rule.id ? "…" : (
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M19 6l-1 14H6L5 6" />
                          </svg>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination copy={`Showing ${filteredRules.length} of ${rules.length} items`} />
        </>
      )}

      {showModal && (
        <RuleModal
          entityId={entityId}
          rule={showModal === "edit" ? selectedRule : null}
          onClose={() => { setShowModal(null); setSelectedRule(null); }}
          onSaved={handleSaved}
        />
      )}
    </section>
  );
}

interface ConfirmationDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDanger?: boolean;
}

function ConfirmationDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  isDanger = false,
}: ConfirmationDialogProps) {
  return (
    <div className="transaction-modal-layer" style={{ zIndex: 9999 }}>
      <div
        className="transaction-modal-backdrop"
        style={{
          background: "rgba(15, 23, 42, 0.4)",
          cursor: "default",
        }}
      />
      <div
        className="transaction-detail-modal"
        style={{
          width: "min(100%, 380px)",
          padding: "24px",
          gap: "16px",
          display: "flex",
          flexDirection: "column",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.05)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
            {title}
          </h3>
          <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.5", color: "#475569" }}>
            {message}
          </p>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
          <button
            type="button"
            className="transaction-cancel-button"
            onClick={onCancel}
            style={{
              minWidth: "auto",
              minHeight: "36px",
              padding: "0 16px",
              fontSize: "13px",
              fontWeight: 800,
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={isDanger ? "transaction-detail-delete-button" : "transaction-detail-edit-button"}
            onClick={onConfirm}
            style={{
              minWidth: "auto",
              minHeight: "36px",
              padding: "0 16px",
              fontSize: "13px",
              fontWeight: 800,
              borderRadius: "8px",
              cursor: "pointer",
              boxShadow: "none",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

