"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ChangeAdminDialog } from "../../_console/components/ChangeAdminDialog";
import { DataTable } from "../../_console/components/DataTable";
import { ExportMenu } from "../../_console/components/ExportMenu";
import { PlusIcon } from "../../_console/components/icons";
import { Badge, Card, FilterBar, Kpi, KpiGrid, Notice, PageHeader, Person, SearchField, Tabs } from "../../_console/components/ui";
import { isPendingStatus } from "../../_console/lib/adminData";
import { formatNumber } from "../../_console/lib/format";
import { currentAdmin, joinOrganisations, useAdmins, useOrganisations, type OrganisationRow } from "../../_console/lib/superAdminData";

type Tab = "all" | "active" | "onboarding";

export default function SuperAdminOrganisationsPage() {
  const params = useSearchParams();
  const orgs = useOrganisations();
  const admins = useAdmins();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [tab, setTab] = useState<Tab>("all");
  const [changeFor, setChangeFor] = useState<OrganisationRow | null>(null);

  const rows = useMemo(() => joinOrganisations(orgs.data, admins.data), [orgs.data, admins.data]);
  const searched = rows.filter((row) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    const admin = currentAdmin(row);
    return `${row.name} ${row.email} ${row.tenantCode} ${admin?.name ?? ""} ${admin?.email ?? ""}`.toLowerCase().includes(needle);
  });
  const visible = searched.filter((row) => tab === "all" || row.status === tab);
  const loading = orgs.isLoading || admins.isLoading;

  return (
    <>
      <PageHeader
        title="Organisations"
        subtitle="Each organisation has one admin who runs it day to day."
        actions={
          <>
            <ExportMenu
              build={() => ({
                title: "Organisations",
                filename: "organisations",
                context: [`${visible.length} organisations`],
                columns: [
                  { header: "Organisation", value: (row: OrganisationRow) => row.name },
                  { header: "Contact email", value: (row: OrganisationRow) => row.email },
                  { header: "Tenant code", value: (row: OrganisationRow) => row.tenantCode },
                  { header: "Admin", value: (row: OrganisationRow) => currentAdmin(row)?.name ?? "" },
                  { header: "Admin email", value: (row: OrganisationRow) => currentAdmin(row)?.email ?? "" },
                  { header: "Status", value: (row: OrganisationRow) => row.status },
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

      {orgs.error ? <Notice tone="red" title="Couldn't load organisations">{orgs.error.message}</Notice> : null}

      <KpiGrid>
        <Kpi label="Organisations" loading={loading} value={formatNumber(rows.length)} hint="on the platform" />
        <Kpi label="Active" tone="good" loading={loading} value={formatNumber(rows.filter((r) => r.status === "active").length)} hint="admin has signed in" />
        <Kpi label="Onboarding" tone="warn" loading={loading} value={formatNumber(rows.filter((r) => r.status === "onboarding").length)} hint="admin invite pending" />
        <Kpi label="Without an admin" tone="bad" loading={loading} value={formatNumber(rows.filter((r) => r.admins.length === 0).length)} hint="invite one to start" />
      </KpiGrid>

      <FilterBar>
        <SearchField id="o-q" value={query} onChange={setQuery} placeholder="Organisation, admin or tenant code" />
      </FilterBar>

      <Card flush>
        <div style={{ padding: "0 1em" }}>
          <Tabs
            label="Organisation status"
            value={tab}
            onChange={setTab}
            items={[
              { id: "all", label: "All", count: searched.length },
              { id: "active", label: "Active", count: searched.filter((r) => r.status === "active").length },
              { id: "onboarding", label: "Onboarding", count: searched.filter((r) => r.status === "onboarding").length },
            ]}
          />
        </div>
        <DataTable<OrganisationRow>
          caption="Organisations"
          loading={loading}
          rows={visible}
          rowKey={(row) => row.id}
          initialSort={{ id: "name", direction: "asc" }}
          footer={`${visible.length} organisations`}
          empty={<p className="cpc-empty">No organisations match.</p>}
          columns={[
            {
              id: "name",
              header: "Organisation",
              cell: (row) => <Person name={row.name} sub={row.email} href={`/dashboard/super-admin/organisations/${encodeURIComponent(row.id)}`} />,
              sortValue: (row) => row.name,
            },
            {
              id: "admin",
              header: "Admin",
              cell: (row) => {
                const admin = currentAdmin(row);
                return admin ? (
                  <div>
                    <div>{admin.name || admin.email}</div>
                    <div className="cpc-person-sub">{admin.email}</div>
                  </div>
                ) : (
                  <span className="cpc-muted">No admin</span>
                );
              },
              sortValue: (row) => currentAdmin(row)?.name ?? "",
            },
            {
              id: "status",
              header: "Status",
              cell: (row) => (row.status === "active" ? <Badge tone="green" dot>Active</Badge> : <Badge tone="amber" dot>Onboarding</Badge>),
              sortValue: (row) => row.status,
            },
            { id: "tenant", header: "Tenant code", cell: (row) => <span className="cpc-num">{row.tenantCode || "—"}</span>, sortValue: (row) => row.tenantCode },
            {
              id: "pending",
              header: "Admin invites",
              align: "right",
              cell: (row) => `${row.admins.filter((a) => isPendingStatus(a.status)).length} pending`,
            },
            {
              id: "actions",
              header: "",
              cell: (row) => (
                <div className="cpc-actions" style={{ flexWrap: "nowrap" }}>
                  <Link className="cpc-btn cpc-btn-sm" href={`/dashboard/super-admin/organisations/${encodeURIComponent(row.id)}`}>
                    View
                  </Link>
                  <button type="button" className="cpc-btn cpc-btn-sm" onClick={() => setChangeFor(row)}>
                    {row.admins.length ? "Change admin" : "Invite admin"}
                  </button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <ChangeAdminDialog
        open={Boolean(changeFor)}
        onClose={() => setChangeFor(null)}
        organisation={changeFor}
        currentAdmin={changeFor ? currentAdmin(changeFor) : null}
        mode={changeFor?.admins.length ? "change" : "invite"}
      />
    </>
  );
}
