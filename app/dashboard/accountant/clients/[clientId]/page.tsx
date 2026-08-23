"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, useId, useRef, useCallback } from "react";
import { Skeleton } from "boneyard-js/react";
import { ClientPortfolioSkeleton } from "@/app/components/PortalSkeletons";
import { AllTransactionsView } from "@/app/components/TransactionsFeature";
import DocumentsListView from "@/app/components/DocumentsListView";
import GstSummaryModal from "@/app/components/GstSummaryModal";
import { getSession } from "@/src/lib/session";
import { ClientEntityCardsSkeleton } from "@/app/components/PortalSkeletons";
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

interface ClientRecord {
  id: string;
  email: string;
  status: string;
  name: string;
  phoneNumber: string;
  invitedByEmail: string;
  joinedAt: string | null;
  assignedAccountantId?: string;
  assignedAccountantName?: string;
  isAssignedToCurrentAccountant?: boolean;
  isAssignedToAnotherAccountant?: boolean;
  totalMarketValue?: number;
}

interface AccountantRecord {
  id: string;
  name: string;
  email: string;
}

type ClientTab = "entities" | "banking" | "transactions" | "documents";

const clientTabs: { id: ClientTab; label: string }[] = [
  { id: "entities", label: "Entities & Ownership" },
  { id: "banking", label: "Bank Accounts & Lending" },
  { id: "transactions", label: "All Transactions" },
  { id: "documents", label: "Document Vault" },
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

function getInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatJoinedDate(value: string | null) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function statusClass(status: string) {
  return status.toLowerCase() === "active" ? "is-active" : "is-pending";
}

function propertyCountLabel(count: number | undefined) {
  if (count === undefined) return "…";
  return `${count} ${count === 1 ? "Property" : "Properties"}`;
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

function ClientDetailPageContent() {
  const params = useParams<{ clientId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = params?.clientId ?? "";

  const [client, setClient] = useState<ClientRecord | null>(null);
  const [entities, setEntities] = useState<CoreEntity[]>([]);
  const [propertyCounts, setPropertyCounts] = useState<Record<string, number | undefined>>({});
  const [currentTab, setCurrentTab] = useState<ClientTab>("entities");
  const [isClientLoading, setIsClientLoading] = useState(true);
  const [isEntitiesLoading, setIsEntitiesLoading] = useState(true);
  const [transactionsCounts, setTransactionsCounts] = useState<Record<string, number | undefined>>({});
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState("");
  const [loadError, setLoadError] = useState("");

  const [currentUser, setCurrentUser] = useState<{ email: string; fullName: string } | null>(null);
  const [accountants, setAccountants] = useState<AccountantRecord[] | null>(null);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [isGstModalOpen, setIsGstModalOpen] = useState(false);

  // Transfer states
  const [isTransferDrawerOpen, setTransferDrawerOpen] = useState(false);
  const [transferToAccountantId, setTransferToAccountantId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [pendingTransferExit, setPendingTransferExit] = useState<"cancel" | "close" | null>(null);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [isPersonalExpanded, setIsPersonalExpanded] = useState(true);
  const [isAssetExpanded, setIsAssetExpanded] = useState(true);

  useEffect(() => {
    const tab = searchParams?.get("tab");
    if (tab === "transactions") {
      setCurrentTab("transactions");
    } else if (tab === "banking") {
      setCurrentTab("banking");
    } else if (tab === "documents") {
      setCurrentTab("documents");
    } else if (tab === "entities") {
      setCurrentTab("entities");
    }
  }, [searchParams]);

  const handleTabClick = (tabId: ClientTab) => {
    setCurrentTab(tabId);
    router.push(`?tab=${tabId}`);
  };

  const reloadClientDetails = useCallback(async () => {
    try {
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) {
        router.replace("/login/user");
        return;
      }
      const token = session.getIdToken().getJwtToken();
      setSessionToken(token);
      const headers = { Authorization: `Bearer ${token}` };

      // One call for the client (no scope=all + find), the entities-with-counts
      // call, plus current user. The accountants list is NOT fetched here — it's
      // only needed for the transfer drawer, so it loads lazily on open.
      const [clientRes, entitiesRes, meRes] = await Promise.all([
        fetch(`/api/users/me/clients/${encodeURIComponent(clientId)}`, { headers }),
        fetch(`/api/entities?client_id=${encodeURIComponent(clientId)}`, { headers }),
        fetch("/api/users/me", { headers }),
      ]);

      let canLoadEntities = false;
      if (clientRes.ok) {
        const data = (await clientRes.json()) as { client: ClientRecord | null };
        setClient(data.client ?? null);
        canLoadEntities = Boolean(data.client);
        if (!data.client) {
          setLoadError("Client portfolio not found or you are not authorized to view it.");
        }
      } else {
        setLoadError("Failed to load client.");
      }

      if (meRes.ok) {
        const meData = await meRes.json();
        setCurrentUser(meData);
      }

      setIsClientLoading(false);

      if (!canLoadEntities) {
        setEntities([]);
        setPropertyCounts({});
        setTransactionsCounts({});
        setIsEntitiesLoading(false);
        setIsTransactionsLoading(false);
        return;
      }

      if (entitiesRes.ok) {
        const data = (await entitiesRes.json()) as { items: CoreEntity[] };
        const loadedEntities = data.items || [];
        setEntities(loadedEntities);

        // Counts come straight off each entity (computed by the backend in the
        // same /entities query) — no per-entity properties/transactions fetches.
        setPropertyCounts(
          Object.fromEntries(loadedEntities.map((e) => [e.id, e.propertiesCount ?? 0])),
        );
        setTransactionsCounts(
          Object.fromEntries(loadedEntities.map((e) => [e.id, e.transactionsCount ?? 0])),
        );
        setIsEntitiesLoading(false);
        setIsTransactionsLoading(false);
      } else {
        setIsEntitiesLoading(false);
        setIsTransactionsLoading(false);
      }
    } catch (error) {
      console.error("Failed to load client detail:", error);
      setLoadError("Unexpected error loading client.");
      setIsClientLoading(false);
      setIsEntitiesLoading(false);
    }
  }, [clientId, router]);

  useEffect(() => {
    if (clientId) {
      reloadClientDetails();
    }
  }, [clientId, reloadClientDetails]);

  const assignedAccountant = useMemo(() => {
    if (!client) return null;
    if (client.isAssignedToCurrentAccountant) {
      return currentUser;
    }
    return accountants?.find((acc) => acc.id === client.assignedAccountantId) || null;
  }, [client, currentUser, accountants]);

  // The accountants list is only needed for the transfer dropdown, so it loads
  // on demand (guarded so it fetches at most once) — not on page load.
  const loadAccountants = useCallback(async () => {
    if (accountants !== null) return;
    try {
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) return;
      const token = session.getIdToken().getJwtToken();
      const res = await fetch("/api/users/me/accountants", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.ok ? await res.json() : { accountants: [] };
      setAccountants(data.accountants || []);
    } catch {
      setAccountants([]);
    }
  }, [accountants]);

  function openTransferDrawer() {
    void loadAccountants();
    setTransferToAccountantId("");
    setTransferReason("");
    setTransferSuccess(false);
    setTransferDrawerOpen(true);
  }

  function resetTransferState() {
    setTransferDrawerOpen(false);
    setTransferToAccountantId("");
    setTransferReason("");
    setTransferSuccess(false);
    setPendingTransferExit(null);
    setShowTransferConfirm(false);
  }

  const hasTransferChanges = transferToAccountantId !== "" || transferReason !== "";

  function handleAttemptTransferExit(action: "cancel" | "close") {
    if (!transferSuccess && hasTransferChanges) {
      setPendingTransferExit(action);
    } else {
      resetTransferState();
    }
  }

  function handleTransferClient() {
    if (!client || !transferToAccountantId || isTransferring) return;
    setShowTransferConfirm(true);
  }

  async function performTransferClient() {
    if (!client || !transferToAccountantId || isTransferring) return;
    try {
      setIsTransferring(true);
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) return;
      const token = session.getIdToken().getJwtToken();
      const res = await fetch("/api/users/me/clients/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clientId: client.id,
          toAccountantId: transferToAccountantId,
          reason: transferReason || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        alert(data.error || "Failed to transfer client");
        return;
      }
      setTransferSuccess(true);
      await reloadClientDetails();
    } catch (error) {
      console.error("Transfer client error:", error);
      alert("Something went wrong while transferring the client.");
    } finally {
      setIsTransferring(false);
    }
  }

  async function handleExportCsv() {
    if (isExporting) return;
    try {
      setIsExporting(true);
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) return;
      const token = session.getIdToken().getJwtToken();
      const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/export-csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        console.error("Export CSV failed", res.status);
        alert("Failed to export client data. Please try again.");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] || `${client?.name || clientId}_Export.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export CSV error:", error);
      alert("Something went wrong while exporting. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  const totalProperties = useMemo(
    () => Object.values(propertyCounts).reduce<number>((sum, count) => sum + (count ?? 0), 0),
    [propertyCounts],
  );

  const totalTransactions = useMemo(
    () => Object.values(transactionsCounts).reduce<number>((sum, count) => sum + (count ?? 0), 0),
    [transactionsCounts],
  );

  if (isClientLoading) {
    return (
      <Skeleton
        name="client-portfolio-page"
        loading
        fallback={<ClientPortfolioSkeleton />}
      >
        <ClientPortfolioSkeleton />
      </Skeleton>
    );
  }

  if (!client) {
    return (
      <section className="client-detail-page client-portfolio-page">
        <Link href="/dashboard/accountant/clients?tab=mine" className="entity-wizard-back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Back to Clients
        </Link>
        <p className="entity-wizard-error">{loadError || "Client not found."}</p>
      </section>
    );
  }

  return (
    <section className="client-detail-page client-portfolio-page">
      <Link href="/dashboard/accountant/clients?tab=mine" className="entity-wizard-back">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Back to Clients
      </Link>

      <header className="client-profile-card" style={{ flexDirection: "column", alignItems: "stretch", gap: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", width: "100%" }}>
          <div className="client-profile-main">
            <span className="client-profile-avatar">{getInitials(client.name)}</span>
            <div>
              <h1>{client.name}</h1>
              <div className="client-profile-meta">
                <span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 6h16v12H4z" />
                    <path d="m4 7 8 6 8-6" />
                  </svg>
                  {client.email}
                </span>
                <span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="4" y="5" width="16" height="15" rx="2" />
                    <path d="M8 3v4" />
                    <path d="M16 3v4" />
                    <path d="M4 10h16" />
                  </svg>
                  Joined {formatJoinedDate(client.joinedAt)}
                </span>
              </div>
            </div>
          </div>
          <span className={`client-status-pill ${statusClass(client.status)}`}>
            {titleCase(client.status)}
          </span>
        </div>

        {/* Horizontal Divider Line */}
        <hr style={{ border: 0, borderTop: "1px solid #e4e7ec", margin: 0 }} />

        {/* Managed By & Transfer Row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <span style={{ fontSize: "12px", color: "#667085", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "8px" }}>
              Account Managed By
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span className="client-profile-avatar" style={{ width: "38px", height: "38px", fontSize: "14px", background: "#2f3c82" }}>
                {getInitials(
                  client.isAssignedToCurrentAccountant
                    ? (currentUser?.fullName || client.assignedAccountantName || "You")
                    : (client.assignedAccountantName || "Unassigned")
                )}
              </span>
              <div>
                <strong style={{ display: "block", fontSize: "15px", color: "#101828", fontWeight: 600 }}>
                  {client.isAssignedToCurrentAccountant
                    ? `${currentUser?.fullName || client.assignedAccountantName || "You"} (You)`
                    : (client.assignedAccountantName || "Unassigned")}
                </strong>
                <span style={{ fontSize: "13px", color: "#667085", display: "block", marginTop: "2px" }}>
                  {assignedAccountant?.email || "No email available"}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={isExporting}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                border: "1px solid #d0d5dd",
                borderRadius: "8px",
                background: "#ffffff",
                color: "#344054",
                fontSize: "14px",
                fontWeight: 600,
                cursor: isExporting ? "not-allowed" : "pointer",
                transition: "all 0.2s",
                boxShadow: "0 1px 2px rgba(16, 24, 40, 0.05)",
                opacity: isExporting ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isExporting) {
                  e.currentTarget.style.background = "#f9fafb";
                  e.currentTarget.style.borderColor = "#c6cacc";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#ffffff";
                e.currentTarget.style.borderColor = "#d0d5dd";
              }}
            >
              {isExporting ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "16px", height: "16px", animation: "spin 0.9s linear infinite" }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "16px", height: "16px" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                </svg>
              )}
              {isExporting ? "Exporting…" : "Export CSV"}
            </button>

            {/* Rolls up every entity belonging to this client. Useful as an
                overview; the lodgeable BAS figure is the per-entity one. */}
            <button
              type="button"
              className="property-outline-button"
              onClick={() => setIsGstModalOpen(true)}
              title="View the GST summary across this client's entities"
            >
              GST Summary
            </button>

            {/* Transfer Ownership Button - Only visible when client is assigned to current accountant */}
            {client.isAssignedToCurrentAccountant && (
              <button
                type="button"
                className="accountant-transfer-btn"
                onClick={() => openTransferDrawer()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 16px",
                  border: "1px solid #d0d5dd",
                  borderRadius: "8px",
                  background: "#ffffff",
                  color: "#344054",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: "0 1px 2px rgba(16, 24, 40, 0.05)"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f9fafb";
                  e.currentTarget.style.borderColor = "#c6cacc";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#ffffff";
                  e.currentTarget.style.borderColor = "#d0d5dd";
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "16px", height: "16px" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L17.5 12M21 7.5H7.5" />
                </svg>
                Transfer Ownership
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="client-stat-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <article className="client-stat-card">
          <span className="client-stat-icon is-entity">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
              <path d="M9 8h6" />
              <path d="M9 12h6" />
              <path d="M9 16h6" />
            </svg>
          </span>
          <div>
            <span>Total Entities</span>
            <strong>{isEntitiesLoading ? "—" : entities.length}</strong>
          </div>
        </article>
        <article className="client-stat-card">
          <span className="client-stat-icon is-property">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 21V9l8-6 8 6v12" />
              <path d="M9 21v-7h6v7" />
              <path d="M9 10h.01" />
              <path d="M15 10h.01" />
            </svg>
          </span>
          <div>
            <span>Total Properties</span>
            <strong>{isEntitiesLoading ? "—" : totalProperties}</strong>
            
          </div>
        </article>
        <article className="client-stat-card">
          <span className="client-stat-icon is-transaction">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2v20" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </span>
          <div>
            <span>Total Transactions</span>
              <strong>{isTransactionsLoading ? "—" : totalTransactions}</strong>
          </div>
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
              {isClientLoading ? "—" : `A$ ${(client?.totalMarketValue ?? 180000).toLocaleString()}`}
            </strong>
            <span style={{ fontSize: '12px', color: '#667085', fontWeight: 500 }}>
              Across {totalProperties} {totalProperties === 1 ? "property" : "properties"}
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginTop: '18px' }}>
        <article style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', border: '1px solid #fee2e2', borderRadius: '10px', background: '#fef2f2', boxShadow: '0 8px 20px rgba(16, 24, 40, 0.05)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#b91c1c', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              GST ON PURCHASE
            </span>
            <strong style={{ fontSize: '28px', fontWeight: 800, color: '#000000', marginTop: '4px' }}>
              A$ 274.54
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
            <strong style={{ fontSize: '28px', fontWeight: 800, color: '#000000', marginTop: '4px' }}>
              A$ 47.27
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginTop: '18px', marginBottom: '24px' }}>
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
                  transform: isPersonalExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                  transition: 'transform 0.2s ease',
                }}
              >
                <polyline points="6 9 12 15 18 9" />
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#344054' }}>
                    <span>Advertising for Tenants</span>
                    <strong style={{ fontWeight: 600, color: '#101828' }}>-A$ 6,021.71</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#344054' }}>
                    <span>Repairs and maintenance</span>
                    <strong style={{ fontWeight: 600, color: '#101828' }}>-A$ 4,856.37</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#344054' }}>
                    <span>Body Corporate Fees / Strata Levy</span>
                    <strong style={{ fontWeight: 600, color: '#101828' }}>-A$ 411.00</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid #eaecf0', paddingTop: '12px', color: '#101828' }}>
                    <strong style={{ fontWeight: 700 }}>Total</strong>
                    <strong style={{ fontWeight: 800 }}>-A$ 11,289.08</strong>
                  </div>
                </div>
              </div>

              {/* Total Revenue Section */}
              <div>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, color: '#16a34a', borderBottom: '1px solid #f2f4f7', paddingBottom: '8px' }}>
                  Total Revenue
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#344054' }}>
                    <span>Other Rental Income</span>
                    <strong style={{ fontWeight: 600, color: '#101828' }}>A$ 9,856.00</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#344054' }}>
                    <span>Rental Income</span>
                    <strong style={{ fontWeight: 600, color: '#101828' }}>A$ 6,464.00</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid #eaecf0', paddingTop: '12px', color: '#101828' }}>
                    <strong style={{ fontWeight: 700 }}>Total</strong>
                    <strong style={{ fontWeight: 800 }}>A$ 16,320.00</strong>
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
              <span style={{ background: '#fef3c7', color: '#d97706', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </span>
              <div>
                <strong style={{ display: 'block', fontSize: '15px', color: '#101828', fontWeight: 700 }}>Asset Transactions</strong>
                <span style={{ display: 'block', fontSize: '12px', color: '#667085', marginTop: '2px' }}>Expenses marked as asset purchases</span>
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
                  transform: isAssetExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                  transition: 'transform 0.2s ease',
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </button>

          {isAssetExpanded && (
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #dde4f2',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 4px 12px rgba(16, 24, 40, 0.04)',
                overflowX: 'auto',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '450px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #eaecf0' }}>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#475467', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#475467', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Category</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#475467', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Property</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#475467', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: 700, color: '#475467', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f2f4f7' }}>
                    <td style={{ padding: '14px 8px', fontSize: '13px', color: '#101828', fontWeight: 500 }}>Supply and replace switchboard</td>
                    <td style={{ padding: '14px 8px', fontSize: '13px', color: '#475467' }}>Repairs and maintenance</td>
                    <td style={{ padding: '14px 8px', fontSize: '13px', color: '#475467' }}>Heaven Villa</td>
                    <td style={{ padding: '14px 8px', fontSize: '13px', color: '#475467', whiteSpace: 'nowrap' }}>25 July 2026</td>
                    <td style={{ padding: '14px 8px', fontSize: '13px', color: '#101828', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>-A$ 2,272.73</td>
                  </tr>
                  <tr style={{ borderBottom: 'none' }}>
                    <td style={{ padding: '14px 8px', fontSize: '13px', color: '#101828', fontWeight: 500 }}>New split system A/C unit</td>
                    <td style={{ padding: '14px 8px', fontSize: '13px', color: '#475467' }}>Repairs and maintenance</td>
                    <td style={{ padding: '14px 8px', fontSize: '13px', color: '#475467' }}>Heaven Villa</td>
                    <td style={{ padding: '14px 8px', fontSize: '13px', color: '#475467', whiteSpace: 'nowrap' }}>14 May 2026</td>
                    <td style={{ padding: '14px 8px', fontSize: '13px', color: '#101828', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>-A$ 1,681.82</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <section className="client-portfolio-panel">
        <div className="client-portfolio-tabs" role="tablist" aria-label="Client detail sections">
          {clientTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={currentTab === tab.id}
              className={currentTab === tab.id ? "is-active" : ""}
              onClick={() => handleTabClick(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {currentTab === "entities" && (
          <div className="client-portfolio-tab-body">
            {isEntitiesLoading ? (
              <ClientEntityCardsSkeleton />
            ) : entities.length === 0 ? (
              <div className="client-empty-entities">
                <span className="client-empty-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
                    <path d="M9 8h6" />
                    <path d="M9 12h6" />
                    <path d="M9 16h6" />
                  </svg>
                </span>
                <strong>No entities yet</strong>
                <p>Create your first entity to get started</p>
                <Link
                  href={`/dashboard/accountant/clients/${clientId}/entities/new`}
                  className="entity-wizard-primary "
                >
                  + Add Entity
                </Link>
              </div>
            ) : (
              <>
                <div className="client-portfolio-section-head">
                  <h2>Entities & Ownership</h2>
                  <Link
                    href={`/dashboard/accountant/clients/${clientId}/entities/new`}
                    className="entity-wizard-primary"
                  >
                    + Add Entity
                  </Link>
                </div>

                <div className="entity-card-grid">
                  {entities.map((entity) => {
                    const propertyCount = propertyCounts[entity.id];
                    return (
                      <article key={entity.id} className="entity-ownership-card">
                        <Link
                          href={`/dashboard/accountant/clients/${clientId}/entities/${entity.id}`}
                          className="entity-ownership-card-main"
                        >
                          <div className="entity-ownership-card-top">
                            <span className="entity-card-icon">
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
                                <path d="M9 8h6" />
                                <path d="M9 12h6" />
                                <path d="M9 16h6" />
                              </svg>
                            </span>
                            {entity.enabled === false ? (
                              <div className="entity-card-badges-group">
                                <span className="entity-disabled-badge" title="This entity is inactive">
                                  Inactive
                                </span>
                                <span className="entity-type-badge">
                                  {entityTypeLabel(entity.entityType)}
                                </span>
                              </div>
                            ) : (
                              <span className="entity-type-badge">
                                {entityTypeLabel(entity.entityType)}
                              </span>
                            )}
                          </div>

                          <h3>{entity.name}</h3>
                          <strong className="entity-ownership-label">
                            Ownership
                          </strong>
                          <ul className="entity-card-owners">
                            {entity.beneficiaries.map((beneficiary) => (
                              <li key={beneficiary.id ?? beneficiary.name}>
                                <span>{beneficiary.name}</span>
                                <strong>{beneficiary.ownershipPercentage}%</strong>
                              </li>
                            ))}
                          </ul>

                          <div className="entity-card-footer-line">
                            <span>{propertyCountLabel(propertyCount)}</span>
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="m9 6 6 6-6 6" />
                            </svg>
                          </div>
                        </Link>

                        <Link
                          href={`/dashboard/accountant/clients/${clientId}/entities/${entity.id}/edit`}
                          className="entity-card-edit-action"
                          aria-label={`Edit ${entity.name}`}
                          title="Edit entity"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </Link>

                        <Link
                          href={`/dashboard/accountant/clients/${clientId}/entities/${entity.id}/properties/new`}
                          className="entity-card-add-property"
                        >
                          + Add Property
                        </Link>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {currentTab === "transactions" && (
          <div className="client-portfolio-tab-body">
            <AllTransactionsView
              context={{ kind: "client", clientId }}
              addTransactionHref={
                entities[0]
                  ? `/dashboard/accountant/clients/${clientId}/entities/${entities[0].id}/transactions/new`
                  : "/dashboard/accountant/transactions/new"
              }
              compact
            />
          </div>
        )}

        {currentTab === "documents" && (
          <div className="client-portfolio-tab-body">
            <DocumentsListView
              context={{ kind: "client", clientId }}
              token={sessionToken}
            />
          </div>
        )}

        {currentTab === "banking" && (
          <div className="client-coming-soon">
            <strong>Bank Accounts &amp; Lending</strong>
            <p>Coming soon</p>
          </div>
        )}
      </section>

      {/* Transfer Ownership Drawer Overlay */}
      {isTransferDrawerOpen && (
        <div className="accountant-drawer-layer" style={{ zIndex: 1000 }}>
          <button
            type="button"
            className="accountant-drawer-backdrop"
            aria-label="Close transfer drawer"
            onClick={() => handleAttemptTransferExit("close")}
          />
          <aside className="accountant-invite-drawer">
            <div className="accountant-invite-drawer-header">
              <div>
                <h2>Transfer Client</h2>
                <p>
                  Reassign{" "}
                  <strong>{client?.name ?? "this client"}</strong> to
                  another accountant
                </p>
              </div>
              <button type="button" onClick={() => handleAttemptTransferExit("close")}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12" />
                  <path d="M18 6 6 18" />
                </svg>
              </button>
            </div>

            {transferSuccess ? (
              <div className="accountant-invite-success">
                <div className="accountant-invite-success-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m22 2-7 20-4-9-9-4Z" />
                    <path d="M22 2 11 13" />
                  </svg>
                </div>
                <h3>Client Transferred!</h3>
                <p>
                  {client?.name} has been reassigned to{" "}
                  {accountants?.find((a) => a.id === transferToAccountantId)
                    ?.name ?? "the selected accountant"}
                  . The transfer has been logged in the client&apos;s history.
                </p>
              </div>
            ) : (
              <div className="accountant-invite-drawer-body">
                <div
                  style={{
                    marginBottom: "20px",
                    padding: "12px 14px",
                    background: "#f9fafb",
                    borderRadius: "10px",
                    border: "1px solid #e4e7ec",
                  }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#667085",
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Transfering
                  </span>
                  <strong
                    style={{
                      display: "block",
                      fontSize: "15px",
                      color: "#101828",
                      marginTop: "4px",
                    }}
                  >
                    {client?.name}
                  </strong>
                  <span style={{ fontSize: "13px", color: "#667085" }}>
                    {client?.email}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    marginBottom: "16px",
                  }}
                >
                  <span
                    style={{ fontSize: "14px", fontWeight: 500, color: "#344054" }}
                  >
                    Transfer To <span className="imp">*</span>
                  </span>
                  <StaticSelect
                    value={transferToAccountantId}
                    placeholder={
                      accountants === null
                        ? "Loading accountants…"
                        : "Select accountant"
                    }
                    options={(accountants ?? [])
                      .filter((a) => a.id !== client?.assignedAccountantId)
                      .map((a) => ({
                        label: `${a.name} (${a.email})`,
                        value: a.id,
                      }))}
                    onChange={setTransferToAccountantId}
                    disabled={accountants === null}
                  />
                </div>

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <span style={{ fontSize: "14px", fontWeight: 500, color: "#344054" }}>
                    Reason <small style={{ fontWeight: 400, color: "#667085" }}>(Optional)</small>
                  </span>
                  <textarea
                    placeholder="e.g. Going on annual leave Dec 1–15"
                    value={transferReason}
                    rows={3}
                    onChange={(e) => setTransferReason(e.target.value)}
                    style={{
                      padding: "10px 14px",
                      border: "1.5px solid #d0d5dd",
                      borderRadius: "10px",
                      fontSize: "14px",
                      resize: "vertical",
                      fontFamily: "inherit",
                      color: "#101828",
                      outline: "none",
                    }}
                  />
                </label>

                <div className="accountant-invite-note" style={{ marginTop: "16px" }}>
                  <strong>What happens?</strong>
                  <p>
                    The selected accountant becomes the primary contact for this
                    client. This transfer is recorded in the client&apos;s
                    ownership history.
                  </p>
                </div>
              </div>
            )}

            <div className="accountant-invite-drawer-footer">
              <button
                type="button"
                onClick={() => {
                  if (transferSuccess) {
                    resetTransferState();
                  } else {
                    handleAttemptTransferExit("cancel");
                  }
                }}
              >
                {transferSuccess ? "Close" : "Cancel"}
              </button>
              {!transferSuccess && (
                <button
                  type="button"
                  className="is-primary"
                  onClick={handleTransferClient}
                  disabled={isTransferring || !transferToAccountantId}
                >
                  {isTransferring ? "Transferring…" : "Transfer Client"}
                </button>
              )}
            </div>
          </aside>
          {pendingTransferExit && (
            <ConfirmationDialog
              title="Discard Changes"
              message="You have unsaved changes. Are you sure you want to discard them and exit?"
              confirmLabel="Yes, Discard"
              cancelLabel="No, Keep Editing"
              onConfirm={() => {
                resetTransferState();
              }}
              onCancel={() => setPendingTransferExit(null)}
              isDanger={false}
            />
          )}
          {showTransferConfirm && (
            <ConfirmationDialog
              title="Transfer Client"
              message={`Are you sure you want to transfer ${client?.name} to ${
                accountants?.find((a) => a.id === transferToAccountantId)?.name ?? "the selected accountant"
              }? This reassigns ownership of the client.`}
              confirmLabel="Yes, Transfer"
              cancelLabel="No, Cancel"
              onConfirm={() => {
                setShowTransferConfirm(false);
                performTransferClient();
              }}
              onCancel={() => setShowTransferConfirm(false)}
              isDanger={false}
            />
          )}
        </div>
      )}
      <GstSummaryModal
        isOpen={isGstModalOpen}
        onClose={() => setIsGstModalOpen(false)}
        scope={{ level: "client", id: clientId, name: client.name }}
      />
    </section>
  );
}

export default function ClientDetailPage() {
  return (
    <Suspense fallback={<ClientPortfolioSkeleton />}>
      <ClientDetailPageContent />
    </Suspense>
  );
}

interface ConfirmationDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDanger?: boolean;
}

function ConfirmationDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  isDanger = false,
}: ConfirmationDialogProps) {
  return (
    <div className="accountant-drawer-layer" style={{ zIndex: 9999, alignItems: "center", justifyContent: "center" }}>
      <div
        className="accountant-drawer-backdrop"
        style={{
          background: "rgba(15, 23, 52, 0.4)",
          cursor: "default",
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "min(100%, 380px)",
          padding: "24px",
          gap: "16px",
          display: "flex",
          flexDirection: "column",
          borderRadius: "16px",
          border: "1px solid #dde4f2",
          background: "#ffffff",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.05)",
          margin: "0 16px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#101828" }}>
            {title}
          </h3>
          <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.5", color: "#667085" }}>
            {message}
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              minHeight: "40px",
              border: "1px solid #dde4f2",
              background: "#ffffff",
              color: "#5d6987",
              fontWeight: 700,
              fontSize: "14px",
              borderRadius: "10px",
              cursor: "pointer",
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              minHeight: "40px",
              border: `1px solid ${isDanger ? "#e11d48" : "#2f3c82"}`,
              background: isDanger ? "#e11d48" : "#2f3c82",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "14px",
              borderRadius: "10px",
              cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

