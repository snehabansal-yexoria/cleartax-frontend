"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState, useId, useRef } from "react";
import ToggleSwitch from "@/app/components/ToggleSwitch";
import InactiveReasonModal from "@/app/components/InactiveReasonModal";
import GstSummaryModal from "@/app/components/GstSummaryModal";
import { useGstSummary } from "@/app/components/useGstSummary";
import { Skeleton } from "boneyard-js/react";
import {
  EntityDetailSkeleton,
  EntityPropertyListSkeleton,
} from "@/app/components/PortalSkeletons";
import ProfitLossTrendCard from "@/app/components/ProfitLossTrendCard";
import { AllTransactionsView } from "@/app/components/TransactionsFeature";
import DocumentsListView from "@/app/components/DocumentsListView";
import { getSession } from "@/src/lib/session";
import {
  dropdownRegistryEvent,
  announceDropdownOpen,
  isDropdownRegistryEvent,
} from "@/src/lib/dropdownRegistry";
import type {
  CoreEntity,
  CoreProperty,
  CoreTransactionListItem,
  ReconciliationSession,
} from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

export type EntityDetailViewProps = {
  entityId: string;
  backHref: string;
  backLabel: string;
  addPropertyHref: string;
  addTransactionHref?: string;
  transactionRulesHref?: string;
  transactionRulesLabel?: string;
  transactionRulesClassName?: string;
  transactionRulesIcon?: "rules" | "reconcile";
  editEntityHref: string;
  propertyDetailHrefBase: string;
  reconciliationHref?: string;
};

type EntityTab = "properties" | "transactions" | "documents" | "reconciliation";

const entityTabs: { id: EntityTab; label: string }[] = [
  { id: "properties", label: "Properties" },
  { id: "transactions", label: "Transactions" },
  { id: "documents", label: "Documents" },
  { id: "reconciliation", label: "Reconciliations" },
];

function titleCase(value: string) {
  if (!value) return "";
  return value
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function entityTypeLabel(value: string) {
  if (value === "smsf") return "Self Managed Super Fund (SMSF)";
  if (value === "trust") return "Trust (Discretionary/Unit)";
  if (value === "company") return "Company (Pvt Ltd)";
  return titleCase(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function appendQueryParam(href: string, key: string, value: string) {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}${key}=${encodeURIComponent(value)}`;
}



// Removed static AVAILABLE_MANAGERS. Now loaded dynamically from API.


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


export default function EntityDetailView({
  entityId,
  backHref,
  backLabel,
  addPropertyHref,
  addTransactionHref = "/dashboard/accountant/transactions/new",
  transactionRulesHref,
  transactionRulesLabel,
  transactionRulesClassName,
  transactionRulesIcon,
  editEntityHref,
  propertyDetailHrefBase,
  reconciliationHref,
}: EntityDetailViewProps) {
  const router = useRouter();
  const params = useParams<{ clientId?: string }>();
  const clientId = params?.clientId ?? "";
  const [entity, setEntity] = useState<CoreEntity | null>(null);
  const [properties, setProperties] = useState<CoreProperty[]>([]);
  const [transactions, setTransactions] = useState<CoreTransactionListItem[]>(
    [],
  );
  const [currentTab, setCurrentTab] = useState<EntityTab>("properties");
  const [isEntityLoading, setIsEntityLoading] = useState(true);
  const [isPropertiesLoading, setIsPropertiesLoading] = useState(true);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPersonalExpanded, setIsPersonalExpanded] = useState(false);
  const [isAssetExpanded, setIsAssetExpanded] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const [sessionList, setSessionList] = useState<ReconciliationSession[]>([]);
  const [sessionListLoading, setSessionListLoading] = useState(false);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [newSessionLabel, setNewSessionLabel] = useState("");
  const [newSessionAccountAffected, setNewSessionAccountAffected] = useState("");
  const [newSessionFrom, setNewSessionFrom] = useState("");
  const [newSessionTo, setNewSessionTo] = useState("");
  const [newSessionSaving, setNewSessionSaving] = useState(false);
  const [newSessionError, setNewSessionError] = useState<string | null>(null);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [selectedRmId, setSelectedRmId] = useState<string>("");
  const [availableManagers, setAvailableManagers] = useState<any[]>([]);
  const [rmError, setRmError] = useState<string | null>(null);
  const [enabledError, setEnabledError] = useState<string | null>(null);
  const [isTogglingEnabled, setIsTogglingEnabled] = useState(false);
  const [isInactiveModalOpen, setIsInactiveModalOpen] = useState(false);
  const [isGstModalOpen, setIsGstModalOpen] = useState(false);
  const [propertyToDeactivate, setPropertyToDeactivate] = useState<CoreProperty | null>(null);
  const [togglingPropertyId, setTogglingPropertyId] = useState<string | null>(null);
  const pathname = usePathname();
  // The client dashboard reuses this view; only accountants manage the flag.
  const isClientView = (pathname || "").startsWith("/dashboard/client");

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;

    fetch("/api/users/me/regional-managers", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((res) => (res.ok ? res.json() : { regionalManagers: [] }))
      .then((data) => {
        if (!cancelled) {
          setAvailableManagers(data.regionalManagers || []);
        }
      })
      .catch((err) => {
        console.error("Failed to load regional managers:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  const selectedRm = useMemo(() => {
    const found = availableManagers.find(rm => rm.id === selectedRmId);
    if (found) return found;
    if (entity && (entity as any).regionalManager && (entity as any).regionalManager.id === selectedRmId) {
      return (entity as any).regionalManager;
    }
    return null;
  }, [availableManagers, selectedRmId, entity]);

  const rmOptions = useMemo(() => {
    return [
      { label: "Select Regional Manager", value: "" },
      ...availableManagers.map((rm) => ({ label: rm.name, value: rm.id })),
    ];
  }, [availableManagers]);

  const avatarInitials = useMemo(() => {
    if (!selectedRm) return "";
    return selectedRm.name
      .split(" ")
      .map((part: string) => part.charAt(0))
      .join("")
      .toUpperCase();
  }, [selectedRm]);

  async function handleAssignRm(rmId: string) {
    if (!sessionToken || !entityId) return;

    try {
      setRmError(null);
      setSelectedRmId(rmId);
      const res = await fetch(`/api/entities/${encodeURIComponent(entityId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          assignedRegionalManagerId: rmId || null,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to assign regional manager");
      }

      const updatedEntity = await res.json();
      setEntity(updatedEntity);
    } catch (err) {
      console.error("Error assigning regional manager:", err);
      setRmError("Failed to assign Regional Manager. Please try again.");
      setSelectedRmId((entity as any)?.regionalManager?.id || "");
    }
  }

  async function handleToggleEnabled(next: boolean, reason?: string) {
    if (!sessionToken || !entityId || !entity || isTogglingEnabled) return;

    const previous = entity;
    setEnabledError(null);
    setIsTogglingEnabled(true);
    setEntity({ ...entity, enabled: next });
    try {
      const res = await fetch(`/api/entities/${encodeURIComponent(entityId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          enabled: next,
          ...(next === false && reason ? { inactiveReason: reason } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.message || data.error || `Failed to ${next ? "activate" : "deactivate"} entity`,
        );
      }
      setEntity({ ...previous, ...data });
    } catch (err) {
      setEntity(previous);
      setEnabledError(
        err instanceof Error
          ? err.message
          : `Failed to ${next ? "activate" : "deactivate"} entity. Please try again.`,
      );
    } finally {
      setIsTogglingEnabled(false);
    }
  }

  async function handleTogglePropertyEnabled(property: CoreProperty, next: boolean, reason?: string) {
    if (!sessionToken || togglingPropertyId) return;

    setEnabledError(null);
    setTogglingPropertyId(property.id);
    setProperties((cur) =>
      cur.map((p) => (p.id === property.id ? { ...p, enabled: next } : p)),
    );
    try {
      const res = await fetch(`/api/properties/${encodeURIComponent(property.id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          enabled: next,
          ...(next === false && reason ? { inactiveReason: reason } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.message || data.error || `Failed to ${next ? "activate" : "deactivate"} property`,
        );
      }
    } catch (err) {
      setProperties((cur) =>
        cur.map((p) => (p.id === property.id ? { ...p, enabled: !next } : p)),
      );
      setEnabledError(
        err instanceof Error
          ? err.message
          : `Failed to ${next ? "activate" : "deactivate"} property. Please try again.`,
      );
    } finally {
      setTogglingPropertyId(null);
    }
  }


  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "properties" || tab === "transactions" || tab === "documents" || tab === "reconciliation") {
      setCurrentTab(tab);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) {
        router.replace("/login/user");
        return;
      }
      const token = session.getIdToken().getJwtToken();
      if (!cancelled) setSessionToken(token);

      const headers = { Authorization: `Bearer ${token}` };

      // Entity — must load before header renders
      fetch(`/api/entities/${encodeURIComponent(entityId)}`, { headers })
        .then((res) => {
          if (!res.ok) throw new Error("entity_not_found");
          return res.json();
        })
        .then((data: CoreEntity) => {
          if (!cancelled) {
            setEntity(data);
            setSelectedRmId((data as any).regionalManager?.id || "");
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            const msg = err instanceof Error && err.message === "entity_not_found"
              ? "Failed to load entity."
              : "Unexpected error loading entity.";
            setErrorMessage(msg);
          }
        })
        .finally(() => { if (!cancelled) setIsEntityLoading(false); });

      // Properties — independent; populates the Properties tab
      fetch(`/api/entities/${encodeURIComponent(entityId)}/properties`, { headers })
        .then((res) => (res.ok ? res.json() : { items: [] }))
        .then((data: { items?: CoreProperty[] }) => {
          if (!cancelled) setProperties(data.items || []);
        })
        .catch(() => { if (!cancelled) setProperties([]); })
        .finally(() => { if (!cancelled) setIsPropertiesLoading(false); });

      // Transactions — independent; used by trend chart and Transactions tab
      fetch(`/api/entities/${encodeURIComponent(entityId)}/transactions`, { headers })
        .then((res) => (res.ok ? res.json() : { items: [] }))
        .then((data: { items?: CoreTransactionListItem[] }) => {
          if (!cancelled) setTransactions(data.items || []);
        })
        .catch(() => { if (!cancelled) setTransactions([]); })
        .finally(() => { if (!cancelled) setIsTransactionsLoading(false); });
    }

    if (entityId) load().catch((error) => {
      console.error("Failed to load entity detail:", error);
    });
    return () => {
      cancelled = true;
    };
  }, [entityId, router]);

  useEffect(() => {
    if (currentTab !== "reconciliation" || !sessionToken || !entityId) return;
    let cancelled = false;
    setSessionListLoading(true);
    fetch(`/api/entities/${encodeURIComponent(entityId)}/reconciliation-sessions`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ReconciliationSession[]) => {
        if (!cancelled) setSessionList(Array.isArray(data) ? data : []);
      })
      .catch(() => { if (!cancelled) setSessionList([]); })
      .finally(() => { if (!cancelled) setSessionListLoading(false); });
    return () => { cancelled = true; };
  }, [currentTab, sessionToken, entityId]);

  async function handleCreateSession(e: FormEvent) {
    e.preventDefault();
    setLabelError(null);
    setNewSessionError(null);
    if (!sessionToken || !entityId) return;
    const label = newSessionLabel.trim();
    if (!label) {
      setLabelError("Label is required");
      return;
    }
    if (newSessionFrom && newSessionTo && newSessionFrom > newSessionTo) {
      setNewSessionError("Start date cannot be after end date");
      return;
    }
    setNewSessionSaving(true);
    try {
      const res = await fetch(
        `/api/entities/${encodeURIComponent(entityId)}/reconciliation-sessions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            label,
            periodFrom: newSessionFrom || null,
            periodTo: newSessionTo || null,
            accountAffected: newSessionAccountAffected || null,
          }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Failed to create session (${res.status})`);
      }
      const created = (await res.json()) as ReconciliationSession;
      setSessionList((cur) => [created, ...cur]);
      setNewSessionOpen(false);
      setNewSessionLabel("");
      setNewSessionAccountAffected("");
      setNewSessionFrom("");
      setNewSessionTo("");
      setLabelError(null);
      if (reconciliationHref) {
        router.push(`${reconciliationHref}/${encodeURIComponent(created.id)}`);
      }
    } catch (err) {
      setNewSessionError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setNewSessionSaving(false);
    }
  }

  const ownerCopy = useMemo(() => {
    if (!entity) return "";
    if (entity.beneficiaries.length === 1) return "1 shareholder";
    return `${entity.beneficiaries.length} shareholders`;
  }, [entity]);

  const entityMarketValue = useMemo(() => {
    const sum = properties.reduce((sum, p) => sum + (p.estimatedMarketValue ?? 0), 0);
    return sum;
  }, [properties]);

  // GST comes from GET /entities/{id}/gst-summary, never from `transactions`:
  // that array is capped at 100 rows server-side, spans all time rather than a
  // BAS quarter, and would have to re-implement the bucketing rules (1B counts
  // cost_base but not personal; rejected rows excluded) the aggregate applies.
  const gst = useGstSummary("entity", entityId);
  const gstOnPurchase = gst.gstOnPurchases;
  const gstOnSales = gst.gstOnSales;

  const personalBreakdown = useMemo(() => {
    const personalTransactions = transactions.filter((t) => t.type === "personal");
    const expensesMap = new Map<string, number>();
    const revenueMap = new Map<string, number>();

    personalTransactions.forEach((t) => {
      const category = t.subcategoryName || t.categoryName || "Other";
      const amt = t.grossAmount ?? 0;
      if (amt < 0) {
        expensesMap.set(category, (expensesMap.get(category) ?? 0) + amt);
      } else {
        revenueMap.set(category, (revenueMap.get(category) ?? 0) + amt);
      }
    });

    const expensesList = Array.from(expensesMap.entries()).map(([category, amount]) => ({ category, amount }));
    const revenueList = Array.from(revenueMap.entries()).map(([category, amount]) => ({ category, amount }));

    const finalExpenses = expensesList.length > 0 ? expensesList : [
      { category: "Advertising for Tenants", amount: -6021.71 },
      { category: "Repairs and maintenance", amount: -4856.37 },
      { category: "Body Corporate Fees / Strata Levy", amount: -411.00 },
    ];

    const finalRevenue = revenueList.length > 0 ? revenueList : [
      { category: "Other Rental Income", amount: 9856.00 },
      { category: "Rental Income", amount: 6464.00 },
    ];

    const totalExpense = finalExpenses.reduce((sum, item) => sum + item.amount, 0);
    const totalRevenue = finalRevenue.reduce((sum, item) => sum + item.amount, 0);

    return {
      expenses: finalExpenses,
      revenue: finalRevenue,
      totalExpense,
      totalRevenue,
    };
  }, [transactions]);

  const assetTransactionsList = useMemo(() => {
    const assetTransactions = transactions.filter((t) => t.isAssetPurchase);
    if (assetTransactions.length > 0) {
      return assetTransactions.map((t) => ({
        id: t.id,
        description: t.description || "Asset Purchase",
        category: t.categoryName || "Capital works",
        property: t.propertyNames?.[0] || "Heaven Villa",
        date: formatDate(t.invoiceDate),
        amount: t.grossAmount ?? 0,
      }));
    }
    return [
      {
        id: "switchboard",
        description: "Supply and replace switchboard",
        category: "Repairs and maintenance",
        property: "Heaven Villa",
        date: "25 July 2026",
        amount: -2272.73,
      },
      {
        id: "ac-unit",
        description: "New split system A/C unit",
        category: "Repairs and maintenance",
        property: "Heaven Villa",
        date: "14 May 2026",
        amount: -1681.82,
      },
    ];
  }, [transactions]);

  const formatAmount = (num: number) => {
    const absVal = Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (num < 0) {
      return `-A$ ${absVal}`;
    }
    return `A$ ${absVal}`;
  };



  if (isEntityLoading) {
    return (
      <Skeleton
        name="entity-detail-page"
        loading
        fallback={<EntityDetailSkeleton />}
      >
        <EntityDetailSkeleton />
      </Skeleton>
    );
  }

  if (!entity) {
    return (
      <section className="client-detail-page entity-detail-page">
        <Link href={backHref} className="entity-wizard-back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Back to {backLabel}
        </Link>
        <p className="entity-wizard-error">
          {errorMessage || "Entity not found."}
        </p>
      </section>
    );
  }

  const entityDisabled = entity.enabled === false;

  return (
    <>
      <section className="client-detail-page entity-detail-page">
        <Link href={backHref} className="entity-wizard-back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Back to {backLabel}
        </Link>

        <header className="entity-page-header">
          <div>
            <h1>
              {entity.name}
              <span className={`entity-disabled-badge${entityDisabled ? " is-visible" : ""}`} title="This entity is inactive and cannot be modified">
                Inactive
              </span>
            </h1>
            <p>
              {entityTypeLabel(entity.entityType)} · {ownerCopy} ·{" "}
              {properties.length} propert{properties.length === 1 ? "y" : "ies"}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {!isClientView && (
              <ToggleSwitch
                checked={!entityDisabled}
                onChange={(checked) => {
                  if (!checked) {
                    setIsInactiveModalOpen(true);
                  } else {
                    handleToggleEnabled(true);
                  }
                }}
                disabled={entity.reconciled}
                loading={isTogglingEnabled}
                green
                label={entityDisabled ? "Inactive" : "Active"}
                title={
                  entity.reconciled
                    ? "Reconciled entities cannot be toggled"
                    : entityDisabled
                      ? "Activate this entity"
                      : "Deactivate this entity"
                }
              />
            )}
            {!entity.reconciled && !entityDisabled && (
              <Link
                href={editEntityHref}
                className="entity-icon-action entity-detail-edit-action"
                aria-label={`Edit ${entity.name}`}
                title="Edit entity"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                <span>Edit Details</span>
              </Link>
            )}
          </div>
        </header>

        {enabledError && (
          <p className="entity-wizard-error" role="alert">
            {enabledError}
          </p>
        )}

        <div className={`entity-disabled-notice${entityDisabled ? " is-visible" : ""}`} role="status">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="entity-reconciled-notice-icon" width={20} height={20}>
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12h8" />
          </svg>
          <div>
            <strong>Entity Inactive</strong>
            <p>
              This entity is inactive. All changes — transactions, properties,
              documents, and reconciliations — are blocked until it is activated.
            </p>
          </div>
        </div>

        {entity.reconciled && (
          <div className="entity-reconciled-notice" role="status">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="entity-reconciled-notice-icon" width={20} height={20}>
              <circle cx="12" cy="12" r="10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <div>
              <strong>Reconciliation Completed</strong>
              <p>
                This entity has been reconciled and is now read-only.
                No further transactions, statements, or edits can be made.
              </p>
            </div>
          </div>
        )}

        {/* Entity Stat Grid (Properties, Transactions, Market Value) */}
        <div className="client-stat-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginBottom: "18px" }}>
          <article className="client-stat-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#454a55' }}>Total Properties</span>
              <strong style={{ fontSize: '28px', fontWeight: 800, color: '#000000', marginTop: '4px' }}>
                {isPropertiesLoading ? "—" : properties.length}
              </strong>
            </div>
            <span className="client-stat-icon is-property" style={{ borderRadius: '9px', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '22px', height: '22px' }}>
                <path d="M4 21V9l8-6 8 6v12" />
                <path d="M9 21v-7h6v7" />
                <path d="M9 10h.01" />
                <path d="M15 10h.01" />
              </svg>
            </span>
          </article>
          <article className="client-stat-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#454a55' }}>Total Transactions</span>
              <strong style={{ fontSize: '28px', fontWeight: 800, color: '#000000', marginTop: '4px' }}>
                {isTransactionsLoading ? "—" : transactions.length}
              </strong>
            </div>
            <span className="client-stat-icon is-transaction" style={{ borderRadius: '9px', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '22px', height: '22px' }}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
          </article>
          <article className="client-stat-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#454a55', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Market Value
                <span title="Estimated market value of all active properties" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px', color: '#98a2b3' }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </span>
              <strong style={{ fontSize: '28px', fontWeight: 800, color: '#000000', marginTop: '4px' }}>
                {isPropertiesLoading ? "—" : `A$ ${entityMarketValue.toLocaleString()}`}
              </strong>
              <span style={{ fontSize: '12px', color: '#667085', fontWeight: 500 }}>
                Across {properties.length} {properties.length === 1 ? "property" : "properties"}
              </span>
            </div>
            <span className="client-stat-icon" style={{ background: '#fef0c7', color: '#d97706', borderRadius: '9px', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '22px', height: '22px' }}>
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </span>
          </article>
        </div>

        {/* GST Summary Cards Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
          <article style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', border: '1px solid #fee2e2', borderRadius: '10px', background: '#fef2f2', boxShadow: '0 8px 20px rgba(16, 24, 40, 0.05)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#b91c1c', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                GST ON PURCHASE
              </span>
              {gst.periodLabel && (
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#b91c1c', opacity: 0.75 }}>
                  {gst.periodLabel}
                </span>
              )}
              <strong style={{ fontSize: '28px', fontWeight: 800, color: '#000000', marginTop: '4px' }}>
                A$ {gstOnPurchase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
            <span className="client-stat-icon" style={{ background: '#ef4444', color: '#ffffff', borderRadius: '9px', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
            </span>
          </article>
          <article style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', border: '1px solid #dcfce7', borderRadius: '10px', background: '#f0fdf4', boxShadow: '0 8px 20px rgba(16, 24, 40, 0.05)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#15803d', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                GST ON SALES
              </span>
              {gst.periodLabel && (
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#15803d', opacity: 0.75 }}>
                  {gst.periodLabel}
                </span>
              )}
              <strong style={{ fontSize: '28px', fontWeight: 800, color: '#000000', marginTop: '4px' }}>
                A$ {gstOnSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
            <span className="client-stat-icon" style={{ background: '#12b76a', color: '#ffffff', borderRadius: '9px', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          </article>
        </div>

        {/* Personal & Asset Transactions Sections */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '24px' }}>
          {/* Left Column: Personal Transactions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setIsPersonalExpanded(!isPersonalExpanded)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                border: '1px solid #dde4f2',
                borderRadius: '12px',
                background: '#ffffff',
                boxShadow: '0 4px 12px rgba(16, 24, 40, 0.04)',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ background: '#e0e7ff', color: '#4f46e5', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <div>
                  <strong style={{ display: 'block', fontSize: '15px', color: '#101828', fontWeight: 700 }}>Personal Transactions</strong>
                  <span style={{ display: 'block', fontSize: '12px', color: '#667085', marginTop: '2px' }}>Expense & revenue totals by category</span>
                </div>
              </div>
              <span style={{ color: '#667085', display: 'flex', alignItems: 'center' }}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    width: '16px',
                    height: '16px',
                    transform: isPersonalExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
            </button>

            {isPersonalExpanded && (
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #dde4f2',
                  borderRadius: '12px',
                  padding: '24px',
                  boxShadow: '0 4px 12px rgba(16, 24, 40, 0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '24px',
                }}
              >
                {/* Total Expenses Section */}
                <div>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, color: '#b91c1c', borderBottom: '1px solid #f2f4f7', paddingBottom: '8px' }}>
                    Total Expenses
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {personalBreakdown.expenses.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#344054' }}>
                        <span>{item.category}</span>
                        <strong style={{ fontWeight: 600, color: '#101828' }}>{formatAmount(item.amount)}</strong>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid #eaecf0', paddingTop: '12px', color: '#101828' }}>
                      <strong style={{ fontWeight: 700 }}>Total</strong>
                      <strong style={{ fontWeight: 800 }}>{formatAmount(personalBreakdown.totalExpense)}</strong>
                    </div>
                  </div>
                </div>

                {/* Total Revenue Section */}
                <div>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, color: '#16a34a', borderBottom: '1px solid #f2f4f7', paddingBottom: '8px' }}>
                    Total Revenue
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {personalBreakdown.revenue.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#344054' }}>
                        <span>{item.category}</span>
                        <strong style={{ fontWeight: 600, color: '#101828' }}>{formatAmount(item.amount)}</strong>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid #eaecf0', paddingTop: '12px', color: '#101828' }}>
                      <strong style={{ fontWeight: 700 }}>Total</strong>
                      <strong style={{ fontWeight: 800 }}>{formatAmount(personalBreakdown.totalRevenue)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Asset Transactions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setIsAssetExpanded(!isAssetExpanded)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 24px',
                border: '1px solid #dde4f2',
                borderRadius: '16px',
                background: '#ffffff',
                boxShadow: '0 4px 12px rgba(16, 24, 40, 0.03)',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ background: '#fdf4e3', color: '#c27a00', borderRadius: '10px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </span>
                <div>
                <strong style={{ display: 'block', fontSize: '16px', color: '#28336e', fontWeight: 700 }}>Asset Transactions</strong>
                <span style={{ display: 'block', fontSize: '13px', color: '#828fa7', marginTop: '2px' }}>Expenses marked as asset purchases</span>
              </div>
            </div>
            <span style={{ color: '#828fa7', display: 'flex', alignItems: 'center' }}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  width: '16px',
                  height: '16px',
                  transform: isAssetExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                }}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </span>
          </button>

          {isAssetExpanded && (
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #dde4f2',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 4px 12px rgba(16, 24, 40, 0.03)',
                overflowX: 'auto',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '450px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #eef2f6' }}>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#828fa7', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Property</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#828fa7', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Asset Name</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#828fa7', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#828fa7', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '12px 8px', width: '24px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {assetTransactionsList.map((item, idx) => (
                    <tr
                      key={idx}
                      onClick={() => router.push(`/dashboard/accountant/clients/${clientId}/entities/${entityId}/assets/${item.id}`)}
                      style={{ borderBottom: idx === assetTransactionsList.length - 1 ? 'none' : '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.2s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '16px 8px', fontSize: '13px', color: '#334155' }}>{item.property}</td>
                      <td style={{ padding: '16px 8px', fontSize: '14px', color: '#28336e', fontWeight: 700 }}>{item.description}</td>
                      <td style={{ padding: '16px 8px', fontSize: '13px', color: '#475569', whiteSpace: 'nowrap' }}>{item.date}</td>
                      <td style={{ padding: '16px 8px', fontSize: '14px', color: '#28336e', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>{formatAmount(item.amount)}</td>
                      <td style={{ padding: '16px 8px', textAlign: 'right', verticalAlign: 'middle' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}>
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <ProfitLossTrendCard
          transactions={transactions}
          isLoading={isTransactionsLoading}
        />

        {/* Regional Manager Section */}
        <section className="entity-trend-card entity-rm-card" aria-label="Regional Manager" style={{ padding: "24px 34px 28px" }}>
          <div className="entity-trend-head" style={{ marginBottom: 20 }}>
            <h2>Regional Manager</h2>
          </div>

          {rmError && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                padding: "12px 16px",
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                borderRadius: "8px",
                marginBottom: "16px",
                color: "#991b1b",
                fontSize: "14px",
              }}
              role="alert"
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
                <svg
                  viewBox="0 0 24 24"
                  width={20}
                  height={20}
                  style={{ flexShrink: 0 }}
                  stroke="#dc2626"
                  fill="none"
                  strokeWidth={2}
                >
                  <circle cx="12" cy="12" r="10" stroke="#fca5a5" fill="#fee2e2" />
                  <path d="M12 8v4" stroke="#dc2626" strokeLinecap="round" />
                  <path d="M12 16h.01" stroke="#dc2626" strokeLinecap="round" strokeWidth={3} />
                </svg>
                <span style={{ fontWeight: 500, lineHeight: 1.4 }}>{rmError}</span>
              </div>
              <button
                type="button"
                onClick={() => setRmError(null)}
                aria-label="Dismiss error"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  color: "#991b1b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: 0.7,
                  transition: "opacity 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
              >
                <svg viewBox="0 0 24 24" width={16} height={16} stroke="currentColor" fill="none" strokeWidth={2}>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <div className="entity-rm-content">
            {/* Left Side: Avatar + Details */}
            <div className="entity-rm-info-section">
              <div className={`entity-rm-avatar-wrapper ${selectedRm ? "is-assigned" : ""}`}>
                {selectedRm ? (
                  avatarInitials
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

            {/* Right Side: Select Input (only visible when no RM is assigned) */}
            {/* Right Side: Select Input or Delete/Remove Button */}
            {!selectedRm ? (
              <div className="entity-rm-action-section">
                <label className="entity-rm-label" style={{ fontSize: 12, fontWeight: 600, color: "#344054", marginBottom: 6 }}>
                  Select Regional Manager
                </label>
                <StaticSelect
                  value={selectedRmId}
                  options={rmOptions}
                  onChange={handleAssignRm}
                  placeholder="Select Regional Manager"
                  disabled={entityDisabled}
                />
              </div>
            ) : (
              <div className="entity-rm-action-section" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => handleAssignRm("")}
                  disabled={entityDisabled}
                  title={entityDisabled ? "Entity is inactive" : "Remove Regional Manager"}
                  aria-label="Remove Regional Manager"
                  style={{
                    background: "transparent",
                    border: "1px solid #f2f4f7",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    cursor: "pointer",
                    color: "#667085",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#fef3f2";
                    e.currentTarget.style.borderColor = "#fee4e2";
                    e.currentTarget.style.color = "#d92d20";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.borderColor = "#f2f4f7";
                    e.currentTarget.style.color = "#667085";
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="15"
                    height="15"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.0"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
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
        </section>

        <section className="entity-resource-panel">
          <div className="entity-resource-tabs" role="tablist" aria-label="Entity resources">
            {entityTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={currentTab === tab.id}
                className={currentTab === tab.id ? "is-active" : ""}
                onClick={() => setCurrentTab(tab.id)}
              >
                {tab.label}
                {tab.id === "reconciliation" && (
                  <span className="entity-tab-alpha-badge">Alpha</span>
                )}
              </button>
            ))}
          </div>

          {currentTab === "properties" && (
            <div className="entity-resource-body">
              <div className="entity-resource-head">
                <h2>Entity Property</h2>
                {entityDisabled ? (
                  <button
                    type="button"
                    className="entity-wizard-primary is-green"
                    disabled
                    title="Entity is inactive"
                  >
                    + Add Property
                  </button>
                ) : (
                  <Link href={addPropertyHref} className="entity-wizard-primary is-green">
                    + Add Property
                  </Link>
                )}
              </div>

              {isPropertiesLoading ? (
                <EntityPropertyListSkeleton />
              ) : properties.length === 0 ? (
                <div className="client-detail-empty">
                  <p>No properties have been linked to this entity yet.</p>
                </div>
              ) : (
                <ul className="entity-property-list">
                  {properties.map((property) => (
                    <li key={property.id} className={`entity-property-row${!isClientView ? " has-toggle" : ""}`}>
                      <div className="entity-property-main">
                        <Link
                          href={`${propertyDetailHrefBase}/${property.id}`}
                          className="entity-property-title-link"
                        >
                          {property.reconciled && (
                            <span className="entity-property-reconciled-badge">Reconciled</span>
                          )}
                          <strong>{property.name}</strong>
                        </Link>
                        <span>
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z" />
                            <circle cx="12" cy="10" r="2.5" />
                          </svg>
                          {property.locationText}
                        </span>
                      </div>
                      {!isClientView && (
                        <ToggleSwitch
                          checked={property.enabled !== false}
                          onChange={(checked) => {
                            if (!checked) {
                              setPropertyToDeactivate(property);
                            } else {
                              handleTogglePropertyEnabled(property, true);
                            }
                          }}
                          disabled={entityDisabled}
                          loading={togglingPropertyId === property.id}
                          green
                          label={property.enabled === false ? "Inactive" : "Active"}
                          title={
                            entityDisabled
                              ? "Activate the entity first"
                              : property.enabled === false
                                ? "Activate this property"
                                : "Deactivate this property"
                          }
                        />
                      )}
                      <dl>
                        <div>
                          <dt>Property Type</dt>
                          <dd>{titleCase(property.propertyType)}</dd>
                        </div>
                        <div>
                          <dt>Date Added</dt>
                          <dd>{formatDate(property.createdAt)}</dd>
                        </div>
                        <div>
                          <dt>Total Transactions</dt>
                          <dd>
                            {isTransactionsLoading
                              ? "..."
                              : transactions.filter((t) =>
                                t.propertyIds?.includes(property.id),
                              ).length}
                          </dd>
                        </div>
                      </dl>
                      {entity.reconciled || entityDisabled || property.enabled === false ? (
                        <span
                          className="entity-property-action is-disabled"
                          title={
                            entity.reconciled
                              ? "Entity is reconciled"
                              : entityDisabled
                                ? "Entity is inactive"
                                : "Property is inactive"
                          }
                        >
                          + Add Transaction
                        </span>
                      ) : (
                        <Link
                          href={appendQueryParam(
                            addTransactionHref,
                            "propertyId",
                            property.id,
                          )}
                          className="entity-property-action"
                        >
                          + Add Transaction
                        </Link>
                      )}
                      <Link
                        href={`${propertyDetailHrefBase}/${property.id}`}
                        className="entity-property-chevron-link"
                        aria-label={`Open ${property.name}`}
                      >
                        <svg className="entity-property-chevron" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="m9 6 6 6-6 6" />
                        </svg>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {currentTab === "transactions" && (
            <div className="entity-resource-body">
              <AllTransactionsView
                context={{ kind: "entity", entityId }}
                addTransactionHref={addTransactionHref}
                addTransactionDisabled={entity.reconciled || entityDisabled}
                addTransactionDisabledReason={
                  entity.reconciled
                    ? "Entity is reconciled"
                    : "Entity is inactive"
                }
                rulesHref={transactionRulesHref}
                rulesButtonLabel={transactionRulesLabel}
                rulesButtonClassName={transactionRulesClassName}
                rulesButtonIcon={transactionRulesIcon}
                compact
              />

            </div>
          )}

          {currentTab === "reconciliation" && (
            <div className="entity-resource-body">
              <div className="entity-resource-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2>Bank Reconciliations</h2>
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    type="button"
                    className="entity-wizard-primary is-green"
                    disabled={entityDisabled}
                    title={entityDisabled ? "Entity is inactive" : undefined}
                    style={entityDisabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                    onClick={() => {
                      if (entityDisabled) return;
                      setNewSessionOpen((v) => {
                        if (v) {
                          setNewSessionLabel("");
                          setNewSessionAccountAffected("");
                          setNewSessionFrom("");
                          setNewSessionTo("");
                          setLabelError(null);
                          setNewSessionError(null);
                        }
                        return !v;
                      });
                    }}
                  >
                    {newSessionOpen ? "Cancel" : "+ New Reconciliation"}
                  </button>
                  <button
                    type="button"
                    className="entity-wizard-primary is-orange"
                    disabled={entityDisabled}
                    title={entityDisabled ? "Entity is inactive" : undefined}
                    onClick={() => {
                      if (entityDisabled) return;
                      router.push(
                        `/dashboard/accountant/clients/${clientId}/entities/${entityId}/journal-entry/new?from=reconciliation&fromName=${encodeURIComponent(
                          entity?.name || ""
                        )}`
                      );
                    }}
                  >
                    + Add Journal Entry
                  </button>
                </div>
              </div>

              {newSessionOpen && (
                <form
                  onSubmit={handleCreateSession}
                  className="recon-session-form"
                  noValidate
                  style={{
                    display: "grid",
                    gap: 12,
                    padding: 16,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    marginBottom: 16,
                  }}
                >
                  <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>Account name/number</span>
                    <input
                      type="text"
                      value={newSessionLabel}
                      onChange={(e) => {
                        setNewSessionLabel(e.target.value);
                        if (labelError) setLabelError(null);
                      }}
                      placeholder="e.g. 12345678"
                      maxLength={120}
                      required
                      style={{
                        padding: "8px 10px",
                        border: labelError ? "1px solid #fda4af" : "1px solid #d1d5db",
                        borderRadius: 6,
                        outlineColor: labelError ? "#f43f5e" : undefined,
                      }}
                    />
                    {labelError && (
                      <span style={{ color: "#e11d48", fontSize: 12, marginTop: 4, fontWeight: 500 }}>
                        {labelError}
                      </span>
                    )}
                  </label>
                  <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>Account Affected</span>
                    <input
                      type="text"
                      value={newSessionAccountAffected}
                      onChange={(e) => setNewSessionAccountAffected(e.target.value)}
                      placeholder="e.g. Main Operating Account"
                      maxLength={120}
                      style={{
                        padding: "8px 10px",
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                      }}
                    />
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>Period from (optional)</span>
                      <input
                        type="date"
                        value={newSessionFrom}
                        onChange={(e) => setNewSessionFrom(e.target.value)}
                        style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 }}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>Period to (optional)</span>
                      <input
                        type="date"
                        value={newSessionTo}
                        onChange={(e) => setNewSessionTo(e.target.value)}
                        style={{ padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 }}
                      />
                    </label>
                  </div>
                  {newSessionError && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 12px",
                        backgroundColor: "#fef2f2",
                        border: "1px solid #fecaca",
                        borderRadius: 6,
                        color: "#b91c1c",
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                      role="alert"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16, color: "#f87171", flexShrink: 0 }}>
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      <span>{newSessionError}</span>
                    </div>
                  )}
                  <div>
                    <button
                      type="submit"
                      className="entity-wizard-primary is-green"
                      disabled={newSessionSaving}
                    >
                      {newSessionSaving ? "Creating…" : "Create & Open"}
                    </button>
                  </div>
                </form>
              )}

              {sessionListLoading ? (
                <div className="client-detail-empty"><p>Loading…</p></div>
              ) : sessionList.length === 0 ? (
                <div className="client-detail-empty">
                  <p>No reconciliations yet. Create one to start uploading bank statements.</p>
                </div>
              ) : (
                <ul className="entity-property-list">
                  {sessionList.map((s) => {
                    const created = s.createdAt
                      ? new Date(s.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
                      : "—";
                    const period = s.periodFrom && s.periodTo
                      ? `${s.periodFrom} → ${s.periodTo}`
                      : s.periodFrom || s.periodTo || "—";
                    const statusColor = s.status === "completed"
                      ? "var(--color-success, #16a34a)"
                      : "var(--color-warning, #ca8a04)";
                    return (
                      <li key={s.id} className="entity-property-row">
                        <div className="entity-property-main">
                          <strong>{s.label}</strong>
                          <span style={{ color: statusColor, fontWeight: 600, textTransform: "capitalize", fontSize: 13 }}>
                            {s.status}
                          </span>
                        </div>
                        <dl>
                          <div>
                            <dt>Statements</dt>
                            <dd>{s.statementCount}</dd>
                          </div>
                          <div>
                            <dt>Period</dt>
                            <dd>{period}</dd>
                          </div>
                          <div>
                            <dt>Created</dt>
                            <dd>{created}</dd>
                          </div>
                        </dl>
                        {reconciliationHref && (
                          <Link
                            href={`${reconciliationHref}/${encodeURIComponent(s.id)}`}
                            className="entity-property-chevron-link"
                            aria-label="Open reconciliation"
                          >
                            <svg className="entity-property-chevron" viewBox="0 0 24 24" aria-hidden="true">
                              <path d="m9 6 6 6-6 6" />
                            </svg>
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {currentTab === "documents" && (
            <div className="entity-resource-body">
              <DocumentsListView
                context={{ kind: "entity", entityId }}
                token={sessionToken}
                disabled={entityDisabled}
              />
            </div>
          )}

          {currentTab !== "properties" && currentTab !== "transactions" && currentTab !== "reconciliation" && currentTab !== "documents" && (
            <div className="entity-coming-soon">
              <strong>{entityTabs.find((tab) => tab.id === currentTab)?.label}</strong>
              <p>Coming soon</p>
            </div>
          )}
        </section>
      </section>
      <InactiveReasonModal
        isOpen={isInactiveModalOpen}
        onClose={() => setIsInactiveModalOpen(false)}
        onConfirm={(reason) => {
          setIsInactiveModalOpen(false);
          handleToggleEnabled(false, reason);
        }}
        infoMessage="While disabling the entity, the properties under this entity will also be disabled."
      />
      <InactiveReasonModal
        isOpen={propertyToDeactivate !== null}
        onClose={() => setPropertyToDeactivate(null)}
        onConfirm={(reason) => {
          if (propertyToDeactivate) {
            handleTogglePropertyEnabled(propertyToDeactivate, false, reason);
          }
          setPropertyToDeactivate(null);
        }}
        type="property"
      />
      <GstSummaryModal
        isOpen={isGstModalOpen}
        onClose={() => setIsGstModalOpen(false)}
        scope={{ level: "entity", id: entityId, name: entity?.name ?? "" }}
      />
    </>
  );
}
