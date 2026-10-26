"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo } from "react";
import { joinOrganisations, useAdmins, useOrganisations, type OrganisationRow } from "../lib/superAdminData";

export const workspacePath = (orgId: string, section = "") =>
  `/dashboard/super-admin/organisations/${encodeURIComponent(orgId)}/workspace${section ? `/${section}` : ""}`;

/** The organisation the super admin is working in, from the route's [orgId]. */
export function useWorkspaceOrg() {
  const { orgId: rawId } = useParams<{ orgId: string }>();
  const orgId = decodeURIComponent(rawId);
  const orgs = useOrganisations();
  const admins = useAdmins();
  const rows = useMemo(() => joinOrganisations(orgs.data, admins.data), [orgs.data, admins.data]);
  const org: OrganisationRow | null = rows.find((row) => row.id === orgId) ?? null;
  return { orgId, org, rows, loading: orgs.isLoading || admins.isLoading };
}

/** Amber banner shown on every workspace page, with an organisation switcher. */
export function WorkspaceBanner({ org, rows, section = "" }: { org: OrganisationRow | null; rows: OrganisationRow[]; section?: string }) {
  const router = useRouter();
  return (
    <div className="cpc-workspace-banner" role="status">
      <span>
        <strong>You&apos;re working in {org?.name ?? "this organisation"} as Super admin.</strong>{" "}
        <span className="cpc-muted">You can do everything its admin can. Every change is logged under your name.</span>
      </span>
      <div className="cpc-actions">
        <select
          className="cpc-select"
          aria-label="Switch organisation"
          value={org?.id ?? ""}
          onChange={(event) => router.push(workspacePath(event.target.value, section))}
        >
          {rows.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
        <button type="button" className="cpc-btn cpc-btn-sm" onClick={() => router.push("/dashboard/super-admin/organisations")}>
          Exit workspace
        </button>
      </div>
    </div>
  );
}
