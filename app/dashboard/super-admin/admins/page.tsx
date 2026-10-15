"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChangeAdminDialog } from "../../_console/components/ChangeAdminDialog";
import { DataTable } from "../../_console/components/DataTable";
import { ExportMenu } from "../../_console/components/ExportMenu";
import { PlusIcon } from "../../_console/components/icons";
import {
  ApiPending,
  Badge,
  Card,
  EmptyState,
  Field,
  FilterBar,
  Kpi,
  KpiGrid,
  Notice,
  PageHeader,
  PendingAction,
  Person,
  SearchField,
  SelectField,
  StatusBadge,
} from "../../_console/components/ui";
import { formatDate, formatNumber } from "../../_console/lib/format";
import {
  ORG_STATUS_LABEL,
  currentAdmin,
  isPendingStatus,
  joinOrganisations,
  useAdmins,
  useOrganisations,
  type InvitedUser,
  type OrgStatus,
  type OrganisationRow,
} from "../../_console/lib/superAdminData";

const AUTH_REASON = "Needs sign-in details (MFA, last login) from the auth API";

export default function SuperAdminAdminsPage() {
  const orgs = useOrganisations();
  const admins = useAdmins();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [orgStatus, setOrgStatus] = useState<OrgStatus | "all">("all");
  const [changeFor, setChangeFor] = useState<OrganisationRow | null>(null);

  const rows = useMemo(() => joinOrganisations(orgs.data, admins.data), [orgs.data, admins.data]);
  const orgByName = useMemo(() => new Map(rows.map((row) => [row.name.trim().toLowerCase(), row])), [rows]);
  const list = useMemo(() => admins.data ?? [], [admins.data]);
  const orgFor = (admin: InvitedUser) => orgByName.get(admin.organizationName.trim().toLowerCase());

  const visible = list.filter((admin) => {
    const needle = query.trim().toLowerCase();
    if (needle && !`${admin.name} ${admin.email} ${admin.organizationName}`.toLowerCase().includes(needle)) return false;
    if (status === "active" && isPendingStatus(admin.status)) return false;
    if (status === "pending" && !isPendingStatus(admin.status)) return false;
    if (orgStatus !== "all" && orgFor(admin)?.status !== orgStatus) return false;
    return true;
  });
  const loading = admins.isLoading || orgs.isLoading;
  const thisYear = new Date().getFullYear();
  const pending = list.filter((a) => isPendingStatus(a.status)).length;

  return (
    <>
      <PageHeader
        title="Admins"
        subtitle="The person running each organisation. Changing an admin always means inviting a new person by email."
        actions={
          <>
            <ExportMenu
              build={() => ({
                title: "Admins",
                filename: "admins",
                columns: [
                  { header: "Name", value: (a: InvitedUser) => a.name },
                  { header: "Email", value: (a: InvitedUser) => a.email },
                  { header: "Organisation", value: (a: InvitedUser) => a.organizationName },
                  { header: "Status", value: (a: InvitedUser) => (isPendingStatus(a.status) ? "Invite pending" : "Active") },
                  { header: "Admin since", value: (a: InvitedUser) => formatDate(a.createdAt) },
                ],
                rows: visible,
              })}
            />
            <Link className="cpc-btn cpc-btn-primary" href="/dashboard/super-admin/create-organization">
              <PlusIcon />
              Add organisation
            </Link>
          </>
        }
      />

      {admins.error ? <Notice tone="red" title="Couldn't load admins">{admins.error.message}</Notice> : null}

      <KpiGrid>
        <Kpi label="Admins" loading={loading} value={formatNumber(list.length)} hint="one per organisation" />
        <Kpi label="Active" tone="good" loading={loading} value={formatNumber(list.length - pending)} />
        <Kpi label="Invite pending" tone="warn" loading={loading} value={formatNumber(pending)} hint="not yet accepted" />
        <Kpi label="MFA on" value="—" hint={<ApiPending>{AUTH_REASON}</ApiPending>} />
        <Kpi
          label="Changed this year"
          loading={loading}
          value={formatNumber(list.filter((a) => a.createdAt && new Date(a.createdAt).getFullYear() === thisYear).length)}
        />
      </KpiGrid>

      <FilterBar>
        <SearchField id="ad-q" value={query} onChange={setQuery} placeholder="Name, email or organisation" />
        <SelectField
          id="ad-status"
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All statuses" },
            { value: "active", label: "Active" },
            { value: "pending", label: "Invite pending" },
          ]}
        />
        <SelectField
          id="ad-org-status"
          label="Organisation status"
          value={orgStatus}
          onChange={setOrgStatus}
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "onboarding", label: "Onboarding" },
            { value: "suspended", label: "Suspended" },
          ]}
        />
        <Field label="MFA" htmlFor="ad-mfa">
          <select id="ad-mfa" className="cpc-select" disabled title={AUTH_REASON}>
            <option>Any</option>
          </select>
        </Field>
        <Field label="Last login" htmlFor="ad-login">
          <select id="ad-login" className="cpc-select" disabled title={AUTH_REASON}>
            <option>Any time</option>
          </select>
        </Field>
      </FilterBar>

      <Card flush>
        <DataTable<InvitedUser>
          caption="Admins"
          loading={loading}
          rows={visible}
          rowKey={(a) => a.id}
          initialSort={{ id: "since", direction: "desc" }}
          footer={`${visible.length} admins`}
          empty={<EmptyState title="No admins match these filters" />}
          columns={[
            { id: "name", header: "Admin", cell: (a) => <Person name={a.name || a.email} sub={a.email} />, sortValue: (a) => a.name },
            {
              id: "org",
              header: "Organisation",
              cell: (a) => {
                const org = orgFor(a);
                if (!org) return a.organizationName || <span className="cpc-muted">Unassigned</span>;
                return (
                  <span style={{ display: "inline-flex", gap: "0.5em", alignItems: "center", flexWrap: "wrap" }}>
                    <Link className="cpc-person-name" href={`/dashboard/super-admin/organisations/${encodeURIComponent(org.id)}`}>
                      {org.name}
                    </Link>
                    {org.status !== "active" ? <Badge tone={ORG_STATUS_LABEL[org.status].tone}>{ORG_STATUS_LABEL[org.status].label}</Badge> : null}
                  </span>
                );
              },
              sortValue: (a) => a.organizationName,
            },
            { id: "status", header: "Status", cell: (a) => <StatusBadge status={a.status} />, sortValue: (a) => a.status },
            { id: "mfa", header: "MFA", cell: () => <span className="cpc-muted">—</span> },
            { id: "since", header: "Admin since", cell: (a) => <span className="cpc-small">{formatDate(a.createdAt)}</span>, sortValue: (a) => a.createdAt ?? "" },
            { id: "login", header: "Last login", cell: () => <span className="cpc-muted">—</span> },
            {
              id: "actions",
              header: "",
              cell: (a) => {
                const org = orgFor(a);
                return (
                  <div className="cpc-actions" style={{ flexWrap: "nowrap" }}>
                    {isPendingStatus(a.status) ? (
                      <PendingAction small reason="Resending an invite needs a resend endpoint">Resend invite</PendingAction>
                    ) : (
                      <PendingAction small reason="Resetting MFA needs a Cognito admin endpoint">Reset MFA</PendingAction>
                    )}
                    <button type="button" className="cpc-btn cpc-btn-sm" disabled={!org} onClick={() => org && setChangeFor(org)}>
                      Change admin
                    </button>
                  </div>
                );
              },
            },
          ]}
        />
      </Card>

      <ChangeAdminDialog
        open={Boolean(changeFor)}
        onClose={() => setChangeFor(null)}
        organisation={changeFor}
        currentAdmin={changeFor ? currentAdmin(changeFor) : null}
      />
    </>
  );
}
