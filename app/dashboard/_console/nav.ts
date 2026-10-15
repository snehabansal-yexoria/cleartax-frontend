export type ConsoleRole = "super_admin";

export type NavItem = { href: string; label: string; exact?: boolean };
export type NavSection = { label: string; items: NavItem[] };

const SUPER = "/dashboard/super-admin";

/** Super admin sidebar, as in the "ClearPortfolio Super Admin Panel" design. */
export const NAV: Record<ConsoleRole, NavSection[]> = {
  super_admin: [
    { label: "Overview", items: [{ href: SUPER, label: "Dashboard", exact: true }] },
    {
      label: "Organisations",
      items: [
        { href: `${SUPER}/organisations`, label: "Organisations" },
        { href: `${SUPER}/create-organization`, label: "Add organisation" },
      ],
    },
    { label: "Admins", items: [{ href: `${SUPER}/admins`, label: "Admins" }] },
    { label: "Account", items: [{ href: `${SUPER}/profile`, label: "My profile" }] },
  ],
};

export function isNavActive(item: NavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Title shown in the top bar for the current route. */
export function titleForPath(role: ConsoleRole, pathname: string) {
  const items = NAV[role].flatMap((section) => section.items);
  const match = [...items].sort((a, b) => b.href.length - a.href.length).find((item) => isNavActive(item, pathname));
  if (match) return match.label;
  if (pathname.includes("/invite-admin")) return "Invite admin";
  if (pathname.includes("/bulk-upload")) return "Bulk upload";
  return "Dashboard";
}
