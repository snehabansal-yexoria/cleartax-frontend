"use client";

import { useEffect, useState, useId, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Skeleton } from "boneyard-js/react";
import ClientEntitiesSkeleton from "@/app/components/clients/ClientEntitiesSkeleton";
import { getSession } from "@/src/lib/session";
import { formatCurrencyShort } from "@/app/components/clients/CurrencyFormatter";
import type { CoreEntity } from "@/src/lib/coreApi";

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
  const dropdownId = `entity-select-${reactId}`;
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const selectRef = useRef<HTMLDivElement>(null);

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

type EntityCategoryConfig = {
  icon: React.ReactNode;
  iconBoxClass: string;
  badgeClass: string;
};

function getEntityCategoryConfig(type?: string): EntityCategoryConfig {
  const t = type?.toLowerCase().trim() || "";

  // 1. Company (e.g. "company", "pty ltd", "pty_ltd", "corporate")
  if (t.includes("company") || t.includes("pty") || t.includes("corp")) {
    return {
      icon: (
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[#2563EB] dark:text-[#60A5FA]"
        >
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
          <path d="M6 12H4a2 2 0 0 0-2 2v8" />
          <path d="M18 9h2a2 2 0 0 1 2 2v11" />
          <path d="M10 6h4" />
          <path d="M10 10h4" />
          <path d="M10 14h4" />
          <path d="M10 18h4" />
        </svg>
      ),
      iconBoxClass: "bg-[#EFF6FF] border-[#DBEAFE] dark:bg-blue-500/15 dark:border-blue-500/25",
      badgeClass: "bg-[#EBF3FF] text-[#2563EB] dark:bg-blue-500/20 dark:text-[#93C5FD]",
    };
  }

  // 2. Trust (e.g. "trust", "discretionary trust", "unit trust", "family trust")
  if (t.includes("trust")) {
    return {
      icon: (
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[#059669] dark:text-[#34D399]"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
      iconBoxClass: "bg-[#ECFDF5] border-[#D1FAE5] dark:bg-emerald-500/15 dark:border-emerald-500/25",
      badgeClass: "bg-[#ECFDF5] text-[#059669] dark:bg-emerald-500/20 dark:text-[#6EE7B7]",
    };
  }

  // 3. Partnership (e.g. "partnership", "partner", "joint")
  if (t.includes("partnership") || t.includes("partner") || t.includes("joint")) {
    return {
      icon: (
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[#7E22CE] dark:text-[#C084FC]"
        >
          <path d="m11 17 2 2a1 1 0 1 0 3-3" />
          <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
          <path d="m21 3 1 11h-2" />
          <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" />
          <path d="M3 4h8" />
        </svg>
      ),
      iconBoxClass: "bg-[#F3E8FF] border-[#E9D5FF] dark:bg-purple-500/15 dark:border-purple-500/25",
      badgeClass: "bg-[#F3E8FF] text-[#7E22CE] dark:bg-purple-500/20 dark:text-[#D8B4FE]",
    };
  }

  // 4. Individual (e.g. "individual", "personal", "sole trader")
  if (t.includes("individual") || t.includes("sole") || t.includes("person")) {
    return {
      icon: (
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[#E11D48] dark:text-[#FB7185]"
        >
          <circle cx="12" cy="8" r="4.5" />
          <path d="M20 21a8 8 0 0 0-16 0" />
        </svg>
      ),
      iconBoxClass: "bg-[#FFF1F2] border-[#FFE4E6] dark:bg-rose-500/15 dark:border-rose-500/25",
      badgeClass: "bg-[#FFF1F2] text-[#E11D48] dark:bg-rose-500/20 dark:text-[#FDA4AF]",
    };
  }

  // 5. SMSF (Self-Managed Super Fund / Superannuation)
  if (t.includes("smsf") || t.includes("super") || t.includes("fund")) {
    return {
      icon: (
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[#D97706] dark:text-[#FBBF24]"
        >
          <line x1="3" y1="22" x2="21" y2="22" />
          <line x1="6" y1="18" x2="6" y2="11" />
          <line x1="10" y1="18" x2="10" y2="11" />
          <line x1="14" y1="18" x2="14" y2="11" />
          <line x1="18" y1="18" x2="18" y2="11" />
          <polygon points="12 2 20 7 4 7" />
        </svg>
      ),
      iconBoxClass: "bg-[#FEF3C7] border-[#FDE68A] dark:bg-amber-500/15 dark:border-amber-500/25",
      badgeClass: "bg-[#FEF3C7] text-[#D97706] dark:bg-amber-500/20 dark:text-[#FCD34D]",
    };
  }

  // 6. Default / Other Category
  return {
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-[#475569] dark:text-[#94A3B8]"
      >
        <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
    iconBoxClass: "bg-[#F1F5F9] border-[#E2E8F0] dark:bg-slate-700/30 dark:border-slate-600/30",
    badgeClass: "bg-[#F1F5F9] text-[#475569] dark:bg-slate-700/40 dark:text-[#CBD5E1]",
  };
}

export function EntityTypeIcon({ type }: { type?: string }) {
  const config = getEntityCategoryConfig(type);
  return (
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${config.iconBoxClass}`}>
      {config.icon}
    </div>
  );
}

function EntitiesSectionHeader() {
  return (
    <div className="flex items-center gap-3.5 mb-6 mt-6 md:mt-8">
      {/* Distinct Layers icon to differentiate from the Company building card icon */}
      <div className="w-12 h-12 rounded-[14px] bg-[#EFF6FF] dark:bg-blue-500/15 text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center shrink-0 border border-blue-100/60 dark:border-blue-500/20 shadow-sm">
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      </div>
      <div className="flex flex-col">
        <h2 className="text-[19px] md:text-[20px] font-bold text-t-primary m-0 leading-tight">
          Your Entities
        </h2>
        <p className="text-[13px] md:text-[14px] text-t-secondary m-0 mt-0.5 font-normal">
          Manage and view the details of all your entities in one place.
        </p>
      </div>
    </div>
  );
}

interface EntityCardProps {
  item: {
    id: string;
    name: string;
    typeText: string;
    propertiesCount: number;
    marketValue: number;
    entityType?: string;
  };
}

function EntityCard({ item }: EntityCardProps) {
  const config = getEntityCategoryConfig(item.entityType);

  let propCountText = "No properties yet";
  if (item.propertiesCount === 1) {
    propCountText = "1 active";
  } else if (item.propertiesCount > 1) {
    propCountText = `${item.propertiesCount} active`;
  }

  return (
    <Link
      href={`/dashboard/client/entities/${item.id}`}
      className="group bg-white dark:bg-[var(--surface-1)] border border-[#EAEFF4] dark:border-[var(--border)] rounded-[20px] p-5 md:p-6 flex flex-col justify-between shadow-[0_2px_8px_rgba(16,24,40,0.02)] hover:shadow-[0_12px_24px_rgba(27,38,92,0.06)] dark:hover:shadow-[0_12px_24px_rgba(0,0,0,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 dark:hover:border-blue-500/40 no-underline cursor-pointer"
    >
      {/* Top Section */}
      <div className="flex items-center gap-3.5 mb-4 min-w-0">
        {/* Category Icon */}
        <div
          className={`w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 border transition-transform duration-200 group-hover:scale-105 shadow-sm ${config.iconBoxClass}`}
        >
          {config.icon}
        </div>

        {/* Entity Name & Category Pill Badge */}
        <div className="flex flex-col min-w-0">
          <h4 className="text-[17px] md:text-[18px] font-bold text-t-primary m-0 truncate group-hover:text-[#2563EB] dark:group-hover:text-[#60A5FA] transition-colors leading-snug">
            {item.name}
          </h4>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium w-fit mt-1.5 ${config.badgeClass}`}
          >
            {item.typeText}
          </span>
        </div>
      </div>

      {/* Horizontal Divider */}
      <div className="h-[1px] bg-[#F2F4F7] dark:bg-white/[0.08] w-full my-3.5" />

      {/* Bottom Stats Section */}
      <div className="grid grid-cols-2 gap-4 items-center">
        {/* Properties Stat */}
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-1.5 text-t-secondary">
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 opacity-70"
            >
              <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
              <path d="M9 22v-4h6v4" />
              <path d="M8 6h.01" />
              <path d="M16 6h.01" />
              <path d="M8 10h.01" />
              <path d="M16 10h.01" />
              <path d="M8 14h.01" />
              <path d="M16 14h.01" />
            </svg>
            <span className="text-[13px] font-medium text-t-secondary truncate">Properties</span>
          </div>
          <span className="text-[15px] font-bold text-t-primary truncate">
            {propCountText}
          </span>
        </div>

        {/* Net Value Stat */}
        <div className="flex flex-col gap-1 min-w-0 items-start pl-2">
          <div className="flex items-center gap-1.5 text-t-secondary">
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 opacity-70"
            >
              <ellipse cx="12" cy="6" rx="8" ry="3" />
              <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
              <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
            </svg>
            <span className="text-[13px] font-medium text-t-secondary truncate">Net Value</span>
          </div>
          <span className="text-[15px] font-bold text-t-primary truncate">
            {formatCurrencyShort(item.marketValue)}
          </span>
        </div>
      </div>
    </Link>
  );
}

interface EntityProperty {
  id?: string;
  entityId?: string;
  estimatedMarketValue?: number;
  [key: string]: unknown;
}

export default function ClientEntitiesPage() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [entities, setEntities] = useState<CoreEntity[]>([]);
  const [properties, setProperties] = useState<EntityProperty[]>([]);

  // Desktop sorting & paging state
  const [sortBy, setSortBy] = useState<string>("name-asc");
  const [pageSize, setPageSize] = useState<string>("20");

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

        // Fetch entities
        const res = await fetch("/api/entities", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;

        let loadedEntities: CoreEntity[] = [];
        if (res.ok) {
          const data = await res.json();
          loadedEntities = data.items || [];
          if (!cancelled) setEntities(loadedEntities);
        }

        if (cancelled || loadedEntities.length === 0) {
          if (!cancelled) setIsLoading(false);
          return;
        }

        // Fetch properties using nested entities response
        const allProperties = loadedEntities.flatMap(
          (entity) => (entity as unknown as { properties?: EntityProperty[] }).properties || []
        );
        if (!cancelled) setProperties(allProperties);
      } catch (err) {
        console.error("Failed to load entities page:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);



  // Total Under Management (Sum of property estimated market values)
  const totalMarketValue = properties.reduce((sum, p) => sum + (p.estimatedMarketValue || 0), 0);
  const displayPortfolioValue = totalMarketValue;
  const entitiesCount = entities.length;

  const entityListItems = entities.map((entity) => {
    const entityProperties = properties.filter((p) => p.entityId === entity.id);
    const mValue = entityProperties.reduce((sum, p) => sum + (p.estimatedMarketValue || 0), 0);

    let typeLabel = titleCase(entity.entityType);
    const lower = entity.entityType?.toLowerCase() || "";
    if (lower === "trust") {
      typeLabel = "Discretionary Trust";
    } else if (lower === "smsf") {
      typeLabel = "SMSF";
    }

    return {
      id: entity.id,
      name: entity.name,
      typeText: typeLabel,
      propertiesCount: entityProperties.length,
      marketValue: mValue,
      entityType: entity.entityType,
    };
  });

  // Desktop sorting logic
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

  if (isMobile) {
    return (
      <Skeleton
        name="client-entities-page"
        loading={isLoading}
        fallback={<ClientEntitiesSkeleton />}
      >
        <div
          className="mobile-client-dashboard"
          style={{
            minHeight: "100vh",
            paddingBottom: "90px"
          }}
        >
          {/* Header */}
          <div
            className="m-db-subpage-header"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 20px",
              background: "var(--surface-1)",
              borderBottom: "1px solid var(--border)",
              marginBottom: "20px"
            }}
          >
            <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Entities</h1>
            <Link
              href="/dashboard/client/entities/new"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "40px",
                height: "40px",
                borderRadius: "20px",
                background: "#1a235a",
                color: "#ffffff",
                textDecoration: "none"
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ width: "20px", height: "20px" }}
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </Link>

          </div>

          {/* Content Area */}
          <div style={{ padding: "0 16px" }}>
            {/* Blue Summary Card (Total Under Management) */}
            <div className="entities-portfolio-summary-card relative w-full rounded-[20px] text-white overflow-hidden shadow-[0_10px_25px_rgba(27,38,92,0.15)] mb-6 py-5 px-6">
              <div style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.7)", fontWeight: 500, letterSpacing: "0.5px" }}>
                Total Under Management
              </div>
              <div style={{ fontSize: "36px", fontWeight: 700, color: "#ffffff", margin: "6px 0" }}>
                {formatCurrencyShort(displayPortfolioValue)}
              </div>
              <div style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.7)", fontWeight: 500 }}>
                Across {entitiesCount} entities
              </div>
            </div>

            {/* Your Entities Header */}
            <EntitiesSectionHeader />

            {/* Entities List */}
            {entityListItems.length === 0 ? (
              <div className="w-full text-center py-12 px-6 rounded-2xl bg-white dark:bg-[var(--surface-1)] border border-[#EAEFF4] dark:border-[var(--border)] text-t-secondary shadow-sm">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 mx-auto flex items-center justify-center mb-3 text-slate-400">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-t-primary m-0">No entities available</p>
                <p className="text-sm text-t-secondary m-0 mt-1">
                  Click the &apos;+&apos; button in the top right to create your first entity.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {entityListItems.map((item) => (
                  <EntityCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>

        </div>
      </Skeleton>
    );
  }

  // Desktop / Tablet Responsive View
  return (
    <Skeleton
      name="client-entities-page"
      loading={isLoading}
      fallback={<ClientEntitiesSkeleton />}
    >
      <div className="desktop-client-dashboard">

        {/* Header */}
        <div className="flex justify-between items-center bg-transparent mb-8 pt-0 pb-0">
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Entities</h1>
          <Link
            href="/dashboard/client/entities/new"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "40px",
              height: "40px",
              borderRadius: "20px",
              background: "#1a235a",
              color: "#ffffff",
              textDecoration: "none"
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: "20px", height: "20px" }}
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </Link>
        </div>

        {/* Content Area */}
        <div>
          {/* Blue Summary Card (Total Under Management) */}
          <div
            className="relative w-full rounded-[20px] py-6 px-6 text-white overflow-hidden shadow-[0_10px_25px_rgba(27,38,92,0.15)] mb-6 entities-portfolio-summary-card"
          >
            <div style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.7)", fontWeight: 500, letterSpacing: "0.5px" }}>
              Total Under Management
            </div>
            <div style={{ fontSize: "36px", fontWeight: 700, color: "#ffffff", margin: "6px 0" }}>
              {formatCurrencyShort(displayPortfolioValue)}
            </div>
            <div style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.7)", fontWeight: 500 }}>
              Across {entitiesCount} entities
            </div>
          </div>

          {/* Your Entities Header */}
          <EntitiesSectionHeader />

          {/* Entities Grid */}
          {entityListItems.length === 0 ? (
            <div className="w-full text-center py-12 px-6 rounded-2xl bg-white dark:bg-[var(--surface-1)] border border-[#EAEFF4] dark:border-[var(--border)] text-t-secondary shadow-sm">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 mx-auto flex items-center justify-center mb-3 text-slate-400">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </div>
              <p className="text-base font-semibold text-t-primary m-0">No entities available</p>
              <p className="text-sm text-t-secondary m-0 mt-1">
                Click the &apos;+&apos; button in the top right to create your first entity.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
              {entityListItems.map((item) => (
                <EntityCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

      </div>
    </Skeleton>
  );
}
