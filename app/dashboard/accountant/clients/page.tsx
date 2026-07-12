"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, useId, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession } from "../../../../src/lib/session";
import Link from "next/link";
import {
  dropdownRegistryEvent,
  announceDropdownOpen,
  isDropdownRegistryEvent,
} from "../../../../src/lib/dropdownRegistry";
import { SHOW_INVITE_CREDENTIALS } from "../../../../src/lib/appConfig";

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
  propertiesCount?: number;
}

type ClientTab = "all" | "mine";

interface AccountantRecord {
  id: string;
  name: string;
  email: string;
}

function getInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

function formatJoinedDate(value: string | null) {
  if (!value) return "Recently";

  const date = new Date(value);
  if (isNaN(date.getTime())) return "Recently";
  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "short" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function formatStatus(raw: string) {
  const s = raw.toUpperCase();
  const labels: Record<string, string> = {
    ACCEPTED: "Accepted",
    PENDING: "Pending",
    ACTIVE: "Active",
    INACTIVE: "Inactive",
  };
  return labels[s] ?? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function statusStyle(raw: string) {
  const s = raw.toUpperCase();
  const base = {
    borderRadius: "6px",
    padding: "2px 10px",
    fontSize: "12px",
    fontWeight: 600,
    whiteSpace: "nowrap" as const,
    display: "inline-block",
  };
  if (s === "ACCEPTED" || s === "ACTIVE") {
    return { ...base, color: "#027a48", background: "#ecfdf3" };
  }
  if (s === "PENDING") {
    return { ...base, color: "#b54708", background: "#fffaeb" };
  }
  return { ...base, color: "#344054", background: "#f2f4f7" };
}

function buildInviteLink(params: {
  origin: string;
  token: string;
  email: string;
  role: string;
  temporaryPassword: string;
}) {
  const url = new URL("/invite", params.origin);
  url.searchParams.set("token", params.token);
  url.searchParams.set("email", params.email);
  url.searchParams.set("role", params.role);

  return `${url.toString()}#temporary_password=${encodeURIComponent(
    params.temporaryPassword,
  )}`;
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

function AccountantClientsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentTab, setCurrentTab] = useState<ClientTab>(
    searchParams.get("tab") === "mine" ? "mine" : "all",
  );
  const [allClients, setAllClients] = useState<ClientRecord[] | null>(null);
  const [myClients, setMyClients] = useState<ClientRecord[] | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [isAssigningClients, setIsAssigningClients] = useState(false);
  const [assignMessage, setAssignMessage] = useState("");
  const [isInviteDrawerOpen, setInviteDrawerOpen] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteForm, setInviteForm] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
  });
  const [pageSize, setPageSize] = useState<string>("20");
  const [sortBy, setSortBy] = useState<string>("properties");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageInputValue, setPageInputValue] = useState<string>("1");
  const [isTransferDrawerOpen, setTransferDrawerOpen] = useState(false);
  const [transferClient, setTransferClient] = useState<ClientRecord | null>(null);
  const [transferToAccountantId, setTransferToAccountantId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [accountants, setAccountants] = useState<AccountantRecord[] | null>(null);

  useEffect(() => {
    if (searchParams.get("invite") === "1") {
      setInviteSuccess(false);
      setInviteDrawerOpen(true);
    }
    if (searchParams.get("tab") === "mine") {
      setCurrentTab("mine");
      setSelectedClientIds([]);
      setAssignMessage("");
    }
    const query = searchParams.get("q");
    if (query) setSearchValue(query);
  }, [searchParams]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchValue]);

  useEffect(() => {
    setPageInputValue(String(currentPage));
  }, [currentPage]);

  const loadAccountants = useCallback(async () => {
    if (accountants !== null) return;
    try {
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) return;
      const token = session.getIdToken().getJwtToken();
      const res = await fetch("/api/users/me/accountants", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { accountants?: AccountantRecord[] };
        setAccountants(data.accountants ?? []);
      }
    } catch {
      setAccountants([]);
    }
  }, [accountants]);

  // Fetch one tab's clients from the backend (scope=mine returns only the
  // accountant's assigned clients; scope=all returns the whole org).
  const fetchScope = useCallback(async (scope: "all" | "mine") => {
    const session = (await getSession()) as SessionWithIdToken | null;
    if (!session) return [] as ClientRecord[];
    const token = session.getIdToken().getJwtToken();
    const res = await fetch(`/api/users/me/clients?scope=${scope}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return (res.ok ? (await res.json()).clients || [] : []) as ClientRecord[];
  }, []);

  // Load a tab's data only if it hasn't been loaded yet (lazy per-tab).
  const ensureTabLoaded = useCallback(
    async (tab: ClientTab) => {
      if (tab === "all") {
        if (allClients !== null) return;
        setAllClients(await fetchScope("all"));
      } else {
        if (myClients !== null) return;
        setMyClients(await fetchScope("mine"));
      }
    },
    [allClients, myClients, fetchScope],
  );

  // Refresh after a write (invite/assign/transfer) — refetch whichever tab(s)
  // are currently loaded so the visible list reflects the change.
  const loadClients = useCallback(async () => {
    try {
      const [all, mine] = await Promise.all([
        allClients !== null ? fetchScope("all") : Promise.resolve(null),
        myClients !== null ? fetchScope("mine") : Promise.resolve(null),
      ]);
      if (all !== null) setAllClients(all);
      if (mine !== null) setMyClients(mine);
    } catch (error) {
      console.error("Failed to load clients:", error);
    }
  }, [allClients, myClients, fetchScope]);

  // Load the active tab's data on mount and whenever the tab changes. The guard
  // in ensureTabLoaded prevents refetching an already-loaded tab.
  useEffect(() => {
    void ensureTabLoaded(currentTab);
  }, [currentTab, ensureTabLoaded]);

  const visibleClients = useMemo(() => {
    const source =
      currentTab === "all"
        ? (allClients ?? [])
        : (myClients ?? []);
    const query = searchValue.trim().toLowerCase();

    if (!query) {
      return source;
    }

    return source.filter(
      (client) =>
        client.name.toLowerCase().includes(query) ||
        client.email.toLowerCase().includes(query),
    );
  }, [allClients, myClients, currentTab, searchValue]);

  const sortedClients = useMemo(() => {
    return [...visibleClients].sort((a, b) => {
      if (sortBy === "name-asc") {
        return a.name.localeCompare(b.name);
      } else if (sortBy === "name-desc") {
        return b.name.localeCompare(a.name);
      } else if (sortBy === "joined-asc") {
        if (!a.joinedAt && !b.joinedAt) return 0;
        if (!a.joinedAt) return 1;
        if (!b.joinedAt) return -1;
        return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
      } else if (sortBy === "joined-desc") {
        if (!a.joinedAt && !b.joinedAt) return 0;
        if (!a.joinedAt) return 1;
        if (!b.joinedAt) return -1;
        return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
      } else if (sortBy === "properties") {
        const countA = a.propertiesCount || 0;
        const countB = b.propertiesCount || 0;
        return countB - countA;
      }
      return 0;
    });
  }, [visibleClients, sortBy]);

  const totalItems = sortedClients.length;
  const numericPageSize = pageSize === "all" ? totalItems : Number(pageSize);
  const totalPages = Math.ceil(totalItems / numericPageSize) || 1;
  const activePage = Math.min(currentPage, totalPages);

  const displayedClients = useMemo(() => {
    const startIndex = (activePage - 1) * numericPageSize;
    const endIndex = startIndex + numericPageSize;
    return sortedClients.slice(startIndex, endIndex);
  }, [sortedClients, activePage, numericPageSize]);

  function toggleClientSelection(clientId: string) {
    const client = (allClients ?? []).find((item) => item.id === clientId);
    if (
      currentTab === "mine" ||
      client?.isAssignedToCurrentAccountant ||
      client?.isAssignedToAnotherAccountant
    ) {
      return;
    }

    setAssignMessage("");
    setSelectedClientIds((current) =>
      current.includes(clientId)
        ? current.filter((id) => id !== clientId)
        : [...current, clientId],
    );
  }

  async function handleAssignSelectedClients() {
    if (selectedClientIds.length === 0 || isAssigningClients) {
      return;
    }

    try {
      setIsAssigningClients(true);
      setAssignMessage("");

      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) {
        setAssignMessage("Your session has expired. Please log in again.");
        return;
      }

      const token = session.getIdToken().getJwtToken();
      const res = await fetch("/api/users/me/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ clientIds: selectedClientIds }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setAssignMessage(data.error || "Failed to add selected clients.");
        return;
      }

      setAssignMessage(
        `${data.assignedCount || selectedClientIds.length} client${(data.assignedCount || selectedClientIds.length) === 1 ? "" : "s"
        } added to My Clients.`,
      );
      setSelectedClientIds([]);
      await loadClients();
      setCurrentTab("mine");
    } catch (error) {
      console.error("Assign clients error:", error);
      setAssignMessage("Something went wrong while adding clients.");
    } finally {
      setIsAssigningClients(false);
    }
  }

  function resetInviteState() {
    setInviteForm({
      fullName: "",
      email: "",
      phoneNumber: "",
    });
    setTemporaryPassword("");
    setInviteLink("");
    setInviteSuccess(false);
    setInviteDrawerOpen(false);
    setInviteError("");
  }

  async function handleInviteClient() {
    try {
      setInviteLoading(true);
      setInviteError("");

      const session = (await getSession()) as SessionWithIdToken | null;

      if (!session) {
        setInviteError("Your session has expired. Please log in again.");
        return;
      }

      const token = session.getIdToken().getJwtToken();
      const res = await fetch("/api/invite-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: inviteForm.email,
          role: "client",
          full_name: inviteForm.fullName,
          phone_number: inviteForm.phoneNumber,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setInviteError(data.error || "Failed to invite client");
        return;
      }

      setTemporaryPassword(data.temporaryPassword || "");
      setInviteLink(
        buildInviteLink({
          origin: window.location.origin,
          token: String(data.invitationToken || ""),
          email: String(data.email || inviteForm.email),
          role: String(data.role || "client"),
          temporaryPassword: String(data.temporaryPassword || ""),
        }),
      );
      setInviteSuccess(true);
      await loadClients();
    } catch (error) {
      console.error("Invite client error:", error);
      setInviteError("Something went wrong while inviting the client.");
    } finally {
      setInviteLoading(false);
    }
  }

  function openTransferDrawer(client: ClientRecord) {
    setTransferClient(client);
    setTransferToAccountantId("");
    setTransferReason("");
    setTransferSuccess(false);
    setTransferDrawerOpen(true);
    loadAccountants();
  }

  function resetTransferState() {
    setTransferDrawerOpen(false);
    setTransferClient(null);
    setTransferToAccountantId("");
    setTransferReason("");
    setTransferSuccess(false);
  }

  async function handleTransferClient() {
    if (!transferClient || !transferToAccountantId || isTransferring) return;
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
          clientId: transferClient.id,
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
      await loadClients();
    } catch (error) {
      console.error("Transfer client error:", error);
      alert("Something went wrong while transferring the client.");
    } finally {
      setIsTransferring(false);
    }
  }

  return (
    <section className="accountant-clients-page">
      <div className="accountant-clients-topbar">
        <div>
          <h1>All Clients</h1>
          <p>Manage and view all your property clients</p>
        </div>

        <button
          type="button"
          className="accountant-primary-cta"
          onClick={() => {
            setTemporaryPassword("");
            setInviteLink("");
            setInviteSuccess(false);
            setInviteDrawerOpen(true);
            setInviteError("");
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          Invite Client
        </button>
      </div>

      <div className="accountant-client-tabs">
        <button
          type="button"
          className={currentTab === "all" ? "is-active" : ""}
          onClick={() => {
            setCurrentTab("all");
            setSelectedClientIds([]);
            setAssignMessage("");
            setPageSize("20");
            setCurrentPage(1);
          }}
        >
          All Clients
          <span>{allClients === null ? "…" : allClients.length}</span>
        </button>
        <Link href="/dashboard/accountant/clients?tab=mine">
          <button
            type="button"
            className={currentTab === "mine" ? "is-active" : ""}
            onClick={() => {
              setCurrentTab("mine");
              setSelectedClientIds([]);
              setAssignMessage("");
              setPageSize("20");
              setCurrentPage(1);
            }}
          >
            My Clients
            <span>{myClients === null ? "…" : myClients.length}</span>
          </button>
        </Link>
      </div>

      <div className="accountant-clients-toolbar" style={{ gap: '24px' }}>
        <div className="accountant-client-search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6" />
            <path d="m20 20-4.2-4.2" />
          </svg>
          <input
            type="text"
            placeholder="Search by client name or email..."
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
          />
        </div>

        <StaticSelect
          value={sortBy}
          horizontal
          triggerClassName="accountant-sort-button"
          options={[
            { label: "Sort by Name (A-Z)", value: "name-asc" },
            { label: "Sort by Name (Z-A)", value: "name-desc" },
            { label: "Sort by Date (Oldest)", value: "joined-asc" },
            { label: "Sort by Date (Newest)", value: "joined-desc" },
            { label: "Sort by Properties", value: "properties" },
          ]}
          onChange={(value) => setSortBy(value)}
        />
      </div>

      {assignMessage && (
        <div className="accountant-selection-banner">
          <span>{assignMessage}</span>
        </div>
      )}

      {currentTab === "all" && selectedClientIds.length > 0 && (
        <div className="accountant-selection-banner">
          <span>
            {selectedClientIds.length} client
            {selectedClientIds.length === 1 ? "" : "s"} selected
          </span>
          <button
            type="button"
            onClick={handleAssignSelectedClients}
            disabled={isAssigningClients}
          >
            {isAssigningClients ? "Adding..." : "Add to list"}
          </button>
        </div>
      )}

      <div className="accountant-client-table">
        <div className="accountant-client-table-head">
          <div />
          <div>Client Name</div>
          <div>Email Address</div>
          <div>Status</div>
          <div>Accountant</div>
          <div>Properties</div>
          <div>Joined Date</div>
        </div>

        {(currentTab === "all" ? allClients : myClients) === null ? (
          <div className="boneyard-fallback">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="portal-list-row portal-list-row-admin">
                <div className="skeleton-row">
                  <div className="skeleton-circle skeleton-circle-sm" />
                  <div className="skeleton-stack skeleton-grow">
                    <div className="skeleton-line skeleton-line-md" />
                    <div className="skeleton-line skeleton-line-sm" />
                  </div>
                </div>
                <div className="skeleton-line skeleton-line-md" />
                <div className="skeleton-pill" />
                <div className="skeleton-pill" />
              </div>
            ))}
          </div>
        ) : displayedClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[#f0f3fa] text-[#2f3c82] mb-5 shadow-inner">
              {searchValue.trim() ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-7 h-7"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              ) : currentTab === "mine" ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-7 h-7"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="16" y1="11" x2="22" y2="11" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-7 h-7"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              )}
            </div>

            <h3 className="text-lg font-bold text-[#101828] mb-2">
              {searchValue.trim()
                ? "No clients match your search"
                : currentTab === "mine"
                ? "No clients assigned yet"
                : "Your client list is empty"}
            </h3>

            <p className="text-sm text-[#667085] max-w-[420px] leading-relaxed mb-6">
              {searchValue.trim()
                ? `We couldn't find any clients matching "${searchValue}". Check the spelling or try searching for a different term.`
                : currentTab === "mine"
                ? "You haven't assigned any clients to yourself yet. Add existing clients to your list or invite a new client to get started."
                : "Get started by inviting your first client to manage and view their property portfolios."}
            </p>

            <div className="flex items-center gap-3">
              {searchValue.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearchValue("")}
                  className="inline-flex items-center justify-center gap-2 px-[18px] py-[10px] text-sm font-semibold rounded-xl border border-[#d5dceb] bg-white text-[#49567a] hover:bg-[#f8f9fb] active:bg-[#f1f3f7] transition-colors duration-200 cursor-pointer"
                >
                  Clear Search
                </button>
              ) : currentTab === "mine" ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      router.push("/dashboard/accountant/clients");
                      setCurrentTab("all");
                      setSelectedClientIds([]);
                      setAssignMessage("");
                      setPageSize("20");
                      setCurrentPage(1);
                    }}
                    className="inline-flex items-center justify-center gap-2 px-[18px] py-[10px] text-sm font-semibold rounded-xl border border-[#d5dceb] bg-white text-[#49567a] hover:bg-[#f8f9fb] active:bg-[#f1f3f7] transition-colors duration-200 cursor-pointer"
                  >
                    Browse All Clients
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTemporaryPassword("");
                      setInviteLink("");
                      setInviteSuccess(false);
                      setInviteDrawerOpen(true);
                      setInviteError("");
                    }}
                    className="inline-flex items-center justify-center gap-2 px-[18px] py-[10px] text-sm font-semibold rounded-xl bg-[#2f3b82] text-white hover:bg-[#37489c] active:bg-[#252f69] transition-colors duration-200 cursor-pointer shadow-sm"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="w-4 h-4"
                    >
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </svg>
                    Invite Client
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTemporaryPassword("");
                    setInviteLink("");
                    setInviteSuccess(false);
                    setInviteDrawerOpen(true);
                    setInviteError("");
                  }}
                  className="inline-flex items-center justify-center gap-2 px-[18px] py-[10px] text-sm font-semibold rounded-xl bg-[#2f3b82] text-white hover:bg-[#37489c] active:bg-[#252f69] transition-colors duration-200 cursor-pointer shadow-sm"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="w-4 h-4"
                  >
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                  Invite Client
                </button>
              )}
            </div>
          </div>
        ) : (
          displayedClients.map((client) => {
            const canOpenClient = true;
            return (
              <article
                key={client.id}
                className={`accountant-client-table-row${client.isAssignedToAnotherAccountant ? " is-muted" : ""
                  }${client.isAssignedToCurrentAccountant ? " is-assigned" : ""}`}
                role={canOpenClient ? "link" : undefined}
                tabIndex={canOpenClient ? 0 : undefined}
                onClick={() => {
                  if (canOpenClient) {
                    router.push(`/dashboard/accountant/clients/${client.id}`);
                  }
                }}
                onKeyDown={(event) => {
                  if (
                    canOpenClient &&
                    (event.key === "Enter" || event.key === " ")
                  ) {
                    event.preventDefault();
                    router.push(`/dashboard/accountant/clients/${client.id}`);
                  }
                }}
              >
                <div>
                  {currentTab === "mine" ? (
                    <span className="accountant-client-selection-empty" />
                  ) : client.isAssignedToAnotherAccountant ? (
                    <span className="accountant-client-selection-empty" />
                  ) : client.isAssignedToCurrentAccountant ? (
                    <span
                      className="accountant-client-assignment-icon"
                      title="Assigned to you"
                      role="img"
                      aria-label="Assigned to you"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        style={{ width: '16px', height: '16px', fill: 'none', stroke: 'currentColor', strokeWidth: 3 }}
                      >
                        <path d="M5 12l4 4 10-10" />
                      </svg>
                    </span>
                  ) : (
                    <input
                      type="checkbox"
                      checked={selectedClientIds.includes(client.id)}
                      onChange={() => toggleClientSelection(client.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </div>

                <div className="accountant-client-cell accountant-client-cell-primary">
                  <div className="accountant-client-pill">
                    {getInitials(client.name)}
                  </div>
                  <div>
                    {canOpenClient ? (
                      <strong className="accountant-client-name-link">
                        {client.name}
                      </strong>
                    ) : (
                      <strong>{client.name}</strong>
                    )}
                    {client.phoneNumber && <span>{client.phoneNumber}</span>}
                  </div>
                </div>

                <div className="accountant-client-cell">
                  <span>{client.email}</span>
                </div>

                <div className="accountant-client-cell">
                  <span style={statusStyle(client.status)}>
                    {formatStatus(client.status)}
                  </span>
                </div>

                <div className="accountant-client-cell">
                  {client.isAssignedToCurrentAccountant ? (
                    <span style={{ color: "#2f3c82", fontWeight: 600, fontSize: "13px" }}>
                      You
                    </span>
                  ) : client.assignedAccountantName ? (
                    <span title={client.assignedAccountantId}>
                      {client.assignedAccountantName}
                    </span>
                  ) : (
                    <span style={{ color: "#98a2b3" }}>Unassigned</span>
                  )}
                </div>

                <div className="accountant-client-cell flex justify-center">
                  <span className="inline-flex items-center justify-center px-[10px] py-[3px] rounded-lg bg-[#f0f3fa] text-[#2f3c82] font-bold text-[13px] min-w-[32px] border border-[#e1e7f3] transition-all duration-150 ease-in-out group-hover:bg-[#e5ecfb] group-hover:border-[#cbd5e1] group-hover:text-[#2f3c82]">
                    {client.propertiesCount ?? 0}
                  </span>
                </div>

                <div className="accountant-client-cell" style={{ flexDirection: "column", alignItems: "flex-start", gap: "6px" }}>
                  <span>{formatJoinedDate(client.joinedAt)}</span>
                  {currentTab === "mine" && (
                    <button
                      type="button"
                      className="accountant-transfer-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        openTransferDrawer(client);
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L17.5 12M21 7.5H7.5" />
                      </svg>
                      Transfer
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}

        {/* Pagination Footer */}
        {allClients !== null && myClients !== null && totalItems > 0 && (
          <footer className="premium-pagination-container">
            {/* Left Section: Items per page and page range details */}
            <div className="premium-pagination-left">
              <span className="premium-pagination-label">Items per page</span>
              <div className="premium-pagination-select-wrapper">
                <select
                  className="premium-pagination-select"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="all">All</option>
                </select>
              </div>
              <span className="premium-pagination-info">
                {`${(activePage - 1) * numericPageSize + 1}–${Math.min(activePage * numericPageSize, totalItems)} of ${totalItems} items`}
              </span>
            </div>

            {/* Right Section: First, Previous, Page Input, Next, Last */}
            <div className="premium-pagination-right">
              {/* First Page */}
              <button
                type="button"
                className="premium-pagination-btn premium-pagination-icon-btn"
                title="First Page"
                onClick={() => setCurrentPage(1)}
                disabled={activePage === 1}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}>
                  <line x1="5" y1="5" x2="5" y2="19" />
                  <polyline points="19 5 12 12 19 19" />
                </svg>
              </button>

              {/* Previous Page */}
              <button
                type="button"
                className="premium-pagination-btn"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={activePage === 1}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}>
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <span className="premium-pagination-btn-text">Previous</span>
              </button>

              {/* Page Selector Input Box */}
              <div className="premium-pagination-page-input-wrapper">
                <input
                  type="number"
                  className="premium-pagination-page-input"
                  value={pageInputValue}
                  onChange={(e) => setPageInputValue(e.target.value)}
                  onBlur={() => {
                    const pageNum = Number(pageInputValue);
                    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                      setCurrentPage(pageNum);
                    } else {
                      setPageInputValue(String(activePage));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const pageNum = Number(pageInputValue);
                      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                        setCurrentPage(pageNum);
                        e.currentTarget.blur();
                      } else {
                        setPageInputValue(String(activePage));
                        e.currentTarget.blur();
                      }
                    }
                  }}
                  min={1}
                  max={totalPages}
                />
                <span className="premium-pagination-label">of {totalPages}</span>
              </div>

              {/* Next Page */}
              <button
                type="button"
                className="premium-pagination-btn"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={activePage === totalPages}
              >
                <span className="premium-pagination-btn-text">Next</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>

              {/* Last Page */}
              <button
                type="button"
                className="premium-pagination-btn premium-pagination-icon-btn"
                title="Last Page"
                onClick={() => setCurrentPage(totalPages)}
                disabled={activePage === totalPages}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}>
                  <line x1="19" y1="5" x2="19" y2="19" />
                  <polyline points="5 5 12 12 5 19" />
                </svg>
              </button>
            </div>
          </footer>
        )}
      </div>

      {isTransferDrawerOpen && (
        <div className="accountant-drawer-layer">
          <button
            type="button"
            className="accountant-drawer-backdrop"
            aria-label="Close transfer drawer"
            onClick={resetTransferState}
          />
          <aside className="accountant-invite-drawer">
            <div className="accountant-invite-drawer-header">
              <div>
                <h2>Transfer Client</h2>
                <p>
                  Reassign{" "}
                  <strong>{transferClient?.name ?? "this client"}</strong> to
                  another accountant
                </p>
              </div>
              <button type="button" onClick={resetTransferState}>
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
                  {transferClient?.name} has been reassigned to{" "}
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
                    Transferring
                  </span>
                  <strong
                    style={{
                      display: "block",
                      fontSize: "15px",
                      color: "#101828",
                      marginTop: "4px",
                    }}
                  >
                    {transferClient?.name}
                  </strong>
                  <span style={{ fontSize: "13px", color: "#667085" }}>
                    {transferClient?.email}
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
                      .filter((a) => a.id !== transferClient?.assignedAccountantId)
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
              <button type="button" onClick={resetTransferState}>
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
        </div>
      )}

      {isInviteDrawerOpen && (
        <div className="accountant-drawer-layer">
          <button
            type="button"
            className="accountant-drawer-backdrop"
            aria-label="Close invite drawer"
            onClick={resetInviteState}
          />

          <aside className="accountant-invite-drawer">
            <div className="accountant-invite-drawer-header">
              <div>
                <h2>Invite New Client</h2>
                <p>Send an invitation to a new client</p>
              </div>

              <button type="button" onClick={resetInviteState}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12" />
                  <path d="M18 6 6 18" />
                </svg>
              </button>
            </div>

            {inviteSuccess ? (
              <div className="accountant-invite-success">
                <div className="accountant-invite-success-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m22 2-7 20-4-9-9-4Z" />
                    <path d="M22 2 11 13" />
                  </svg>
                </div>
                <h3>Invitation Sent!</h3>
                <p>
                  That&apos;s another client invitation in the books. You can
                  track their onboarding status directly from your portfolio.
                </p>
                {SHOW_INVITE_CREDENTIALS && temporaryPassword && (
                  <div className="accountant-temp-password-card">
                    <span>Invite Link</span>
                    {inviteLink ? (
                      <a
                        href={inviteLink}
                        target="_blank"
                        className="accountant-invite-link"
                      >
                        {inviteLink}
                      </a>
                    ) : (
                      <strong>Invite link created</strong>
                    )}
                    <p>
                      Send this link to the client. It includes the temporary
                      password and opens the create password step.
                    </p>
                    <span>Backup Temporary Password</span>
                    <strong>{temporaryPassword}</strong>
                  </div>
                )}
              </div>
            ) : (
              <div className="accountant-invite-drawer-body">
                {inviteError && (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: "1px solid #fda29b",
                      background: "#fef3f2",
                      color: "#b42318",
                      fontSize: "14px",
                      fontWeight: 500,
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "8px",
                      marginBottom: "6px",
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      style={{ width: "16px", height: "16px", flexShrink: 0, marginTop: "2px" }}
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{inviteError}</span>
                  </div>
                )}

                <label>
                  <span>
                    Full Name <span className="imp">*</span>
                  </span>
                  <input
                    type="text"
                    placeholder="Enter client's full name"
                    value={inviteForm.fullName}
                    onChange={(event) => {
                      setInviteError("");
                      setInviteForm((current) => ({
                        ...current,
                        fullName: event.target.value,
                      }));
                    }}
                  />
                </label>

                <label>
                  <span>
                    Email Address <span className="imp">*</span>
                  </span>
                  <input
                    type="email"
                    placeholder="client@example.com"
                    value={inviteForm.email}
                    onChange={(event) => {
                      setInviteError("");
                      setInviteForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }));
                    }}
                  />
                </label>

                <label>
                  <span>
                    Phone Number <small>(Optional)</small>
                  </span>
                  <input
                    type="tel"
                    placeholder="+61 2 9342 5678"
                    value={inviteForm.phoneNumber}
                    onChange={(event) => {
                      setInviteError("");
                      setInviteForm((current) => ({
                        ...current,
                        phoneNumber: event.target.value,
                      }));
                    }}
                  />
                </label>

                <div className="accountant-invite-note">
                  <strong>What happens next?</strong>
                  <p>
                    The client will receive an email invitation to join the
                    platform and complete their registration.
                  </p>
                </div>
              </div>
            )}

            <div className="accountant-invite-drawer-footer">
              <button type="button" onClick={resetInviteState}>
                {inviteSuccess ? "Close" : "Cancel"}
              </button>
              {!inviteSuccess && (
                <button
                  type="button"
                  className="is-primary"
                  onClick={handleInviteClient}
                  disabled={
                    inviteLoading ||
                    !inviteForm.fullName.trim() ||
                    !inviteForm.email.trim()
                  }
                >
                  {inviteLoading ? "Sending..." : "Send Invitation"}
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

export default function AccountantClientsPage() {
  return (
    <Suspense
      fallback={
        <section className="accountant-clients-page">
          <div className="accountant-clients-topbar">
            <div>
              <h1>All Clients</h1>
              <p>Manage and view all your property clients</p>
            </div>
          </div>
        </section>
      }
    >
      <AccountantClientsContent />
    </Suspense>
  );
}
