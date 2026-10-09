"use client";

import { apiGet } from "./api";
import { isPendingStatus, type InvitedUser } from "./adminData";
import { useResource } from "./useResource";

/** GET /api/organizations/list (normalised CoreOrganization) */
export type Organisation = {
  id: string;
  name: string;
  email: string;
  tenantCode: string;
};

export type OrganisationRow = Organisation & {
  admins: InvitedUser[];
  status: "active" | "onboarding";
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

async function loadOrganisations() {
  const data = await apiGet<{ organizations: Organisation[] }>("/api/organizations/list");
  return data.organizations ?? [];
}

async function loadAdmins() {
  const data = await apiGet<{ users: InvitedUser[] }>("/api/users/me/invited");
  return (data.users ?? []).filter((user) => user.role === "admin");
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

const normalise = (value: string) => value.trim().toLowerCase();

/** Join organisations with the admins invited into them (matched by org name). */
export function joinOrganisations(orgs: Organisation[] = [], admins: InvitedUser[] = []): OrganisationRow[] {
  return orgs.map((org) => {
    const orgAdmins = admins.filter((admin) => normalise(admin.organizationName) === normalise(org.name));
    const hasActive = orgAdmins.some((admin) => !isPendingStatus(admin.status));
    return { ...org, admins: orgAdmins, status: hasActive ? "active" : "onboarding" };
  });
}

export function currentAdmin(row: OrganisationRow) {
  return (
    row.admins.find((admin) => !isPendingStatus(admin.status)) ??
    row.admins[0] ??
    null
  );
}
