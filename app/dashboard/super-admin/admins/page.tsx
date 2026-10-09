"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChangeAdminDialog } from "../../_console/components/ChangeAdminDialog";
import { DataTable } from "../../_console/components/DataTable";
import { ExportMenu } from "../../_console/components/ExportMenu";
import { PlusIcon } from "../../_console/components/icons";
import {
  Card,
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
import { isPendingStatus, type InvitedUser } from "../../_console/lib/adminData";
import { formatDate, formatNumber } from "../../_console/lib/format";
import { currentAdmin, joinOrganisations, useAdmins, useOrganisations, type OrganisationRow } from "../../_console/lib/superAdminData";

export default function SuperAdminAdminsPage() {
  const orgs = useOrganisations();
  const admins = useAdmins();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [changeFor, setChangeFor] = useState<OrganisationRow | null>(null);

  const rows = useMemo(() => joinOrganisations(orgs.data, admins.data), [orgs.data, admins.data]);
  const orgByName = useMemo(() => new Map(rows.map((row) => [row.name.trim().toLowerCase(), row])), [rows]);
  const list = admins.data ?? [];
  const visible = list.filter((admin) => {
    const needle = query.trim().toLowerCase();
    if (needle && !`${admin.name} ${admin.email} ${admin.organizationName}`.toLowerCase().includes(needle)) return false;
    if (status === "active" && isPendingStatus(admin.status)) return false;
    if (status === "pending" && !isPendingStatus(admin.status)) return false;
    return true;
  });
  const loading = admins.isLoading || orgs.isLoading;
  const thisYear = new Date().getFullYear();

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
                  { header: "Invited", value: (a: InvitedUser) => formatDate(a.createdAt) },
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
        <Kpi label="Admins" loading={loading} value={formatNumber(list.length)} hint="across all organisations" />
        <Kpi label="Active" tone="good" loading={loading} value={formatNumber(list.filter((a) => !isPendingStatus(a.status)).length)} />
        <Kpi label="Invite pending" tone="warn" loading={loading} value={formatNumber(list.filter((a) => isPendingStatus(a.status)).length)} hint="links expire after 24 h" />
        <Kpi
          label="Invited this year"
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
      </FilterBar>

      <Card flush>
        <DataTable<InvitedUser>
          caption="Admins"
          loading={loading}
          rows={visible}
          rowKey={(a) => a.id}
          initialSort={{ id: "invited", direction: "desc" }}
          footer={`${visible.length} admins`}
          empty={<p className="cpc-empty">No admins match.</p>}
          columns={[
            { id: "name", header: "Admin", cell: (a) => <Person name={a.name || a.email} sub={a.email} />, sortValue: (a) => a.name },
            {
              id: "org",
              header: "Organisation",
              cell: (a) => {
                const org = orgByName.get(a.organizationName.trim().toLowerCase());
                return org ? (
                  <Link className="cpc-person-name" href={`/dashboard/super-admin/organisations/${encodeURIComponent(org.id)}`}>
                    {a.organizationName}
                  </Link>
                ) : (
                  a.organizationName || <span className="cpc-muted">Unassigned</span>
                );
              },
              sortValue: (a) => a.organizationName,
            },
            { id: "status", header: "Status", cell: (a) => <StatusBadge status={a.status} />, sortValue: (a) => a.status },
            { id: "invited", header: "Invited", cell: (a) => formatDate(a.createdAt), sortValue: (a) => a.createdAt ?? "" },
            { id: "by", header: "Invited by", cell: (a) => <span className="cpc-muted">{a.invitedByEmail || "—"}</span> },
            {
              id: "actions",
              header: "",
              cell: (a) => {
                const org = orgByName.get(a.organizationName.trim().toLowerCase());
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
