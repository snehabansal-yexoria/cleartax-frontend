"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSession } from "../../src/lib/session";
import { jwtDecode } from "jwt-decode";
import { logout } from "../../src/lib/logout";

interface TokenPayload {
  email: string;
  "custom:role"?: string;
}

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

interface OrganizationResponse {
  organization: {
    id: string;
    name: string;
  } | null;
}

const accountantMenuItems = [
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

        const decoded: TokenPayload = jwtDecode(token);

        setEmail(decoded.email || "");

        const userRole = decoded["custom:role"] || "client";

        setRole(userRole);

        if (userRole === "admin" || userRole === "accountant") {
          const orgResponse = await fetch("/api/users/me/organization", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (orgResponse.ok) {
            const data = (await orgResponse.json()) as OrganizationResponse;
            setOrganizationName(data.organization?.name || "");
          }
        }
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

  function renderAccountantMenuItem(item: (typeof accountantMenuItems)[number]) {
    const isActive = item.href
      ? item.href === "/dashboard/accountant"
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

  if (role === "accountant") {
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
              {accountantMenuItems.map(renderAccountantMenuItem)}
            </nav>
          </div>

          <div className="accountant-sidebar-footer">
            <div className="accountant-avatar accountant-avatar-small">
              {initials}
            </div>
            <div className="accountant-profile-copy">
              <strong>Accountant Portal</strong>
              <span>{organizationName || email || "Account access"}</span>
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
                    <strong>{organizationName || "Accountant Dashboard"}</strong>
                    <span>{email || "Account Manager"}</span>
                  </div>
                  <div className="accountant-avatar">{initials}</div>
                </button>

                {isAccountMenuOpen && (
                  <div className="accountant-profile-menu" role="menu">
                    <Link
                      href="/dashboard/accountant/account"
                      className="accountant-profile-menu-item"
                      role="menuitem"
                      onClick={() => setIsAccountMenuOpen(false)}
                    >
                      Account
                    </Link>
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
                  <span>{organizationName || "Accountant Portal"}</span>
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
                {accountantMenuItems.map(renderAccountantMenuItem)}
              </nav>
            </aside>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: "250px",
          background: "#111",
          color: "white",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h3>Dashboard</h3>

          <p>{email}</p>

          <p>Role: {role}</p>

          <hr />

          <nav>
            <a href="/dashboard">Home</a>

            <br />
            <br />

            {role === "super_admin" && (
              <>
                <a href="/dashboard/super-admin">Super Admin Panel</a>
                <br />
                <br />

                <a href="/dashboard/super-admin/invite-admin">Invite User</a>
                <br />
                <br />

                <a href="/dashboard/super-admin/create-organization">
                  Create Organization
                </a>
              </>
            )}

            {role === "admin" && (
              <>
                <a href="/dashboard/admin">Admin Panel</a>
                <br />
                <br />

                <a href="/dashboard/admin/invite">Invite User</a>
              </>
            )}
            {role === "accountant" && (
              <>
                <a href="/dashboard/accountant">Accountant Panel</a>
                <br />
                <br />

                <a href="/dashboard/accountant/invite">Invite Client</a>
              </>
            )}

            {role === "user" && (
              <>
                <a href="/dashboard/client">Client Panel</a>
                <br />
                <br />
              </>
            )}

            {role === "client" && (
              <>
                <a href="/dashboard/client">Client Panel</a>
                <br />
                <br />
              </>
            )}
          </nav>
        </div>

        <button
          onClick={handleLogout}
          style={{
            padding: "10px",
            background: "#e11d48",
            color: "white",
            border: "none",
            cursor: "pointer",
            borderRadius: "4px",
          }}
        >
          Logout
        </button>
      </aside>

      <main style={{ flex: 1, padding: "40px" }}>{children}</main>
    </div>
  );
}
