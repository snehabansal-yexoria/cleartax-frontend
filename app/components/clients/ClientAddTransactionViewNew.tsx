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

interface PropertyWithEntity {
  id: string;
  name: string;
  entityId: string;
  entityName: string;
}

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
            background: isDark ? 'var(--surface-2)' : '#ffffff',
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

function PropertyIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={{ width: '16px', height: '16px', flexShrink: 0, opacity: 0.8, ...style }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

type PropertySelectProps = {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  error?: string;
};

function PropertySelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Select Property",
  required,
  className = "",
  triggerClassName = "",
  disabled = false,
  error,
}: PropertySelectProps) {
  const reactId = useId();
  const dropdownId = `client-tx-property-select-${reactId}`;
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isMobileScreen, setIsMobileScreen] = useState(false);

  const selectRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsListRef = useRef<HTMLDivElement>(null);

  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    setIsMobileScreen(window.innerWidth < 768);
    function handleResize() {
      setIsMobileScreen(window.innerWidth < 768);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isDark = mounted && theme === "dark";

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    return options.filter((option) =>
      option.value !== "" && option.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [options, searchQuery]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (!isMobileScreen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen, isMobileScreen]);

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
      setSearchQuery("");
      setHighlightedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 80);
    }
  }, [dropdownId, isOpen]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions]);

  useEffect(() => {
    if (!isOpen || !optionsListRef.current || isMobileScreen) return;
    const activeEl = optionsListRef.current.children[highlightedIndex] as HTMLElement;
    if (activeEl) {
      const container = optionsListRef.current;
      const scrollBottom = container.clientHeight + container.scrollTop;
      const elementBottom = activeEl.offsetTop + activeEl.clientHeight;
      if (elementBottom > scrollBottom) {
        container.scrollTop = elementBottom - container.clientHeight;
      } else if (activeEl.offsetTop < container.scrollTop) {
        container.scrollTop = activeEl.offsetTop;
      }
    }
  }, [highlightedIndex, isOpen, isMobileScreen]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!isMobileScreen) {
          setHighlightedIndex((prev) => (filteredOptions.length > 0 ? (prev + 1) % filteredOptions.length : 0));
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!isMobileScreen) {
          setHighlightedIndex((prev) => (filteredOptions.length > 0 ? (prev - 1 + filteredOptions.length) % filteredOptions.length : 0));
        }
        break;
      case "Enter":
        e.preventDefault();
        if (!isMobileScreen && filteredOptions[highlightedIndex]) {
          onChange(filteredOptions[highlightedIndex].value);
          setIsOpen(false);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
      case "Tab":
        setIsOpen(false);
        break;
    }
  }

  const selected = options.find((option) => option.value === value);
  const totalPropertiesCount = options.filter(o => o.value !== "").length;

  return (
    <div
      ref={selectRef}
      className={`client-tx-field-wrapper ${className}`}
      style={{
        display: "flex",
        flexDirection: "column",
        minWidth: '200px',
        position: 'relative',
      }}
      onKeyDown={handleKeyDown}
    >
      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
      {label && (
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
        className={`client-tx-select${isOpen ? " is-open" : ""}${disabled ? " is-disabled" : ""}`}
        style={{ position: 'relative', width: '100%' }}
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
            background: isDark ? 'var(--surface-2)' : '#ffffff',
            border: `1px solid ${isOpen ? (isDark ? 'var(--accent)' : '#1c2452') : (isDark ? 'var(--border)' : '#d0d5dd')}`,
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
            transition: 'all 0.2s ease',
            boxShadow: isOpen ? `0 0 0 3px ${isDark ? 'rgba(244, 161, 23, 0.15)' : 'rgba(28, 36, 82, 0.08)'}` : 'none',
          }}
          onClick={() => {
            if (!disabled) {
              setIsOpen((current) => !current);
            }
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <PropertyIcon style={{ color: selected?.value ? (isDark ? 'var(--accent)' : '#1c2452') : (isDark ? 'var(--text-muted)' : '#667085') }} />
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: selected?.value ? (isDark ? 'var(--text-primary)' : '#1d2939') : (isDark ? 'var(--text-muted)' : '#667085')
            }}>
              {selected?.value ? selected.label : placeholder}
            </span>
          </div>
          <ChevronIcon />
        </button>

        {isOpen && !disabled && !isMobileScreen && (
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
              display: 'flex',
              flexDirection: 'column',
              padding: '6px',
              overflow: 'hidden',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              borderBottom: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
              marginBottom: '4px',
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: '15px', height: '15px', color: isDark ? 'var(--text-muted)' : '#667085', flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search property..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: '13.5px',
                  color: 'var(--text-primary)',
                  padding: 0,
                }}
              />
              <span style={{
                fontSize: '11px',
                fontWeight: '600',
                background: isDark ? 'var(--surface-2)' : '#f2f4f7',
                color: isDark ? 'var(--text-secondary)' : '#475467',
                padding: '2px 6px',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
              }}>
                {filteredOptions.length}
              </span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery("");
                    searchInputRef.current?.focus();
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '2px',
                    cursor: 'pointer',
                    color: isDark ? 'var(--text-muted)' : '#667085',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CloseIcon />
                </button>
              )}
            </div>

            <div
              ref={optionsListRef}
              style={{
                maxHeight: '200px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              {filteredOptions.length === 0 ? (
                <div style={{
                  padding: '16px',
                  textAlign: 'center',
                  fontSize: '13px',
                  color: isDark ? 'var(--text-muted)' : '#667085',
                }}>
                  No properties found
                </div>
              ) : (
                filteredOptions.map((option, index) => {
                  const isSelected = value === option.value;
                  const isHighlighted = highlightedIndex === index;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '10px 12px',
                        background: isSelected
                          ? (isDark ? 'rgba(244, 161, 23, 0.15)' : 'rgba(28, 36, 82, 0.08)')
                          : isHighlighted
                            ? (isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8f9fb')
                            : 'transparent',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: isSelected ? '600' : '500',
                        color: isSelected
                          ? (isDark ? 'var(--accent)' : '#1c2452')
                          : (isDark ? 'var(--text-primary)' : '#1d2939'),
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background-color 0.15s, color 0.15s',
                        outline: 'none',
                      }}
                      onClick={() => {
                        onChange(option.value);
                        setIsOpen(false);
                      }}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                        <PropertyIcon style={{
                          color: isSelected
                            ? (isDark ? 'var(--accent)' : '#1c2452')
                            : (isDark ? 'var(--text-muted)' : '#98a2b3'),
                          opacity: isSelected ? 1 : 0.7
                        }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {option.label}
                        </span>
                      </div>
                      {isSelected && (
                        <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '16px', height: '16px', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, color: isDark ? 'var(--accent)' : '#1c2452', flexShrink: 0 }}>
                          <path d="M5 12l4 4 10-10" />
                        </svg>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {isOpen && !disabled && isMobileScreen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: isDark ? 'rgba(15, 19, 48, 0.6)' : 'rgba(29, 36, 82, 0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            style={{
              background: isDark ? 'var(--surface-1)' : '#ffffff',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              maxHeight: '85vh',
              height: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.15)',
              overflow: 'hidden',
              width: '100%',
              animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
              <div style={{ width: '40px', height: '4px', background: isDark ? 'rgba(255, 255, 255, 0.15)' : '#e4e7ec', borderRadius: '2px' }} />
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 20px 16px 20px',
              borderBottom: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: isDark ? 'var(--text-primary)' : '#1d2939' }}>
                  Select Property
                </h3>
                <span style={{ fontSize: '12px', color: isDark ? 'var(--text-muted)' : '#667085', fontWeight: '500' }}>
                  {totalPropertiesCount > 0 ? `${totalPropertiesCount} properties available` : '0 properties available'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: isDark ? 'var(--surface-2)' : '#f2f4f7',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: isDark ? 'var(--text-primary)' : '#1d2939',
                }}
              >
                <CloseIcon />
              </button>
            </div>

            <div style={{
              padding: '16px 20px 12px 20px',
              borderBottom: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: isDark ? 'var(--surface-2)' : '#f8f9fb',
                border: `1px solid ${isDark ? 'var(--border)' : '#d0d5dd'}`,
                borderRadius: '12px',
                padding: '10px 14px',
                width: '100%',
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ width: '16px', height: '16px', color: isDark ? 'var(--text-muted)' : '#667085', flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={`Search ${totalPropertiesCount > 0 ? totalPropertiesCount : ''} properties...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '15px',
                    color: 'var(--text-primary)',
                    padding: 0,
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      searchInputRef.current?.focus();
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '2px',
                      cursor: 'pointer',
                      color: isDark ? 'var(--text-muted)' : '#667085',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CloseIcon />
                  </button>
                )}
              </div>
            </div>

            <div
              ref={optionsListRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {filteredOptions.length === 0 ? (
                <div style={{
                  padding: '40px 16px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: '48px', height: '48px', color: isDark ? 'rgba(255,255,255,0.15)' : '#d0d5dd' }}>
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <span style={{ fontSize: '14.5px', color: isDark ? 'var(--text-muted)' : '#667085', fontWeight: '500' }}>
                    No properties match your search
                  </span>
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = value === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        minHeight: '52px',
                        padding: '14px 16px',
                        background: isSelected
                          ? (isDark ? 'rgba(244, 161, 23, 0.15)' : 'rgba(28, 36, 82, 0.08)')
                          : isDark ? 'rgba(255, 255, 255, 0.02)' : '#f8f9fb',
                        border: `1px solid ${isSelected ? (isDark ? 'rgba(244, 161, 23, 0.3)' : 'rgba(28, 36, 82, 0.15)') : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#f2f4f7')}`,
                        borderRadius: '12px',
                        fontSize: '15px',
                        fontWeight: isSelected ? '600' : '500',
                        color: isSelected
                          ? (isDark ? 'var(--accent)' : '#1c2452')
                          : (isDark ? 'var(--text-primary)' : '#1d2939'),
                        cursor: 'pointer',
                        textAlign: 'left',
                        outline: 'none',
                        transition: 'background-color 0.15s, border-color 0.15s',
                      }}
                      onClick={() => {
                        onChange(option.value);
                        setIsOpen(false);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                        <PropertyIcon style={{
                          color: isSelected
                            ? (isDark ? 'var(--accent)' : '#1c2452')
                            : (isDark ? 'var(--text-muted)' : '#98a2b3'),
                          opacity: isSelected ? 1 : 0.8
                        }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {option.label}
                        </span>
                      </div>
                      {isSelected && (
                        <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '18px', height: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: 3, color: isDark ? 'var(--accent)' : '#1c2452', flexShrink: 0 }}>
                          <path d="M5 12l4 4 10-10" />
                        </svg>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

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
                background: isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
                border: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '14.5px',
                fontWeight: '500',
                color: isDark ? 'var(--text-primary)' : '#1d2939',
                width: '100%',
                boxSizing: 'border-box',
                height: '50px',
                boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                <svg
                  style={{ width: '16px', height: '16px', color: isDark ? 'var(--accent)' : '#1c2452', opacity: 0.8, flexShrink: 0 }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M7 20h10" />
                  <path d="M12 20v-4" />
                  <path d="M12 4v4" />
                </svg>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '600' }}>
                  {entityName}
                </span>
              </div>
              {!disabled && isEntityLockable && (
                <button
                  type="button"
                  className="client-tx-edit-btn"
                  aria-label="Edit entity"
                  onClick={onEditEntity}
                  style={{
                    background: isDark ? 'var(--surface-2)' : '#f2f4f7',
                    border: 'none',
                    borderRadius: '8px',
                    color: isDark ? 'var(--text-secondary)' : '#566474',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    padding: 0,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.08)' : '#e4e7ec';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.background = isDark ? 'var(--surface-2)' : '#f2f4f7';
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
          <PropertySelect
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
                background: isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
                border: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '14.5px',
                fontWeight: '500',
                color: isDark ? 'var(--text-primary)' : '#1d2939',
                width: '100%',
                boxSizing: 'border-box',
                height: '50px',
                boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                <PropertyIcon style={{ color: isDark ? 'var(--accent)' : '#1c2452', flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '600' }}>
                  {propertyName}
                </span>
              </div>
              {!disabled && isPropertyLockable && (
                <button
                  type="button"
                  className="client-tx-edit-btn"
                  aria-label="Edit property"
                  onClick={onEditProperty}
                  style={{
                    background: isDark ? 'var(--surface-2)' : '#f2f4f7',
                    border: 'none',
                    borderRadius: '8px',
                    color: isDark ? 'var(--text-secondary)' : '#566474',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    padding: 0,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.08)' : '#e4e7ec';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.background = isDark ? 'var(--surface-2)' : '#f2f4f7';
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
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | "form">(1);
  const [allProperties, setAllProperties] = useState<PropertyWithEntity[]>([]);
  const [allPropertiesLoaded, setAllPropertiesLoaded] = useState(false);
  const [propertySearchQuery, setPropertySearchQuery] = useState("");
  const [activeEntityFilter, setActiveEntityFilter] = useState("all");

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
  const propertyIdRef = useRef(propertyId);
  useEffect(() => {
    propertyIdRef.current = propertyId;
  }, [propertyId]);
  const [isEditingProperty, setIsEditingProperty] = useState<boolean>(true);

  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceDateTouched, setInvoiceDateTouched] = useState(false);
  const [grossAmount, setGrossAmount] = useState("");

  const [showGstBreakdown, setShowGstBreakdown] = useState(false);
  const [gstAmount, setGstAmount] = useState("");
  const [gstOption, setGstOption] = useState<"10" | "0" | "none">("none");

  const [isRegularPayment, setIsRegularPayment] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [dueDateTouched, setDueDateTouched] = useState(false);
  const [alertName, setAlertName] = useState("");
  const [userEditedAlertName, setUserEditedAlertName] = useState(false);

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

  // Auto-calculate GST amount when GST Option or Gross Amount changes
  useEffect(() => {
    if (gstOption === "10") {
      const grossVal = Number.parseFloat(grossAmount);
      if (!Number.isNaN(grossVal) && grossVal > 0) {
        setGstAmount((grossVal / 11).toFixed(2));
      } else {
        setGstAmount("");
      }
    } else if (gstOption === "0") {
      setGstAmount("0.00");
    } else if (gstOption === "none") {
      setGstAmount("");
    }
  }, [gstOption, grossAmount]);

  // Auto-fill Alert Name based on Property and Subcategory
  useEffect(() => {
    if (!userEditedAlertName) {
      const propName = properties.find((p) => p.id === propertyId)?.name || "";
      const subcatName = subcategories.find((s) => s.id === subcategoryId)?.name || "";
      if (subcatName && propName) {
        setAlertName(`${subcatName} - ${propName}`);
      } else if (subcatName) {
        setAlertName(subcatName);
      } else if (propName) {
        setAlertName(propName);
      } else {
        setAlertName("");
      }
    }
  }, [propertyId, subcategoryId, properties, subcategories, userEditedAlertName]);

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

  // Load properties for all entities in parallel for Step 1
  useEffect(() => {
    if (!token || !entitiesLoaded || entities.length === 0) return;
    let cancelled = false;
    async function loadAllProperties() {
      setAllPropertiesLoaded(false);
      try {
        const promises = entities.map(async (entity) => {
          const res = await fetch(
            `/api/entities/${encodeURIComponent(entity.id)}/properties`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!res.ok) return [];
          const data = (await res.json()) as { items?: PropertyOption[] };
          return (data.items || []).map((p) => ({
            id: p.id,
            name: p.name,
            entityId: entity.id,
            entityName: entity.name,
          }));
        });
        const results = await Promise.all(promises);
        if (!cancelled) {
          setAllProperties(results.flat());
          setAllPropertiesLoaded(true);
        }
      } catch (err) {
        console.error("Error loading properties for all entities:", err);
      }
    }
    loadAllProperties();
    return () => {
      cancelled = true;
    };
  }, [token, entities, entitiesLoaded]);

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
        const currentPropertyValid =
          !!propertyIdRef.current &&
          loadedProperties.some((property) => property.id === propertyIdRef.current);
        const hasDefaultProperty =
          !!defaultPropertyId &&
          loadedProperties.some((property) => property.id === defaultPropertyId);
        if (currentPropertyValid) {
          setIsEditingProperty(false);
        } else if (hasDefaultProperty) {
          setPropertyId(defaultPropertyId);
          setIsEditingProperty(false);
        } else {
          setPropertyId("");
          setIsEditingProperty(true);
        }
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

  const dueDateError = useMemo(() => {
    if (!isRegularPayment) return "";
    if (!dueDate) {
      return "Due date is required.";
    }
    const todayStr = getLocalDateString();
    if (dueDate <= todayStr) {
      return "Due date must be in the future.";
    }
    return "";
  }, [isRegularPayment, dueDate]);

  const showDueDateError = !!dueDateError && (dueDateTouched || dueDateError !== "Due date is required.");

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
    (!isRegularPayment || !dueDateError) &&
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
      setGstOption("10");
    } else {
      setGstOption("none");
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

  const handleUseSampleReceipt = () => {
    const mockData: ExtractedDocumentData = {
      type: "expense",
      title: "Google Workspace Invoice",
      description: "Monthly subscription for G Suite / Workspace emails.",
      vendor: "Google Workspace",
      payer: activeEntityId ? entities.find(e => e.id === activeEntityId)?.name || "Johnson Family Trust" : "Johnson Family Trust",
      amount: 120.00,
      currency: "AUD",
      gst_included: true,
      gst_amount: 10.91,
      date: getLocalDateString(),
      reference: "INV-9827361",
    };

    handleExtracted(mockData, "sample-doc-id-123", {
      filename: "ME.pdf",
      jobId: "sample-job-id-999",
    });

    setWizardStep(3);
  };

  // POSTs a create-transaction body to the core API via the BFF. Returns an
  // error message to display, or null on success.
  const postTransaction = async (
    body: Record<string, unknown>,
  ): Promise<string | null> => {
    if (!token) return "You're signed out. Refresh and log in again.";
    if (!activeEntityId) return "Select a property before submitting.";
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
        message?: string;
        error?: string;
      } | null;
      return (
        data?.message || data?.error || `Failed to save transaction (${res.status}).`
      );
    }
    return null;
  };

  // Fallback categorisation for the quick "Submit to Accountant" path: first
  // category for the type + its first sub-category (same convention as bulk
  // import). The accountant re-categorises during review anyway.
  const resolveDefaultCategory = async (
    txnType: CoreTransactionType,
  ): Promise<{ categoryId: number; subcategoryId: number } | null> => {
    if (!token) return null;
    const catRes = await fetch(
      `/api/transactions/categories?type=${encodeURIComponent(txnType)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!catRes.ok) return null;
    const catData = (await catRes.json()) as { items?: CoreTransactionCategory[] };
    const category = catData.items?.[0];
    if (!category) return null;
    const subRes = await fetch(
      `/api/transactions/categories/${category.id}/sub-categories`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!subRes.ok) return null;
    const subData = (await subRes.json()) as {
      items?: CoreTransactionSubcategory[];
    };
    const subcategory = subData.items?.[0];
    if (!subcategory) return null;
    return { categoryId: category.id, subcategoryId: subcategory.id };
  };

  const submitToAccountant = async () => {
    setSelectedMethod("submit_invoice");
    setIsSubmitting(true);
    setSubmitError("");

    try {
      if (!activeEntityId || !propertyId) {
        setSubmitError("Select a property before submitting.");
        return;
      }
      const grossNum = Number.parseFloat(grossAmount);
      if (Number.isNaN(grossNum) || grossNum <= 0) {
        setSubmitError(
          "We couldn't read an amount from the document. Use 'Review & Submit' to enter it.",
        );
        return;
      }

      const effectiveType: CoreTransactionType =
        type === "revenue" ? "revenue" : "expense";

      // Prefer the matched rule's categorisation (applied or still pending),
      // then whatever is already selected, then the type's default.
      const pending = pendingRuleRef.current;
      let resolvedCategoryId = categoryId ?? pending?.categoryId ?? null;
      let resolvedSubcategoryId = subcategoryId ?? pending?.subcategoryId ?? null;
      if (!resolvedCategoryId || !resolvedSubcategoryId) {
        const defaults = await resolveDefaultCategory(effectiveType);
        resolvedCategoryId = resolvedCategoryId ?? defaults?.categoryId ?? null;
        resolvedSubcategoryId =
          resolvedSubcategoryId ?? defaults?.subcategoryId ?? null;
      }
      if (!resolvedCategoryId || !resolvedSubcategoryId) {
        setSubmitError(
          "Couldn't pick a category automatically. Use 'Review & Submit' to choose one.",
        );
        return;
      }

      const body: Record<string, unknown> = {
        type: effectiveType,
        category_id: resolvedCategoryId,
        subcategory_id: resolvedSubcategoryId,
        invoice_date: invoiceDate || getLocalDateString(),
        gross_amount: grossNum,
        description: description.trim() || null,
        internal_remarks: internalRemarks.trim() || null,
        is_asset_purchase: false,
        splits: [{ property_id: propertyId, split_percentage: 100 }],
        metadata: { source: "client_submit_invoice" },
      };
      if (documentId) body.document_id = documentId;
      if (appliedRuleIdRef.current) body.rule_id = appliedRuleIdRef.current;
      if (gstAmount) {
        const gstNum = Number.parseFloat(gstAmount.replace(/[^0-9.]/g, ""));
        if (!Number.isNaN(gstNum) && gstNum > 0) body.gst_amount = gstNum;
      }

      const errorMessage = await postTransaction(body);
      if (errorMessage) {
        setSubmitError(errorMessage);
        return;
      }
      setIsMarked(true);
    } catch (err) {
      console.error(err);
      setSubmitError("An error occurred during submission.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
    if (!activeEntityId) return;

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
      if (isRegularPayment && dueDateError) {
        setDueDateTouched(true);
        setSubmitError(dueDateError);
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
      body.metadata = {
        ...(modeOfTransaction ? { mode_of_transaction: modeOfTransaction } : {}),
        is_regular_payment: isRegularPayment,
        due_date: isRegularPayment ? (dueDate || null) : null,
        alert_name: isRegularPayment ? (alertName.trim() || null) : null,
      };
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

      const errorMessage = await postTransaction(body);
      if (errorMessage) {
        setSubmitError(errorMessage);
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

  // Extract unique entities and count properties per entity for step 1 filtering
  const uniqueEntities = useMemo(() => {
    const entitiesMap = new Map<string, { id: string; name: string; count: number }>();
    allProperties.forEach((p) => {
      if (!p.entityId) return;
      const existing = entitiesMap.get(p.entityId);
      if (existing) {
        existing.count += 1;
      } else {
        entitiesMap.set(p.entityId, { id: p.entityId, name: p.entityName, count: 1 });
      }
    });
    return Array.from(entitiesMap.values());
  }, [allProperties]);

  // Filter properties by search query and selected entity tab
  const filteredProperties = useMemo(() => {
    return allProperties.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(propertySearchQuery.toLowerCase()) ||
        p.entityName.toLowerCase().includes(propertySearchQuery.toLowerCase());
      const matchesEntity = activeEntityFilter === "all" || p.entityId === activeEntityFilter;
      return matchesSearch && matchesEntity;
    });
  }, [allProperties, propertySearchQuery, activeEntityFilter]);

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
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: isDark ? 'var(--text-primary)' : '#0f1330', margin: '0 0 12px 0', fontFamily: "'Inter', sans-serif" }}>
              {selectedMethod === "submit_invoice" ? "Submitted to accountant" : "Transaction Added"}
            </h2>
            <div style={{ fontSize: '14.5px', color: isDark ? 'var(--text-secondary)' : '#566474', lineHeight: 1.6, fontFamily: "'Inter', sans-serif" }}>
              {selectedMethod === "submit_invoice" ? (
                <span>They'll review, categorize, and confirm it — you'll see it under “To Be Reviewed”.</span>
              ) : (
                <>
                  <strong style={{ display: 'block', color: isDark ? 'var(--text-primary)' : '#0f1330', marginBottom: '8px', fontSize: '15.5px' }}>Transaction successfully recorded.</strong>
                  <span>The property ledger has been updated. Returning to transactions...</span>
                </>
              )}
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

  if (wizardStep === 1) {
    return (
      <section className="client-tx-container" style={{ width: '100%', maxWidth: '800px', margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>
        {/* Header */}
        <div className="client-tx-header-bar" style={{ marginBottom: '24px' }}>
          <Link href={effectiveBackHref} className="client-tx-back-link" style={{ color: isDark ? 'var(--text-secondary)' : '#667085' }}>
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "16px", height: "16px", fill: "none", stroke: "currentColor", strokeWidth: 2 }}>
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {backLabel}
          </Link>
          <h1 className="client-tx-page-title" style={{ fontSize: '30px', fontWeight: '700', color: isDark ? 'var(--text-primary)' : '#0f1330', marginTop: '16px', marginBottom: '8px' }}>Add transaction</h1>
          <p className="client-tx-page-subtitle" style={{ fontSize: '15px', color: isDark ? 'var(--text-secondary)' : '#667085', margin: 0 }}>
            Select a property to continue.
          </p>
        </div>

        {/* Search & Entity Filters Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px', width: '100%' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: isDark ? 'var(--surface-2)' : '#f8f9fb',
            border: `1px solid ${isDark ? 'var(--border)' : '#d0d5dd'}`,
            borderRadius: '16px',
            padding: '12px 20px',
            width: '100%',
            boxSizing: 'border-box',
            boxShadow: '0 2px 4px rgba(16, 24, 40, 0.02)',
            transition: 'all 0.2s ease',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ width: '18px', height: '18px', color: isDark ? 'var(--text-muted)' : '#667085', flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search properties by name or entity..."
              value={propertySearchQuery}
              onChange={(e) => setPropertySearchQuery(e.target.value)}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '15px',
                color: 'var(--text-primary)',
                padding: 0,
              }}
            />
            {propertySearchQuery && (
              <button
                type="button"
                onClick={() => setPropertySearchQuery("")}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: isDark ? 'var(--text-muted)' : '#667085',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <CloseIcon />
              </button>
            )}
            <span style={{
              fontSize: '12px',
              fontWeight: '600',
              background: isDark ? 'var(--surface-1)' : '#f2f4f7',
              color: isDark ? 'var(--text-secondary)' : '#475467',
              padding: '4px 10px',
              borderRadius: '8px',
              whiteSpace: 'nowrap',
            }}>
              {filteredProperties.length} of {allProperties.length}
            </span>
          </div>

          {/* Horizontal Entity Tabs */}
          {uniqueEntities.length > 0 && (
            <div style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              paddingBottom: '8px',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
            }}>
              <button
                type="button"
                onClick={() => setActiveEntityFilter("all")}
                style={{
                  padding: '8px 16px',
                  borderRadius: '9999px',
                  border: `1px solid ${activeEntityFilter === "all" ? (isDark ? 'var(--accent)' : '#1c2452') : (isDark ? 'var(--border)' : '#eaeef4')}`,
                  background: activeEntityFilter === "all" ? (isDark ? 'rgba(244, 161, 23, 0.15)' : '#1c2452') : (isDark ? 'var(--surface-1)' : '#ffffff'),
                  color: activeEntityFilter === "all" ? (isDark ? 'var(--accent)' : '#ffffff') : (isDark ? 'var(--text-secondary)' : '#566474'),
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                All Entities ({allProperties.length})
              </button>
              {uniqueEntities.map((ent) => {
                const isActive = activeEntityFilter === ent.id;
                return (
                  <button
                    key={ent.id}
                    type="button"
                    onClick={() => setActiveEntityFilter(ent.id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '9999px',
                      border: `1px solid ${isActive ? (isDark ? 'var(--accent)' : '#1c2452') : (isDark ? 'var(--border)' : '#eaeef4')}`,
                      background: isActive ? (isDark ? 'rgba(244, 161, 23, 0.15)' : '#1c2452') : (isDark ? 'var(--surface-1)' : '#ffffff'),
                      color: isActive ? (isDark ? 'var(--accent)' : '#ffffff') : (isDark ? 'var(--text-secondary)' : '#566474'),
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ent.name} ({ent.count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Skeleton Loading State */}
        {!allPropertiesLoaded ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '20px',
            marginTop: '8px',
            width: '100%',
          }}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '24px 20px',
                  borderRadius: '16px',
                  border: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
                  background: isDark ? 'var(--surface-1)' : '#ffffff',
                  opacity: 0.6,
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: isDark ? 'var(--surface-2)' : '#f0f2f5', marginBottom: '16px' }} />
                <div style={{ height: '14px', background: isDark ? 'var(--surface-2)' : '#f0f2f5', borderRadius: '4px', width: '70%', marginBottom: '10px' }} />
                <div style={{ height: '10px', background: isDark ? 'var(--surface-2)' : '#f0f2f5', borderRadius: '4px', width: '40%' }} />
              </div>
            ))}
          </div>
        ) : filteredProperties.length === 0 ? (
          /* Empty Search State */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            textAlign: 'center',
            width: '100%',
            boxSizing: 'border-box',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: '56px', height: '56px', color: isDark ? 'rgba(255,255,255,0.15)' : '#d0d5dd', marginBottom: '16px' }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: '600', color: isDark ? 'var(--text-primary)' : '#1d2939' }}>No properties found</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: isDark ? 'var(--text-muted)' : '#667085' }}>Try adjusting your search query or selecting a different entity.</p>
            <button
              type="button"
              onClick={() => {
                setPropertySearchQuery("");
                setActiveEntityFilter("all");
              }}
              style={{
                background: isDark ? 'var(--surface-2)' : '#1c2452',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: '600',
                padding: '8px 16px',
                cursor: 'pointer',
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          /* Properties Card Grid */
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '20px',
            marginTop: '8px',
            width: '100%',
          }}>
            {filteredProperties.map((prop) => {
              const isSelected = propertyId === prop.id;
              return (
                <button
                  key={prop.id}
                  type="button"
                  onClick={() => {
                    handlePropertyPicked(prop.id);
                    handleEntityPicked(prop.entityId);
                    setWizardStep(2);
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    position: 'relative',
                    padding: '24px 20px',
                    borderRadius: '16px',
                    border: `1px solid ${isSelected ? (isDark ? 'var(--accent)' : '#1c2452') : (isDark ? 'var(--border)' : '#eaeef4')}`,
                    background: isSelected
                      ? (isDark ? 'rgba(244, 161, 23, 0.08)' : '#f3f5fc')
                      : (isDark ? 'var(--surface-1)' : '#ffffff'),
                    color: isDark ? 'var(--text-primary)' : '#0f1330',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: isSelected ? '0 10px 20px -5px rgba(28, 36, 82, 0.12)' : '0 2px 8px -1px rgba(0, 0, 0, 0.04)',
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                  onMouseOver={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 12px 24px -5px rgba(0, 0, 0, 0.06)';
                      e.currentTarget.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.2)' : '#d0d5dd';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '0 2px 8px -1px rgba(0, 0, 0, 0.04)';
                      e.currentTarget.style.borderColor = isDark ? 'var(--border)' : '#eaeef4';
                    }
                  }}
                >
                  {/* Styled Icon */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: isSelected ? (isDark ? 'var(--accent)' : '#1c2452') : (isDark ? 'var(--surface-2)' : '#f2f5fa'),
                    color: isSelected ? '#ffffff' : (isDark ? 'var(--accent)' : '#1c2452'),
                    marginBottom: '16px',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? '0 4px 10px rgba(0, 0, 0, 0.1)' : 'none',
                  }}>
                    <PropertyIcon style={{ width: '20px', height: '20px', opacity: 1 }} />
                  </div>

                  {/* Property Name */}
                  <span style={{
                    fontSize: '16.5px',
                    fontWeight: '700',
                    lineHeight: '1.3',
                    marginBottom: '8px',
                    color: isSelected ? (isDark ? 'var(--accent)' : '#1c2452') : (isDark ? 'var(--text-primary)' : '#0f1330'),
                    width: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {prop.name}
                  </span>

                  {/* Entity Muted Tag */}
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: isDark ? 'var(--text-secondary)' : '#667085',
                    background: isDark ? 'var(--surface-2)' : '#f2f4f7',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'inline-block',
                  }}>
                    {prop.entityName}
                  </span>

                  {/* Corner Checkmark Check */}
                  {isSelected && (
                    <div style={{
                      position: 'absolute',
                      top: '16px',
                      right: '16px',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: isDark ? 'var(--accent)' : '#1c2452',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                      <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '12px', height: '12px', fill: 'none', stroke: 'currentColor', strokeWidth: 3.5 }}>
                        <path d="M5 12l4 4 10-10" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  if (wizardStep === 2) {
    const selectedProp = allProperties.find(p => p.id === propertyId);
    const propName = selectedProp?.name || "Selected Property";
    const entityName = selectedProp?.entityName || "Johnson Family Trust";

    return (
      <section className="client-tx-container" style={{ width: '100%', maxWidth: '800px', margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>
        {/* Header */}
        <div className="client-tx-header-bar" style={{ marginBottom: '32px' }}>
          <button
            type="button"
            onClick={() => setWizardStep(1)}
            className="client-tx-back-link"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              color: isDark ? 'var(--text-secondary)' : '#667085',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "16px", height: "16px", fill: "none", stroke: "currentColor", strokeWidth: 2 }}>
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
          <h1 className="client-tx-page-title" style={{ fontSize: '30px', fontWeight: '700', color: isDark ? 'var(--text-primary)' : '#0f1330', marginTop: '16px', marginBottom: '8px' }}>Upload invoice</h1>
          <p className="client-tx-page-subtitle" style={{ fontSize: '15px', color: isDark ? 'var(--text-secondary)' : '#667085', margin: 0 }}>
            For {propName} ({entityName}). Scan or upload the receipt for this transaction.
          </p>
        </div>

        {/* Upload Container */}
        <div style={{
          background: isDark ? 'var(--surface-1)' : '#ffffff',
          border: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
          borderRadius: '24px',
          padding: '40px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          {/* Dashed Dropzone */}
          <div style={{ width: '100%' }}>
            <DocumentDropZone
              token={token}
              onExtracted={(data, docId, meta) => {
                handleExtracted(data, docId, meta);
                setWizardStep(3);
              }}
              scope={activeEntityId ? { entityId: activeEntityId } : undefined}
              isSubmitting={isSubmitting}
              submitError={submitError && !submitError.toLowerCase().includes("split") ? submitError : ""}
              primaryLabelText="Scan or upload invoice / receipt"
              secondaryLabelText="PDF, JPG, PNG · max 10MB · camera or gallery"
              hideIconOnIdle={false}
              customIcon={
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: isDark ? 'var(--surface-2)' : '#f8f9fb',
                  border: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
                  color: isDark ? 'var(--text-primary)' : '#1c2452',
                  marginBottom: '16px',
                }}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "28px", height: "28px", fill: "none", stroke: "currentColor", strokeWidth: 2 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </svg>
                </div>
              }
              style={{
                border: `2px dashed ${isDark ? 'var(--border)' : '#d0d5dd'}`,
                background: isDark ? 'var(--surface-2)' : '#f8f9fb',
                borderRadius: '16px',
                padding: '60px 40px',
                minHeight: '220px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                cursor: 'pointer',
                width: '100%',
                boxSizing: 'border-box',
                transition: 'all 0.2s ease',
              }}
              strongStyle={{
                fontSize: '17px',
                fontWeight: '700',
                color: isDark ? 'var(--text-primary)' : '#0f1330',
                margin: '12px 0 6px 0',
                display: 'block',
              }}
              smallStyle={{
                fontSize: '13px',
                color: isDark ? 'var(--text-muted)' : '#667085',
                margin: 0,
                display: 'block',
              }}
            />
          </div>

          {/* Sample Receipt Link */}
          <button
            type="button"
            onClick={handleUseSampleReceipt}
            style={{
              background: 'none',
              border: 'none',
              color: isDark ? 'var(--accent)' : '#1e3a7a',
              fontSize: '15px',
              fontWeight: '600',
              textDecoration: 'underline',
              cursor: 'pointer',
              outline: 'none',
              transition: 'opacity 0.2s ease',
            }}
          >
            No file handy? Use a sample receipt
          </button>
        </div>
      </section>
    );
  }

  if (wizardStep === 3) {
    const selectedProp = allProperties.find(p => p.id === propertyId);
    const propName = selectedProp?.name || "Selected Property";
    const fileSizeStr = uploadedFilename === "ME.pdf" ? "6 KB" : "152 KB";

    return (
      <section className="client-tx-container" style={{ width: '100%', maxWidth: '800px', margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>
        {/* Header */}
        <div className="client-tx-header-bar" style={{ marginBottom: '32px' }}>
          <button
            type="button"
            onClick={() => setWizardStep(2)}
            className="client-tx-back-link"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              color: isDark ? 'var(--text-secondary)' : '#667085',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "16px", height: "16px", fill: "none", stroke: "currentColor", strokeWidth: 2 }}>
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
          <h1 className="client-tx-page-title" style={{ fontSize: '30px', fontWeight: '700', color: isDark ? 'var(--text-primary)' : '#0f1330', marginTop: '16px', marginBottom: '8px' }}>Add transaction</h1>
          <p className="client-tx-page-subtitle" style={{ fontSize: '15px', color: isDark ? 'var(--text-secondary)' : '#667085', margin: 0 }}>
            Choose how you'd like to process this transaction.
          </p>
        </div>

        {/* Wizard Card Body */}
        <div style={{
          background: isDark ? 'var(--surface-1)' : '#ffffff',
          border: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
          borderRadius: '24px',
          padding: '36px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          {/* File Preview Card */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '16px 20px',
            borderRadius: '16px',
            border: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
            background: isDark ? 'var(--surface-2)' : '#ffffff',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: isDark ? 'rgba(92, 133, 214, 0.1)' : '#f0f2f5',
              color: isDark ? 'var(--accent)' : '#1c2452',
              flexShrink: 0,
            }}>
              <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "20px", height: "20px", fill: "none", stroke: "currentColor", strokeWidth: 2 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '15px', fontWeight: '700', color: isDark ? 'var(--text-primary)' : '#0f1330' }}>
                {uploadedFilename || "receipt.pdf"}
              </span>
              <span style={{ fontSize: '13px', color: isDark ? 'var(--text-muted)' : '#667085', fontWeight: '500' }}>
                {fileSizeStr}
              </span>
            </div>
          </div>

          {/* Option 1: Submit to Accountant */}
          <button
            type="button"
            onClick={submitToAccountant}
            disabled={isSubmitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              padding: '24px',
              borderRadius: '16px',
              border: `1.5px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
              background: isDark ? 'var(--surface-2)' : '#ffffff',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              width: '100%',
              boxSizing: 'border-box',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              outline: 'none',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: isDark ? 'rgba(92, 133, 214, 0.1)' : '#f0f4ff',
              color: isDark ? 'var(--accent)' : '#1e3a7a',
              flexShrink: 0,
            }}>
              <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "24px", height: "24px", fill: "none", stroke: "currentColor", strokeWidth: 2, transform: "rotate(15deg)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              <span style={{ fontSize: '17px', fontWeight: '700', color: isDark ? 'var(--text-primary)' : '#0f1330' }}>
                Submit to accountant
              </span>
              <span style={{ fontSize: '14px', color: isDark ? 'var(--text-secondary)' : '#475467', lineHeight: '1.4' }}>
                Send as-is — your accountant will categorize it. Quickest option.
              </span>
            </div>
          </button>

          {/* Option 2: Review & Submit */}
          <button
            type="button"
            onClick={() => {
              setIsEditingEntity(false);
              setIsEditingProperty(false);
              setSelectedMethod("review_submit");
              setWizardStep("form");
            }}
            disabled={isSubmitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              padding: '24px',
              borderRadius: '16px',
              border: `1.5px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
              background: isDark ? 'var(--surface-2)' : '#ffffff',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              width: '100%',
              boxSizing: 'border-box',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              outline: 'none',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: isDark ? 'rgba(92, 133, 214, 0.1)' : '#f0f4ff',
              color: isDark ? 'var(--accent)' : '#1e3a7a',
              flexShrink: 0,
            }}>
              <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "24px", height: "24px", fill: "none", stroke: "currentColor", strokeWidth: 2 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              <span style={{ fontSize: '17px', fontWeight: '700', color: isDark ? 'var(--text-primary)' : '#0f1330' }}>
                Review & submit
              </span>
              <span style={{ fontSize: '14px', color: isDark ? 'var(--text-secondary)' : '#475467', lineHeight: '1.4' }}>
                We've pre-filled the details from your receipt — check them and save.
              </span>
            </div>
          </button>

          {/* Submit/Save error messages */}
          {submitError && (
            <p style={{ color: '#da3838', fontSize: '14px', fontWeight: '600', margin: '8px 0 0 0', textAlign: 'center' }}>
              {submitError}
            </p>
          )}
        </div>
      </section>
    );
  }

  const selectedProperty = allProperties.find((p) => p.id === propertyId);
  const selectedPropertyName = selectedProperty?.name || "Not selected";
  const selectedEntityName = entities.find((e) => e.id === activeEntityId)?.name || selectedProperty?.entityName || "Johnson Family Trust";

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
              onClick={() => setWizardStep(3)}
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
            onClick={() => setWizardStep(3)}
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
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '700',
            color: isDark ? 'var(--text-primary)' : '#0f1330',
            margin: '0 0 6px 0',
            fontFamily: "'Inter', sans-serif"
          }}>
            Review & submit
          </h2>
          <p style={{
            fontSize: '14.5px',
            color: isDark ? 'var(--text-secondary)' : '#667085',
            margin: 0,
            fontFamily: "'Inter', sans-serif"
          }}>
            We used OCR to read your receipt — check everything looks right.
          </p>
        </div>

        <form className="client-tx-form" onSubmit={handleSubmit}>

          {showSelectionMessage && selectionMessage && (
            <div className="client-tx-banner-error" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", color: '#da3838', fontSize: '13px', fontWeight: '600' }}>
              <svg style={{ width: '20px', height: '20px', flexShrink: 0 }} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <span>{selectionMessage}</span>
            </div>
          )}

          {/* Upload Invoice or Receipt */}
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

            {/* Row 1: Entity name & Property */}
            <div className="client-tx-grid cols-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginTop: '16px' }}>
              <div className="client-tx-field-group" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <label className="client-tx-field-label" style={{ fontSize: '13px', fontWeight: '500', color: isDark ? 'var(--text-secondary)' : '#344054', marginBottom: '6px', display: 'inline-block' }}>Entity name</label>
                <input
                  type="text"
                  className="client-tx-input"
                  value={selectedEntityName}
                  readOnly
                  disabled
                  style={{
                    background: isDark ? 'var(--surface-2)' : '#ffffff',
                    border: `1px solid ${isDark ? 'var(--border)' : '#d0d5dd'}`,
                    borderRadius: '12px',
                    padding: '14px 16px',
                    fontSize: '14.5px',
                    fontWeight: '500',
                    color: isDark ? 'var(--text-muted)' : '#667085',
                    width: '100%',
                    boxSizing: 'border-box',
                    outline: 'none',
                    height: '50px',
                    cursor: 'not-allowed',
                  }}
                />
              </div>
              <div className="client-tx-field-group" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <StaticSelect
                  label="Property"
                  required={!isSplit}
                  placeholder="Select Property"
                  value={isSplit ? "split" : propertyId}
                  disabled={isSplit}
                  options={isSplit ? [{ label: "Split transaction", value: "split" }] : [
                    { label: "Select property", value: "" },
                    ...properties.map((p) => ({ label: p.name, value: p.id })),
                  ]}
                  onChange={(val) => {
                    setPropertyId(val);
                    setSubmitError("");
                  }}
                />
              </div>
            </div>

            {/* Row 2: Category and Sub-category */}
            <div className="client-tx-grid cols-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginTop: '20px' }}>
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

            {/* Row 3: Amount (AUD) and GST (optional) */}
            <div className="client-tx-grid cols-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginTop: '20px' }}>
              <div className={`client-tx-field-group ${flashClass("grossAmount")}`} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <label className="client-tx-field-label" style={{ fontSize: '13px', fontWeight: '500', color: isDark ? 'var(--text-secondary)' : '#344054', marginBottom: '6px', display: 'inline-block' }}>
                  Amount (AUD)
                  <em className="client-tx-required" style={{ color: '#da3838', fontStyle: 'normal', marginLeft: '3px' }}>*</em>
                </label>
                <input
                  type="number"
                  className="client-tx-input"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  placeholder="312.00"
                  value={grossAmount}
                  onKeyDown={preventExponentialAndNegative}
                  onChange={(e) => {
                    const val = e.target.value.replace(/-/g, "");
                    setGrossAmount(val);
                  }}
                  style={{
                    background: isDark ? 'var(--surface-2)' : '#ffffff',
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
                {grossAmount && grossAmountError && (
                  <p className="client-tx-field-error" style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4.5px", color: '#da3838', fontSize: '11.5px', fontWeight: '600' }}>
                    <svg style={{ width: '14px', height: '14px', flexShrink: 0 }} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <span>{grossAmountError}</span>
                  </p>
                )}
              </div>

              <div className="client-tx-field-group" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <StaticSelect
                  label="GST (optional)"
                  value={gstOption}
                  options={[
                    { label: "GST 10%", value: "10" },
                    { label: "GST Free (0%)", value: "0" },
                    { label: "No GST", value: "none" },
                  ]}
                  onChange={(value) => {
                    setGstOption(value as any);
                  }}
                />
              </div>
            </div>

            {/* Split Toggle Switch */}
            <div className="client-tx-split-toggle-container" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '24px 0 20px 0',
              marginTop: '24px',
              borderTop: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
            }}>
              <div className="client-tx-split-toggle-info" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span className="client-tx-split-toggle-title" style={{ fontSize: '14.5px', fontWeight: '700', color: isDark ? 'var(--text-primary)' : '#1d2939' }}>Is this a split transaction?</span>
                <span className="client-tx-split-toggle-desc" style={{ fontSize: '12.5px', color: isDark ? 'var(--text-secondary)' : '#667085' }}>Allocate the amount across multiple properties.</span>
              </div>
              <label className="client-tx-switch" style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isSplit}
                  onChange={(e) => handleSplitToggle(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span className="client-tx-slider" style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: isSplit ? '#1d2452' : '#eaeef4',
                  transition: '.2s',
                  borderRadius: '24px',
                }} />
                <span style={{
                  position: 'absolute',
                  content: '""',
                  height: '18px',
                  width: '18px',
                  left: isSplit ? '24px' : '4px',
                  bottom: '3px',
                  backgroundColor: 'white',
                  transition: '.2s',
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
                          <PropertySelect
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
                  background: isDark ? 'var(--surface-2)' : '#ffffff',
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

            {/* Is this a regular payment? */}
            <div className="client-tx-split-toggle-container" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '24px 0 20px 0',
              marginTop: '24px',
              borderTop: `1px solid ${isDark ? 'var(--border)' : '#eaeef4'}`,
            }}>
              <div className="client-tx-split-toggle-info" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span className="client-tx-split-toggle-title" style={{ fontSize: '14.5px', fontWeight: '700', color: isDark ? 'var(--text-primary)' : '#1d2939' }}>Is this a regular payment?</span>
                <span className="client-tx-split-toggle-desc" style={{ fontSize: '12.5px', color: isDark ? 'var(--text-secondary)' : '#667085' }}>We'll flag it in your dashboard alerts so nothing gets missed.</span>
              </div>
              <label className="client-tx-switch" style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isRegularPayment}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsRegularPayment(checked);
                    if (!checked) {
                      setDueDate("");
                      setDueDateTouched(false);
                    }
                  }}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span className="client-tx-slider" style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: isRegularPayment ? '#1d2452' : '#eaeef4',
                  transition: '.2s',
                  borderRadius: '24px',
                }} />
                <span style={{
                  position: 'absolute',
                  content: '""',
                  height: '18px',
                  width: '18px',
                  left: isRegularPayment ? '24px' : '4px',
                  bottom: '3px',
                  backgroundColor: 'white',
                  transition: '.2s',
                  borderRadius: '50%',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  pointerEvents: 'none',
                }} />
              </label>
            </div>

            {isRegularPayment && (
              <div className="client-tx-grid cols-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginTop: '16px', marginBottom: '16px' }}>
                <div className="client-tx-field-group" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                  <label className="client-tx-field-label" style={{ fontSize: '13px', fontWeight: '500', color: isDark ? 'var(--text-secondary)' : '#344054', marginBottom: '6px', display: 'inline-block' }}>Due date</label>
                  <input
                    type="date"
                    min="1900-01-01"
                    max="9999-12-31"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    onBlur={() => setDueDateTouched(true)}
                    style={{
                      background: isDark ? 'var(--surface-2)' : '#ffffff',
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
                  {showDueDateError && (
                    <p className="client-tx-field-error" style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4.5px", color: '#da3838', fontSize: '11.5px', fontWeight: '600' }}>
                      <svg style={{ width: '14px', height: '14px', flexShrink: 0 }} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      <span>{dueDateError}</span>
                    </p>
                  )}
                </div>

                <div className="client-tx-field-group" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                  <label className="client-tx-field-label" style={{ fontSize: '13px', fontWeight: '500', color: isDark ? 'var(--text-secondary)' : '#344054', marginBottom: '6px', display: 'inline-block' }}>Alert name</label>
                  <input
                    type="text"
                    value={alertName}
                    onChange={(e) => {
                      setAlertName(e.target.value);
                      setUserEditedAlertName(true);
                    }}
                    placeholder="Enter alert name"
                    style={{
                      background: isDark ? 'var(--surface-2)' : '#ffffff',
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
              </div>
            )}

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
                  background: 'transparent',
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
                  Delete transaction
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
                {isSubmitting ? "Saving transaction..." : "Save transaction"}
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

          <PropertySelect
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
