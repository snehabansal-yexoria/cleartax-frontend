"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useState, type FormEvent, type ReactNode } from "react";
import "./console.css";
import { BellIcon, MenuIcon } from "./components/icons";
import { ConsolePageSkeleton } from "./components/Skeletons";
import { cx } from "./components/ui";
import { initials } from "./lib/format";
import { NAV, isNavActive, titleForPath, type ConsoleRole } from "./nav";

/**
 * App frame for the admin and super admin consoles. The accountant and client
 * portals keep their existing shell in app/dashboard/layout.tsx.
 */
export default function ConsoleShell({
  role,
  email,
  organizationName,
  onLogout,
  children,
}: {
  role: ConsoleRole;
  email: string;
  organizationName: string;
  onLogout: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [query, setQuery] = useState("");

  const isSuper = role === "super_admin";
  const home = isSuper ? "/dashboard/super-admin" : "/dashboard/admin";
  const searchTarget = isSuper ? `${home}/organisations` : `${home}/clients`;

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `${searchTarget}?q=${encodeURIComponent(value)}` : searchTarget);
  }

  return (
    <div className={cx("cpc", navOpen && "is-nav-open")}>
      <aside className="cpc-sidebar" aria-label="Main navigation">
        <Link href={home} className="cpc-brand" onClick={() => setNavOpen(false)}>
          <span className="cpc-brand-logo">CP</span>
          <span>
            <span className="cpc-brand-name" style={{ display: "block" }}>
              ClearPortfolio
            </span>
            <span className="cpc-brand-org" style={{ display: "block" }}>
              {isSuper ? "Super admin console" : organizationName || "Admin console"}
            </span>
          </span>
        </Link>

        <nav>
          {NAV[role].map((section) => (
            <div key={section.label}>
              <div className="cpc-nav-section">{section.label}</div>
              {section.items.map((item) => {
                const active = isNavActive(item, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cx("cpc-nav-link", active && "is-active")}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setNavOpen(false)}
                  >
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="cpc-sidebar-user">
          <span className="cpc-avatar" style={{ background: "#3a4291", color: "#fff" }} aria-hidden="true">
            {initials(email)}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <strong>{isSuper ? "Super admin" : "Org admin"}</strong>
            <span title={email}>{email}</span>
          </div>
          <button
            type="button"
            className="cpc-link"
            style={{ color: "#cfd3f2", fontSize: "0.82em" }}
            onClick={onLogout}
          >
            Log out
          </button>
        </div>
      </aside>
      <button type="button" className="cpc-scrim" aria-label="Close navigation" onClick={() => setNavOpen(false)} />

      <div className="cpc-main">
        <header className="cpc-topbar">
          <div className="cpc-topbar-title">
            <button
              type="button"
              className="cpc-btn cpc-icon-btn cpc-menu-toggle"
              aria-label="Open navigation"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
            >
              <MenuIcon />
            </button>
            <div>
              <strong>{titleForPath(role, pathname)}</strong>
              <span>{isSuper ? "ClearPortfolio platform" : organizationName || email}</span>
            </div>
          </div>
          <div className="cpc-topbar-right">
            <form role="search" onSubmit={onSearch}>
              <input
                className="cpc-search"
                type="search"
                aria-label={isSuper ? "Search organisations" : "Search clients"}
                placeholder={isSuper ? "Search organisations or admins…" : "Search clients…"}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </form>
            <button type="button" className="cpc-btn cpc-icon-btn" aria-label="Notifications" title="Notifications">
              <BellIcon />
            </button>
            <Link
              href={isSuper ? `${home}/profile` : `${home}/organisation`}
              className="cpc-avatar cpc-tone-0"
              style={{ width: "2.6em", height: "2.6em", textDecoration: "none" }}
              aria-label="Your profile"
            >
              {initials(email)}
            </Link>
          </div>
        </header>

        <main className="cpc-content">
          <Suspense fallback={<ConsolePageSkeleton />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
