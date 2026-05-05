"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSession } from "../../src/lib/session";
import { logout } from "../../src/lib/logout";
import { normalizeRoleName } from "../../src/lib/roleNames";

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
    href: "/dashboard/accountant/clients",
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

  useEffect(() => {
    async function loadSession() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;

        if (!session) {
          router.replace("/login");
          return;
        }

        const idToken = session.getIdToken();
        const token = idToken.getJwtToken();

        await fetch("/api/invitations/accept", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => undefined);

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

  function renderPortalMenuItem(item: PortalMenuItem) {
    const isActive = item.href
      ? item.id === "transactions"
        ? pathname.includes("/transactions")
        : item.href === "/dashboard/accountant" ||
        item.href === "/dashboard/admin" ||
        item.href === "/dashboard/super-admin" ||
        item.href === "/dashboard/client"
        ? pathname === item.href
        : pathname.startsWith(item.href)
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
                  <span>Clear Portfolio</span>
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
            <div className="accountant-search">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6" />
                <path d="m20 20-4.2-4.2" />
              </svg>
              <input
                type="text"
                placeholder="Search clients, transactions, or properties..."
                aria-label="Search accountant dashboard"
              />
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
                  onClick={() => setIsAccountMenuOpen((current) => !current)}
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

        <button
          type="button"
          className={`accountant-mobile-menu-button${isMobileNavOpen ? " is-open" : ""}`}
          aria-label="Open navigation menu"
          aria-expanded={isMobileNavOpen}
          onClick={() => setIsMobileNavOpen((current) => !current)}
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
