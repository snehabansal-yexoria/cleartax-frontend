export type ConsoleRole = "admin" | "super_admin";

export type NavItem = { href: string; label: string; exact?: boolean };
export type NavSection = { label: string; items: NavItem[] };

const ADMIN = "/dashboard/admin";
const SUPER = "/dashboard/super-admin";

export const NAV: Record<ConsoleRole, NavSection[]> = {
  admin: [
    { label: "Overview", items: [{ href: ADMIN, label: "Dashboard", exact: true }] },
    {
      label: "People",
      items: [
        { href: `${ADMIN}/clients`, label: "Clients" },
        { href: `${ADMIN}/accountants`, label: "Accountants" },
        { href: `${ADMIN}/relationship-managers`, label: "Relationship managers" },
        { href: `${ADMIN}/invite`, label: "Invite users" },
      ],
    },
    {
      label: "Reports",
      items: [
        { href: `${ADMIN}/efficiency`, label: "Accountant efficiency" },
        { href: `${ADMIN}/transactions`, label: "Transactions" },
        { href: `${ADMIN}/properties`, label: "Properties" },
        { href: `${ADMIN}/entities`, label: "Entities" },
        { href: `${ADMIN}/audit-trail`, label: "Audit trail" },
      ],
    },
    {
      label: "Configuration",
      items: [
        { href: `${ADMIN}/data-settings`, label: "Data settings" },
        { href: `${ADMIN}/organisation`, label: "Organisation profile" },
      ],
    },
  ],
  super_admin: [
    { label: "Overview", items: [{ href: SUPER, label: "Dashboard", exact: true }] },
    {
      label: "Organisations",
      items: [
        { href: `${SUPER}/organisations`, label: "Organisations" },
        { href: `${SUPER}/create-organization`, label: "Add organisation" },
      ],
    },
    {
      label: "Admins",
      items: [
        { href: `${SUPER}/admins`, label: "Admins" },
        { href: `${SUPER}/bulk-upload`, label: "Bulk invite" },
      ],
    },
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
