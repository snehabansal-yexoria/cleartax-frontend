"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useRef } from "react";
import { useTheme } from "next-themes";

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
import { CURRENCY_PREFIX } from "./CurrencyFormatter";


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
  { label: "Cash", value: "cash" },
  { label: "Bank Transfer", value: "bank_transfer" },
  { label: "Credit Card", value: "credit_card" },
  { label: "Cheque", value: "cheque" },
  { label: "Direct Debit", value: "direct_debit" },
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

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "24px", height: "24px", fill: "none", stroke: "currentColor", strokeWidth: 2 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
  );
}

function ChecklistIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "24px", height: "24px", fill: "none", stroke: "currentColor", strokeWidth: 2 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.03 0 1.9.693 2.166 1.638m-7.377 0A48.536 48.536 0 0112 3m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664M4.5 6.108V16.5A2.25 2.25 0 006.75 18.75h.75m-3-12.642c0-1.135.845-2.098 1.976-2.192a48.424 48.424 0 011.123-.08" />
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
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";

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
        display: "flex",
        flexDirection: "column",
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
          style={{
            fontSize: '13px',
            fontWeight: '500',
            color: isDark ? 'var(--text-secondary)' : '#344054',
            marginBottom: '6px',
            display: 'inline-block',
            ...(horizontal && { margin: 0, whiteSpace: 'nowrap' }),
          }}
        >
          {label}
          {required && (
            <em
              className="client-tx-required"
              style={{
                color: '#da3838',
                fontStyle: 'normal',
                marginLeft: '3px',
              }}
            >
              *
            </em>
          )}
        </span>
      )}
      <div
        ref={selectRef}
        className={`client-tx-select${isOpen ? " is-open" : ""}${disabled ? " is-disabled" : ""}`}
        style={{ position: 'relative', width: '100%' }}
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
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: isDark ? 'var(--surface-2)' : '#f8f9fb',
            border: `1px solid ${isDark ? 'var(--border)' : '#d0d5dd'}`,
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '14.5px',
            fontWeight: '500',
            color: isDark ? 'var(--text-primary)' : '#1d2939',
            width: '100%',
            boxSizing: 'border-box',
            cursor: disabled ? 'not-allowed' : 'pointer',
            outline: 'none',
            textAlign: 'left',
            height: '50px',
          }}
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
          <div
            className="client-tx-select-menu"
            role="listbox"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              background: isDark ? 'var(--surface-1)' : '#ffffff',
              border: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
              borderRadius: '12px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
              zIndex: 999,
              maxHeight: '250px',
              overflowY: 'auto',
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={value === option.value}
                className={value === option.value ? "is-selected" : ""}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  padding: '11px 12px',
                  background: value === option.value ? (isDark ? 'rgba(244, 161, 23, 0.12)' : 'rgba(29, 36, 82, 0.06)') : 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: value === option.value ? '600' : '500',
                  color: value === option.value ? (isDark ? 'var(--accent)' : '#1d2452') : (isDark ? 'var(--text-primary)' : '#1d2939'),
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span>{option.label}</span>
                {value === option.value && (
                  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '16px', height: '16px', fill: 'none', stroke: 'currentColor', strokeWidth: 2, color: isDark ? 'var(--accent)' : '#1d2452' }}>
                    <path d="M5 12l4 4 10-10" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && (
        <p
          className="client-tx-field-error"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginTop: "4.5px",
            color: '#da3838',
            fontSize: '11.5px',
            fontWeight: '600',
          }}
        >
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

  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";

  return (
    <div
      className="client-tx-grid cols-2"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '20px',
        marginBottom: '20px',
      }}
    >
      <div className="client-tx-field-group" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        {isEditingEntity ? (
          <StaticSelect
            label="Entity Name"
            required={true}
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
          <div className="client-tx-locked-field" style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              className="client-tx-field-label"
              style={{
                fontSize: '13px',
                fontWeight: '500',
                color: isDark ? 'var(--text-secondary)' : '#344054',
                marginBottom: '6px',
                display: 'inline-block',
              }}
            >
              Entity Name
              <em className="client-tx-required" style={{ color: '#da3838', fontStyle: 'normal', marginLeft: '3px' }}>*</em>
            </span>
            <div
              className="client-tx-locked-input"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: isDark ? 'var(--surface-2)' : '#f2f4f7',
                border: `1px solid ${isDark ? 'var(--border)' : '#d0d5dd'}`,
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '14.5px',
                fontWeight: '500',
                color: isDark ? 'var(--text-primary)' : '#1d2939',
                width: '100%',
                boxSizing: 'border-box',
                height: '50px',
              }}
            >
              <span>{entityName}</span>
              {!disabled && isEntityLockable && (
                <button
                  type="button"
                  className="client-tx-edit-btn"
                  aria-label="Edit entity"
                  onClick={onEditEntity}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: isDark ? 'var(--text-secondary)' : '#566474',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                  }}
                >
                  <EditPencilIcon />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="client-tx-field-group" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        {isEditingProperty ? (
          <StaticSelect
            label="Select Property"
            required={isPropertyRequired}
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
          <div className="client-tx-locked-field" style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              className="client-tx-field-label"
              style={{
                fontSize: '13px',
                fontWeight: '500',
                color: isDark ? 'var(--text-secondary)' : '#344054',
                marginBottom: '6px',
                display: 'inline-block',
              }}
            >
              Select Property
              {isPropertyRequired && <em className="client-tx-required" style={{ color: '#da3838', fontStyle: 'normal', marginLeft: '3px' }}>*</em>}
            </span>
            <div
              className="client-tx-locked-input"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: isDark ? 'var(--surface-2)' : '#f2f4f7',
                border: `1px solid ${isDark ? 'var(--border)' : '#d0d5dd'}`,
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '14.5px',
                fontWeight: '500',
                color: isDark ? 'var(--text-primary)' : '#1d2939',
                width: '100%',
                boxSizing: 'border-box',
                height: '50px',
              }}
            >
              <span>{propertyName}</span>
              {!disabled && isPropertyLockable && (
                <button
                  type="button"
                  className="client-tx-edit-btn"
                  aria-label="Edit property"
                  onClick={onEditProperty}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: isDark ? 'var(--text-secondary)' : '#566474',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                  }}
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
  backHref: propBackHref,
  backLabel: propBackLabel,
}: {
  entityId?: string;
  backHref?: string;
  backLabel?: string;
}) {
  const router = useRouter();
  const [backHref, setBackHref] = useState(
    propBackHref || (entityId ? `/dashboard/client/entities/${entityId}` : "/dashboard/client/transactions")
  );
  const [backLabel, setBackLabel] = useState(
    propBackLabel || (entityId ? "Entity" : "Transactions")
  );
  const [effectiveBackHref, setEffectiveBackHref] = useState(backHref);

  useEffect(() => {
    const defaultBackHref = propBackHref || (entityId ? `/dashboard/client/entities/${entityId}` : "/dashboard/client/transactions");
    const defaultBackLabel = propBackLabel || (entityId ? "Entity" : "Transactions");

    setBackHref(defaultBackHref);
    setBackLabel(defaultBackLabel);

    if (!propBackHref || !propBackLabel) {
      if (typeof window !== "undefined" && window.sessionStorage) {
        const prevPath = sessionStorage.getItem("prevDashboardPath");
        if (prevPath) {
          const normalized = prevPath.split("?")[0].split("#")[0];
          if (!propBackHref) {
            if (normalized.startsWith("/dashboard/client")) {
              setBackHref(prevPath);
            }
          }
          if (!propBackLabel) {
            if (normalized === "/dashboard/client" || normalized === "/dashboard/client/summary" || normalized === "/dashboard/client/detailed") {
              setBackLabel("Dashboard");
            } else if (normalized === "/dashboard/client/properties") {
              setBackLabel("Properties");
            } else if (normalized === "/dashboard/client/entities") {
              setBackLabel("Entities");
            } else if (normalized.match(/^\/dashboard\/client\/entities\/[^/]+$/)) {
              setBackLabel("Entity");
            } else if (normalized.match(/^\/dashboard\/client\/properties\/[^/]+$/)) {
              setBackLabel("Property");
            } else if (normalized === "/dashboard/client/transactions") {
              setBackLabel("Transactions");
            } else if (normalized === "/dashboard/client/insights") {
              setBackLabel("Insights");
            } else if (normalized === "/dashboard/client/profile") {
              setBackLabel("Profile");
            } else if (normalized.startsWith("/dashboard/client")) {
              setBackLabel("Back");
            }
          }
        }
      }
    }
  }, [propBackHref, propBackLabel, entityId]);
  const [selectedMethod, setSelectedMethod] = useState<"submit_invoice" | "review_submit" | null>(null);

  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";

  const [isMobile, setIsMobile] = useState(false);
  const [mobileStep, setMobileStep] = useState(1);

  useEffect(() => {
    if (!mounted) return;
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [mounted]);

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

  const [modeOfTransaction, setModeOfTransaction] = useState<string>("");
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
    const year = Number.parseInt(yearPart);
    if (!Number.isNaN(year) && year < 1900) {
      return "Invoice date cannot be earlier than the year 1900.";
    }
    const todayStr = getLocalDateString();
    if (invoiceDate > todayStr) {
      return "Invoice date cannot be in the future.";
    }
    return "";
  }, [invoiceDate]);

  const showDateError = !!invoiceDateError && (invoiceDateTouched || invoiceDateError !== "Invoice date is required.");

  const grossAmountError = useMemo(() => {
    if (!grossAmount) return "";
    const parsed = Number.parseFloat(grossAmount);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return "Amount must be greater than 0.";
    }
    return "";
  }, [grossAmount]);

  const gstAmountError = useMemo(() => {
    if (!gstAmount) return "";
    const parsed = Number.parseFloat(gstAmount.replace(/[^0-9.]/g, ""));
    if (Number.isNaN(parsed) || parsed <= 0) {
      return "GST amount cannot be 0.";
    }
    return "";
  }, [gstAmount]);

  const preventExponentialAndNegative = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "e" || e.key === "E" || e.key === "-" || e.key === "+" || e.key === "Minus") {
      e.preventDefault();
    }
  };

  const canSubmit =
    !hasNoProperties &&
    !!activeEntityId &&
    !!type &&
    (lockAssetPurchaseCategory || !!categoryId) &&
    (lockAssetPurchaseCategory || !!subcategoryId) &&
    !!invoiceDate &&
    !invoiceDateError &&
    !!grossAmount &&
    !grossAmountError &&
    !gstAmountError &&
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
      if (hasNoProperties) {
        setSubmitError("Add a property to this entity before recording transactions.");
        setIsSubmitting(false);
        return;
      }
      if (invoiceDateError) {
        setInvoiceDateTouched(true);
        setSubmitError(invoiceDateError);
        setIsSubmitting(false);
        return;
      }
      if (!modeOfTransaction) {
        setSubmitError("Please select a mode of transaction.");
        setIsSubmitting(false);
        return;
      }

      const grossNum = Number.parseFloat(grossAmount);
      const allBlank = isSplit && splitRows.every((row) => !row.amount || !row.amount.trim());
      if (!allBlank) {
        if (Number.isNaN(grossNum) || grossNum <= 0) {
          setSubmitError("Amount must be greater than 0.");
          setIsSubmitting(false);
          return;
        }
      } else {
        if (!Number.isNaN(grossNum) && grossNum <= 0) {
          setSubmitError("Amount must be greater than 0.");
          setIsSubmitting(false);
          return;
        }
      }

      let gstNum: number | null = null;
      if (gstAmount) {
        const parsed = Number.parseFloat(gstAmount.replace(/[^0-9.]/g, ""));
        if (Number.isNaN(parsed) || parsed <= 0) {
          setSubmitError("GST amount cannot be 0.");
          setIsSubmitting(false);
          return;
        }
        gstNum = parsed;
      }

      let splits: Array<Record<string, unknown>>;
      if (isSplit) {
        if (!splitHasMultipleProperties) {
          setSubmitError("Split transactions must include more than one property.");
          setIsSubmitting(false);
          return;
        }
        if (Object.keys(splitErrors).length > 0) {
          setSubmitError("Fix the errors in the split rows.");
          setIsSubmitting(false);
          return;
        }
        if (!allBlank && !splitMatches) {
          setSubmitError(
            `Split amounts must total ${grossNum.toFixed(
              2,
            )} (currently ${splitTotal.toFixed(2)}).`,
          );
          setIsSubmitting(false);
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
          setIsSubmitting(false);
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
      <section className="client-tx-container" style={{ width: '100%', maxWidth: '1280px', margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: isDark ? 'rgba(15, 19, 48, 0.8)' : 'rgba(29, 36, 82, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
        }} role="dialog" aria-modal="true">
          <div style={{
            background: isDark ? 'var(--surface-1)' : '#ffffff',
            border: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
            borderRadius: '20px',
            padding: '40px 32px',
            textAlign: 'center',
            maxWidth: '450px',
            width: '90%',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.15)',
          }}>
            <div style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', position: 'relative', marginBottom: '24px' }}>
              <svg viewBox="0 0 72 72" style={{ width: "72px", height: "72px" }}>
                <circle cx="36" cy="36" r="28" fill="none" stroke="#12B76A" strokeWidth="4" />
                <path d="M22 37.5 31.5 47 51 25" fill="none" stroke="#12B76A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: isDark ? 'var(--text-primary)' : '#0f1330', margin: '0 0 12px 0' }}>Transaction Added</h2>
            <div style={{ fontSize: '14.5px', color: isDark ? 'var(--text-secondary)' : '#566474', lineHeight: 1.6 }}>
              <strong style={{ display: 'block', color: isDark ? 'var(--text-primary)' : '#0f1330', marginBottom: '8px', fontSize: '15.5px' }}>Transaction successfully recorded.</strong>
              <p style={{ margin: 0 }}>The property ledger has been updated. Returning to transactions...</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (tokenLoaded && !token) {
    return (
      <section className="client-tx-container" style={{ width: '100%', maxWidth: '1280px', margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>
        <div style={{
          background: isDark ? 'var(--surface-1)' : '#ffffff',
          border: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
          borderRadius: '16px',
          padding: '32px',
          textAlign: 'center',
          boxShadow: '0px 1px 3px rgba(16, 24, 40, 0.05)',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: isDark ? 'var(--text-primary)' : '#0f1330', marginBottom: '12px' }}>Sign-in required</h2>
          <p style={{ fontSize: '14px', color: isDark ? 'var(--text-secondary)' : '#566474', margin: 0 }}>Please sign in to add a transaction.</p>
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

  if (selectedMethod === null) {
    return (
      <section className="client-tx-container" style={{ width: '100%', maxWidth: '1280px', margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>
        <div className="client-tx-header-bar">
          <Link href={effectiveBackHref} className="client-tx-back-link">
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "16px", height: "16px", fill: "none", stroke: "currentColor", strokeWidth: 2 }}>
              <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {backLabel}
          </Link>
          <h1 className="client-tx-page-title">Add Transaction</h1>
          <p className="client-tx-page-subtitle">
            Choose how you'd like to add this transaction.
          </p>
        </div>

        <div className="client-tx-methods-grid">
          <button
            type="button"
            className="client-tx-method-card"
            onClick={() => setSelectedMethod("submit_invoice")}
          >
            <div className="client-tx-method-icon-wrap">
              <CameraIcon />
            </div>
            <div className="client-tx-method-content">
              <h3 className="client-tx-method-title">Submit Invoice</h3>
              <p className="client-tx-method-desc">
                Snap a photo or upload a receipt. It goes straight to your accountant to categorise and review — quickest option.
              </p>
            </div>
          </button>

          <button
            type="button"
            className="client-tx-method-card"
            onClick={() => setSelectedMethod("review_submit")}
          >
            <div className="client-tx-method-icon-wrap">
              <ChecklistIcon />
            </div>
            <div className="client-tx-method-content">
              <h3 className="client-tx-method-title">Review & Submit</h3>
              <p className="client-tx-method-desc">
                Fill in entity, property, category, amount and GST yourself before sending — best when you already have the details.
              </p>
            </div>
          </button>
        </div>
      </section>
    );
  }

  if (selectedMethod === "submit_invoice" && isMobile) {
    return (
      <section className="client-tx-container mobile-submit-invoice" style={{
        width: '100%',
        margin: '0 auto',
        fontFamily: "'Inter', sans-serif",
        padding: '0 0 120px 0',
        boxSizing: 'border-box',
        minHeight: '100vh',
        background: isDark ? 'var(--surface-0)' : '#ffffff',
      }}>
        {/* Mobile Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
          background: isDark ? 'var(--surface-1)' : '#ffffff',
          height: '60px',
          boxSizing: 'border-box',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}>
          <button
            type="button"
            onClick={() => {
              if (mobileStep === 1) {
                setSelectedMethod(null);
              } else {
                setMobileStep(1);
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: isDark ? 'var(--accent)' : '#1c2452',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "18px", height: "18px", fill: "none", stroke: "currentColor", strokeWidth: 2.5 }}>
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
          <span style={{
            fontSize: '17px',
            fontWeight: '700',
            color: isDark ? 'var(--text-primary)' : '#0f1330',
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
          }}>
            Add Transaction
          </span>
          <div style={{ width: '48px' }}></div>
        </div>

        {/* Step Banner */}
        <div style={{
          background: isDark ? 'rgba(92, 133, 214, 0.08)' : '#f2f5fa',
          padding: '12px 16px',
          textAlign: 'center',
        }}>
          <span style={{
            fontSize: '13.5px',
            fontWeight: '600',
            color: isDark ? 'var(--text-primary)' : '#1e3a7a',
          }}>
            Enter the below values to complete the step
          </span>
        </div>

        {mobileStep === 1 ? (
          <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Entity Name Dropdown */}
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              <StaticSelect
                label="Entity Name"
                required={true}
                placeholder="e.g., Smith Family Trust, ABC Properties LLC"
                value={activeEntityId}
                options={[
                  { label: "Select Entity", value: "" },
                  ...entities.map((e) => ({ label: e.name, value: e.id })),
                ]}
                onChange={handleEntityPicked}
              />
            </div>

            {/* Select Property Dropdown */}
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              <StaticSelect
                label="Select Property"
                required={true}
                placeholder="Select Type"
                value={propertyId}
                options={[
                  { label: "Select Property", value: "" },
                  ...properties.map((p) => ({ label: p.name, value: p.id })),
                ]}
                onChange={handlePropertyPicked}
                disabled={!activeEntityId}
              />
            </div>

            {/* Fields locked vs Dropzone */}
            {!isSelectionComplete ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '36px 24px',
                background: isDark ? 'var(--surface-2)' : '#f8fafe',
                border: `1px solid ${isDark ? 'var(--border)' : '#e4eefc'}`,
                borderRadius: '16px',
                marginTop: '12px',
                minHeight: '120px',
              }}>
                <span style={{
                  fontSize: '15px',
                  fontWeight: '700',
                  color: isDark ? 'var(--text-secondary)' : '#475467',
                  marginBottom: '6px',
                }}>
                  Fields locked
                </span>
                <span style={{
                  fontSize: '13px',
                  color: isDark ? 'var(--text-muted)' : '#667085',
                  maxWidth: '260px',
                  lineHeight: '1.4',
                }}>
                  Select entity and property above to unlock the transaction fields
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginTop: '12px' }}>
                <span className="client-tx-field-label" style={{
                  fontSize: '13.5px',
                  fontWeight: '600',
                  color: isDark ? 'var(--text-secondary)' : '#344054',
                  marginBottom: '8px',
                }}>
                  Upload Invoice or Receipt
                </span>
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
                  <div className="client-tx-dropzone-wrapper" style={{ width: '100%' }}>
                    <DocumentDropZone
                      token={token}
                      onExtracted={handleExtracted}
                      scope={activeEntityId ? { entityId: activeEntityId } : undefined}
                      isSubmitting={isSubmitting}
                      submitError={submitError && !submitError.toLowerCase().includes("split") ? submitError : ""}
                      primaryLabelText="Upload invoice or receipt"
                      secondaryLabelText="PDF, JPG, PNG max 10 MB"
                      hideIconOnIdle={true}
                      style={{
                        border: `1.5px dashed ${isDark ? 'var(--border)' : '#c4ccd8'}`,
                        background: 'transparent',
                        borderRadius: '12px',
                        padding: '40px 24px',
                        minHeight: '120px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        textAlign: 'center',
                        cursor: 'pointer',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                      strongStyle={{
                        fontSize: '15px',
                        fontWeight: '600',
                        color: isDark ? 'var(--text-primary)' : '#1c2452',
                        margin: '0 0 4px 0',
                        display: 'block',
                      }}
                      smallStyle={{
                        fontSize: '12px',
                        color: isDark ? 'var(--text-muted)' : '#667085',
                        margin: 0,
                        display: 'block',
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Mobile Step 1 Footer */}
            <div className="client-tx-mobile-footer" style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: isDark ? 'var(--surface-1)' : '#ffffff',
              borderTop: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
              padding: '16px 20px calc(16px + env(safe-area-inset-bottom)) 20px',
              zIndex: 100,
              boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.03)',
            }}>
              {!isSelectionComplete ? (
                <button
                  type="button"
                  disabled
                  style={{
                    width: '100%',
                    height: '52px',
                    background: isDark ? 'var(--surface-2)' : '#b0b8c9',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: '700',
                    cursor: 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  Save Transaction
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setMobileStep(2)}
                  style={{
                    width: '100%',
                    height: '52px',
                    background: isDark ? 'var(--accent)' : '#1c2452',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  Continue
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Mobile Step 2: Form Fields & Review */
          <div style={{ padding: '24px 20px 140px 20px' }}>
            <form className="client-tx-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Green document preview banner */}
              {documentId && uploadedFilename && (
                <div style={{
                  background: isDark ? 'rgba(18, 183, 106, 0.08)' : '#E6F4EA',
                  border: `1.5px dashed ${isDark ? '#12B76A' : '#A3E0C1'}`,
                  borderRadius: '16px',
                  padding: '16px 20px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  boxSizing: 'border-box',
                  marginTop: '-4px',
                }}>
                  <span style={{
                    fontSize: '14.5px',
                    fontWeight: '700',
                    color: isDark ? '#82F2B1' : '#1d2452',
                  }}>
                    {uploadedFilename}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDocumentId(null);
                      setUploadedFilename(null);
                      appliedRuleIdRef.current = null;
                      setMobileStep(1); // Go back to step 1 to upload again
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: isDark ? '#82F2B1' : '#566474',
                      fontSize: '12px',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      fontWeight: '500',
                    }}
                  >
                    Replace document
                  </button>
                </div>
              )}

              {/* Transaction Type Pill Toggle */}
              <div style={{
                display: 'flex',
                background: isDark ? 'var(--surface-2)' : '#F2F4F7',
                borderRadius: '12px',
                padding: '4px',
                width: '100%',
                boxSizing: 'border-box',
                height: '48px',
                marginTop: '4px',
              }}>
                <button
                  type="button"
                  onClick={() => setType("expense")}
                  style={{
                    flex: 1,
                    height: '100%',
                    border: 'none',
                    borderRadius: '8px',
                    background: type === "expense" ? (isDark ? 'var(--surface-1)' : '#ffffff') : 'transparent',
                    color: type === "expense" ? (isDark ? 'var(--text-primary)' : '#1c2452') : '#98A2B3',
                    fontSize: '14.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: type === "expense" && !isDark ? '0px 1px 3px rgba(16, 24, 40, 0.1)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setType("revenue")}
                  style={{
                    flex: 1,
                    height: '100%',
                    border: 'none',
                    borderRadius: '8px',
                    background: type === "revenue" ? (isDark ? 'var(--surface-1)' : '#ffffff') : 'transparent',
                    color: type === "revenue" ? (isDark ? 'var(--text-primary)' : '#1c2452') : '#98A2B3',
                    fontSize: '14.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: type === "revenue" && !isDark ? '0px 1px 3px rgba(16, 24, 40, 0.1)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  Income
                </button>
              </div>

              {/* Category and Sub-category */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <StaticSelect
                  label="Category"
                  required={true}
                  placeholder="Select category"
                  value={categoryId == null ? "" : String(categoryId)}
                  options={categorySelectOptions}
                  onChange={(value) => setCategoryId(value ? Number(value) : null)}
                  disabled={lockAssetPurchaseCategory}
                />
                <StaticSelect
                  label="Sub-category"
                  required={true}
                  placeholder="Select sub-category"
                  value={subcategoryId == null ? "" : String(subcategoryId)}
                  options={subcategorySelectOptions}
                  onChange={(value) => setSubcategoryId(value ? Number(value) : null)}
                  disabled={lockAssetPurchaseCategory}
                />
              </div>

              {/* Amount and GST */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label className="client-tx-field-label" style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: isDark ? 'var(--text-secondary)' : '#667085',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                    display: 'inline-block',
                  }}>
                    Amount AUD <em style={{ color: '#da3838', fontStyle: 'normal' }}>*</em>
                  </label>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '14.5px', fontWeight: '600', color: isDark ? 'var(--text-primary)' : '#1d2939' }}>{CURRENCY_PREFIX}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0.01"
                      placeholder="0"
                      value={grossAmount}
                      onKeyDown={preventExponentialAndNegative}
                      onChange={(e) => setGrossAmount(e.target.value.replace(/-/g, ""))}
                      style={{
                        background: isDark ? 'var(--surface-2)' : '#f8f9fb',
                        border: `1px solid ${isDark ? 'var(--border)' : '#d0d5dd'}`,
                        borderRadius: '12px',
                        padding: `14px 16px 14px ${24 + CURRENCY_PREFIX.length * 9}px`,
                        fontSize: '14.5px',
                        fontWeight: '500',
                        color: isDark ? 'var(--text-primary)' : '#1d2939',
                        width: '100%',
                        boxSizing: 'border-box',
                        height: '50px',
                        outline: 'none',
                      }}
                    />
                  </div>
                  {grossAmount && grossAmountError && (
                    <p className="client-tx-field-error" style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4.5px", color: '#da3838', fontSize: '11.5px', fontWeight: '600' }}>
                      <svg style={{ width: '14px', height: '14px', flexShrink: 0 }} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      <span>{grossAmountError}</span>
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label className="client-tx-field-label" style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: isDark ? 'var(--text-secondary)' : '#667085',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                    display: 'inline-block',
                  }}>
                    GST (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="0"
                    value={gstAmount}
                    onChange={(e) => setGstAmount(e.target.value)}
                    style={{
                      background: isDark ? 'var(--surface-2)' : '#f8f9fb',
                      border: `1px solid ${isDark ? 'var(--border)' : '#d0d5dd'}`,
                      borderRadius: '12px',
                      padding: '14px 16px',
                      fontSize: '14.5px',
                      fontWeight: '500',
                      color: isDark ? 'var(--text-primary)' : '#1d2939',
                      width: '100%',
                      boxSizing: 'border-box',
                      height: '50px',
                      outline: 'none',
                    }}
                  />
                  {gstAmount && gstAmountError && (
                    <p className="client-tx-field-error" style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4.5px", color: '#da3838', fontSize: '11.5px', fontWeight: '600' }}>
                      <svg style={{ width: '14px', height: '14px', flexShrink: 0 }} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      <span>{gstAmountError}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Is Split Transaction Toggle */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 0',
                borderTop: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
                borderBottom: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
                marginTop: '8px',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '14.5px', fontWeight: '700', color: isDark ? 'var(--text-primary)' : '#1d2939' }}>Is this a split transaction?</span>
                  <span style={{ fontSize: '12.5px', color: isDark ? 'var(--text-secondary)' : '#667085' }}>Allocate across multiple properties</span>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
                  <input
                    type="checkbox"
                    checked={isSplit}
                    onChange={(e) => handleSplitToggle(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute',
                    cursor: 'pointer',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: isSplit ? (isDark ? 'var(--accent)' : '#1c2452') : (isDark ? 'var(--surface-2)' : '#e2e8f0'),
                    transition: '.3s',
                    borderRadius: '34px',
                  }} />
                  <span style={{
                    position: 'absolute',
                    content: '""',
                    height: '16px',
                    width: '16px',
                    left: isSplit ? '26px' : '4px',
                    bottom: '4px',
                    backgroundColor: 'white',
                    transition: '.3s',
                    borderRadius: '50%',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    pointerEvents: 'none',
                  }} />
                </label>
              </div>

              {/* Split Cards Container */}
              {isSplit && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                  {splitRows.map((row, index) => {
                    const rowError = splitErrors[row.id];
                    const propertyError = (rowError === "Choose a property." || rowError === "Property already used in another split.") ? rowError : undefined;
                    const amountError = rowError === "Enter a positive amount." ? rowError : undefined;

                    return (
                      <div key={row.id} style={{
                        background: isDark ? 'var(--surface-2)' : '#ffffff',
                        border: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
                        borderRadius: '12px',
                        padding: '16px',
                        boxSizing: 'border-box',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}>
                        {/* Split Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: isDark ? 'var(--text-muted)' : '#98a2b3', letterSpacing: '0.5px' }}>
                            PROPERTY {index + 1}
                          </span>
                          <button
                            type="button"
                            disabled={splitRows.length <= 1}
                            onClick={() => removeSplitRow(row.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#BC4A24',
                              fontSize: '12.5px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              padding: 0,
                              opacity: splitRows.length <= 1 ? 0.5 : 1,
                            }}
                          >
                            Remove
                          </button>
                        </div>

                        {/* Dropdown and Amount Input Side-by-Side */}
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', width: '100%' }}>
                          <div style={{ flex: '3', minWidth: 0 }}>
                            <StaticSelect
                              placeholder="Select Property"
                              value={row.propertyId}
                              options={[
                                { label: "Select Property", value: "" },
                                ...properties.map((p) => ({ label: p.name, value: p.id })),
                              ]}
                              onChange={(value) => updateSplitRow(row.id, { propertyId: value })}
                              error={propertyError}
                            />
                          </div>
                          <div style={{ flex: '2', minWidth: 0 }}>
                            <div style={{ position: 'relative', width: '100%' }}>
                              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', fontWeight: '600', color: isDark ? 'var(--text-primary)' : '#1d2939' }}>{CURRENCY_PREFIX}</span>
                              <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0.01"
                                placeholder="0"
                                value={row.amount}
                                onKeyDown={preventExponentialAndNegative}
                                onChange={(e) => updateSplitRow(row.id, { amount: e.target.value.replace(/-/g, "") })}
                                style={{
                                  background: isDark ? 'var(--surface-1)' : '#f8f9fb',
                                  border: `1px solid ${isDark ? 'var(--border)' : '#d0d5dd'}`,
                                  borderRadius: '12px',
                                  padding: `14px 12px 14px ${18 + CURRENCY_PREFIX.length * 8}px`,
                                  fontSize: '14.5px',
                                  fontWeight: '500',
                                  color: isDark ? 'var(--text-primary)' : '#1d2939',
                                  width: '100%',
                                  boxSizing: 'border-box',
                                  height: '50px',
                                  outline: 'none',
                                }}
                              />
                            </div>
                            {amountError && (
                              <p style={{ color: '#da3838', fontSize: '11px', marginTop: '4px', fontWeight: '600' }}>{amountError}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {splitErrors.__form && (
                    <p style={{ color: '#da3838', fontSize: '12px', fontWeight: '600', margin: '4px 0' }}>
                      {splitErrors.__form}
                    </p>
                  )}

                  {/* Allocation Buttons/Labels */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={addSplitRow}
                      disabled={properties.length < 2}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#12b76a',
                        fontSize: '14px',
                        fontWeight: '700',
                        cursor: properties.length < 2 ? 'not-allowed' : 'pointer',
                        padding: 0,
                        textAlign: 'left',
                        alignSelf: 'flex-start',
                      }}
                    >
                      + Add property
                    </button>

                    {/* Summary Allocations Banner */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: isDark ? 'var(--surface-2)' : '#F0F4FA',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}>
                      <span style={{ fontSize: '13px', color: isDark ? 'var(--text-secondary)' : '#667085', fontWeight: '500' }}>
                        Total allocated
                      </span>
                      <span style={{ fontSize: '14.5px', color: isDark ? 'var(--text-primary)' : '#1c2452', fontWeight: '700' }}>
                        {CURRENCY_PREFIX}{splitTotal.toFixed(2)} / {CURRENCY_PREFIX}{Number(grossAmount || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Invoice Date and Mode of Transaction */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label className="client-tx-field-label" style={{ fontSize: '13.5px', fontWeight: '600', color: isDark ? 'var(--text-secondary)' : '#344054', marginBottom: '8px' }}>
                    Invoice Date <em style={{ color: '#da3838', fontStyle: 'normal' }}>*</em>
                  </label>
                  <input
                    type="date"
                    min="1900-01-01"
                    max="9999-12-31"
                    value={invoiceDate}
                    onChange={(e) => {
                      setInvoiceDate(e.target.value);
                      setInvoiceDateTouched(true);
                    }}
                    style={{
                      background: isDark ? 'var(--surface-2)' : '#f8f9fb',
                      border: `1px solid ${isDark ? 'var(--border)' : '#d0d5dd'}`,
                      borderRadius: '12px',
                      padding: '14px 16px',
                      fontSize: '14.5px',
                      fontWeight: '500',
                      color: isDark ? 'var(--text-primary)' : '#1d2939',
                      width: '100%',
                      boxSizing: 'border-box',
                      height: '50px',
                      outline: 'none',
                    }}
                  />
                  {showDateError && invoiceDateError && (
                    <p className="client-tx-field-error" style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4.5px", color: '#da3838', fontSize: '11.5px', fontWeight: '600' }}>
                      <svg style={{ width: '14px', height: '14px', flexShrink: 0 }} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      <span>{invoiceDateError}</span>
                    </p>
                  )}
                </div>

                <StaticSelect
                  label="Mode of Transaction"
                  required
                  placeholder="Select mode of transaction"
                  value={modeOfTransaction}
                  options={MODE_OF_TRANSACTION_OPTIONS}
                  onChange={setModeOfTransaction}
                />
              </div>

              {/* Description */}
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <label className="client-tx-field-label" style={{ fontSize: '13.5px', fontWeight: '600', color: isDark ? 'var(--text-secondary)' : '#344054', marginBottom: '8px' }}>Description</label>
                <textarea
                  placeholder="Add remarks...."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    background: isDark ? 'var(--surface-2)' : '#f8f9fb',
                    border: `1px solid ${isDark ? 'var(--border)' : '#d0d5dd'}`,
                    borderRadius: '12px',
                    padding: '14px 16px',
                    fontSize: '14.5px',
                    fontWeight: '500',
                    color: isDark ? 'var(--text-primary)' : '#1d2939',
                    width: '100%',
                    boxSizing: 'border-box',
                    outline: 'none',
                    minHeight: '100px',
                    resize: 'vertical',
                  }}
                />
              </div>

              {submitError && (
                <p style={{ color: '#da3838', fontSize: '13px', fontWeight: '600', margin: '8px 0' }}>
                  {submitError}
                </p>
              )}

              {/* Mobile Step 2 Footer */}
              <div className="client-tx-mobile-footer" style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                background: isDark ? 'var(--surface-1)' : '#ffffff',
                borderTop: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
                padding: '16px 20px calc(16px + env(safe-area-inset-bottom)) 20px',
                zIndex: 100,
                boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.03)',
              }}>
                <button
                  type="submit"
                  disabled={!canSubmit || isSubmitting}
                  style={{
                    width: '100%',
                    height: '52px',
                    background: isDark ? 'var(--accent)' : '#1c2452',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: '700',
                    cursor: (!canSubmit || isSubmitting) ? 'not-allowed' : 'pointer',
                    opacity: (!canSubmit || isSubmitting) ? 0.65 : 1,
                  }}
                >
                  {isSubmitting ? "Saving Transaction..." : "Save Transaction"}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={`client-tx-container${isMobile ? ' mobile-submit-invoice' : ''}`} style={{
      width: '100%',
      maxWidth: '1280px',
      margin: '0 auto',
      fontFamily: "'Inter', sans-serif",
      background: isDark ? 'var(--surface-0)' : '#ffffff',
    }}>
      {isMobile ? (
        <>
          {/* Mobile Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
            background: isDark ? 'var(--surface-1)' : '#ffffff',
            height: '60px',
            boxSizing: 'border-box',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}>
            <button
              type="button"
              onClick={() => setSelectedMethod(null)}
              style={{
                background: 'none',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: isDark ? 'var(--accent)' : '#1c2452',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "18px", height: "18px", fill: "none", stroke: "currentColor", strokeWidth: 2.5 }}>
                <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </button>
            <span style={{
              fontSize: '17px',
              fontWeight: '700',
              color: isDark ? 'var(--text-primary)' : '#0f1330',
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
            }}>
              Add Transaction
            </span>
            <div style={{ width: '48px' }}></div>
          </div>

          {/* Step Banner */}
          <div style={{
            background: isDark ? 'rgba(92, 133, 214, 0.08)' : '#f2f5fa',
            padding: '12px 16px',
            textAlign: 'center',
            marginBottom: '20px',
          }}>
            <span style={{
              fontSize: '13.5px',
              fontWeight: '600',
              color: isDark ? 'var(--text-primary)' : '#1e3a7a',
            }}>
              Enter the below values to complete the step
            </span>
          </div>
        </>
      ) : (
        <div className="client-tx-header-bar">
          <button
            type="button"
            className="client-tx-back-link"
            onClick={() => setSelectedMethod(null)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "16px", height: "16px", fill: "none", stroke: "currentColor", strokeWidth: 2 }}>
              <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
          <h1 className="client-tx-page-title">Add Transaction</h1>
        </div>
      )}

      <div className="client-tx-card" style={{
        background: isDark ? 'var(--surface-1)' : '#ffffff',
        border: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
        borderRadius: '16px',
        padding: isMobile ? '24px 20px' : '36px 40px',
        boxShadow: '0px 1px 3px rgba(16, 24, 40, 0.05)',
      }}>
        <h2 className="client-tx-title" style={{ fontSize: '18px', fontWeight: '600', color: isDark ? 'var(--text-primary)' : '#1d2452', margin: '0 0 24px 0' }}>Transaction Information</h2>
        <form className="client-tx-form" onSubmit={handleSubmit}>

          {showSelectionMessage && selectionMessage && (
            <div className="client-tx-banner-error" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", color: '#da3838', fontSize: '13px', fontWeight: '600' }}>
              <svg style={{ width: '20px', height: '20px', flexShrink: 0 }} viewBox="0 0 20 20" fill="currentColor">
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
          <div className="client-tx-field-group" style={{ display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box', marginBottom: "24px" }}>
            <span className="client-tx-field-label" style={{ fontSize: '13px', fontWeight: '500', color: isDark ? 'var(--text-secondary)' : '#344054', marginBottom: '6px', display: 'inline-block' }}>Upload Invoice or Receipt</span>
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
              <div className="client-tx-dropzone-wrapper" style={{ width: '100%' }}>
                <DocumentDropZone
                  token={token}
                  onExtracted={handleExtracted}
                  scope={activeEntityId ? { entityId: activeEntityId } : undefined}
                  isSubmitting={isSubmitting}
                  submitError={submitError && !submitError.toLowerCase().includes("split") ? submitError : ""}
                  primaryLabelText="Upload invoice or receipt"
                  secondaryLabelText="PDF, JPG, PNG · Max 10 MB"
                  hideIconOnIdle={true}
                  style={{
                    border: '1.5px dashed #c4ccd8',
                    background: 'transparent',
                    borderRadius: '12px',
                    padding: '40px 24px',
                    minHeight: '120px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                    cursor: 'pointer',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                  strongStyle={{
                    fontSize: '15px',
                    fontWeight: '500',
                    color: isDark ? 'var(--text-primary)' : '#344054',
                    margin: '0 0 4px 0',
                    display: 'block',
                  }}
                  smallStyle={{
                    fontSize: '12px',
                    color: isDark ? 'var(--text-muted)' : '#667085',
                    margin: 0,
                    display: 'block',
                  }}
                />
              </div>
            )}
          </div>

          <fieldset className="client-tx-fieldset" disabled={!isSelectionComplete} style={{ border: 'none', padding: 0, margin: 0 }}>

            {/* Transaction Type */}
            <div className="client-tx-field-group" style={{ display: 'flex', flexDirection: 'column', width: '100%', marginBottom: '20px' }}>
              <label className="client-tx-field-label" style={{ fontSize: '13px', fontWeight: '500', color: isDark ? 'var(--text-secondary)' : '#344054', marginBottom: '6px', display: 'inline-block' }}>
                Transaction Type
                <em
                  className="client-tx-required"
                  style={{
                    color: '#da3838',
                    fontStyle: 'normal',
                    marginLeft: '3px',
                  }}
                >
                  *
                </em>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', width: '100%' }}>
                <button
                  type="button"
                  onClick={() => setType("expense")}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '52px',
                    borderRadius: '12px',
                    border: type === "expense"
                      ? `1.5px solid ${isDark ? 'var(--brand)' : '#1a2b56'}`
                      : `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
                    background: isDark
                      ? (type === "expense" ? 'rgba(92, 133, 214, 0.1)' : 'var(--surface-2)')
                      : '#ffffff',
                    color: type === "expense"
                      ? (isDark ? 'var(--text-primary)' : '#1a2b56')
                      : (isDark ? 'var(--text-secondary)' : '#566474'),
                    fontSize: '14.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: type === "expense"
                      ? (isDark ? '0 0 0 3px rgba(92, 133, 214, 0.25)' : '0 0 0 3px rgba(26, 43, 86, 0.15)')
                      : 'none',
                  }}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setType("revenue")}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '52px',
                    borderRadius: '12px',
                    border: type === "revenue"
                      ? `1.5px solid ${isDark ? 'var(--brand)' : '#1a2b56'}`
                      : `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
                    background: isDark
                      ? (type === "revenue" ? 'rgba(92, 133, 214, 0.1)' : 'var(--surface-2)')
                      : '#ffffff',
                    color: type === "revenue"
                      ? (isDark ? 'var(--text-primary)' : '#1a2b56')
                      : (isDark ? 'var(--text-secondary)' : '#566474'),
                    fontSize: '14.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: type === "revenue"
                      ? (isDark ? '0 0 0 3px rgba(92, 133, 214, 0.25)' : '0 0 0 3px rgba(26, 43, 86, 0.15)')
                      : 'none',
                  }}
                >
                  Revenue
                </button>
              </div>
            </div>

            {/* Category and Sub-category */}
            <div className="client-tx-grid cols-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginTop: '16px' }}>
              <div className="client-tx-field-group" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <StaticSelect
                  label="Category"
                  required={true}
                  placeholder="Select category"
                  value={categoryId == null ? "" : String(categoryId)}
                  options={categorySelectOptions}
                  onChange={(value) => setCategoryId(value ? Number(value) : null)}
                  disabled={lockAssetPurchaseCategory}
                />
              </div>

              <div className="client-tx-field-group" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <StaticSelect
                  label="Sub-category"
                  required={true}
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
            <div className="client-tx-grid cols-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginTop: '20px' }}>
              <div className={`client-tx-field-group ${flashClass("grossAmount")}`} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <label className="client-tx-field-label" style={{ fontSize: '13px', fontWeight: '500', color: isDark ? 'var(--text-secondary)' : '#344054', marginBottom: '6px', display: 'inline-block' }}>
                  Amount
                  <em className="client-tx-required" style={{ color: '#da3838', fontStyle: 'normal', marginLeft: '3px' }}>*</em>
                </label>
                <div className="client-tx-amount-input-wrap" style={{ position: 'relative', width: '100%' }}>
                  <span className="client-tx-amount-prefix" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '14.5px', fontWeight: '600', color: isDark ? 'var(--text-primary)' : '#1d2939', pointerEvents: 'none' }}>{CURRENCY_PREFIX}</span>
                  <input
                    type="number"
                    className="client-tx-input has-prefix"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    placeholder="0"
                    value={grossAmount}
                    onKeyDown={preventExponentialAndNegative}
                    onChange={(e) => {
                      const val = e.target.value.replace(/-/g, "");
                      setGrossAmount(val);
                    }}
                    style={{
                      background: isDark ? 'var(--surface-2)' : '#f8f9fb',
                      border: `1px solid ${isDark ? 'var(--border)' : '#d0d5dd'}`,
                      borderRadius: '12px',
                      padding: `14px 16px 14px ${24 + CURRENCY_PREFIX.length * 9}px`,
                      ['--prefix-padding' as any]: `${24 + CURRENCY_PREFIX.length * 9}px`,
                      fontSize: '14.5px',
                      fontWeight: '500',
                      color: isDark ? 'var(--text-primary)' : '#1d2939',
                      width: '100%',
                      boxSizing: 'border-box',
                      outline: 'none',
                      height: '50px',
                    }}
                  />
                </div>
                {grossAmount && grossAmountError && (
                  <p className="client-tx-field-error" style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4.5px", color: '#da3838', fontSize: '11.5px', fontWeight: '600' }}>
                    <svg style={{ width: '14px', height: '14px', flexShrink: 0 }} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <span>{grossAmountError}</span>
                  </p>
                )}
              </div>

              <div className={`client-tx-field-group ${flashClass("gstAmount")}`} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <label className="client-tx-field-label" style={{ fontSize: '13px', fontWeight: '500', color: isDark ? 'var(--text-secondary)' : '#344054', marginBottom: '6px', display: 'inline-block' }}>GST (Optional)</label>
                <div className="client-tx-amount-input-wrap no-prefix" style={{ position: 'relative', width: '100%' }}>
                  <input
                    type="text"
                    className="client-tx-input"
                    placeholder="0"
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
                    style={{
                      background: isDark ? 'var(--surface-2)' : '#f8f9fb',
                      border: `1px solid ${isDark ? 'var(--border)' : '#d0d5dd'}`,
                      borderRadius: '12px',
                      padding: '14px 16px',
                      fontSize: '14.5px',
                      fontWeight: '500',
                      color: isDark ? 'var(--text-primary)' : '#1d2939',
                      width: '100%',
                      boxSizing: 'border-box',
                      outline: 'none',
                      height: '50px',
                    }}
                  />
                </div>
                {gstAmount && gstAmountError && (
                  <p className="client-tx-field-error" style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4.5px", color: '#da3838', fontSize: '11.5px', fontWeight: '600' }}>
                    <svg style={{ width: '14px', height: '14px', flexShrink: 0 }} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <span>{gstAmountError}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Invoice Date and Mode of Transaction */}
            <div className="client-tx-grid cols-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginTop: '20px' }}>
              <div className={`client-tx-field-group ${flashClass("invoiceDate")}`} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <label className="client-tx-field-label" style={{ fontSize: '13px', fontWeight: '500', color: isDark ? 'var(--text-secondary)' : '#344054', marginBottom: '6px', display: 'inline-block' }}>
                  Invoice Date
                  <em className="client-tx-required" style={{ color: '#da3838', fontStyle: 'normal', marginLeft: '3px' }}>*</em>
                </label>
                <input
                  type="date"
                  min="1900-01-01"
                  max="9999-12-31"
                  value={invoiceDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    const yearPart = val.split("-")[0];
                    if (yearPart && yearPart.length > 4) {
                      return;
                    }
                    setInvoiceDate(val);
                    setInvoiceDateTouched(true);
                    setSubmitError("");
                  }}
                  onBlur={() => setInvoiceDateTouched(true)}
                  style={{
                    background: isDark ? 'var(--surface-2)' : '#f8f9fb',
                    border: `1px solid ${isDark ? 'var(--border)' : '#d0d5dd'}`,
                    borderRadius: '12px',
                    padding: '14px 16px',
                    fontSize: '14.5px',
                    fontWeight: '500',
                    color: isDark ? 'var(--text-primary)' : '#1d2939',
                    width: '100%',
                    boxSizing: 'border-box',
                    outline: 'none',
                    height: '50px',
                  }}
                />
                {showDateError && invoiceDateError && (
                  <p className="client-tx-field-error" style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4.5px", color: '#da3838', fontSize: '11.5px', fontWeight: '600' }}>
                    <svg style={{ width: '14px', height: '14px', flexShrink: 0 }} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <span>{invoiceDateError}</span>
                  </p>
                )}
              </div>

              <div className="client-tx-field-group" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <StaticSelect
                  label="Mode of Transaction"
                  required
                  placeholder="Select mode of transaction"
                  value={modeOfTransaction}
                  options={MODE_OF_TRANSACTION_OPTIONS}
                  onChange={(value) => {
                    setModeOfTransaction(value);
                    setSubmitError("");
                  }}
                />
              </div>
            </div>

            {/* Split Toggle Switch */}
            <div className="client-tx-split-toggle-container" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px 0',
              margin: '12px 0 20px 0',
              borderTop: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
            }}>
              <div className="client-tx-split-toggle-info" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span className="client-tx-split-toggle-title" style={{ fontSize: '14.5px', fontWeight: '700', color: isDark ? 'var(--text-primary)' : '#1d2939' }}>Is this a split transaction?</span>
                <span className="client-tx-split-toggle-desc" style={{ fontSize: '12.5px', color: isDark ? 'var(--text-secondary)' : '#667085' }}>Allocate across multiple properties</span>
              </div>
              <label className="client-tx-switch" style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
                <input
                  type="checkbox"
                  checked={isSplit}
                  onChange={(e) => handleSplitToggle(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span className="client-tx-slider" style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: isSplit ? (isDark ? 'var(--accent)' : '#1d2452') : (isDark ? 'var(--surface-2)' : '#e2e8f0'),
                  transition: '.3s',
                  borderRadius: '34px',
                }} />
                <span style={{
                  position: 'absolute',
                  content: '""',
                  height: '16px',
                  width: '16px',
                  left: isSplit ? '26px' : '4px',
                  bottom: '4px',
                  backgroundColor: 'white',
                  transition: '.3s',
                  borderRadius: '50%',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  pointerEvents: 'none',
                }} />
              </label>
            </div>

            {!isSplit && submitError && submitError.toLowerCase().includes("split") && (
              <p className="client-tx-warning-banner" role="alert" style={{ color: '#da3838', fontSize: '13px', fontWeight: '600', margin: '8px 0' }}>
                {submitError}
              </p>
            )}

            {/* Split Rows Cards */}
            {isSplit && (
              <div className="client-tx-split-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px', width: '100%' }}>
                {splitRows.map((row, index) => {
                  const rowError = splitErrors[row.id];
                  const propertyError = (rowError === "Choose a property." || rowError === "Property already used in another split.") ? rowError : undefined;
                  const amountError = rowError === "Enter a positive amount." ? rowError : undefined;

                  return (
                    <div key={row.id} className="client-tx-split-card" style={{
                      background: isDark ? 'var(--surface-2)' : '#ffffff',
                      border: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
                      borderRadius: '12px',
                      padding: '20px',
                      boxSizing: 'border-box',
                    }}>
                      <div className="client-tx-split-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span className="client-tx-split-card-title" style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '0.8px', color: isDark ? 'var(--text-muted)' : '#667085' }}>PROPERTY {index + 1}</span>
                        <button
                          type="button"
                          className="client-tx-split-remove-btn"
                          disabled={splitRows.length <= 1}
                          onClick={() => removeSplitRow(row.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: isDark ? 'var(--danger)' : '#da3838',
                            fontSize: '12.5px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            padding: '2px 6px',
                          }}
                        >
                          Remove
                        </button>
                      </div>

                      <div className="client-tx-grid cols-split-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '4px' }}>
                        <div className="client-tx-field-group flex-2" style={{ display: 'flex', flexDirection: 'column' }}>
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

                        <div className="client-tx-field-group flex-1" style={{ display: 'flex', flexDirection: 'column' }}>
                          <div className="client-tx-amount-input-wrap" style={{ position: 'relative', width: '100%' }}>
                            <span className="client-tx-amount-prefix" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '14.5px', fontWeight: '600', color: isDark ? 'var(--text-primary)' : '#1d2939', pointerEvents: 'none' }}>{CURRENCY_PREFIX}</span>
                            <input
                              type="number"
                              className="client-tx-input has-prefix"
                              inputMode="decimal"
                              step="0.01"
                              min="0.01"
                              placeholder="00"
                              value={row.amount}
                              onKeyDown={preventExponentialAndNegative}
                              onChange={(e) => {
                                const val = e.target.value.replace(/-/g, "");
                                updateSplitRow(row.id, { amount: val });
                              }}
                              style={{
                                background: isDark ? 'var(--surface-1)' : '#f8f9fb',
                                border: `1px solid ${isDark ? 'var(--border)' : '#d0d5dd'}`,
                                borderRadius: '12px',
                                padding: `14px 16px 14px ${24 + CURRENCY_PREFIX.length * 9}px`,
                                ['--prefix-padding' as any]: `${24 + CURRENCY_PREFIX.length * 9}px`,
                                fontSize: '14.5px',
                                fontWeight: '500',
                                color: isDark ? 'var(--text-primary)' : '#1d2939',
                                width: '100%',
                                boxSizing: 'border-box',
                                outline: 'none',
                                height: '50px',
                              }}
                            />
                          </div>
                          {amountError && (
                            <p className="client-tx-field-error" style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4.5px", color: '#da3838', fontSize: '11.5px', fontWeight: '600' }}>
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
                  <p className="client-tx-field-error" style={{ display: "flex", alignItems: "center", gap: "6px", margin: "8px 0", color: '#da3838', fontSize: '11.5px', fontWeight: '600' }}>
                    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <span>{splitErrors.__form}</span>
                  </p>
                )}

                <div className="client-tx-split-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', gap: '16px' }}>
                  <span className={`client-tx-split-total-label ${grossAmount && !splitMatches ? "is-mismatch" : ""}`} style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: grossAmount && !splitMatches ? '#da3838' : (isDark ? 'var(--text-secondary)' : '#566474'),
                  }}>
                    {grossAmount && !Number.isNaN(grossNumberValue)
                      ? `Split total: ${splitTotal.toFixed(2)} of ${grossNumberValue.toFixed(2)}`
                      : "Enter the total amount above to validate splits."}
                  </span>
                  <button
                    type="button"
                    className="client-tx-add-split-btn"
                    onClick={addSplitRow}
                    disabled={properties.length < 2}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: isDark ? 'var(--accent)' : '#1d2452',
                      fontSize: '13.5px',
                      fontWeight: '700',
                      cursor: properties.length < 2 ? 'not-allowed' : 'pointer',
                      padding: '4px 8px',
                    }}
                  >
                    + Add Property
                  </button>
                </div>
              </div>
            )}

            {isSplit && submitError && submitError.toLowerCase().includes("split") && (
              <p className="client-tx-warning-banner" role="alert" style={{ color: '#da3838', fontSize: '13px', fontWeight: '600', marginTop: "12px", marginBottom: "12px" }}>
                {submitError}
              </p>
            )}

            {/* Description */}
            <div className="client-tx-field-group" style={{ display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box', marginTop: "16px" }}>
              <label className="client-tx-field-label" style={{ fontSize: '13px', fontWeight: '500', color: isDark ? 'var(--text-secondary)' : '#344054', marginBottom: '6px', display: 'inline-block' }}>Description</label>
              <textarea
                className="client-tx-textarea"
                placeholder="Add remarks..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  background: isDark ? 'var(--surface-2)' : '#f8f9fb',
                  border: `1px solid ${isDark ? 'var(--border)' : '#d0d5dd'}`,
                  borderRadius: '12px',
                  padding: '14px 16px',
                  fontSize: '14.5px',
                  fontWeight: '500',
                  color: isDark ? 'var(--text-primary)' : '#1d2939',
                  width: '100%',
                  boxSizing: 'border-box',
                  outline: 'none',
                  minHeight: '120px',
                  resize: 'vertical',
                  lineHeight: '1.5',
                }}
              />
            </div>

            {submitError && !submitError.toLowerCase().includes("split") && (
              <p className="client-tx-warning-banner" role="alert" style={{ color: '#da3838', fontSize: '13px', fontWeight: '600', marginTop: "16px" }}>
                {submitError}
              </p>
            )}

            {/* Save / Delete Actions */}
            <div className="client-tx-form-actions" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '32px',
              gap: '16px',
              paddingTop: '24px',
              borderTop: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
              width: '100%',
              boxSizing: 'border-box',
            }}>
              {!isMobile && (
                <Link href={effectiveBackHref} className="client-tx-delete-btn" style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isDark ? 'var(--surface-2)' : '#f2f4f7',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px 24px',
                  fontSize: '14.5px',
                  fontWeight: '700',
                  color: isDark ? 'var(--danger)' : '#da3838',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  height: '50px',
                  boxSizing: 'border-box',
                }}>
                  Delete Transaction
                </Link>
              )}
              <button
                type="submit"
                className="client-tx-save-btn"
                disabled={!canSubmit || isSubmitting}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isDark ? 'var(--brand)' : '#1d2452',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px 24px',
                  fontSize: '14.5px',
                  fontWeight: '700',
                  color: '#ffffff',
                  cursor: (!canSubmit || isSubmitting) ? 'not-allowed' : 'pointer',
                  height: '50px',
                  boxSizing: 'border-box',
                  opacity: (!canSubmit || isSubmitting) ? 0.65 : 1,
                }}
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

  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";

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
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: isDark ? 'rgba(15, 19, 48, 0.8)' : 'rgba(29, 36, 82, 0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
    }} role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close bulk import"
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
      />
      <section style={{
        background: isDark ? 'var(--surface-1)' : '#ffffff',
        border: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
        borderRadius: '20px',
        maxWidth: '550px',
        width: '90%',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.15)',
        zIndex: 10000,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }} onClick={(e) => e.stopPropagation()}>
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '24px 32px',
          borderBottom: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
        }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: isDark ? 'var(--text-primary)' : '#0f1330', margin: 0 }}>Bulk Import from CSV</h2>
            <p style={{ fontSize: '13px', color: isDark ? 'var(--text-secondary)' : '#566474', margin: '4px 0 0 0' }}>Upload multiple transactions at once</p>
          </div>
          <button type="button" aria-label="Close bulk import" onClick={onClose} style={{
            background: 'none',
            border: 'none',
            color: isDark ? 'var(--text-secondary)' : '#566474',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <CloseIcon />
          </button>
        </header>

        <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

          <div className="client-tx-field-group" style={{ display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box', marginTop: "16px" }}>
            <span className="client-tx-field-label" style={{ fontSize: '13px', fontWeight: '500', color: isDark ? 'var(--text-secondary)' : '#344054', marginBottom: '6px', display: 'inline-block' }}>CSV File</span>
            <input type="file" accept=".csv" onChange={handleFileChange} style={{
              background: isDark ? 'var(--surface-2)' : '#f8f9fb',
              border: `1px solid ${isDark ? 'var(--border)' : '#d0d5dd'}`,
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '14px',
              color: isDark ? 'var(--text-primary)' : '#1d2939',
              width: '100%',
              boxSizing: 'border-box',
              outline: 'none',
            }} />
          </div>

          {errorMsg && <p style={{ color: '#da3838', fontSize: '12px', fontWeight: '600', margin: '8px 0 0 0' }}>{errorMsg}</p>}
        </div>

        <footer style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '12px',
          padding: '24px 32px',
          background: isDark ? 'var(--surface-2)' : '#f8f9fb',
          borderTop: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
        }}>
          <button type="button" onClick={onClose} disabled={isLoading} style={{
            background: 'transparent',
            border: 'none',
            color: isDark ? 'var(--danger)' : '#da3838',
            fontSize: '14.5px',
            fontWeight: '700',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            padding: '10px 16px',
          }}>
            Cancel
          </button>
          <button type="button" onClick={handleImport} disabled={isLoading} style={{
            background: isDark ? 'var(--brand)' : '#1d2452',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 24px',
            fontSize: '14.5px',
            fontWeight: '700',
            color: '#ffffff',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.65 : 1,
          }}>
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
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: isDark ? 'rgba(15, 19, 48, 0.8)' : 'rgba(29, 36, 82, 0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
    }} role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close message"
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
      />
      <section style={{
        background: isDark ? 'var(--surface-1)' : '#ffffff',
        border: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
        borderRadius: '20px',
        padding: '40px 32px',
        textAlign: 'center',
        maxWidth: '450px',
        width: '90%',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.15)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: tone === "success" ? 'rgba(18, 183, 106, 0.1)' : 'rgba(240, 149, 149, 0.15)',
          color: tone === "success" ? '#12B76A' : '#da3838',
          marginBottom: '20px',
        }} aria-hidden="true">
          {tone === "success" ? (
            <svg viewBox="0 0 24 24" style={{ width: "28px", height: "28px", fill: "none", stroke: "currentColor", strokeWidth: 2.5 }}>
              <path d="M5 12l4 4 10-10" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" style={{ width: "28px", height: "28px", fill: "none", stroke: "currentColor", strokeWidth: 2.5 }}>
              <path d="M12 8v5" />
              <path d="M12 17h.01" />
              <path d="M10.3 4.3 2.8 17.2A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.8L13.7 4.3a2 2 0 0 0-3.4 0z" />
            </svg>
          )}
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: isDark ? 'var(--text-primary)' : '#0f1330', margin: '0 0 8px 0' }}>{title}</h2>
        <p style={{ fontSize: '14.5px', color: isDark ? 'var(--text-secondary)' : '#566474', margin: '0 0 24px 0', lineHeight: 1.5 }}>{message}</p>
        <button type="button" onClick={onClose} style={{
          width: '100%',
          background: isDark ? 'var(--brand)' : '#1d2452',
          border: 'none',
          borderRadius: '12px',
          padding: '14px 24px',
          fontSize: '14.5px',
          fontWeight: '700',
          color: '#ffffff',
          cursor: 'pointer',
        }}>
          Continue
        </button>
      </section>
    </div>
  );
}
