"use client";

import type { CoreOrganization } from "@/src/lib/coreApi";
import { apiGet } from "./api";
import { SHOW_SAMPLE_DATA, sampleAdmins, sampleOrganisations } from "./sampleData";
import { useResource } from "./useResource";

/** GET /api/organizations/list (normalised CoreOrganization) */
export type Organisation = CoreOrganization;

/** A row of GET /api/users/me/invited (for a super admin: every admin). */
export type InvitedUser = {
  id: string;
  email: string;
  role: string;
  status: string;
  name: string;
  organizationName: string;
  invitedByEmail: string;
  createdAt: string | null;
};

export type OrgStatus = "active" | "onboarding" | "suspended";

export type OrganisationRow = Organisation & {
  admins: InvitedUser[];
  status: OrgStatus;
};

/** GET /api/users/me */
export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  orgId: string;
  orgName: string;
  status: string;
};

export function isPendingStatus(status: string) {
  return ["INVITED", "PENDING", "FORCE_CHANGE_PASSWORD"].includes(String(status).toUpperCase());
}

const normalise = (value: string) => String(value ?? "").trim().toLowerCase();

/**
 * Real rows first, then the sample rows (when sample data is on). A sample row
 * is skipped if a real row has the same key, so nothing is listed twice. If the
 * API fails while sample data is on, the sample rows still render.
 */
async function withSamples<T>(load: () => Promise<T[]>, samples: () => T[], key: (row: T) => string) {
  if (!SHOW_SAMPLE_DATA) return load();
  try {
    const real = await load();
    const taken = new Set(real.map((row) => normalise(key(row))));
    return [...real, ...samples().filter((row) => !taken.has(normalise(key(row))))];
  } catch {
    return samples();
  }
}

async function loadOrganisations() {
  return withSamples(async () => {
    const data = await apiGet<{ organizations: Organisation[] }>("/api/organizations/list");
    return data.organizations ?? [];
  }, sampleOrganisations, (org) => org.name);
}

async function loadAdmins() {
  return withSamples(async () => {
    const data = await apiGet<{ users: InvitedUser[] }>("/api/users/me/invited");
    return (data.users ?? []).filter((user) => user.role === "admin");
  }, sampleAdmins, (admin) => admin.email);
}

async function loadMe() {
  return apiGet<CurrentUser>("/api/users/me");
}

export function useOrganisations() {
  return useResource("super:orgs", loadOrganisations);
}

export function useAdmins() {
  return useResource("super:admins", loadAdmins);
}

export function useCurrentUser() {
  return useResource("me", loadMe, 10 * 60 * 1000);
}

/**
 * Join organisations with the admins invited into them. The invited-users API
 * returns the organisation by name, so the match is on name.
 * Suspended = the organisation is inactive; onboarding = no admin has signed in yet.
 */
export function joinOrganisations(orgs: Organisation[] = [], admins: InvitedUser[] = []): OrganisationRow[] {
  return orgs.map((org) => {
    const orgAdmins = admins.filter((admin) => normalise(admin.organizationName) === normalise(org.name));
    const hasActive = orgAdmins.some((admin) => !isPendingStatus(admin.status));
    const status: OrgStatus = org.isActive === false ? "suspended" : hasActive ? "active" : "onboarding";
    return { ...org, admins: orgAdmins, status };
  });
}

/** The newest admin who has accepted; otherwise the newest invite. */
export function currentAdmin(row: OrganisationRow) {
  const newestFirst = [...row.admins].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return newestFirst.find((admin) => !isPendingStatus(admin.status)) ?? newestFirst[0] ?? null;
}

export function orgAddress(org: Organisation) {
  const locality = [org.city, [org.state, org.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [org.addressLine1, locality].filter(Boolean).join(", ");
}

export const ORG_STATUS_LABEL: Record<OrgStatus, { label: string; tone: "green" | "amber" | "red" }> = {
  active: { label: "Active", tone: "green" },
  onboarding: { label: "Onboarding", tone: "amber" },
  suspended: { label: "Suspended", tone: "red" },
};

/* ---------------------------------------------------------------- periods */

export type PeriodId = "last-12" | "fy-current" | "quarter" | "month" | "all";
export type Period = { id: PeriodId; label: string; from: Date | null };

export function getPeriod(id: PeriodId, now = new Date()): Period {
  const fyStartYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  switch (id) {
    case "fy-current":
      return { id, label: `FY ${fyStartYear}–${String(fyStartYear + 1).slice(2)}`, from: new Date(fyStartYear, 6, 1) };
    case "quarter":
      return { id, label: "This quarter", from: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1) };
    case "month":
      return { id, label: "This month", from: new Date(now.getFullYear(), now.getMonth(), 1) };
    case "all":
      return { id, label: "All time", from: null };
    default:
      return { id: "last-12", label: "Last 12 months", from: new Date(now.getFullYear() - 1, now.getMonth() + 1, 1) };
  }
}

export function inPeriod(value: string | null | undefined, period: Period) {
  if (!period.from) return true;
  if (!value) return false;
  const time = new Date(value).getTime();
  return !Number.isNaN(time) && time >= period.from.getTime();
}
