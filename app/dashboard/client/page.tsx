"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useId, useRef } from "react";
import { Skeleton } from "boneyard-js/react";
import { ClientEntitiesSkeleton } from "@/app/components/PortalSkeletons";
import { logout } from "@/src/lib/logout";
import { getSession } from "@/src/lib/session";
import type { CoreEntity } from "@/src/lib/coreApi";
import {
  dropdownRegistryEvent,
  announceDropdownOpen,
  isDropdownRegistryEvent,
} from "@/src/lib/dropdownRegistry";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

function titleCase(value: string) {
  if (!value) return "";
  return value
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatDate(dateString: string) {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (e) {
    return "";
  }
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '14px', height: '14px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

type SelectOption = {
  label: string;
  value: string;
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
}: StaticSelectProps) {
  const reactId = useId();
  const dropdownId = `transaction-select-${reactId}`;
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
      className={`transaction-field ${className}`}
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
          className="transaction-field-label"
          style={horizontal ? { margin: 0, whiteSpace: 'nowrap' } : undefined}
        >
          {label}
          {required && <em>*</em>}
        </span>
      )}
      <div
        ref={selectRef}
        className={`property-status-select transaction-select${isOpen ? " is-open" : ""
          }${disabled ? " is-disabled" : ""}`}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsOpen(false);
          }
        }}
      >
        <button
          type="button"
          className={triggerClassName || "property-status-trigger"}
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
                  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '16px', height: '16px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
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
}

export default function ClientPage() {
  const router = useRouter();
  const [entities, setEntities] = useState<CoreEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [sortBy, setSortBy] = useState<string>("name-asc");
  const [pageSize, setPageSize] = useState<string>("20");

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

        const res = await fetch("/api/entities", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;

        if (res.ok) {
          const data = (await res.json()) as { items?: CoreEntity[] };
          setEntities(data.items || []);
        } else {
          const data = await res.json().catch(() => ({}));
          setErrorMessage(data.error || "Failed to load your entities.");
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load client entities:", error);
          setErrorMessage("Unexpected error loading your workspace.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  // Sort and filter displayed entities
  const sortedEntities = [...entities].sort((a, b) => {
    if (sortBy === "name-asc") {
      return a.name.localeCompare(b.name);
    } else if (sortBy === "name-desc") {
      return b.name.localeCompare(a.name);
    } else if (sortBy === "date-desc") {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    } else if (sortBy === "date-asc") {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    }
    return 0;
  });

  const limit = pageSize === "all" ? entities.length : Number(pageSize);
  const displayedEntities = sortedEntities.slice(0, limit);

  return (
    <Skeleton
      name="client-entities-page"
      loading={isLoading}
      fallback={<ClientEntitiesSkeleton />}
    >
      <section className="portal-page">
        <div className="portal-page-header">
          <div>
            <p className="portal-kicker">Client Workspace</p>
            <h1>Your Entities</h1>
            <p>Register the legal structures that hold your properties.</p>
          </div>

          <div className="portal-page-actions">
            <Link
              href="/dashboard/client/entities/new"
              className="entity-wizard-primary"
            >
              + Add Entity
            </Link>
            <Link
              href="/dashboard/client/transactions/new"
              className="portal-secondary-link"
            >
              + Add Transaction
            </Link>
            <button
              type="button"
              className="portal-secondary-link"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>

        {errorMessage ? (
          <p className="entity-wizard-error">{errorMessage}</p>
        ) : entities.length === 0 ? (
          <div className="client-detail-empty">
            <p>
              You haven&apos;t added any entities yet. Use <strong>Add Entity</strong>{" "}
              to register your first Individual, Trust, Company or SMSF — then you
              can map properties and transactions to it.
            </p>
          </div>
        ) : (
          <div className="client-entities-container">
            {/* Sorting & Pagination Controls */}
            <div className="client-list-toolbar" style={{ justifyContent: 'flex-start', gap: '24px' }}>
              <StaticSelect
                label="Sort by"
                horizontal
                value={sortBy}
                options={[
                  { label: "Alphabetical (A - Z)", value: "name-asc" },
                  { label: "Alphabetical (Z - A)", value: "name-desc" },
                  { label: "Date Joined (Newest first)", value: "date-desc" },
                  { label: "Date Joined (Oldest first)", value: "date-asc" },
                ]}
                onChange={(value) => setSortBy(value)}
              />

              {entities.length > 20 && (
                <StaticSelect
                  label="Show"
                  horizontal
                  value={pageSize}
                  options={[
                    { label: "20 records", value: "20" },
                    { label: "50 records", value: "50" },
                    { label: "100 records", value: "100" },
                    { label: "200 records", value: "200" },
                    { label: "Load All", value: "all" },
                  ]}
                  onChange={(value) => setPageSize(value)}
                />
              )}
            </div>

            <ul className="client-detail-entity-list">
              {displayedEntities.map((entity) => (
                <li key={entity.id} className="client-detail-entity-row">
                  <div>
                    <Link
                      href={`/dashboard/client/entities/${entity.id}`}
                      className="client-detail-entity-link"
                    >
                      <strong>{entity.name}</strong>
                    </Link>
                    <span>{titleCase(entity.entityType)}</span>
                  </div>
                  <div className="client-detail-entity-meta">
                    {entity.createdAt && (
                      <span style={{ marginRight: '8px' }}>
                        Joined {formatDate(entity.createdAt)}
                      </span>
                    )}
                    <span>
                      {entity.beneficiaries.length} beneficiar
                      {entity.beneficiaries.length === 1 ? "y" : "ies"}
                    </span>
                    <Link
                      href={`/dashboard/client/entities/${entity.id}/edit`}
                      className="entity-icon-action"
                      aria-label={`Edit ${entity.name}`}
                      title="Edit entity"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>

            {entities.length > limit && (
              <div className="client-list-load-more-container">
                <button
                  type="button"
                  className="client-list-load-more-btn"
                  onClick={() => {
                    if (pageSize === "20") setPageSize("50");
                    else if (pageSize === "50") setPageSize("100");
                    else if (pageSize === "100") setPageSize("200");
                    else setPageSize("all");
                  }}
                >
                  Load More Entities
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </Skeleton>
  );
}
