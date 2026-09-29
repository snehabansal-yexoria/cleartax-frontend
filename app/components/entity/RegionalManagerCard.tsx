"use client";

import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { EntityRmSkeleton } from "@/app/components/PortalSkeletons";
import { RegionError } from "@/app/components/ui/RegionError";
import type { AsyncRegion, RegionStatus } from "@/app/components/useAsyncRegion";
import {
  announceDropdownOpen,
  dropdownRegistryEvent,
  isDropdownRegistryEvent,
} from "@/src/lib/dropdownRegistry";
import { isPending, type RegionalManager } from "./types";

// -----------------------------------------------------------------------------
// StaticSelect (private to this card)
// -----------------------------------------------------------------------------

type SelectOption = { label: string; value: string };

type StaticSelectProps = {
  id?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 14, height: 14, fill: "none", stroke: "currentColor", strokeWidth: 2 }}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

const StaticSelect = memo(function StaticSelect({
  id,
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
}: StaticSelectProps) {
  const reactId = useId();
  const dropdownId = `entity-rm-select-${reactId}`;
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeIfAnotherOpened(event: Event) {
      if (isDropdownRegistryEvent(event) && event.detail?.id && event.detail.id !== dropdownId) {
        setIsOpen(false);
      }
    }
    window.addEventListener(dropdownRegistryEvent, closeIfAnotherOpened);
    return () => window.removeEventListener(dropdownRegistryEvent, closeIfAnotherOpened);
  }, [dropdownId]);

  useEffect(() => {
    if (isOpen) announceDropdownOpen(dropdownId);
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
    <div className="transaction-field" style={{ minWidth: 200 }}>
      <div
        ref={selectRef}
        className={`property-status-select transaction-select${isOpen ? " is-open" : ""}${disabled ? " is-disabled" : ""}`}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
        }}
      >
        <button
          type="button"
          id={id}
          className="property-status-trigger"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          disabled={disabled}
          onClick={() => {
            if (!disabled) setIsOpen((current) => !current);
          }}
        >
          <span>{selected?.label || placeholder || "Select"}</span>
          <ChevronIcon />
        </button>
        {isOpen && !disabled && (
          <div className="property-status-menu" role="listbox" style={{ zIndex: 50 }}>
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
                  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: 2 }}>
                    <path d="M5 12l4 4 10-10" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

// -----------------------------------------------------------------------------
// Card
// -----------------------------------------------------------------------------

export type RegionalManagerCardProps = {
  entityStatus: RegionStatus;
  selectedRm: RegionalManager | null;
  managers: AsyncRegion<RegionalManager[]>;
  disabled: boolean;
  error: string | null;
  onAssign: (rmId: string) => void;
  onRemove: () => void;
  onDismissError: () => void;
};

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

export default function RegionalManagerCard({
  entityStatus,
  selectedRm,
  managers,
  disabled,
  error,
  onAssign,
  onRemove,
  onDismissError,
}: RegionalManagerCardProps) {
  const selectId = useId();
  const options = useMemo(
    () => [
      { label: "Select Regional Manager", value: "" },
      ...(managers.data ?? []).map((rm) => ({ label: rm.name, value: rm.id })),
    ],
    [managers.data],
  );

  return (
    <section
      className="entity-trend-card entity-rm-card"
      aria-label="Regional Manager"
      aria-busy={isPending(entityStatus) || undefined}
      style={{ padding: "24px 34px 28px" }}
    >
      <div className="entity-trend-head" style={{ marginBottom: 20 }}>
        <h2>Regional Manager</h2>
      </div>

      {error && (
        <div className="entity-rm-alert" role="alert">
          <div className="entity-rm-alert-body">
            <svg viewBox="0 0 24 24" width={20} height={20} style={{ flexShrink: 0 }} fill="none" strokeWidth={2} aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="#fca5a5" fill="#fee2e2" />
              <path d="M12 8v4" stroke="#dc2626" strokeLinecap="round" />
              <path d="M12 16h.01" stroke="#dc2626" strokeLinecap="round" strokeWidth={3} />
            </svg>
            <span>{error}</span>
          </div>
          <button type="button" className="entity-rm-alert-dismiss" onClick={onDismissError} aria-label="Dismiss error">
            <svg viewBox="0 0 24 24" width={16} height={16} stroke="currentColor" fill="none" strokeWidth={2} aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {isPending(entityStatus) ? (
        <EntityRmSkeleton />
      ) : (
        <div className="entity-rm-content">
          <div className="entity-rm-info-section">
            <div className={`entity-rm-avatar-wrapper ${selectedRm ? "is-assigned" : ""}`}>
              {selectedRm ? (
                initialsOf(selectedRm.name)
              ) : (
                <svg className="entity-rm-avatar-icon" viewBox="0 0 24 24" aria-hidden="true" style={{ width: 22, height: 22, stroke: "#98a2b3" }}>
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
            </div>

            <div className="entity-rm-text-details">
              <h3 className="entity-rm-status-title" style={{ fontSize: 16, fontWeight: 700, color: "#1d2939" }}>
                {selectedRm ? selectedRm.name : "No Regional Manager Assigned"}
              </h3>
              {selectedRm ? (
                <div className="entity-rm-assigned-meta">
                  <span className="entity-rm-badge">Regional Manager</span>
                  <span className="entity-rm-meta-item">
                    <svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14">
                      <rect x="3" y="4" width="18" height="14" rx="2" />
                      <path d="m3 7 9 6 9-6" />
                    </svg>
                    {selectedRm.email}
                  </span>
                </div>
              ) : (
                <p className="entity-rm-status-subtitle" style={{ fontSize: 13, color: "#667085", marginTop: 4 }}>
                  Please select a regional manager from the dropdown below to assign them to this entity.
                </p>
              )}
            </div>
          </div>

          {!selectedRm ? (
            <div className="entity-rm-action-section" aria-busy={isPending(managers.status) || undefined}>
              <label htmlFor={selectId} className="entity-rm-label" style={{ fontSize: 12, fontWeight: 600, color: "#344054", marginBottom: 6 }}>
                Select Regional Manager
              </label>
              {isPending(managers.status) ? (
                <span className="skeleton-line skeleton-input" style={{ minHeight: 44 }} aria-hidden="true" />
              ) : managers.status === "error" ? (
                <RegionError
                  compact
                  message={managers.error ?? "Could not load regional managers."}
                  onRetry={managers.reload}
                />
              ) : (
                <StaticSelect
                  id={selectId}
                  value=""
                  options={options}
                  onChange={(value) => {
                    if (value) onAssign(value);
                  }}
                  placeholder="Select Regional Manager"
                  disabled={disabled}
                />
              )}
            </div>
          ) : (
            <div className="entity-rm-action-section" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="entity-rm-remove-btn"
                onClick={onRemove}
                disabled={disabled}
                title={disabled ? "Entity is inactive" : "Remove Regional Manager"}
                aria-label="Remove Regional Manager"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
                <span>Remove</span>
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
