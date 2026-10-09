"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable } from "../_console/components/DataTable";
import { ExportMenu } from "../_console/components/ExportMenu";
import { ChangeAdminDialog } from "../_console/components/ChangeAdminDialog";
import { PlusIcon, UserPlusIcon } from "../_console/components/icons";
import {
  ApiPending,
  Badge,
  Card,
  ColumnChart,
  FilterBar,
  Kpi,
  KpiGrid,
  Notice,
  PageHeader,
  Person,
  SelectField,
} from "../_console/components/ui";
import { isPendingStatus } from "../_console/lib/adminData";
import { formatDate, formatNumber } from "../_console/lib/format";
import { findPeriod, inPeriod, monthBuckets, monthKey, type PeriodId } from "../_console/lib/metrics";
import { currentAdmin, joinOrganisations, useAdmins, useOrganisations, type OrganisationRow } from "../_console/lib/superAdminData";

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default function SuperAdminDashboardPage() {
  const orgs = useOrganisations();
  const admins = useAdmins();
  const [periodId, setPeriodId] = useState<PeriodId>("last-12");
  const [status, setStatus] = useState("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteOrg, setInviteOrg] = useState("");

  const period = findPeriod(periodId);
  const rows = useMemo(() => joinOrganisations(orgs.data, admins.data), [orgs.data, admins.data]);
  const visible = rows.filter((row) => status === "all" || row.status === status);
  const adminList = useMemo(() => admins.data ?? [], [admins.data]);
  const pendingAdmins = adminList.filter((admin) => isPendingStatus(admin.status)).length;
  const loading = orgs.isLoading || admins.isLoading;

  const months = monthBuckets(period);
  const invitedByMonth = useMemo(() => {
    const counts = new Map<string, number>();
    for (const admin of adminList) {
      if (!admin.createdAt || !inPeriod(admin.createdAt, period)) continue;
      counts.set(monthKey(admin.createdAt), (counts.get(monthKey(admin.createdAt)) ?? 0) + 1);
    }
    return months.map((month) => counts.get(month.key) ?? 0);
  }, [adminList, period, months]);

  const recent = [...adminList]
    .filter((admin) => admin.createdAt)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 6);

  const inviteTarget = rows.find((row) => row.id === inviteOrg) ?? null;

  return (
    <>
      <PageHeader
        title={greeting()}
        subtitle="Every organisation on ClearPortfolio at a glance."
        actions={
          <>
            <button type="button" className="cpc-btn" onClick={() => setInviteOpen(true)}>
              <UserPlusIcon />
              Invite admin
            </button>
            <Link className="cpc-btn cpc-btn-primary" href="/dashboard/super-admin/create-organization">
              <PlusIcon />
              Add organisation
            </Link>
            <ExportMenu
              build={() => ({
                title: "Organisations",
                filename: "organisations",
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
          </>
        }
      />

      {orgs.error ? <Notice tone="red" title="Couldn't load organisations">{orgs.error.message}</Notice> : null}

      <FilterBar>
        <SelectField
          id="sa-period"
          label="Period"
          value={periodId}
          onChange={setPeriodId}
          options={[
            { value: "last-12", label: "Last 12 months" },
            { value: "fy-current", label: "This FY" },
            { value: "quarter", label: "This quarter" },
            { value: "all", label: "All time" },
          ]}
        />
        <SelectField
          id="sa-status"
          label="Organisation status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All statuses" },
            { value: "active", label: "Active" },
            { value: "onboarding", label: "Onboarding" },
          ]}
        />
      </FilterBar>

      <KpiGrid>
        <Kpi
          label="Organisations"
          href="/dashboard/super-admin/organisations"
          loading={loading}
          value={formatNumber(rows.length)}
          hint={`${rows.filter((r) => r.status === "active").length} active · ${rows.filter((r) => r.status === "onboarding").length} onboarding`}
        />
        <Kpi label="Admins" href="/dashboard/super-admin/admins" loading={loading} value={formatNumber(adminList.length)} hint={`${pendingAdmins} invite pending`} />
        <Kpi label="Accountants" value="—" hint={<ApiPending>Needs platform totals API</ApiPending>} />
        <Kpi label="Relationship managers" value="—" hint={<ApiPending />} />
        <Kpi label="Clients" value="—" hint={<ApiPending>Needs platform totals API</ApiPending>} />
        <Kpi label="Properties" value="—" hint={<ApiPending>Needs platform totals API</ApiPending>} />
        <Kpi label="Equity managed" value="—" hint={<ApiPending>Needs platform totals API</ApiPending>} />
      </KpiGrid>

      <div className="cpc-grid-2">
        <Card title="Admins invited" meta={period.label}>
          <ColumnChart loading={loading} labels={months.map((m) => m.label)} series={[{ name: "Admins", color: "var(--cpc-blue)", values: invitedByMonth }]} />
        </Card>
        <Card title="Recent admin changes" actions={<Link className="cpc-link" href="/dashboard/super-admin/admins">All admins →</Link>}>
          {recent.length === 0 ? (
            <p className="cpc-muted cpc-small">{loading ? "Loading…" : "No admins invited yet."}</p>
          ) : (
            <div className="cpc-list">
              {recent.map((admin) => (
                <div key={admin.id} className="cpc-list-row">
                  <div>
                    <span className="cpc-strong">{admin.organizationName || "No organisation"}</span>{" "}
                    <span className="cpc-muted">· admin {isPendingStatus(admin.status) ? "invited" : "active"}</span>
                    <div className="cpc-person-sub">{admin.name || admin.email}</div>
                  </div>
                  <span className="cpc-small cpc-muted cpc-num">{formatDate(admin.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card
        flush
        title="Organisations at a glance"
        meta="Per-organisation totals appear once the platform totals API is connected"
        actions={<Link className="cpc-btn cpc-btn-sm" href="/dashboard/super-admin/organisations">Open list</Link>}
      >
        <DataTable<OrganisationRow>
          caption="Organisations"
          loading={loading}
          rows={visible}
          rowKey={(row) => row.id}
          pageSize={10}
          empty={<p className="cpc-empty">No organisations yet.</p>}
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
                  <span>
                    {admin.name || admin.email} {isPendingStatus(admin.status) ? <span className="cpc-muted">(invited)</span> : null}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="cpc-link"
                    onClick={() => {
                      setInviteOrg(row.id);
                      setInviteOpen(true);
                    }}
                  >
                    Invite admin
                  </button>
                );
              },
            },
            {
              id: "status",
              header: "Status",
              cell: (row) => (row.status === "active" ? <Badge tone="green" dot>Active</Badge> : <Badge tone="amber" dot>Onboarding</Badge>),
              sortValue: (row) => row.status,
            },
            { id: "tenant", header: "Tenant code", cell: (row) => <span className="cpc-num">{row.tenantCode || "—"}</span> },
            { id: "acc", header: "Accountants", align: "right", cell: () => "—" },
            { id: "clients", header: "Clients", align: "right", cell: () => "—" },
            { id: "equity", header: "Equity", align: "right", cell: () => "—" },
          ]}
        />
      </Card>

      <OrgPickerInvite
        open={inviteOpen}
        rows={rows}
        selected={inviteOrg}
        onSelect={setInviteOrg}
        onClose={() => {
          setInviteOpen(false);
          setInviteOrg("");
        }}
        target={inviteTarget}
      />
    </>
  );
}

/** "Invite admin" from the dashboard: pick the organisation first, then the invite form. */
function OrgPickerInvite({
  open,
  rows,
  selected,
  onSelect,
  onClose,
  target,
}: {
  open: boolean;
  rows: OrganisationRow[];
  selected: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  target: OrganisationRow | null;
}) {
  if (!open) return null;
  if (!target) {
    return (
      <div className="cpc-dialog-layer" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="cpc-dialog" role="dialog" aria-modal="true" aria-label="Choose organisation">
          <div className="cpc-dialog-head">
            <h2 className="cpc-card-title">Invite admin</h2>
          </div>
          <div className="cpc-dialog-body">
            <SelectField
              id="pick-org"
              label="Organisation"
              value={selected}
              onChange={onSelect}
              options={[{ value: "", label: "Choose an organisation" }, ...rows.map((row) => ({ value: row.id, label: row.name }))]}
            />
          </div>
          <div className="cpc-dialog-foot">
            <button type="button" className="cpc-btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }
  const admin = currentAdmin(target);
  return <ChangeAdminDialog open organisation={target} currentAdmin={admin} mode={admin ? "change" : "invite"} onClose={onClose} />;
}

