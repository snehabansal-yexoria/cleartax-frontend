"use client";

import { useEffect, useState, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSession } from "../../src/lib/session";
import { logout } from "../../src/lib/logout";
import { normalizeRoleName } from "../../src/lib/roleNames";
import {
  readSessionBootstrap,
  saveSessionBootstrap,
} from "../../src/lib/sessionBootstrap";
import {
  announceDropdownOpen,
  dropdownRegistryEvent,
  isDropdownRegistryEvent,
} from "@/src/lib/dropdownRegistry";
import ReconciliationJobMonitor from "@/app/components/ReconciliationJobMonitor";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

interface MeResponse {
  email: string;
  role: string;
  orgName?: string;
}

type PortalMenuItem = {
  id: string;
  href?: string;
  label: string;
  icon: ReactNode;
};

function DashboardShellSkeleton() {
  return (
    <div className="accountant-shell dashboard-shell-skeleton">
      <aside className="accountant-sidebar accountant-sidebar-skeleton">
        <div className="accountant-sidebar-top">
          <div className="accountant-sidebar-header">
            <div className="skeleton-circle skeleton-circle-brand" />
          </div>

          <nav className="accountant-nav" aria-label="Loading navigation">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="dashboard-nav-skeleton-item">
                <div className="skeleton-circle skeleton-circle-nav" />
                <div className="skeleton-line dashboard-nav-skeleton-label" />
              </div>
            ))}
          </nav>
        </div>

        <div className="accountant-sidebar-footer">
          <div className="skeleton-circle skeleton-circle-sm" />
          <div className="skeleton-stack dashboard-sidebar-profile-skeleton">
            <div className="skeleton-line skeleton-line-md" />
            <div className="skeleton-line skeleton-line-sm" />
          </div>
        </div>
      </aside>

      <div className="accountant-main-shell">
        <div className="accountant-mobile-brand dashboard-mobile-brand-skeleton">
          <div className="skeleton-circle skeleton-circle-brand" />
          <div className="skeleton-line dashboard-mobile-brand-line" />
        </div>

        <header className="accountant-topbar">
          <div className="skeleton-input dashboard-search-skeleton" />
          <div className="accountant-topbar-actions">
            <div className="skeleton-circle skeleton-circle-sm" />
            <div className="skeleton-row">
              <div className="skeleton-stack dashboard-header-copy-skeleton">
                <div className="skeleton-line skeleton-line-md" />
                <div className="skeleton-line skeleton-line-sm" />
              </div>
              <div className="skeleton-circle" />
            </div>
          </div>
        </header>

        <main className="accountant-main-content">
          <section className="portal-page boneyard-fallback">
            <div className="portal-page-header">
              <div className="skeleton-stack">
                <div className="skeleton-line skeleton-line-sm" />
                <div className="skeleton-line skeleton-line-lg" />
                <div className="skeleton-line skeleton-line-md" />
              </div>
              <div className="skeleton-pill skeleton-pill-wide" />
            </div>

            <div className="portal-summary-grid">
              {Array.from({ length: 3 }).map((_, index) => (
                <article key={index} className="portal-summary-card">
                  <div className="skeleton-line skeleton-line-sm" />
                  <div className="skeleton-line skeleton-line-xl" />
                  <div className="skeleton-line skeleton-line-md" />
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

const accountantMenuItems: PortalMenuItem[] = [
  {
    id: "dashboard",
    href: "/dashboard/accountant",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    id: "clients",
    href: "/dashboard/accountant/clients?tab=mine",
    label: "Clients",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
        <circle cx="9.5" cy="7" r="4" />
        <path d="M20 19v-1.2a3.4 3.4 0 0 0-2.7-3.3" />
        <path d="M15.8 4.8a3.6 3.6 0 0 1 0 6.9" />
      </svg>
    ),
  },
  {
    id: "transactions",
    href: "/dashboard/accountant/transactions",
    label: "Transactions",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8" />
        <path d="M8 12h8" />
        <path d="M10.5 16h3" />
        <path d="M12 6v12" />
      </svg>
    ),
  },
  {
    id: "tasks",
    label: "Tasks",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="m8 12 2.5 2.5L16 9" />
      </svg>
    ),
  },
  {
    id: "reports",
    label: "Reports",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6" />
        <path d="M9 17h4" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1 0 2.8 2 2 0 0 1-2.8 0l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1z" />
      </svg>
    ),
  },
];

const adminMenuItems: PortalMenuItem[] = [
  {
    id: "dashboard",
    href: "/dashboard/admin",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    id: "invite",
    href: "/dashboard/admin/invite",
    label: "Invite User",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
        <circle cx="9.5" cy="7" r="4" />
        <path d="M19 8v6" />
        <path d="M16 11h6" />
      </svg>
    ),
  },
  {
    id: "bulk-upload",
    href: "/dashboard/admin/bulk-upload",
    label: "Bulk Upload",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 16V6" />
        <path d="m7.5 10.5 4.5-4.5 4.5 4.5" />
        <path d="M5 18h14" />
      </svg>
    ),
  },
];

const superAdminMenuItems: PortalMenuItem[] = [
  {
    id: "dashboard",
    href: "/dashboard/super-admin",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    id: "invite",
    href: "/dashboard/super-admin/invite-admin",
    label: "Invite Admin",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
        <circle cx="9.5" cy="7" r="4" />
        <path d="M19 8v6" />
        <path d="M16 11h6" />
      </svg>
    ),
  },
  {
    id: "bulk-upload",
    href: "/dashboard/super-admin/bulk-upload",
    label: "Bulk Upload",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 16V6" />
        <path d="m7.5 10.5 4.5-4.5 4.5 4.5" />
        <path d="M5 18h14" />
      </svg>
    ),
  },
  {
    id: "organization",
    href: "/dashboard/super-admin/create-organization",
    label: "Organization",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="7" height="16" rx="1.5" />
        <rect x="13" y="8" width="7" height="12" rx="1.5" />
        <path d="M7.5 8h0.01" />
        <path d="M7.5 12h0.01" />
        <path d="M7.5 16h0.01" />
      </svg>
    ),
  },
];

const clientMenuItems: PortalMenuItem[] = [
  {
    id: "dashboard",
    href: "/dashboard/client",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
];

function highlightMatch(text: string, query: string) {
  if (!query) return <span>{text}</span>;
  const cleanQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const parts = text.split(new RegExp(`(${cleanQuery})`, "gi"));
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <strong key={i} className="search-highlight">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </span>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [email, setEmail] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [organizationName, setOrganizationName] = useState<string>("");
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");

  // Autocomplete states
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [hasPrefetched, setHasPrefetched] = useState(false);
  
  // Data catalogs for in-memory matching
  const [clientsCatalog, setClientsCatalog] = useState<any[]>([]);
  const [entitiesCatalog, setEntitiesCatalog] = useState<any[]>([]);

  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadSession() {
      try {
        const bootstrap = readSessionBootstrap();
        if (bootstrap) {
          setEmail(bootstrap.email);
          setRole(bootstrap.role);
          setOrganizationName(bootstrap.orgName);
        }

        const session = (await getSession()) as SessionWithIdToken | null;

        if (!session) {
          router.replace("/login");
          return;
        }

        const idToken = session.getIdToken();
        const token = idToken.getJwtToken();

        void fetch("/api/invitations/accept", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch((error) => {
          console.warn("Invitation acceptance did not complete:", error);
        });

        const meResponse = await fetch("/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!meResponse.ok) {
          router.replace("/login");
          return;
        }

        const me = (await meResponse.json()) as MeResponse;

        setEmail(me.email || "");
        const roleName = normalizeRoleName(me.role);

        setRole(roleName);
        setOrganizationName(me.orgName || "");

        saveSessionBootstrap({
          email: me.email,
          role: roleName,
          orgName: me.orgName,
        });
        document.cookie = `role=${roleName}; path=/`;
      } catch (error) {
        console.error("Session error:", error);
        router.replace("/login");
      }
    }

    loadSession();
  }, [router]);

  function handleLogout() {
    logout();

    router.replace("/login");
  }

  function getInitials(value: string) {
    if (!value) return "AP";

    const localPart = value.split("@")[0] || value;
    const parts = localPart
      .split(/[._-]/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return localPart.slice(0, 2).toUpperCase();
  }

  const initials = getInitials(email);

  const portalMenuItems =
    role === "super_admin"
      ? superAdminMenuItems
      : role === "admin"
        ? adminMenuItems
        : role === "client" || role === "user"
          ? clientMenuItems
          : accountantMenuItems;

  const portalTitle =
    role === "super_admin"
      ? "Super Admin Control"
      : role === "admin"
        ? organizationName || "Admin Workspace"
        : role === "client" || role === "user"
          ? organizationName || "Client Dashboard"
          : organizationName || "Accountant Dashboard";

  const portalSubtitle =
    role === "super_admin"
      ? email || "Platform oversight"
      : email || "Account access";
  const accountDropdownId = "dashboard-account-menu";
  const mobileNavDropdownId = "dashboard-mobile-nav";

  useEffect(() => {
    function closeIfAnotherOpened(event: Event) {
      if (!isDropdownRegistryEvent(event)) return;
      const id = event.detail?.id;
      if (!id) return;
      if (id !== accountDropdownId) setIsAccountMenuOpen(false);
      if (id !== mobileNavDropdownId) setIsMobileNavOpen(false);
    }

    window.addEventListener(dropdownRegistryEvent, closeIfAnotherOpened);
    return () =>
      window.removeEventListener(dropdownRegistryEvent, closeIfAnotherOpened);
  }, []);

  // Prefetch data based on role
  async function prefetchSearchData() {
    if (hasPrefetched || !role) return;

    try {
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) return;
      const token = session.getIdToken().getJwtToken();
      const headers = { Authorization: `Bearer ${token}` };

      if (role === "accountant") {
        const res = await fetch("/api/users/me/clients?scope=all", { headers });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          setClientsCatalog(data.clients || []);
        }
      } else if (role === "client" || role === "user") {
        const res = await fetch("/api/entities", { headers });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          setEntitiesCatalog(data.items || []);
        }
      }
      setHasPrefetched(true);
    } catch (err) {
      console.warn("Failed to prefetch autocomplete data", err);
    }
  }

  // Auto prefetch when role is determined
  useEffect(() => {
    if (role) {
      prefetchSearchData();
    }
  }, [role]);

  // Click outside to dismiss suggestions
  useEffect(() => {
    if (!isSearchFocused) return;

    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        console.log("Clicked outside global search! Closing suggestions.");
        setIsSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSearchFocused]);

  // Compute and filter search suggestions on typing
  useEffect(() => {
    console.log("Suggestions hook ran. isSearchFocused:", isSearchFocused, "role:", role, "query:", globalSearch);
    if (!isSearchFocused) {
      setSuggestions([]);
      return;
    }

    const query = globalSearch.trim().toLowerCase();

    // 1. Static navigation/action suggestions
    const actions: any[] = [];
    
    if (role === "accountant") {
      actions.push(
        { id: "nav-dash", type: "nav", title: "Go to Dashboard", href: "/dashboard/accountant", keywords: ["dashboard", "home", "main"] },
        { id: "nav-clients", type: "nav", title: "View All Clients", href: "/dashboard/accountant/clients", keywords: ["clients", "customers", "users", "list"] },
        { id: "nav-invite", type: "action", title: "Invite Client", href: "/dashboard/accountant/clients?invite=1", keywords: ["invite", "new client", "add client", "create"] },
        { id: "nav-txs", type: "nav", title: "View Transactions", href: "/dashboard/accountant/transactions", keywords: ["transactions", "payments", "money", "history"] }
      );
    } else if (role === "admin") {
      actions.push(
        { id: "nav-dash", type: "nav", title: "Go to Dashboard", href: "/dashboard/admin", keywords: ["dashboard", "home"] },
        { id: "nav-invite", type: "action", title: "Invite User", href: "/dashboard/admin/invite", keywords: ["invite", "add", "new user"] },
        { id: "nav-upload", type: "action", title: "Bulk Upload", href: "/dashboard/admin/bulk-upload", keywords: ["bulk", "upload", "csv", "excel", "import"] }
      );
    } else if (role === "super_admin") {
      actions.push(
        { id: "nav-dash", type: "nav", title: "Go to Dashboard", href: "/dashboard/super-admin", keywords: ["dashboard", "home"] },
        { id: "nav-invite-admin", type: "action", title: "Invite Admin", href: "/dashboard/super-admin/invite-admin", keywords: ["invite", "admin", "add"] },
        { id: "nav-upload", type: "action", title: "Bulk Upload", href: "/dashboard/super-admin/bulk-upload", keywords: ["bulk", "upload", "csv", "import"] },
        { id: "nav-org", type: "action", title: "Create Organization", href: "/dashboard/super-admin/create-organization", keywords: ["organization", "org", "create", "new"] }
      );
    } else if (role === "client" || role === "user") {
      actions.push(
        { id: "nav-dash", type: "nav", title: "Go to Dashboard", href: "/dashboard/client", keywords: ["dashboard", "home", "entities"] },
        { id: "nav-add-entity", type: "action", title: "Add Entity", href: "/dashboard/client/entities/new", keywords: ["add entity", "new entity", "create company", "trust"] },
        { id: "nav-add-tx", type: "action", title: "Add Transaction", href: "/dashboard/client/transactions/new", keywords: ["add transaction", "new payment", "create transaction"] }
      );
    }

    const filteredActions = actions.filter(act => {
      if (!query) return true;
      return (
        act.title.toLowerCase().includes(query) ||
        act.keywords.some((k: string) => k.toLowerCase().includes(query))
      );
    });

    // 2. Dynamic matching from pre-fetched catalogs
    const dynamicResults: any[] = [];
    if (query) {
      if (role === "accountant") {
        clientsCatalog.forEach(client => {
          const nameMatch = client.name?.toLowerCase().includes(query);
          const emailMatch = client.email?.toLowerCase().includes(query);
          if (nameMatch || emailMatch) {
            dynamicResults.push({
              id: `client-${client.id}`,
              type: "client",
              title: client.name || "Unnamed Client",
              subtitle: client.email || "",
              href: `/dashboard/accountant/clients/${client.id}`
            });
          }
        });
      } else if (role === "client" || role === "user") {
        entitiesCatalog.forEach(entity => {
          if (entity.name?.toLowerCase().includes(query)) {
            dynamicResults.push({
              id: `entity-${entity.id}`,
              type: "entity",
              title: entity.name || "Unnamed Entity",
              subtitle: entity.entityType ? entity.entityType.replace(/_/g, " ").toUpperCase() : "ENTITY",
              href: `/dashboard/client/entities/${entity.id}`
            });
          }
        });
      }
    }

    const combined = [...filteredActions, ...dynamicResults].slice(0, 8);
    console.log("Suggestions calculated array:", combined);
    setSuggestions(combined);
    setHighlightedIndex(-1);
  }, [globalSearch, isSearchFocused, role, clientsCatalog, entitiesCatalog]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        event.preventDefault();
        const selected = suggestions[highlightedIndex];
        if (selected.href && selected.href !== "#") {
          router.push(selected.href);
        }
        setIsSearchFocused(false);
      }
    } else if (event.key === "Escape") {
      setIsSearchFocused(false);
      event.currentTarget.blur();
    }
  }

  function handleGlobalSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = globalSearch.trim();
    if (!query) return;

    setIsSearchFocused(false);

    if (role === "accountant") {
      router.push(
        `/dashboard/accountant/clients?q=${encodeURIComponent(query)}`,
      );
      return;
    }

    router.push(`/dashboard?search=${encodeURIComponent(query)}`);
  }

  function renderPortalMenuItem(item: PortalMenuItem) {
    const hrefPath = item.href ? item.href.split("?")[0] : "";
    const isActive = hrefPath
      ? hrefPath === "/dashboard/accountant" ||
        hrefPath === "/dashboard/admin" ||
        hrefPath === "/dashboard/super-admin" ||
        hrefPath === "/dashboard/client"
        ? pathname === hrefPath
        : pathname.startsWith(hrefPath)
      : false;

    if (!item.href) {
      return (
        <button
          key={item.id}
          type="button"
          className="accountant-nav-item accountant-nav-item-static"
          aria-label={item.label}
        >
          <span className="accountant-nav-icon">{item.icon}</span>
          <span className="accountant-nav-label">{item.label}</span>
        </button>
      );
    }

    return (
      <Link
        key={item.id}
        href={item.href}
        className={`accountant-nav-item${isActive ? " is-active" : ""}`}
        aria-label={item.label}
        onClick={() => setIsMobileNavOpen(false)}
      >
        <span className="accountant-nav-icon">{item.icon}</span>
        <span className="accountant-nav-label">{item.label}</span>
      </Link>
    );
  }

  if (!role) {
    return <DashboardShellSkeleton />;
  }

  if (
    role === "accountant" ||
    role === "admin" ||
    role === "super_admin" ||
    role === "client" ||
    role === "user"
  ) {
    return (
      <div className="accountant-shell">
        <aside className="accountant-sidebar">
          <div className="accountant-sidebar-top">
            <div className="accountant-sidebar-header">
              <div className="accountant-brand">
                <div className="accountant-brand-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="5" y="5" width="6" height="6" rx="1.2" />
                    <rect x="13" y="5" width="6" height="6" rx="1.2" />
                    <rect x="5" y="13" width="6" height="6" rx="1.2" />
                    <rect x="13" y="13" width="6" height="6" rx="1.2" />
                  </svg>
                </div>
                <div className="accountant-brand-copy">
                  <span>Clear <br /> Portfolio</span>
                </div>
              </div>
            </div>

            <nav className="accountant-nav">
              {portalMenuItems.map(renderPortalMenuItem)}
            </nav>
          </div>

          <div className="accountant-sidebar-footer">
            <div className="accountant-avatar accountant-avatar-small">
              {initials}
            </div>
            <div className="accountant-profile-copy">
              <strong>
                {role === "super_admin"
                  ? "Super Admin Portal"
                  : role === "admin"
                    ? "Admin Portal"
                    : role === "client" || role === "user"
                      ? "Client Portal"
                      : "Accountant Portal"}
              </strong>
              <span>{portalSubtitle}</span>
            </div>
          </div>
        </aside>

        <div className="accountant-main-shell">
          <div className="accountant-mobile-brand">
            <div className="accountant-brand">
              <div className="accountant-brand-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="5" y="5" width="6" height="6" rx="1.2" />
                  <rect x="13" y="5" width="6" height="6" rx="1.2" />
                  <rect x="5" y="13" width="6" height="6" rx="1.2" />
                  <rect x="13" y="13" width="6" height="6" rx="1.2" />
                </svg>
              </div>
              <div className="accountant-brand-copy">
                <span>Clear Portfolio</span>
              </div>
            </div>
          </div>

          <header className="accountant-topbar">
            <div className="accountant-search-container" ref={searchRef}>
              <form className="accountant-search" onSubmit={handleGlobalSearch}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="6" />
                  <path d="m20 20-4.2-4.2" />
                </svg>
                <input
                  type="text"
                  placeholder="Search clients, transactions, or properties..."
                  aria-label="Search accountant dashboard"
                  value={globalSearch}
                  onChange={(event) => setGlobalSearch(event.target.value)}
                  onFocus={() => {
                    setIsSearchFocused(true);
                    prefetchSearchData();
                  }}
                  onKeyDown={handleKeyDown}
                />
              </form>

              {isSearchFocused && suggestions.length > 0 && (
                <div className="search-suggestions-dropdown">
                  <div className="suggestions-scrollable">
                    {suggestions.map((item, index) => {
                      const isHighlighted = index === highlightedIndex;
                      return (
                        <div
                          key={item.id}
                          className={`suggestion-item ${isHighlighted ? "is-highlighted" : ""}`}
                          onMouseEnter={() => setHighlightedIndex(index)}
                          onClick={() => {
                            if (item.href && item.href !== "#") {
                              router.push(item.href);
                            }
                            setIsSearchFocused(false);
                          }}
                        >
                          <div className="suggestion-icon-wrapper">
                            {item.type === "nav" || item.type === "action" ? (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polygon points="3 11 22 2 13 21 11 13 3 11" />
                              </svg>
                            ) : item.type === "client" ? (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                              </svg>
                            )}
                          </div>
                          <div className="suggestion-text-wrapper">
                            <span className="suggestion-title">
                              {highlightMatch(item.title, globalSearch)}
                            </span>
                            {item.subtitle && (
                              <span className="suggestion-subtitle">
                                {highlightMatch(item.subtitle, globalSearch)}
                              </span>
                            )}
                          </div>
                          {isHighlighted && (
                            <div className="suggestion-enter-badge">
                              <span>Enter ↵</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="accountant-topbar-actions">
              <button
                type="button"
                className="accountant-icon-button"
                aria-label="Notifications"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M15 17H5l1.4-1.4A2 2 0 0 0 7 14.2V10a5 5 0 0 1 10 0v4.2a2 2 0 0 0 .6 1.4L19 17h-4" />
                  <path d="M10 20a2 2 0 0 0 4 0" />
                </svg>
              </button>

              <div className="accountant-header-profile">
                <button
                  type="button"
                  className="accountant-profile-trigger"
                  onClick={() =>
                    setIsAccountMenuOpen((current) => {
                      const next = !current;
                      if (next) announceDropdownOpen(accountDropdownId);
                      return next;
                    })
                  }
                  aria-haspopup="menu"
                  aria-expanded={isAccountMenuOpen}
                >
                  <div className="accountant-header-copy">
                    <strong>{portalTitle}</strong>
                    <span>{portalSubtitle}</span>
                  </div>
                  <div className="accountant-avatar">{initials}</div>
                </button>

                {isAccountMenuOpen && (
                  <div className="accountant-profile-menu" role="menu">
                    {role === "accountant" ? (
                      <Link
                        href="/dashboard/accountant/account"
                        className="accountant-profile-menu-item"
                        role="menuitem"
                        onClick={() => setIsAccountMenuOpen(false)}
                      >
                        Account
                      </Link>
                    ) : (
                      <Link
                        href={
                          role === "super_admin"
                            ? "/dashboard/super-admin"
                            : role === "admin"
                              ? "/dashboard/admin"
                              : "/dashboard/client"
                        }
                        className="accountant-profile-menu-item"
                        role="menuitem"
                        onClick={() => setIsAccountMenuOpen(false)}
                      >
                        Dashboard
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="accountant-profile-menu-item accountant-profile-menu-danger"
                      role="menuitem"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="accountant-main-content">{children}</main>
        </div>
        <ReconciliationJobMonitor />

        <button
          type="button"
          className={`accountant-mobile-menu-button${isMobileNavOpen ? " is-open" : ""}`}
          aria-label="Open navigation menu"
          aria-expanded={isMobileNavOpen}
          onClick={() =>
            setIsMobileNavOpen((current) => {
              const next = !current;
              if (next) announceDropdownOpen(mobileNavDropdownId);
              return next;
            })
          }
        >
          <span />
          <span />
          <span />
        </button>

        {isMobileNavOpen && (
          <div className="accountant-mobile-nav-layer">
            <button
              type="button"
              className="accountant-mobile-nav-backdrop"
              aria-label="Close navigation menu"
              onClick={() => setIsMobileNavOpen(false)}
            />

            <aside className="accountant-mobile-nav-sheet">
              <div className="accountant-mobile-nav-header">
                <div>
                  <strong>Clear Portfolio</strong>
                  <span>
                    {role === "super_admin"
                      ? "Super Admin Portal"
                      : role === "admin"
                        ? "Admin Portal"
                        : role === "client" || role === "user"
                          ? organizationName || "Client Portal"
                          : organizationName || "Accountant Portal"}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Close navigation menu"
                  onClick={() => setIsMobileNavOpen(false)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6l12 12" />
                    <path d="M18 6 6 18" />
                  </svg>
                </button>
              </div>

              <nav className="accountant-mobile-nav-list">
                {portalMenuItems.map(renderPortalMenuItem)}
              </nav>
            </aside>
          </div>
        )}
      </div>
    );
  }

  return <DashboardShellSkeleton />;
}
