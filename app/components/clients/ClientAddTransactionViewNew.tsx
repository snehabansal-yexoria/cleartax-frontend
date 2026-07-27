"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useRef } from "react";

import { parseCsv } from "@/src/lib/csv";
import { getSession } from "@/src/lib/session";
import { formatCurrency, formatTransactionCurrency } from "@/src/lib/currency";
import type {
  CoreAssetClass,
  CoreTransactionCategory,
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

type TransactionFeedbackTone = "success" | "warning";
type ClientOption = { id: string; name: string };
type EntityOption = { id: string; name: string; createdFor?: string };
type PropertyOption = { id: string; name: string };
type BulkImportRow = Record<string, string>;

const MODE_OF_TRANSACTION_OPTIONS = [
  { label: "Select mode of transaction", value: "" },
  { label: "Bank Transfer / EFT", value: "bank_transfer" },
  { label: "Credit Card", value: "credit_card" },
  { label: "Direct Debit", value: "direct_debit" },
  { label: "Cash", value: "cash" },
  { label: "Cheque", value: "cheque" },
  { label: "Other", value: "other" },
];

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

function EditPencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "16px", height: "16px", fill: "none", stroke: "currentColor", strokeWidth: 2 }}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "16px", height: "16px", fill: "none", stroke: "currentColor", strokeWidth: 2 }}>
      <path d="M12 16V5" />
      <path d="m7 10 5-5 5 5" />
      <path d="M5 19h14" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '14px', height: '14px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '16px', height: '16px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

type SelectOption = {
  label: string;
  value: string;
  type?: string;
};

type StaticSelectProps = {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  horizontal?: boolean;
  error?: string;
};

function StaticSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
  required,
  className = "",
  triggerClassName = "",
  disabled = false,
  horizontal = false,
  error,
}: StaticSelectProps) {
  const reactId = useId();
  const dropdownId = `client-tx-select-${reactId}`;
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  const selectRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
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
      className={`client-tx-field-wrapper ${className}`}
      style={{
        minWidth: '200px',
        ...(horizontal && {
          flexDirection: 'row',
          alignItems: 'center',
          gap: '12px',
          minWidth: 'fit-content',
        }),
      }}
    >
      {label && (
        <span
          className="client-tx-field-label"
          style={horizontal ? { margin: 0, whiteSpace: 'nowrap' } : undefined}
        >
          {label}
          {required && <em className="client-tx-required">*</em>}
        </span>
      )}
      <div
        ref={selectRef}
        className={`client-tx-select${isOpen ? " is-open" : ""}${disabled ? " is-disabled" : ""}`}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsOpen(false);
          }
        }}
      >
        <button
          type="button"
          className={triggerClassName || "client-tx-select-trigger"}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          disabled={disabled}
          onClick={() => {
            if (!disabled) {
              setIsOpen((current) => !current);
            }
          }}
        >
          <span>{selected?.label || placeholder || "Select"}</span>
          <ChevronIcon />
        </button>
        {isOpen && !disabled && (
          <div className="client-tx-select-menu" role="listbox">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={value === option.value}
                className={value === option.value ? "is-selected" : ""}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span>{option.label}</span>
                {value === option.value && (
                  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '16px', height: '16px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                    <path d="M5 12l4 4 10-10" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && (
        <p className="client-tx-field-error" style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4.5px" }}>
          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </p>
      )}
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
    <div className="client-tx-grid cols-2">
      <div className="client-tx-field-group">
        {isEditingEntity ? (
          <StaticSelect
            label="Entity Name"
            placeholder="Select Entity"
            value={activeEntityId}
            options={[
              { label: "Select Entity", value: "" },
              ...entities.map((e) => ({ label: e.name, value: e.id })),
            ]}
            onChange={onSelectEntity}
            disabled={disabled}
          />
        ) : (
          <div className="client-tx-locked-field">
            <span className="client-tx-field-label">Entity Name</span>
            <div className="client-tx-locked-input">
              <span>{entityName}</span>
              {!disabled && isEntityLockable && (
                <button type="button" className="client-tx-edit-btn" aria-label="Edit entity" onClick={onEditEntity}>
                  <EditPencilIcon />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="client-tx-field-group">
        {isEditingProperty ? (
          <StaticSelect
            label="Select Property"
            placeholder="Select Property"
            value={activePropertyId}
            options={[
              { label: "Select Property", value: "" },
              ...properties.map((p) => ({ label: p.name, value: p.id })),
            ]}
            onChange={onSelectProperty}
            disabled={disabled}
          />
        ) : (
          <div className="client-tx-locked-field">
            <span className="client-tx-field-label">Select Property</span>
            <div className="client-tx-locked-input">
              <span>{propertyName}</span>
              {!disabled && isPropertyLockable && (
                <button
                  type="button"
                  className="client-tx-edit-btn"
                  aria-label="Edit property"
                  onClick={onEditProperty}
                >
                  <EditPencilIcon />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function makeSplitRowId() {
  return Math.random().toString(36).slice(2);
}

type SplitRowState = {
  id: string;
  propertyId: string;
  amount: string;
};

export default function ClientAddTransactionViewNew({
  entityId,
  backHref = "/dashboard/client/transactions",
  backLabel = "Back to transactions",
}: {
  entityId?: string;
  backHref?: string;
  backLabel?: string;
}) {
  const router = useRouter();
  const [effectiveBackHref, setEffectiveBackHref] = useState(backHref);

  const [token, setToken] = useState<string | null>(null);
  const [tokenLoaded, setTokenLoaded] = useState(false);

  // Keep all states to ensure 100% functionality under the hood
  const [type, setType] = useState<CoreTransactionType | "">("expense");
  const [categories, setCategories] = useState<CoreTransactionCategory[]>([]);
  const [subcategories, setSubcategories] = useState<CoreTransactionSubcategory[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);

  const pendingRuleRef = useRef<{ categoryId: number; subcategoryId: number } | null>(null);
  const appliedRuleIdRef = useRef<number | null>(null);

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
    setActiveEntityId(entityId ?? "");
    setIsEditingEntity(!entityId);
  }, [entityId]);

  // Load entities for the picker.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function loadEntities() {
      setEntitiesLoaded(false);
      try {
        const res = await fetch(`/api/entities`, {
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
  }, [activeEntityId, token]);

  // Load properties whenever activeEntityId changes.
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

  // Load categories when type changes.
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

  // Load subcategories when category changes.
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
    if (!isMarked) return undefined;
    const timer = window.setTimeout(() => {
      router.refresh();
      router.push(effectiveBackHref);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [effectiveBackHref, isMarked, router]);

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
  const hasNoProperties =
    !!activeEntityId && propertiesLoaded && properties.length === 0;
  const canSplitTransaction = properties.length > 1;

  const invoiceDateError = useMemo(() => {
    if (!invoiceDate) {
      return "Invoice date is required.";
    }
    const yearPart = invoiceDate.split("-")[0];
    if (yearPart && yearPart.length > 4) {
      return "Year cannot exceed 4 digits.";
    }
    const todayStr = getLocalDateString();
    if (invoiceDate > todayStr) {
      return "Invoice date cannot be in the future.";
    }
    return "";
  }, [invoiceDate]);

  const showDateError = !!invoiceDateError && (invoiceDateTouched || invoiceDateError !== "Invoice date is required.");

  const canSubmit =
    !hasNoProperties &&
    !!activeEntityId &&
    !!type &&
    (lockAssetPurchaseCategory || !!categoryId) &&
    (lockAssetPurchaseCategory || !!subcategoryId) &&
    !!invoiceDate &&
    !invoiceDateError &&
    !!grossAmount &&
    !!modeOfTransaction &&
    (!isAssetPurchase ||
      (assetClass === "capital_works" ||
        (assetClass === "capital_allowance" && !!effectiveLifeYears))) &&
    (isSplit
      ? splitHasMultipleProperties &&
      Object.keys(splitErrors).length === 0 &&
      splitMatches
      : !!propertyId);

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
    if (id) {
      setIsEditingEntity(false);
      setIsEditingProperty(true);
    } else {
      setIsEditingEntity(true);
    }
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

    const rule = meta?.matchedRule ?? null;
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

  function handleOpenBulkImport() {
    setIsBulkOpen(true);
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
      category.name.toLowerCase() === categoryName.toLowerCase()
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
      subcategory.name.toLowerCase() === subcategoryName.toLowerCase()
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
    const splitProperties = rawProperties.split(";").map(p => p.trim()).filter(Boolean);

    if (splitProperties.length === 0) {
      return [{ property_id: fallbackPropertyId, split_percentage: 100 }];
    }

    if (splitProperties.length < 2) {
      throw new Error(
        `Row ${rowNumber}: split transactions must include more than one property.`,
      );
    }

    const propertyIds = splitProperties.map((value) => {
      const propObj = properties.find(p => p.name.toLowerCase() === value.toLowerCase() || p.id === value);
      return propObj ? propObj.id : null;
    });

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

    const splitAmounts = (row.split_amounts || row.split_gross_amounts || "")
      .split(";")
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => Number.parseFloat(p));

    const splitPercentages = (row.split_percentages || row.split_percentage || "")
      .split(";")
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => Number.parseFloat(p));

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
          property_id: propertyIdValue!,
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
          property_id: propertyIdValue!,
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
        const typeRaw = (row.type || row.transaction_type || "").trim().toLowerCase();
        const importType: CoreTransactionType =
          typeRaw === "revenue" || typeRaw === "income" ? "revenue" : "expense";
        const isAsset = (row.is_asset_purchase || row.asset_purchase || "").trim().toLowerCase() === "true";
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

        const rawDate = row.date || row.invoice_date || "";
        if (!rawDate || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
          throw new Error(`Row ${rowNumber}: invalid date format. Expected YYYY-MM-DD.`);
        }

        const grossNum = Number.parseFloat(row.amount || row.gross_amount || "");
        if (Number.isNaN(grossNum) || grossNum <= 0) {
          throw new Error(`Row ${rowNumber}: amount is missing or invalid.`);
        }

        const docId = row.document_id || null;
        const ruleIdStr = row.rule_id || "";
        const ruleId = ruleIdStr ? Number.parseInt(ruleIdStr, 10) : null;
        const gstValStr = row.gst_amount || row.gst || "";
        const gstNum = gstValStr ? Number.parseFloat(gstValStr) : null;
        const mode = row.mode_of_transaction || row.payment_mode || "bank_transfer";
        const desc = (row.description || row.desc || "").trim();
        const remarks = (row.remarks || row.internal_remarks || "").trim();

        const rowProperties =
          row.split_properties ||
          row.split_property_names ||
          row.split_property_ids ||
          row.property_splits ||
          "";

        const isSplitImport = !!rowProperties.trim();
        const splits = resolveBulkSplits(row, bulkPropertyId, grossNum, rowNumber);

        const body: Record<string, unknown> = {
          type: importType,
          category_id: categoryValue,
          subcategory_id: subcategoryValue,
          invoice_date: rawDate,
          gross_amount: grossNum,
          description: desc || null,
          internal_remarks: remarks || null,
          is_asset_purchase: isAsset,
          splits,
        };

        if (docId) body.document_id = docId;
        if (ruleId) body.rule_id = ruleId;
        if (gstNum !== null) body.gst_amount = gstNum;
        if (mode) body.metadata = { mode_of_transaction: mode };

        if (isAsset) {
          const rawClass = row.asset_class || "";
          body.asset_class = rawClass === "capital_works" ? "capital_works" : "capital_allowance";
          if (row.asset_item_name) {
            body.metadata = {
              ...(body.metadata as Record<string, unknown> | undefined),
              asset_item_name: row.asset_item_name.trim(),
            };
          }
          if (body.asset_class === "capital_allowance") {
            const lifeYears = Number.parseFloat(row.effective_life_years || row.life_years || "");
            if (Number.isNaN(lifeYears) || lifeYears <= 0) {
              throw new Error(`Row ${rowNumber}: asset purchases with Capital Allowance require effective life in years.`);
            }
            body.effective_life_years = lifeYears;
          }
        }

        const res = await fetch(`/api/entities/${encodeURIComponent(bulkEntityId)}/transactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          throw new Error(`Row ${rowNumber}: API rejected transaction (${res.status}).`);
        }
        imported += 1;
      }

      setFeedback({
        tone: "success",
        title: "Import complete",
        message: `Successfully imported ${imported} transactions.`,
      });
      setIsBulkOpen(false);
      setIsMarked(true);
    } catch (err: any) {
      setFeedback({
        tone: "warning",
        title: "Import failed",
        message: err?.message || "An unexpected error occurred during bulk import.",
      });
    }
  }

  async function resolveLockedCategorySelection() {
    if (!token || !lockAssetPurchaseCategory || categories.length === 0) return null;
    const cat = categories[0];
    const catRes = await fetch(
      `/api/transactions/categories/${cat.id}/sub-categories`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!catRes.ok) return null;
    const data = (await catRes.json()) as { items?: CoreTransactionSubcategory[] };
    const items = data.items || [];
    return {
      categoryId: cat.id,
      subcategoryId: items[0]?.id ?? null,
    };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !activeEntityId) return;

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const grossNum = Number.parseFloat(grossAmount);
      // Under the hood, parse GST amount if user entered a custom number or default to empty
      const gstNum = gstAmount ? Number.parseFloat(gstAmount) : null;

      const splits = isSplit
        ? splitRows.map((row) => {
          const amt = Number.parseFloat(row.amount);
          return {
            property_id: row.propertyId,
            split_percentage: Number(((amt / grossNum) * 100).toFixed(4)),
            split_gross_amount: Number(amt.toFixed(2)),
          };
        })
        : [{ property_id: propertyId, split_percentage: 100 }];

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
        invoice_date: invoiceDate || getLocalDateString(), // Redesign fallback to today if hidden
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
  const showSelectionMessage = !isSelectionComplete;

  const selectionMessage = useMemo(() => {
    if (isSelectionComplete) return null;
    if (!tokenLoaded) return null;

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
  }, [isSelectionComplete, tokenLoaded, entitiesLoaded, entities.length, activeEntityId, propertiesLoaded, properties.length]);

  if (isMarked) {
    return (
      <section className="client-tx-container">
        <div className="client-tx-success-layer" role="dialog" aria-modal="true">
          <div className="client-tx-success-card">
            <div className="client-tx-success-animation" aria-hidden="true">
              <span className="client-tx-confetti is-one" />
              <span className="client-tx-confetti is-two" />
              <span className="client-tx-confetti is-three" />
              <span className="client-tx-confetti is-four" />
              <svg viewBox="0 0 72 72" style={{ width: "72px", height: "72px" }}>
                <circle
                  className="client-tx-success-badge"
                  cx="36"
                  cy="36"
                  r="28"
                  fill="none"
                  stroke="#12B76A"
                  strokeWidth="4"
                />
                <path
                  className="client-tx-success-check"
                  d="M22 37.5 31.5 47 51 25"
                  fill="none"
                  stroke="#12B76A"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2 className="client-tx-success-title">Transaction Added</h2>
            <div className="client-tx-success-body">
              <strong>Transaction successfully recorded.</strong>
              <p>The property ledger has been updated. Returning to transactions...</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (tokenLoaded && !token) {
    return (
      <section className="client-tx-container">
        <div className="client-tx-error-card">
          <h2>Sign-in required</h2>
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
    label: p.name,
    value: p.id,
  }));
  const flashClass = (key: string) =>
    prefilled.has(key) ? " is-prefilled" : "";

  return (
    <section className="client-tx-container">
      <div className="client-tx-header-bar">
        <Link href={effectiveBackHref} className="client-tx-back-link">
          <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "16px", height: "16px", fill: "none", stroke: "currentColor", strokeWidth: 2 }}>
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </Link>
        <h1 className="client-tx-page-title">Add Transaction</h1>
      </div>

      <div className="client-tx-card">
        <h2 className="client-tx-title">Transaction Information</h2>
        <form className="client-tx-form" onSubmit={handleSubmit}>

          {showSelectionMessage && selectionMessage && (
            <div className="client-tx-banner-error" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <span>{selectionMessage}</span>
            </div>
          )}

          {/* Entity Name and Select Property */}
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
          />

          {/* Upload Invoice or Receipt (nested here!) */}
          <div className="client-tx-field-group" style={{ marginBottom: "24px" }}>
            <span className="client-tx-field-label">Upload Invoice or Receipt</span>
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
              <div className="client-tx-dropzone-wrapper">
                <DocumentDropZone
                  token={token}
                  onExtracted={handleExtracted}
                  scope={activeEntityId ? { entityId: activeEntityId } : undefined}
                  isSubmitting={isSubmitting}
                  submitError={submitError && !submitError.toLowerCase().includes("split") ? submitError : ""}
                />
              </div>
            )}
          </div>

          <fieldset className="client-tx-fieldset" disabled={!isSelectionComplete}>

            {/* Category and Sub-category */}
            <div className="client-tx-grid cols-2" style={{ marginTop: "16px" }}>
              <div className="client-tx-field-group">
                <StaticSelect
                  label="Category"
                  placeholder="Select category"
                  value={categoryId == null ? "" : String(categoryId)}
                  options={categorySelectOptions}
                  onChange={(value) => setCategoryId(value ? Number(value) : null)}
                  disabled={lockAssetPurchaseCategory}
                />
              </div>

              <div className="client-tx-field-group">
                <StaticSelect
                  label="Sub-category"
                  placeholder="Select sub-category"
                  value={subcategoryId == null ? "" : String(subcategoryId)}
                  options={subcategorySelectOptions}
                  onChange={(value) =>
                    setSubcategoryId(value ? Number(value) : null)
                  }
                  disabled={lockAssetPurchaseCategory}
                />
              </div>
            </div>

            {/* Amount and GST (Optional) */}
            <div className="client-tx-grid cols-2">
              <div className={`client-tx-field-group ${flashClass("grossAmount")}`}>
                <label className="client-tx-field-label">Amount</label>
                <div className="client-tx-amount-input-wrap">
                  <span className="client-tx-amount-prefix">$</span>
                  <input
                    type="number"
                    className="client-tx-input has-prefix"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    placeholder="312.00"
                    value={grossAmount}
                    onKeyDown={(e) => {
                      if (e.key === "-" || e.key === "Minus") {
                        e.preventDefault();
                      }
                    }}
                    onChange={(e) => {
                      const val = e.target.value.replace(/-/g, "");
                      setGrossAmount(val);
                    }}
                  />
                </div>
              </div>

              <div className={`client-tx-field-group ${flashClass("gstAmount")}`}>
                <label className="client-tx-field-label">GST (Optional)</label>
                <div className="client-tx-amount-input-wrap no-prefix">
                  <input
                    type="text"
                    className="client-tx-input"
                    placeholder="GST 10%"
                    value={gstAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGstAmount(val);
                      // If it contains a number, under the hood set show breakdown
                      const numericVal = Number.parseFloat(val.replace(/[^0-9.]/g, ""));
                      if (numericVal > 0) {
                        setShowGstBreakdown(true);
                      } else {
                        setShowGstBreakdown(false);
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Invisible Invoice Date - Keep state updated for validation, hidden to match figma */}
            <input
              type="hidden"
              value={invoiceDate || getLocalDateString()}
            />

            {/* Split Toggle Switch */}
            <div className="client-tx-split-toggle-container">
              <div className="client-tx-split-toggle-info">
                <span className="client-tx-split-toggle-title">Is this a split transaction?</span>
                <span className="client-tx-split-toggle-desc">Allocate across multiple properties</span>
              </div>
              <label className="client-tx-switch">
                <input
                  type="checkbox"
                  checked={isSplit}
                  onChange={(e) => handleSplitToggle(e.target.checked)}
                />
                <span className="client-tx-slider"></span>
              </label>
            </div>

            {!isSplit && submitError && submitError.toLowerCase().includes("split") && (
              <p className="client-tx-warning-banner" role="alert">
                {submitError}
              </p>
            )}

            {/* Split Rows Cards */}
            {isSplit && (
              <div className="client-tx-split-section">
                {splitRows.map((row, index) => {
                  const rowError = splitErrors[row.id];
                  const propertyError = (rowError === "Choose a property." || rowError === "Property already used in another split.") ? rowError : undefined;
                  const amountError = rowError === "Enter a positive amount." ? rowError : undefined;

                  return (
                    <div key={row.id} className="client-tx-split-card">
                      <div className="client-tx-split-card-header">
                        <span className="client-tx-split-card-title">PROPERTY {index + 1}</span>
                        <button
                          type="button"
                          className="client-tx-split-remove-btn"
                          disabled={splitRows.length <= 1}
                          onClick={() => removeSplitRow(row.id)}
                        >
                          Remove
                        </button>
                      </div>

                      <div className="client-tx-grid cols-split-row" style={{ gap: "16px", marginTop: "4px" }}>
                        <div className="client-tx-field-group flex-2">
                          <StaticSelect
                            placeholder="Select Property"
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
                        </div>

                        <div className="client-tx-field-group flex-1">
                          <div className="client-tx-amount-input-wrap">
                            <span className="client-tx-amount-prefix">$</span>
                            <input
                              type="number"
                              className="client-tx-input has-prefix"
                              inputMode="decimal"
                              step="0.01"
                              min="0.01"
                              placeholder="00"
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
                          </div>
                          {amountError && (
                            <p className="client-tx-field-error" style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4.5px" }}>
                              <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                              </svg>
                              <span>{amountError}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {splitErrors.__form && (
                  <p className="client-tx-field-error" style={{ display: "flex", alignItems: "center", gap: "6px", margin: "8px 0" }}>
                    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <span>{splitErrors.__form}</span>
                  </p>
                )}

                <div className="client-tx-split-footer">
                  <span className={`client-tx-split-total-label ${grossAmount && !splitMatches ? "is-mismatch" : ""}`}>
                    {grossAmount && !Number.isNaN(grossNumberValue)
                      ? `Split total: ${splitTotal.toFixed(2)} of ${grossNumberValue.toFixed(2)}`
                      : "Enter the total amount above to validate splits."}
                  </span>
                  <button
                    type="button"
                    className="client-tx-add-split-btn"
                    onClick={addSplitRow}
                    disabled={properties.length < 2}
                  >
                    + Add Property
                  </button>
                </div>
              </div>
            )}

            {isSplit && submitError && submitError.toLowerCase().includes("split") && (
              <p className="client-tx-warning-banner" role="alert" style={{ marginTop: "12px", marginBottom: "12px" }}>
                {submitError}
              </p>
            )}

            {/* Description */}
            <div className="client-tx-field-group" style={{ marginTop: "16px" }}>
              <label className="client-tx-field-label">Description</label>
              <textarea
                className="client-tx-textarea"
                placeholder="Add remarks..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {submitError && !submitError.toLowerCase().includes("split") && (
              <p className="client-tx-warning-banner" role="alert" style={{ marginTop: "16px" }}>
                {submitError}
              </p>
            )}

            {/* Save / Delete Actions */}
            <div className="client-tx-form-actions">
              <Link href={effectiveBackHref} className="client-tx-delete-btn">
                Delete Transaction
              </Link>
              <button
                type="submit"
                className="client-tx-save-btn"
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? "Saving Transaction…" : "Save Transaction"}
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
      {feedback && (
        <TransactionFeedbackModal
          tone={feedback.tone}
          title={feedback.title}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}
    </section>
  );
}

// Subcomponents
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
  defaultEntityId?: string;
  defaultPropertyId?: string;
  onEntityChange: (id: string) => void;
  onClose: () => void;
  onImport: (params: { entityId: string; propertyId: string; rows: BulkImportRow[] }) => void;
}) {
  const [entityId, setEntityId] = useState(defaultEntityId ?? "");
  const [propertyId, setPropertyId] = useState(defaultPropertyId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setEntityId(defaultEntityId ?? "");
  }, [defaultEntityId]);

  useEffect(() => {
    setPropertyId(defaultPropertyId ?? "");
  }, [defaultPropertyId]);

  function handleEntityPicked(id: string) {
    setEntityId(id);
    onEntityChange(id);
    setPropertyId("");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setErrorMsg("");
    }
  }

  async function handleImport() {
    if (!entityId) {
      setErrorMsg("Please select an entity.");
      return;
    }
    if (!propertyId) {
      setErrorMsg("Please select a property.");
      return;
    }
    if (!file) {
      setErrorMsg("Please select a CSV file.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");

    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        throw new Error("The CSV file is empty.");
      }
      onImport({ entityId, propertyId, rows });
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to parse CSV file.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="client-tx-modal-overlay" role="dialog" aria-modal="true">
      <button
        type="button"
        className="client-tx-modal-backdrop"
        aria-label="Close bulk import"
        onClick={onClose}
      />
      <section className="client-tx-modal" onClick={(e) => e.stopPropagation()}>
        <header className="client-tx-modal-header">
          <div>
            <h2>Bulk Import from CSV</h2>
            <p>Upload multiple transactions at once</p>
          </div>
          <button type="button" className="client-tx-modal-close" aria-label="Close bulk import" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>

        <div className="client-tx-modal-body">
          <StaticSelect
            label="Entity"
            required
            value={entityId}
            options={[
              { label: "Select Entity", value: "" },
              ...entities.map((e) => ({ label: e.name, value: e.id })),
            ]}
            onChange={handleEntityPicked}
          />

          <StaticSelect
            label="Default Property"
            required
            value={propertyId}
            options={[
              { label: "Select Property", value: "" },
              ...properties.map((p) => ({ label: p.name, value: p.id })),
            ]}
            onChange={setPropertyId}
            disabled={!entityId}
          />

          <div className="client-tx-field-group" style={{ marginTop: "16px" }}>
            <span className="client-tx-field-label">CSV File</span>
            <input type="file" accept=".csv" className="client-tx-file-input" onChange={handleFileChange} />
          </div>

          {errorMsg && <p className="client-tx-field-error" style={{ marginTop: "8px" }}>{errorMsg}</p>}
        </div>

        <footer className="client-tx-modal-footer">
          <button type="button" className="client-tx-delete-btn" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button type="button" className="client-tx-save-btn" onClick={handleImport} disabled={isLoading}>
            {isLoading ? "Importing..." : "Import"}
          </button>
        </footer>
      </section>
    </div>
  );
}

// Subcomponents
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
    <div className="client-tx-modal-overlay" role="dialog" aria-modal="true">
      <button
        type="button"
        className="client-tx-modal-backdrop"
        aria-label="Close message"
        onClick={onClose}
      />
      <section className={`client-tx-feedback-card is-${tone}`}>
        <div className="client-tx-feedback-icon" aria-hidden="true">
          {tone === "success" ? (
            <svg viewBox="0 0 24 24" style={{ width: "24px", height: "24px", fill: "none", stroke: "currentColor", strokeWidth: 2 }}>
              <path d="M5 12l4 4 10-10" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" style={{ width: "24px", height: "24px", fill: "none", stroke: "currentColor", strokeWidth: 2 }}>
              <path d="M12 8v5" />
              <path d="M12 17h.01" />
              <path d="M10.3 4.3 2.8 17.2A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.8L13.7 4.3a2 2 0 0 0-3.4 0z" />
            </svg>
          )}
        </div>
        <h2>{title}</h2>
        <p>{message}</p>
        <button type="button" className="client-tx-save-btn" style={{ width: "100%", marginTop: "16px" }} onClick={onClose}>
          Continue
        </button>
      </section>
    </div>
  );
}
