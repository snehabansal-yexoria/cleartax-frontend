"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientHoldingEntity, ClientHoldingProperty } from "@/app/components/useClientHoldings";
import { announceDropdownOpen, dropdownRegistryEvent, isDropdownRegistryEvent } from "@/src/lib/dropdownRegistry";

/**
 * Entity / Property pickers for the Reports and Insights pages.
 * Fully theme-based custom dropdowns: keyboard and screen-reader accessible,
 * seamless dark & light mode styling, custom icons, and smooth micro-interactions.
 *
 * Picking a property also selects its entity; changing the entity drops a
 * property that isn't in it.
 */

type Props = {
  entities: ClientHoldingEntity[];
  entityId: string | null;
  propertyId: string | null;
  disabled?: boolean;
  onChange: (next: { entityId: string | null; propertyId: string | null }) => void;
};

function formatEntityType(type: string): string {
  if (!type) return "";
  switch (type.toLowerCase()) {
    case "individual":
      return "Individual";
    case "trust":
      return "Trust";
    case "company":
      return "Company";
    case "partnership":
      return "Partnership";
    case "smsf":
      return "SMSF";
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

function formatPropertyType(type: string): string {
  if (!type) return "";
  switch (type.toLowerCase()) {
    case "residential":
      return "Residential";
    case "commercial":
      return "Commercial";
    case "vacant_land":
      return "Vacant Land";
    default:
      return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function BuildingIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="scope-picker-icon"
      aria-hidden="true"
    >
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M12 6h.01" />
      <path d="M12 10h.01" />
      <path d="M12 14h.01" />
      <path d="M16 10h.01" />
      <path d="M16 14h.01" />
      <path d="M8 10h.01" />
      <path d="M8 14h.01" />
    </svg>
  );
}

function PropertyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="scope-picker-icon"
      aria-hidden="true"
    >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="scope-picker-chevron"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: "16px", height: "16px", color: "var(--accent)", flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

export default function ReportScopePicker({
  entities,
  entityId,
  propertyId,
  disabled = false,
  onChange,
}: Props) {
  const [isEntityOpen, setIsEntityOpen] = useState(false);
  const [isPropertyOpen, setIsPropertyOpen] = useState(false);

  const entityRef = useRef<HTMLDivElement>(null);
  const propertyRef = useRef<HTMLDivElement>(null);

  const entityDropdownId = "report-scope-entity-dropdown";
  const propertyDropdownId = "report-scope-property-dropdown";

  const selectedEntity = entities.find((e) => e.id === entityId) ?? null;
  const allProperties: ClientHoldingProperty[] = entities.flatMap((e) => e.properties);
  const selectedProperty = allProperties.find((p) => p.id === propertyId) ?? null;
  const entityOfProperty = (id: string) => entities.find((e) => e.properties.some((p) => p.id === id)) ?? null;

  // Listen for outside clicks, Escape key, and dropdown registry events
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (entityRef.current && !entityRef.current.contains(event.target as Node)) {
        setIsEntityOpen(false);
      }
      if (propertyRef.current && !propertyRef.current.contains(event.target as Node)) {
        setIsPropertyOpen(false);
      }
    }

    function handleOtherDropdown(event: Event) {
      if (!isDropdownRegistryEvent(event)) return;
      if (event.detail?.id && event.detail.id !== entityDropdownId) {
        setIsEntityOpen(false);
      }
      if (event.detail?.id && event.detail.id !== propertyDropdownId) {
        setIsPropertyOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsEntityOpen(false);
        setIsPropertyOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener(dropdownRegistryEvent, handleOtherDropdown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener(dropdownRegistryEvent, handleOtherDropdown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const toggleEntity = () => {
    if (disabled) return;
    setIsEntityOpen((prev) => {
      const next = !prev;
      if (next) {
        setIsPropertyOpen(false);
        announceDropdownOpen(entityDropdownId);
      }
      return next;
    });
  };

  const toggleProperty = () => {
    if (disabled) return;
    setIsPropertyOpen((prev) => {
      const next = !prev;
      if (next) {
        setIsEntityOpen(false);
        announceDropdownOpen(propertyDropdownId);
      }
      return next;
    });
  };

  const selectEntity = (nextEntityId: string | null) => {
    if (nextEntityId === null) {
      onChange({ entityId: null, propertyId: null });
    } else {
      const nextEntity = entities.find((e) => e.id === nextEntityId);
      const keepProperty =
        propertyId && nextEntity?.properties.some((p) => p.id === propertyId);
      onChange({ entityId: nextEntityId, propertyId: keepProperty ? propertyId : null });
    }
    setIsEntityOpen(false);
  };

  const selectProperty = (nextPropertyId: string | null) => {
    if (nextPropertyId === null) {
      onChange({ entityId, propertyId: null });
    } else {
      const parentEntity = entityOfProperty(nextPropertyId);
      onChange({
        entityId: parentEntity?.id ?? entityId,
        propertyId: nextPropertyId,
      });
    }
    setIsPropertyOpen(false);
  };

  return (
    <div className="report-scope-picker">
      {/* 1. Entity Custom Dropdown */}
      <div className="scope-picker-dropdown" ref={entityRef}>
        <button
          type="button"
          id="report-scope-entity"
          className={`scope-picker-trigger${isEntityOpen ? " is-open" : ""}`}
          onClick={toggleEntity}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isEntityOpen}
          aria-label="Select Entity"
          title={selectedEntity ? selectedEntity.name : "All entities"}
        >
          <div className="scope-picker-trigger-content">
            <BuildingIcon />
            <span className="scope-picker-label">
              {selectedEntity ? selectedEntity.name : "All entities"}
            </span>
            {selectedEntity && !selectedEntity.enabled && (
              <span className="scope-picker-inactive-badge">inactive</span>
            )}
          </div>
          <ChevronDownIcon />
        </button>

        {isEntityOpen && (
          <div className="scope-picker-menu" role="listbox" aria-label="Entities">
            {/* All Entities Option */}
            <button
              type="button"
              role="option"
              aria-selected={entityId === null}
              className={`scope-picker-item${entityId === null ? " is-selected" : ""}`}
              onClick={() => selectEntity(null)}
            >
              <div className="scope-picker-item-details">
                <span className="scope-picker-item-title font-semibold">All entities</span>
                <span className="scope-picker-item-sub">
                  Entire portfolio ({entities.length} {entities.length === 1 ? "entity" : "entities"})
                </span>
              </div>
              {entityId === null && <CheckIcon />}
            </button>

            {/* Individual Entities */}
            {entities.map((e) => {
              const isSelected = entityId === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`scope-picker-item${isSelected ? " is-selected" : ""}`}
                  onClick={() => selectEntity(e.id)}
                >
                  <div className="scope-picker-item-details">
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span className="scope-picker-item-title">{e.name}</span>
                      {!e.enabled && <span className="scope-picker-inactive-badge">inactive</span>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {e.entityType && (
                        <span className="scope-picker-badge">{formatEntityType(e.entityType)}</span>
                      )}
                      <span className="scope-picker-item-sub">
                        {e.properties.length} {e.properties.length === 1 ? "property" : "properties"}
                      </span>
                    </div>
                  </div>
                  {isSelected && <CheckIcon />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Property Custom Dropdown */}
      <div className="scope-picker-dropdown" ref={propertyRef}>
        <button
          type="button"
          id="report-scope-property"
          className={`scope-picker-trigger${isPropertyOpen ? " is-open" : ""}`}
          onClick={toggleProperty}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isPropertyOpen}
          aria-label="Select Property"
          title={selectedProperty ? selectedProperty.name : "All properties"}
        >
          <div className="scope-picker-trigger-content">
            <PropertyIcon />
            <span className="scope-picker-label">
              {selectedProperty ? selectedProperty.name : "All properties"}
            </span>
            {selectedProperty && !selectedProperty.enabled && (
              <span className="scope-picker-inactive-badge">inactive</span>
            )}
          </div>
          <ChevronDownIcon />
        </button>

        {isPropertyOpen && (
          <div className="scope-picker-menu" role="listbox" aria-label="Properties">
            {/* All Properties Option */}
            <button
              type="button"
              role="option"
              aria-selected={propertyId === null}
              className={`scope-picker-item${propertyId === null ? " is-selected" : ""}`}
              onClick={() => selectProperty(null)}
            >
              <div className="scope-picker-item-details">
                <span className="scope-picker-item-title font-semibold">All properties</span>
                <span className="scope-picker-item-sub">
                  {selectedEntity
                    ? `All properties in ${selectedEntity.name}`
                    : `Across entire portfolio (${allProperties.length} ${allProperties.length === 1 ? "property" : "properties"})`}
                </span>
              </div>
              {propertyId === null && <CheckIcon />}
            </button>

            {/* When a specific entity is chosen: only its properties */}
            {selectedEntity ? (
              selectedEntity.properties.length === 0 ? (
                <div style={{ padding: "12px 10px", fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
                  No properties registered under {selectedEntity.name}
                </div>
              ) : (
                selectedEntity.properties.map((p) => {
                  const isSelected = propertyId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`scope-picker-item${isSelected ? " is-selected" : ""}`}
                      onClick={() => selectProperty(p.id)}
                    >
                      <div className="scope-picker-item-details">
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span className="scope-picker-item-title">{p.name}</span>
                          {!p.enabled && <span className="scope-picker-inactive-badge">inactive</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {p.propertyType && (
                            <span className="scope-picker-badge">{formatPropertyType(p.propertyType)}</span>
                          )}
                          {p.locationText && (
                            <span className="scope-picker-item-sub">{p.locationText}</span>
                          )}
                        </div>
                      </div>
                      {isSelected && <CheckIcon />}
                    </button>
                  );
                })
              )
            ) : (
              /* When All entities is chosen: properties grouped by entity */
              entities
                .filter((e) => e.properties.length > 0)
                .map((e) => (
                  <div key={e.id}>
                    <div className="scope-picker-group-header">
                      <span>{e.name}</span>
                      <span className="scope-picker-badge">{formatEntityType(e.entityType)}</span>
                    </div>
                    {e.properties.map((p) => {
                      const isSelected = propertyId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`scope-picker-item${isSelected ? " is-selected" : ""}`}
                          onClick={() => selectProperty(p.id)}
                        >
                          <div className="scope-picker-item-details">
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span className="scope-picker-item-title">{p.name}</span>
                              {!p.enabled && <span className="scope-picker-inactive-badge">inactive</span>}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              {p.propertyType && (
                                <span className="scope-picker-badge">{formatPropertyType(p.propertyType)}</span>
                              )}
                              {p.locationText && (
                                <span className="scope-picker-item-sub">{p.locationText}</span>
                              )}
                            </div>
                          </div>
                          {isSelected && <CheckIcon />}
                        </button>
                      );
                    })}
                  </div>
                ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
