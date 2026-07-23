"use client";

import { useEffect, useState, useId, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Skeleton } from "boneyard-js/react";
import { ClientEntitiesSkeleton } from "@/app/components/PortalSkeletons";
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

function EntityTypeIcon({ type }: { type?: string }) {
  const typeLower = type?.toLowerCase() || "";
  
  const iconContainerStyles = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    background: "#eff2fc",
    color: "#2f3e8b",
  };

  if (typeLower.includes("trust")) {
    return (
      <div style={iconContainerStyles}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 22h18" />
          <path d="M6 18V9" />
          <path d="M10 18V9" />
          <path d="M14 18V9" />
          <path d="M18 18V9" />
          <path d="M4 6h16l-8-4Z" />
        </svg>
      </div>
    );
  }

  if (typeLower.includes("company") || typeLower.includes("partnership") || typeLower.includes("smsf")) {
    return (
      <div style={iconContainerStyles}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      </div>
    );
  }

  return (
    <div style={iconContainerStyles}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </div>
  );
}

export default function ClientEntitiesPage() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [entities, setEntities] = useState<CoreEntity[]>([]);
  const [properties, setProperties] = useState<any[]>([]);

  // Desktop sorting & paging state
  const [sortBy, setSortBy] = useState<string>("name-asc");
  const [pageSize, setPageSize] = useState<string>("20");

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
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
        const allProperties = loadedEntities.flatMap((entity: any) => entity.properties || []);
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
    if (entity.entityType?.toLowerCase() === "trust") {
      typeLabel = "Discretionary Trust";
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
            background: "#f7f9fc", 
            minHeight: "100vh",
            paddingBottom: "90px"
          }}
        >
          <style>{`
            .mobile-client-dashboard {
              min-height: 100vh;
              background-color: #f7f9fc;
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            .m-db-subpage-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              background: #ffffff;
              border-bottom: 1px solid #eaeef4;
            }
            .m-db-entity-list-header {
              font-size: 14px;
              font-weight: 600;
              color: #475467;
              margin: 20px 0 12px 0;
            }
            .m-db-entity-card-row {
              background: #ffffff;
              border: 1px solid #eaeef4;
              border-radius: 16px;
              padding: 16px;
              margin-bottom: 12px;
              display: flex;
              flex-direction: column;
              box-shadow: 0 4px 12px rgba(16, 24, 40, 0.01);
              transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
              text-decoration: none;
              cursor: pointer;
            }
            .m-db-entity-card-row:hover {
              border-color: #2f3e8b;
              transform: translateY(-2px);
              box-shadow: 0 12px 20px rgba(27, 38, 92, 0.08);
            }
            .m-db-entity-card-top {
              display: flex;
              flex-direction: column;
            }
            .m-db-entity-card-name {
              font-size: 17px;
              font-weight: 700;
              color: #101828;
              margin: 0;
            }
            .m-db-entity-card-type {
              font-size: 13px;
              color: #667085;
              margin-top: 2px;
              font-weight: 500;
            }
            .m-db-entity-card-divider {
              height: 1px;
              background: #f2f4f7;
              margin: 12px 0;
            }
            .m-db-entity-card-bottom {
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .m-db-entity-card-col {
              display: flex;
              flex-direction: column;
            }
            .m-db-entity-card-col.right {
              align-items: flex-end;
              text-align: right;
            }
            .m-db-entity-card-label {
              font-size: 13px;
              color: #667085;
              font-weight: 500;
            }
            .m-db-entity-card-value {
              font-size: 15px;
              font-weight: 700;
              color: #101828;
              margin-top: 4px;
            }
          `}</style>
          
          {/* Header */}
          <div 
            className="m-db-subpage-header"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 20px",
              background: "#ffffff",
              borderBottom: "1px solid #eaeef4",
              marginBottom: "20px"
            }}
          >
            <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#101828", margin: 0 }}>Entities</h1>
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
                textDecoration: "none",
                fontSize: "24px",
                fontWeight: 400
              }}
            >
              +
            </Link>
          </div>

          {/* Content Area */}
          <div style={{ padding: "0 16px" }}>
            {/* Blue Summary Card (Total Under Management) */}
            <div className="entities-portfolio-summary-card relative w-full rounded-[20px] text-white overflow-hidden shadow-[0_10px_25px_rgba(27,38,92,0.15)] mb-6 pt-5 pb-5 pr-6 pl-11">
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
            <h3 className="m-db-entity-list-header">Your Entities</h3>

            {/* Entities List */}
            <div className="entities-cards-container">
              {entityListItems.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 16px", color: "#667085", background: "#ffffff", border: "1px solid #eaeef4", borderRadius: "16px", width: "100%" }}>
                  No entities available. Click the '+' button in the top right to create your first entity.
                </div>
              ) : (
                entityListItems.map((item) => (
                  <Link 
                    key={item.id} 
                    href={`/dashboard/client/entities/${item.id}`}
                    className="m-db-entity-card-row"
                  >
                    <div className="m-db-entity-card-top">
                      <h4 className="m-db-entity-card-name">{item.name}</h4>
                      <span className="m-db-entity-card-type">{item.typeText}</span>
                    </div>
                    
                    <div className="m-db-entity-card-divider" />
                    
                    <div className="m-db-entity-card-bottom">
                      <div className="m-db-entity-card-col">
                        <span className="m-db-entity-card-label">Properties</span>
                        <span className="m-db-entity-card-value">{item.propertiesCount}</span>
                      </div>
                      <div className="m-db-entity-card-col right">
                        <span className="m-db-entity-card-label">Net Value</span>
                        <span className="m-db-entity-card-value">{formatCurrencyShort(item.marketValue)}</span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
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
      <div 
        className="desktop-client-dashboard min-h-screen bg-[#f7f9fc] font-sans pb-10"
      >
        
        {/* Header */}
        <div className="flex justify-between items-center bg-transparent mb-8 pt-6 px-6 pb-0 min-[1200px]:px-10">
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Entities</h1>
          <Link 
            href="/dashboard/client/entities/new" 
            className="flex items-center justify-center w-10 h-10 rounded-full bg-[#1a235a] text-white no-underline text-2xl font-normal transition-all duration-200 ease hover:bg-[#2f3e8b] hover:scale-105"
          >
            +
          </Link>
        </div>
 
        {/* Content Area */}
        <div className="px-6 min-[1200px]:px-10">
          {/* Blue Summary Card (Total Under Management) */}
          <div 
            className="relative w-full rounded-[20px] pt-6 pb-6 pr-6 pl-12 text-white overflow-hidden shadow-[0_10px_25px_rgba(27,38,92,0.15)] mb-6 entities-portfolio-summary-card"
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
          <h3 className="text-sm font-semibold text-[#475467] mt-7 mb-4">Your Entities</h3>
 
          {/* Entities Grid */}
          <div className={entityListItems.length === 0 ? "w-full" : "grid grid-cols-1 gap-5 w-full min-[1200px]:grid-cols-2 min-[1200px]:gap-6 min-[1600px]:grid-cols-3"}>
            {entityListItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 16px", color: "#667085", background: "#ffffff", border: "1px solid #eaeef4", borderRadius: "16px", width: "100%" }}>
                No entities available. Click the '+' button in the top right to create your first entity.
              </div>
            ) : (
              entityListItems.map((item) => {
                // Format properties count text matching figma design
                let propCountText = "No properties yet";
                if (item.propertiesCount === 1) {
                  propCountText = "1 active";
                } else if (item.propertiesCount > 1) {
                  propCountText = `${item.propertiesCount} active`;
                }

                // Color code net value based on status (> 0 is green)
                const hasPositiveNet = item.marketValue > 0;

                return (
                  <Link 
                    key={item.id} 
                    href={`/dashboard/client/entities/${item.id}`}
                    className="bg-white border border-[#eaeef4] rounded-2xl p-6 flex flex-col shadow-[0_1px_3px_rgba(16,24,40,0.05),0_1px_2px_rgba(16,24,40,0.03)] transition-all duration-200 ease-in-out no-underline cursor-pointer hover:border-[#2f3e8b] hover:-translate-y-0.5 hover:shadow-[0_12px_20px_rgba(27,38,92,0.06)]"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex flex-col">
                        <h4 className="text-lg font-bold text-[#101828] m-0 leading-[1.3]">{item.name}</h4>
                        <span className="text-[13px] text-[#667085] mt-1 font-medium">{item.typeText}</span>
                      </div>
                      {/* SVG Icon on the top right */}
                      <EntityTypeIcon type={item.entityType} />
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col gap-1">
                        <span className="text-[13px] text-[#667085] font-medium">Properties</span>
                        <span className="text-[15px] font-semibold text-[#101828]">{propCountText}</span>
                      </div>
                      <div className="flex flex-col gap-1 items-end text-right">
                        <span className="text-[13px] text-[#667085] font-medium">Net Value</span>
                        <span className={`text-[15px] ${hasPositiveNet ? "text-[#039855] font-bold" : "text-[#101828] font-semibold"}`}>
                          {formatCurrencyShort(item.marketValue)}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
 
      </div>
    </Skeleton>
  );
}
