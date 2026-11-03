"use client";

import { useEffect, useRef } from "react";
import { auFinancialYearOf } from "@/app/components/useGstSummary";
import { announceDropdownOpen, dropdownRegistryEvent, isDropdownRegistryEvent } from "@/src/lib/dropdownRegistry";

/**
 * The financial-year picker for the P&L figures and reports.
 * Fully theme-based with dark/light mode support, calendar icon, and dropdown coordination.
 *
 * One control, rendered twice: above the hero summary cards and in the header of
 * the statement itself. Both read the SAME `pnlFinancialYear`.
 */
export default function FinancialYearPicker({
  value,
  onChange,
  isOpen,
  setIsOpen,
  years,
}: {
  value: number;
  onChange: (year: number) => void;
  isOpen: boolean;
  setIsOpen: (next: boolean) => void;
  /** Years to offer, newest first. Defaults to the current FY and five before it. */
  years?: number[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownId = "financial-year-picker-dropdown";
  const label = (year: number) => `FY ${year - 1}-${String(year).slice(-2)}`;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleOtherDropdown(event: Event) {
      if (!isDropdownRegistryEvent(event)) return;
      if (event.detail?.id && event.detail.id !== dropdownId) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener(dropdownRegistryEvent, handleOtherDropdown);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener(dropdownRegistryEvent, handleOtherDropdown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, setIsOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      announceDropdownOpen(dropdownId);
    }
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select Financial Year"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          minWidth: "150px",
          height: "40px",
          padding: "0 14px",
          borderRadius: "10px",
          border: isOpen
            ? "1.5px solid var(--accent, #F4A117)"
            : "1px solid var(--border, rgba(20, 23, 46, 0.08))",
          backgroundColor: isOpen ? "var(--surface-2, #f8fafc)" : "var(--surface-1, #ffffff)",
          color: "var(--text-primary, #1e293b)",
          fontSize: "13px",
          fontWeight: 600,
          cursor: "pointer",
          outline: "none",
          boxShadow: isOpen
            ? "0 0 0 3px rgba(244, 161, 23, 0.18)"
            : "0 1px 2px rgba(0, 0, 0, 0.05)",
          transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          userSelect: "none",
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = "rgba(244, 161, 23, 0.4)";
            e.currentTarget.style.backgroundColor = "var(--surface-2, #f8fafc)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = "var(--border, rgba(20, 23, 46, 0.08))";
            e.currentTarget.style.backgroundColor = "var(--surface-1, #ffffff)";
          }
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ width: "15px", height: "15px", color: "var(--accent, #F4A117)", flexShrink: 0 }}
            aria-hidden="true"
          >
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
          </svg>
          <span>{label(value)}</span>
        </div>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            width: "14px",
            height: "14px",
            color: isOpen ? "var(--accent, #F4A117)" : "var(--text-muted, #64748b)",
            transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s ease",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Financial Years"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: "170px",
            backgroundColor: "var(--surface-1, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "12px",
            boxShadow: "0 16px 36px -4px rgba(0, 0, 0, 0.35), 0 6px 16px -2px rgba(0, 0, 0, 0.15)",
            zIndex: 1000,
            padding: "6px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            backdropFilter: "blur(16px)",
          }}
        >
          {(years ?? Array.from({ length: 6 }, (_, i) => auFinancialYearOf(new Date()) - i)).map((year) => {
            const isSelected = year === value;
            return (
              <button
                key={year}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(year);
                  setIsOpen(false);
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: isSelected ? 600 : 500,
                  color: isSelected ? "var(--accent, #28336e)" : "var(--text-primary, #334155)",
                  backgroundColor: isSelected ? "var(--surface-2, #eff6ff)" : "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "all 0.15s ease",
                  border: "none",
                  outline: "none",
                  width: "100%",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = "var(--surface-2, #f8fafc)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span>{label(year)}</span>
                {isSelected && (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ width: "16px", height: "16px", color: "var(--accent, #28336e)" }}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
