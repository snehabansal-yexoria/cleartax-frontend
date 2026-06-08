"use client";

import { useEffect, useState, useId, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Skeleton } from "boneyard-js/react";
import { ClientEntitiesSkeleton } from "@/app/components/PortalSkeletons";
import { getSession } from "@/src/lib/session";
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

        // Fetch properties in parallel
        const propertyPromises = loadedEntities.map(async (entity) => {
          try {
            const propRes = await fetch(`/api/entities/${entity.id}/properties`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (propRes.ok) {
              const data = await propRes.json();
              return (data.items || []).map((p: any) => ({ ...p, entityId: entity.id }));
            }
          } catch (err) {
            console.error(`Failed to fetch properties:`, err);
          }
          return [];
        });

        const propertiesArrays = await Promise.all(propertyPromises);
        const allProperties = propertiesArrays.flat();
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

  function formatCurrencyShort(value: number) {
    if (value === 0) return "0";
    const sign = value < 0 ? "-" : "";
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
      return `${sign}$${(absValue / 1000000).toFixed(2)}M`;
    }
    if (absValue >= 1000) {
      const kVal = absValue / 1000;
      if (kVal % 1 === 0) {
        return `${sign}$${kVal.toFixed(0)}K`;
      }
      return `${sign}$${kVal.toFixed(1)}K`;
    }
    return `${sign}$${absValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }

  const isDemoMode = entities.length === 0;

  // Total Under Management (Sum of property estimated market values)
  const totalMarketValue = properties.reduce((sum, p) => sum + (p.estimatedMarketValue || 0), 0);
  const displayPortfolioValue = isDemoMode ? 3250000 : totalMarketValue;
  const entitiesCount = isDemoMode ? 3 : entities.length;

  const entityListItems = isDemoMode
    ? [
        {
          id: "demo-ent-1",
          name: "Johnson Family Trust",
          typeText: "Discretionary Trust",
          propertiesCount: 2,
          marketValue: 2400000,
        },
        {
          id: "demo-ent-2",
          name: "SJ Holdings Pvt Ltd",
          typeText: "Company",
          propertiesCount: 1,
          marketValue: 850000,
        },
        {
          id: "demo-ent-3",
          name: "Sarah Johnson",
          typeText: "Individual",
          propertiesCount: 0,
          marketValue: 0,
        }
      ]
    : entities.map((entity) => {
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
          paddingBottom: isMobile ? "90px" : "40px"
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
          .m-db-net-card {
            background-image: 
              linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px),
              linear-gradient(135deg, #1b265c 0%, #2f3e8b 100%);
            background-size: 16px 16px, 16px 16px, 100% 100%;
            border-radius: 20px;
            padding: 24px;
            color: #ffffff;
            box-shadow: 0 10px 25px rgba(27, 38, 92, 0.2);
            position: relative;
            overflow: hidden;
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
          @media (min-width: 769px) {
            .entities-cards-container {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
              gap: 20px;
            }
            .m-db-net-card {
              max-width: 600px;
            }
            .m-db-entity-card-row {
              margin-bottom: 0 !important;
            }
            .m-db-entity-card-row:hover {
              transform: translateY(-4px);
              box-shadow: 0 16px 28px rgba(27, 38, 92, 0.12);
            }
          }
        `}</style>
        
        {/* Header */}
        <div 
          className="m-db-subpage-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: isMobile ? "16px 20px" : "20px 40px",
            background: "#ffffff",
            borderBottom: "1px solid #eaeef4",
            marginBottom: "20px"
          }}
        >
          <h1 style={{ fontSize: isMobile ? "24px" : "28px", fontWeight: 700, color: "#101828", margin: 0 }}>Entities</h1>
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
        <div style={{ padding: isMobile ? "0 16px" : "0 40px" }}>
          {/* Blue Summary Card (Total Under Management) */}
          <div className="m-db-net-card" style={{ padding: "20px 24px", marginBottom: "24px" }}>
            <div style={{ fontSize: "14px", color: "rgba(255, 255, 255, 0.75)", fontWeight: 600 }}>
              Total Under Management
            </div>
            <div style={{ fontSize: "36px", fontWeight: 800, color: "#ffffff", margin: "8px 0" }}>
              {formatCurrencyShort(displayPortfolioValue)}
            </div>
            <div style={{ fontSize: "14px", color: "rgba(255, 255, 255, 0.75)", fontWeight: 500 }}>
              Across {entitiesCount} entities
            </div>
          </div>

          {/* Your Entities Header */}
          <h3 className="m-db-entity-list-header">Your Entities</h3>

          {/* Entities List */}
          <div className="entities-cards-container">
            {entityListItems.map((item) => (
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
            ))}
          </div>
        </div>

      </div>
    </Skeleton>
  );
}
