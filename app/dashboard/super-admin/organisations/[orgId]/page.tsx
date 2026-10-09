"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ChangeAdminDialog } from "../../../_console/components/ChangeAdminDialog";
import { DataTable } from "../../../_console/components/DataTable";
import { ExportMenu } from "../../../_console/components/ExportMenu";
import {
  ApiPending,
  Badge,
  Card,
  EmptyState,
  Kpi,
  KpiGrid,
  Notice,
  PageHeader,
  PendingAction,
  Person,
  Skeleton,
  StatusBadge,
} from "../../../_console/components/ui";
import { isPendingStatus, type InvitedUser } from "../../../_console/lib/adminData";
import { formatDate, initials } from "../../../_console/lib/format";
import { currentAdmin, joinOrganisations, useAdmins, useOrganisations } from "../../../_console/lib/superAdminData";

export default function SuperAdminOrganisationDetailPage() {
  const { orgId: rawId } = useParams<{ orgId: string }>();
  const orgId = decodeURIComponent(rawId);
  const orgs = useOrganisations();
  const admins = useAdmins();
  const [dialogOpen, setDialogOpen] = useState(false);

  const row = useMemo(() => joinOrganisations(orgs.data, admins.data).find((item) => item.id === orgId), [orgs.data, admins.data, orgId]);
  const loading = orgs.isLoading || admins.isLoading;
  const admin = row ? currentAdmin(row) : null;
  const history = [...(row?.admins ?? [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  if (!loading && !row) {
    return (
      <>
        <PageHeader title="Organisation" crumbs={[{ label: "Organisations", href: "/dashboard/super-admin/organisations" }, { label: "Not found" }]} />
        <Notice tone="red" title="Organisation not found">It may have been removed, or the link is out of date.</Notice>
      </>
    );
  }

  const name = row?.name ?? "Organisation";

  return (
    <>
      <PageHeader
        title={row ? name : <Skeleton width="14em" height="1.6em" />}
        crumbs={[{ label: "Organisations", href: "/dashboard/super-admin/organisations" }, { label: name }]}
        actions={
          <>
            <button type="button" className="cpc-btn" onClick={() => setDialogOpen(true)} disabled={!row}>
              {admin ? "Change admin" : "Invite admin"}
            </button>
            <PendingAction reason="Editing an organisation needs an organisation update endpoint">Edit details</PendingAction>
            <ExportMenu
              label="Export summary"
              build={() => ({
                title: `${name} · admin history`,
                filename: `organisation-${orgId}`,
                context: [`Contact: ${row?.email ?? ""}`, `Tenant code: ${row?.tenantCode ?? ""}`],
                columns: [
                  { header: "Admin", value: (a: InvitedUser) => a.name },
                  { header: "Email", value: (a: InvitedUser) => a.email },
                  { header: "Status", value: (a: InvitedUser) => (isPendingStatus(a.status) ? "Invite pending" : "Active") },
                  { header: "Invited", value: (a: InvitedUser) => formatDate(a.createdAt) },
                  { header: "Invited by", value: (a: InvitedUser) => a.invitedByEmail },
                ],
                rows: history,
              })}
            />
          </>
        }
      />

      <Card>
        <div className="cpc-person" style={{ alignItems: "flex-start", gap: "1.15em", flexWrap: "wrap" }}>
          <span className="cpc-brand-logo" style={{ width: "4em", height: "4em", fontSize: "1.15em", borderRadius: "0.9em" }} aria-hidden="true">
            {initials(name)}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45em" }}>
            <div style={{ display: "flex", gap: "0.6em", alignItems: "center", flexWrap: "wrap" }}>
              <span className="cpc-card-title" style={{ fontSize: "1.3em" }}>{name}</span>
              {row ? row.status === "active" ? <Badge tone="green" dot>Active</Badge> : <Badge tone="amber" dot>Onboarding</Badge> : null}
            </div>
            <div className="cpc-small cpc-muted" style={{ display: "flex", gap: "1.3em", flexWrap: "wrap" }}>
              <span>{row?.email}</span>
              {row?.tenantCode ? <span>Tenant code {row.tenantCode}</span> : null}
            </div>
          </div>
        </div>
      </Card>

      <KpiGrid>
        <Kpi label="Accountants" value="—" hint={<ApiPending>Needs organisation totals API</ApiPending>} />
        <Kpi label="RMs" value="—" hint={<ApiPending />} />
        <Kpi label="Clients" value="—" hint={<ApiPending>Needs organisation totals API</ApiPending>} />
        <Kpi label="Properties" value="—" hint={<ApiPending>Needs organisation totals API</ApiPending>} />
        <Kpi label="Entities" value="—" hint={<ApiPending>Needs organisation totals API</ApiPending>} />
        <Kpi label="Equity managed" value="—" hint={<ApiPending>Needs organisation totals API</ApiPending>} />
      </KpiGrid>

      <div className="cpc-grid-2">
        <Card title="Current admin" actions={<button type="button" className="cpc-btn cpc-btn-sm" onClick={() => setDialogOpen(true)}>{admin ? "Change" : "Invite"}</button>}>
          {loading ? (
            <Skeleton height="6em" />
          ) : admin ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1em" }}>
              <Person name={admin.name || admin.email} sub={admin.email} />
              <dl className="cpc-dl">
                <dt>Status</dt>
                <dd><StatusBadge status={admin.status} /></dd>
                <dt>Admin since</dt>
                <dd>{formatDate(admin.createdAt)}</dd>
                <dt>Invited by</dt>
                <dd>{admin.invitedByEmail || "—"}</dd>
              </dl>
            </div>
          ) : (
            <EmptyState title="No admin yet">Invite someone to run this organisation.</EmptyState>
          )}
        </Card>
        <Card title="Organisation details" actions={<PendingAction small reason="Needs an organisation update endpoint">Edit</PendingAction>}>
          {loading ? (
            <Skeleton height="6em" />
          ) : (
            <dl className="cpc-dl">
              <dt>Name</dt>
              <dd>{row?.name}</dd>
              <dt>Contact email</dt>
              <dd>{row?.email || "—"}</dd>
              <dt>Tenant code</dt>
              <dd className="cpc-num">{row?.tenantCode || "—"}</dd>
              <dt>Organisation ID</dt>
              <dd className="cpc-small cpc-muted">{row?.id}</dd>
            </dl>
          )}
        </Card>
      </div>

      <Card flush title="Admin history" meta="Everyone who has been invited as admin of this organisation">
        <DataTable<InvitedUser>
          caption="Admin history"
          loading={loading}
          rows={history}
          rowKey={(a) => a.id}
          empty={<EmptyState title="No admins invited yet" />}
          columns={[
            { id: "admin", header: "Admin", cell: (a) => <Person name={a.name || a.email} sub={a.email} />, sortValue: (a) => a.name },
            { id: "status", header: "Status", cell: (a) => (a.id === admin?.id ? <Badge tone="green">Current</Badge> : <StatusBadge status={a.status} />) },
            { id: "from", header: "Invited", cell: (a) => formatDate(a.createdAt), sortValue: (a) => a.createdAt ?? "" },
            { id: "by", header: "Invited by", cell: (a) => <span className="cpc-muted">{a.invitedByEmail || "—"}</span> },
          ]}
        />
      </Card>

      <ChangeAdminDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        organisation={row ? { id: row.id, name: row.name } : null}
        currentAdmin={admin}
        mode={admin ? "change" : "invite"}
      />
    </>
  );
}
