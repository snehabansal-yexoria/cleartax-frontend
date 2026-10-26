/**
 * Sample data for the super admin's organisation workspace and the
 * platform audit log. None of these have backend endpoints yet, so the
 * screens show this data (switched off with SHOW_SAMPLE_DATA).
 */
import { SHOW_SAMPLE_DATA } from "./sampleData";

export { SHOW_SAMPLE_DATA };

/* ------------------------------------------------------------- users */

export type WsRole = "Admin" | "Relationship manager" | "Accountant" | "Client";
export type WsAccount = "Active" | "Invited" | "Disabled";
export type WsUser = {
  id: string;
  name: string;
  email: string;
  role: WsRole;
  account: WsAccount;
  lastSignIn: string;
  created: string;
  clients?: number;
  reportsTo?: string;
  sample: boolean;
};

const SAMPLE_PEOPLE: [string, string, WsRole, WsAccount, string, string, number?][] = [
  ["Rahul Mehta", "rahul", "Relationship manager", "Active", "Today, 9:40 am", "14 Feb 2024"],
  ["Emma Clarke", "emma", "Relationship manager", "Active", "Yesterday, 4:12 pm", "3 Mar 2024"],
  ["Daniel Wu", "daniel", "Relationship manager", "Active", "Today, 8:55 am", "3 Mar 2024"],
  ["Akash Sharma", "akash", "Accountant", "Active", "Today, 9:12 am", "5 Mar 2024", 11],
  ["Aisha Khan", "aisha", "Accountant", "Active", "Today, 8:47 am", "5 Mar 2024", 10],
  ["Satnam Singh", "satnam", "Accountant", "Active", "Today, 10:05 am", "5 Mar 2024", 9],
  ["Priya Rajan", "priya.r", "Accountant", "Active", "Today, 8:30 am", "2 Apr 2024", 8],
  ["Michael Chen", "michael", "Accountant", "Active", "12 Oct, 4:18 pm", "20 Jun 2024", 5],
  ["Nina Wong", "nina", "Accountant", "Invited", "Never", "2 Oct 2026", 0],
  ["Liam O’Connor", "liam", "Accountant", "Disabled", "2 Sept, 3:44 pm", "11 Jan 2025", 0],
  ["Sneha Bansal", "sneha", "Client", "Active", "Today, 7:58 am", "1 Apr 2024"],
  ["Grace Thompson", "grace", "Client", "Active", "Today, 11:02 am", "6 May 2024"],
  ["Raj Patel", "raj", "Client", "Active", "Yesterday, 8:15 pm", "6 May 2024"],
  ["Zoe Adams", "zoe", "Client", "Invited", "Never", "9 Oct 2026"],
  ["Ben Carter", "ben", "Client", "Disabled", "1 Aug, 10:20 am", "9 May 2024"],
];

/** Sample people for an organisation, with emails on the organisation's domain. */
export function sampleUsers(orgEmail: string | null | undefined): WsUser[] {
  if (!SHOW_SAMPLE_DATA) return [];
  const domain = (orgEmail?.split("@")[1] || "example.com.au").toLowerCase();
  return SAMPLE_PEOPLE.map(([name, local, role, account, lastSignIn, created, clients]) => ({
    id: `sample-user-${local}`,
    name,
    email: role === "Client" ? `${local}@email.com` : `${local}@${domain}`,
    role,
    account,
    lastSignIn,
    created,
    clients,
    reportsTo: role === "Accountant" ? ["Rahul Mehta", "Emma Clarke", "Daniel Wu"][name.length % 3] : undefined,
    sample: true,
  }));
}

/* ------------------------------------------------------- permissions */

export type Access = "none" | "view" | "edit";
export type Toggle = "on" | "off";
export const ROLES = ["Admin", "Relationship manager", "Accountant", "Client"] as const;

export type PermissionTable = {
  screens: { name: string; desc: string; values: Access[] }[];
  reports: { name: string; desc: string; values: Toggle[] }[];
  exports: { name: string; desc: string; values: Toggle[] }[];
};

export const DEFAULT_PERMISSIONS: PermissionTable = {
  screens: [
    { name: "Dashboard", desc: "Organisation overview", values: ["edit", "view", "view", "view"] },
    { name: "Clients", desc: "Client list and client detail", values: ["edit", "edit", "edit", "none"] },
    { name: "Accountants", desc: "Accountant list and reports", values: ["edit", "view", "none", "none"] },
    { name: "Transactions", desc: "All transactions and reconciliation", values: ["edit", "view", "edit", "view"] },
    { name: "Properties & entities", desc: "Portfolio records", values: ["edit", "view", "edit", "view"] },
    { name: "Documents", desc: "Document vault", values: ["edit", "view", "edit", "edit"] },
    { name: "Data settings", desc: "Dropdown lists and account codes", values: ["edit", "none", "none", "none"] },
    { name: "Audit trail", desc: "Who changed what", values: ["view", "view", "none", "none"] },
    { name: "Access control", desc: "Sign-ins, reset password, remove access", values: ["edit", "none", "none", "none"] },
  ],
  reports: [
    { name: "Portfolio report", desc: "Equity, value and growth", values: ["on", "on", "on", "on"] },
    { name: "Transactions report", desc: "By category, by accountant", values: ["on", "on", "on", "off"] },
    { name: "Properties report", desc: "Status and yield", values: ["on", "on", "on", "on"] },
    { name: "Entities report", desc: "Trusts, companies, SMSFs", values: ["on", "on", "on", "off"] },
    { name: "Accountant efficiency", desc: "Output and reconciliation", values: ["on", "on", "off", "off"] },
  ],
  exports: [
    { name: "Clients list", desc: "CSV / Excel", values: ["on", "on", "off", "off"] },
    { name: "Transactions", desc: "CSV / Excel", values: ["on", "on", "on", "off"] },
    { name: "Reports", desc: "CSV / Excel / PDF", values: ["on", "on", "off", "off"] },
    { name: "Audit trail", desc: "CSV / Excel", values: ["on", "off", "off", "off"] },
    { name: "Data settings lists", desc: "CSV", values: ["on", "off", "off", "off"] },
  ],
};

export const ROLE_HEADCOUNT = [1, 3, 12, 84];

export const SAMPLE_EXCEPTIONS = [
  { person: "Satnam Singh", role: "Accountant", kind: "allow", text: "Can export", what: "Transactions report", by: "Sam Carter · 3 Oct" },
  { person: "Michael Chen", role: "Accountant", kind: "block", text: "Can’t open", what: "Bank accounts", by: "Org admin · 28 Sept" },
  { person: "Rahul Mehta", role: "Relationship manager", kind: "allow", text: "Can edit", what: "Clients in his team only", by: "Sam Carter · 12 Sept" },
] as const;

/* ------------------------------------------------- master-data rules */

export type ListRule = { name: string; values: number; protectedCount: number; add: boolean; edit: boolean; del: boolean };

export const DEFAULT_LIST_RULES: ListRule[] = [
  { name: "Transaction categories", values: 9, protectedCount: 4, add: true, edit: true, del: false },
  { name: "Sub-categories", values: 24, protectedCount: 0, add: true, edit: true, del: true },
  { name: "Account codes", values: 38, protectedCount: 31, add: true, edit: false, del: false },
  { name: "Property types", values: 4, protectedCount: 4, add: false, edit: false, del: false },
  { name: "Property statuses", values: 6, protectedCount: 2, add: true, edit: true, del: false },
  { name: "Entity types", values: 6, protectedCount: 6, add: false, edit: false, del: false },
  { name: "Document types", values: 6, protectedCount: 0, add: true, edit: true, del: true },
  { name: "Modes of transaction", values: 5, protectedCount: 0, add: true, edit: true, del: true },
];

export type AccountCode = { code: string; name: string; ato: string; used: number; isProtected: boolean };

export const DEFAULT_CODES: AccountCode[] = [
  { code: "4000", name: "Gross rent", ato: "Gross rent", used: 1790, isProtected: true },
  { code: "6110", name: "Body corporate fees", ato: "Body corporate fees and charges", used: 318, isProtected: true },
  { code: "6140", name: "Council rates", ato: "Council rates", used: 284, isProtected: true },
  { code: "6180", name: "Interest on loans", ato: "Interest on loans", used: 512, isProtected: true },
  { code: "6230", name: "Repairs & maintenance", ato: "Repairs and maintenance", used: 684, isProtected: true },
  { code: "6420", name: "Land tax", ato: "Land tax", used: 0, isProtected: false },
  { code: "6430", name: "Strata special levy", ato: "Body corporate fees and charges", used: 0, isProtected: false },
  { code: "6260", name: "Travel to inspect property", ato: "Not deductible (residential)", used: 12, isProtected: true },
];

/* ----------------------------------------------------------- audit */

export type AuditKind = "Data change" | "Export" | "Failed access" | "Admin action" | "Sign-in";
export type AuditEvent = {
  id: string;
  daysAgo: number;
  time: string;
  kind: AuditKind;
  org: string;
  who: string;
  role: string;
  what: string;
  module: string;
  before: string;
  after: string;
};

const E = (
  id: number,
  daysAgo: number,
  time: string,
  kind: AuditKind,
  org: string,
  who: string,
  role: string,
  what: string,
  module: string,
  before: string,
  after: string,
): AuditEvent => ({ id: `evt-${id}`, daysAgo, time, kind, org, who, role, what, module, before, after });

export const SAMPLE_AUDIT: AuditEvent[] = SHOW_SAMPLE_DATA
  ? [
      E(1, 0, "14:22", "Admin action", "Sunrise Accounting Co.", "Sam Carter", "Super admin", "Account disabled · Liam O’Connor", "Users & roles", "Active", "Disabled"),
      E(2, 0, "13:58", "Export", "Harbour Tax Partners", "James O’Neill", "Admin", "Transactions report · FY 25–26", "Reports", "—", "transactions.xlsx · 4,210 rows"),
      E(3, 0, "12:40", "Failed access", "Coastal Ledger Group", "grace@coastalledger.com.au", "Accountant", "Wrong password, 3 attempts", "Sign-in", "—", "Locked for 15 min"),
      E(4, 0, "11:05", "Data change", "Sunrise Accounting Co.", "Priya Kapoor", "Admin", "Transaction categories · order", "Data settings", "Maintenance 3rd", "Maintenance 4th"),
      E(5, 0, "10:31", "Admin action", "Swan River Advisory", "Sam Carter", "Super admin", "Permission · Accountant · Exports", "Permissions", "Clients list: Off", "Clients list: Allowed"),
      E(6, 0, "09:47", "Failed access", "Sunrise Accounting Co.", "michael@sunrise.com.au", "Accountant", "Opened Bank accounts without permission", "Permissions", "—", "Blocked"),
      E(7, 0, "09:12", "Data change", "Sunrise Accounting Co.", "Akash Sharma", "Accountant", "TXN-1842 · 4 Park Ave", "Transactions", "Unclassified", "Maintenance · $850"),
      E(8, 1, "18:20", "Admin action", "Capital Ledger Co.", "Sam Carter", "Super admin", "Organisation suspended", "Organisations", "Active", "Suspended"),
      E(9, 1, "16:02", "Export", "Sunrise Accounting Co.", "Priya Kapoor", "Admin", "Accountant efficiency", "Reports", "—", "efficiency.pdf"),
      E(10, 1, "15:40", "Admin action", "Sunrise Accounting Co.", "Sam Carter", "Super admin", "Account code 4000 protected", "Master-data rules", "Editable", "Protected"),
      E(11, 1, "11:18", "Sign-in", "Adelaide Hills Accounting", "priya@adelaidehills.com.au", "Admin", "First sign-in", "Sign-in", "Invited", "Active"),
      E(12, 3, "09:30", "Data change", "Harbour Tax Partners", "Mei Lin", "Accountant", "Property 12 Bay St · status", "Properties", "Vacant", "Rented"),
      E(13, 9, "17:05", "Admin action", "Coastal Ledger Group", "Sam Carter", "Super admin", "Role changed · Hannah Scott", "Users & roles", "Accountant", "Relationship manager"),
      E(14, 21, "10:12", "Export", "Swan River Advisory", "Oliver Brooks", "Admin", "Clients list", "Clients", "—", "clients.csv · 168 rows"),
      E(15, 45, "14:44", "Failed access", "Harbour Tax Partners", "unknown", "—", "Sign-in from unknown device", "Sign-in", "—", "Blocked"),
    ]
  : [];
