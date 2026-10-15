import type { InvitedUser, Organisation } from "./superAdminData";

/**
 * Hard-coded sample data for the super admin screens.
 *
 * The backend doesn't return platform totals, per-organisation counts, MFA or
 * last-login yet. While SHOW_SAMPLE_DATA is on, those gaps are filled with
 * stable, realistic numbers so reviewers can see how the screens look with
 * data, and a few sample organisations are listed next to the real ones.
 *
 * Turn it off (false) once the real endpoints exist: every screen falls back
 * to the real API data and shows "—" where a figure isn't available.
 */
export const SHOW_SAMPLE_DATA = true;

const SAMPLE_PREFIX = "sample-";

export function isSampleId(id: string | null | undefined) {
  return Boolean(id && id.startsWith(SAMPLE_PREFIX));
}

/* ------------------------------------------------------- deterministic RNG */

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: string) {
  let a = hash(seed) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function between(random: () => number, min: number, max: number) {
  return Math.round(min + random() * (max - min));
}

/* ------------------------------------------------------- sample organisations */

type SampleOrg = {
  slug: string;
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postcode: string;
  plan: string;
  created: string;
  active: boolean;
  admin: { name: string; email: string; since: string; pending?: boolean; invitedBy?: string };
  previousAdmin?: { name: string; email: string; since: string };
};

const SAMPLE_ORGS: SampleOrg[] = [
  {
    slug: "bluegum",
    name: "Bluegum Accountants",
    email: "hello@bluegum.com.au",
    phone: "02 9261 4410",
    street: "Level 8, 1 Market St",
    city: "Sydney",
    state: "NSW",
    postcode: "2000",
    plan: "enterprise",
    created: "2025-03-12T09:20:00Z",
    active: true,
    admin: { name: "Sarah Pike", email: "sarah@bluegum.com.au", since: "2025-11-04T10:00:00Z" },
    previousAdmin: { name: "Daniel Wu", email: "daniel@bluegum.com.au", since: "2025-03-12T09:30:00Z" },
  },
  {
    slug: "harbour",
    name: "Harbour Tax Partners",
    email: "admin@harbourtax.com.au",
    phone: "03 9670 2281",
    street: "120 Collins St",
    city: "Melbourne",
    state: "VIC",
    postcode: "3000",
    plan: "practice",
    created: "2025-05-20T03:10:00Z",
    active: true,
    admin: { name: "James O'Neill", email: "james@harbourtax.com.au", since: "2025-05-20T03:30:00Z" },
  },
  {
    slug: "coastal",
    name: "Coastal Ledger Group",
    email: "team@coastalledger.com.au",
    phone: "07 3221 8890",
    street: "45 Eagle St",
    city: "Brisbane",
    state: "QLD",
    postcode: "4000",
    plan: "practice",
    created: "2025-08-02T00:40:00Z",
    active: true,
    admin: { name: "Mei Lin", email: "mei@coastalledger.com.au", since: "2026-02-16T04:00:00Z" },
    previousAdmin: { name: "Grace Thompson", email: "grace@coastalledger.com.au", since: "2025-08-02T01:00:00Z" },
  },
  {
    slug: "swan",
    name: "Swan River Advisory",
    email: "office@swanriver.com.au",
    phone: "08 9322 1055",
    street: "250 St Georges Tce",
    city: "Perth",
    state: "WA",
    postcode: "6000",
    plan: "starter",
    created: "2026-01-09T02:00:00Z",
    active: true,
    admin: { name: "Oliver Brooks", email: "oliver@swanriver.com.au", since: "2026-01-09T02:15:00Z" },
  },
  {
    slug: "hills",
    name: "Adelaide Hills Accounting",
    email: "accounts@adelaidehills.com.au",
    phone: "08 8212 7740",
    street: "91 King William St",
    city: "Adelaide",
    state: "SA",
    postcode: "5000",
    plan: "starter",
    created: "2026-09-28T05:00:00Z",
    active: true,
    admin: { name: "Priya Rajan", email: "priya@adelaidehills.com.au", since: "2026-09-28T05:10:00Z", pending: true },
  },
  {
    slug: "capital",
    name: "Capital Ledger Co.",
    email: "info@capitalledger.com.au",
    phone: "02 6247 3301",
    street: "15 London Cct",
    city: "Canberra",
    state: "ACT",
    postcode: "2601",
    plan: "practice",
    created: "2025-02-14T00:00:00Z",
    active: false,
    admin: { name: "Ravi Iyer", email: "ravi@capitalledger.com.au", since: "2025-02-14T00:20:00Z" },
  },
];

const SUPER_ADMIN_EMAIL = "platform@clearportfolio.com.au";

export function sampleOrganisations(): Organisation[] {
  if (!SHOW_SAMPLE_DATA) return [];
  return SAMPLE_ORGS.map((org) => ({
    id: `${SAMPLE_PREFIX}${org.slug}`,
    name: org.name,
    email: org.email,
    contactNumber: org.phone,
    addressLine1: org.street,
    city: org.city,
    state: org.state,
    postalCode: org.postcode,
    country: "AU",
    subscriptionPlan: org.plan,
    maxUsersAllowed: 250,
    isActive: org.active,
    createdAt: org.created,
  })) as Organisation[];
}

export function sampleAdmins(): InvitedUser[] {
  if (!SHOW_SAMPLE_DATA) return [];
  return SAMPLE_ORGS.flatMap((org) => {
    const rows: InvitedUser[] = [
      {
        id: `${SAMPLE_PREFIX}admin-${org.slug}`,
        email: org.admin.email,
        role: "admin",
        status: org.admin.pending ? "INVITED" : "ACCEPTED",
        name: org.admin.name,
        organizationName: org.name,
        invitedByEmail: org.admin.invitedBy ?? SUPER_ADMIN_EMAIL,
        createdAt: org.admin.since,
      },
    ];
    if (org.previousAdmin) {
      rows.push({
        id: `${SAMPLE_PREFIX}prev-${org.slug}`,
        email: org.previousAdmin.email,
        role: "admin",
        status: "ACCEPTED",
        name: org.previousAdmin.name,
        organizationName: org.name,
        invitedByEmail: SUPER_ADMIN_EMAIL,
        createdAt: org.previousAdmin.since,
      });
    }
    return rows;
  });
}

/* --------------------------------------------------------------- metrics */

export type OrgMetrics = {
  accountants: number;
  rms: number;
  clients: number;
  properties: number;
  entities: number;
  equity: number;
  documents: number;
  bankAccounts: number;
  /** Clients at each month end, oldest first (12 values). */
  clientsByMonth: number[];
  /** Equity managed at each month end, oldest first (12 values). */
  equityByMonth: number[];
};

const metricCache = new Map<string, OrgMetrics>();

/** Stable sample totals for an organisation, or null when sample data is off. */
export function orgMetrics(orgId: string): OrgMetrics | null {
  if (!SHOW_SAMPLE_DATA) return null;
  const cached = metricCache.get(orgId);
  if (cached) return cached;
  const random = rng(orgId);
  const rms = between(random, 2, 7);
  const accountants = rms * between(random, 3, 6);
  const clients = accountants * between(random, 4, 9);
  const properties = Math.round(clients * (1.6 + random() * 1.4));
  const entities = Math.round(clients * (1.1 + random() * 0.6));
  const equity = Math.round(properties * (0.55 + random() * 0.5) * 1_000_000);
  const growth = 0.55 + random() * 0.25;
  const clientsByMonth = Array.from({ length: 12 }, (_, index) =>
    Math.round(clients * (growth + ((1 - growth) * index) / 11) * (0.97 + random() * 0.05)),
  );
  clientsByMonth[11] = clients;
  const equityByMonth = clientsByMonth.map((count) => Math.round((equity * count) / clients));
  const metrics: OrgMetrics = {
    accountants,
    rms,
    clients,
    properties,
    entities,
    equity,
    documents: Math.round(properties * (6 + random() * 6)),
    bankAccounts: Math.round(entities * (1.2 + random() * 0.8)),
    clientsByMonth,
    equityByMonth,
  };
  metricCache.set(orgId, metrics);
  return metrics;
}

/** Sum of every organisation's metrics, for the platform dashboard. */
export function platformMetrics(orgIds: string[]): OrgMetrics | null {
  if (!SHOW_SAMPLE_DATA || orgIds.length === 0) return null;
  const all = orgIds.map((id) => orgMetrics(id)).filter((item): item is OrgMetrics => Boolean(item));
  const sum = (pick: (m: OrgMetrics) => number) => all.reduce((total, item) => total + pick(item), 0);
  return {
    accountants: sum((m) => m.accountants),
    rms: sum((m) => m.rms),
    clients: sum((m) => m.clients),
    properties: sum((m) => m.properties),
    entities: sum((m) => m.entities),
    equity: sum((m) => m.equity),
    documents: sum((m) => m.documents),
    bankAccounts: sum((m) => m.bankAccounts),
    clientsByMonth: Array.from({ length: 12 }, (_, index) => sum((m) => m.clientsByMonth[index])),
    equityByMonth: Array.from({ length: 12 }, (_, index) => sum((m) => m.equityByMonth[index])),
  };
}

/* ------------------------------------------------------------ people */

const RM_NAMES = [
  "Hannah Scott",
  "Tom Nguyen",
  "Aisha Khan",
  "Liam O'Connor",
  "Sofia Rossi",
  "Arjun Patel",
  "Nina Wong",
];

export type SampleRm = { id: string; name: string; accountants: number; clients: number; properties: number; equity: number };

/** RMs with their share of the organisation's totals. */
export function orgPeople(orgId: string): SampleRm[] {
  const metrics = orgMetrics(orgId);
  if (!metrics) return [];
  const random = rng(`${orgId}:people`);
  const weights = Array.from({ length: metrics.rms }, () => 0.6 + random());
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const offset = hash(orgId) % RM_NAMES.length;
  let accLeft = metrics.accountants;
  return weights.map((weight, index) => {
    const share = weight / total;
    const last = index === weights.length - 1;
    const accountants = last ? accLeft : Math.max(1, Math.round(metrics.accountants * share));
    accLeft -= accountants;
    return {
      id: `${orgId}-rm-${index}`,
      name: RM_NAMES[(offset + index) % RM_NAMES.length],
      accountants,
      clients: Math.round(metrics.clients * share),
      properties: Math.round(metrics.properties * share),
      equity: Math.round(metrics.equity * share),
    };
  });
}

/* ------------------------------------------------------ admin sign-in info */

export type AdminAuth = { phone: string; mfa: boolean; lastLogin: string | null };

/** Stable sample sign-in details for an admin, or null when sample data is off. */
export function adminAuth(admin: Pick<InvitedUser, "id" | "status">): AdminAuth | null {
  if (!SHOW_SAMPLE_DATA) return null;
  const random = rng(`${admin.id}:auth`);
  const pending = ["INVITED", "PENDING", "FORCE_CHANGE_PASSWORD"].includes(String(admin.status).toUpperCase());
  const hoursAgo = between(random, 1, 24 * 12);
  return {
    phone: `04${between(random, 10, 99)} ${between(random, 100, 999)} ${between(random, 100, 999)}`,
    mfa: !pending && random() > 0.25,
    lastLogin: pending ? null : new Date(SAMPLE_NOW - hoursAgo * 3_600_000).toISOString(),
  };
}

/** Reasons recorded for previous admin changes. */
export function changeReason(adminId: string) {
  if (!SHOW_SAMPLE_DATA) return null;
  const reasons = ["Left the firm", "Moved to a partner role", "Requested by the organisation", "Parental leave cover"];
  return reasons[hash(adminId) % reasons.length];
}

/** Fixed "now" so sample relative times don't change between renders. */
const SAMPLE_NOW = Date.UTC(2026, 9, 15, 6, 0, 0);

/** The last 12 month-end labels, oldest first, e.g. "Nov" … "Oct". */
export function lastTwelveMonths(now = new Date()) {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    return date.toLocaleString("en-AU", { month: "short" });
  });
}
