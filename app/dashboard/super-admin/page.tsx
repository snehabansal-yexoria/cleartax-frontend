"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChangeAdminDialog } from "../_console/components/ChangeAdminDialog";
import { DataTable } from "../_console/components/DataTable";
import { ExportMenu } from "../_console/components/ExportMenu";
import { PlusIcon, UserPlusIcon } from "../_console/components/icons";
import {
  ApiPending,
  Badge,
  Card,
  EmptyState,
  FilterBar,
  Kpi,
  KpiGrid,
  Notice,
  PageHeader,
  Person,
  SelectField,
} from "../_console/components/ui";
import { formatDate, formatNumber } from "../_console/lib/format";
import {
  ORG_STATUS_LABEL,
  currentAdmin,
  getPeriod,
  inPeriod,
  isPendingStatus,
  joinOrganisations,
  useAdmins,
  useOrganisations,
  type OrgStatus,
  type OrganisationRow,
  type PeriodId,
} from "../_console/lib/superAdminData";

const TOTALS_PENDING = "Needs platform totals API";

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default function SuperAdminDashboardPage() {
  const orgs = useOrganisations();
  const admins = useAdmins();
  const [periodId, setPeriodId] = useState<PeriodId>("last-12");
  const [status, setStatus] = useState<OrgStatus | "all">("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteOrgId, setInviteOrgId] = useState("");

  const period = getPeriod(periodId);
  const rows = useMemo(() => joinOrganisations(orgs.data, admins.data), [orgs.data, admins.data]);
  const visible = rows.filter((row) => status === "all" || row.status === status);
  const adminList = useMemo(() => admins.data ?? [], [admins.data]);
  const loading = orgs.isLoading || admins.isLoading;
  const count = (value: OrgStatus) => rows.filter((row) => row.status === value).length;
  const pendingAdmins = adminList.filter((admin) => isPendingStatus(admin.status)).length;

  const recent = useMemo(
    () =>
      [...adminList]
        .filter((admin) => admin.createdAt && inPeriod(admin.createdAt, period))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, 6),
    [adminList, period],
  );

  const inviteTarget = rows.find((row) => row.id === inviteOrgId) ?? null;

  return (
    <>
      <PageHeader
        title={greeting()}
        subtitle="Every organisation on ClearPortfolio at a glance. Filters apply to the whole page."
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
                context: [`Period: ${period.label}`],
                columns: [
                  { header: "Organisation", value: (row: OrganisationRow) => row.name },
                  { header: "Contact email", value: (row: OrganisationRow) => row.email },
                  { header: "Admin", value: (row: OrganisationRow) => currentAdmin(row)?.name ?? "" },
                  { header: "Admin email", value: (row: OrganisationRow) => currentAdmin(row)?.email ?? "" },
                  { header: "Status", value: (row: OrganisationRow) => ORG_STATUS_LABEL[row.status].label },
                  { header: "State", value: (row: OrganisationRow) => row.state ?? "" },
                  { header: "Created", value: (row: OrganisationRow) => formatDate(row.createdAt) },
                ],
                rows: visible,
              })}
            />
          </>
        }
      />

      {orgs.error ? <Notice tone="red" title="Couldn't load organisations">{orgs.error.message}</Notice> : null}

      <FilterBar
        end={
          <button
            type="button"
            className="cpc-btn cpc-btn-ghost cpc-btn-sm"
            onClick={() => {
              setPeriodId("last-12");
              setStatus("all");
            }}
          >
            Reset
          </button>
        }
      >
        <SelectField
          id="sa-period"
          label="Period"
          value={periodId}
          onChange={setPeriodId}
          options={[
            { value: "last-12", label: "Last 12 months" },
            { value: "fy-current", label: getPeriod("fy-current").label },
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
            { value: "suspended", label: "Suspended" },
          ]}
        />
      </FilterBar>

      <KpiGrid>
        <Kpi
          label="Organisations"
          href="/dashboard/super-admin/organisations"
          loading={loading}
          value={formatNumber(rows.length)}
          hint={`${count("active")} active · ${count("onboarding")} onboarding · ${count("suspended")} suspended`}
        />
        <Kpi
          label="Admins"
          href="/dashboard/super-admin/admins"
          loading={loading}
          value={formatNumber(adminList.length)}
          hint={`${adminList.length - pendingAdmins} active · ${pendingAdmins} invite pending`}
        />
        <Kpi label="Accountants" value="—" hint={<ApiPending>{TOTALS_PENDING}</ApiPending>} />
        <Kpi label="Relationship managers" value="—" hint={<ApiPending>{TOTALS_PENDING}</ApiPending>} />
        <Kpi label="Clients" value="—" hint={<ApiPending>{TOTALS_PENDING}</ApiPending>} />
        <Kpi label="Properties" value="—" hint={<ApiPending>{TOTALS_PENDING}</ApiPending>} />
        <Kpi label="Equity managed" value="—" hint={<ApiPending>{TOTALS_PENDING}</ApiPending>} />
      </KpiGrid>

      <div className="cpc-grid-2">
        <Card title="Clients on the platform" meta={`Total clients at month end · ${period.label.toLowerCase()}`}>
          <EmptyState title="No platform totals yet">
            Monthly client counts appear here once the backend exposes platform-wide totals.
          </EmptyState>
        </Card>
        <Card
          title="Equity managed by organisation"
          actions={<Link className="cpc-link" href="/dashboard/super-admin/organisations">All organisations →</Link>}
        >
          <EmptyState title="No equity totals yet">Each organisation&apos;s equity appears here once platform totals are available.</EmptyState>
        </Card>
      </div>

      <Card
        flush
        title="Organisations at a glance"
        meta="Sorted by name"
        actions={
          <>
            <ExportMenu
              small
              build={() => ({
                title: "Organisations at a glance",
                filename: "organisations-at-a-glance",
                columns: [
                  { header: "Organisation", value: (row: OrganisationRow) => row.name },
                  { header: "Admin", value: (row: OrganisationRow) => currentAdmin(row)?.name ?? "" },
                  { header: "Status", value: (row: OrganisationRow) => ORG_STATUS_LABEL[row.status].label },
                ],
                rows: visible,
              })}
            />
            <Link className="cpc-btn cpc-btn-sm" href="/dashboard/super-admin/organisations">
              Open list
            </Link>
          </>
        }
      >
        <DataTable<OrganisationRow>
          caption="Organisations at a glance"
          loading={loading}
          rows={visible}
          rowKey={(row) => row.id}
          pageSize={10}
          initialSort={{ id: "name", direction: "asc" }}
          empty={<EmptyState title="No organisations yet" />}
          columns={[
            {
              id: "name",
              header: "Organisation",
              cell: (row) => <Person name={row.name} href={`/dashboard/super-admin/organisations/${encodeURIComponent(row.id)}`} />,
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
                  <span className="cpc-muted">—</span>
                );
              },
            },
            {
              id: "status",
              header: "Status",
              cell: (row) => (
                <Badge tone={ORG_STATUS_LABEL[row.status].tone} dot>
                  {ORG_STATUS_LABEL[row.status].label}
                </Badge>
              ),
              sortValue: (row) => row.status,
            },
            { id: "acc", header: "Accountants", align: "right", cell: () => "—" },
            { id: "rms", header: "RMs", align: "right", cell: () => "—" },
            { id: "clients", header: "Clients", align: "right", cell: () => "—" },
            { id: "props", header: "Properties", align: "right", cell: () => "—" },
            { id: "equity", header: "Equity", align: "right", cell: () => "—" },
            { id: "share", header: "Clients share", cell: () => <span className="cpc-muted">—</span> },
          ]}
        />
      </Card>

      <Card title="Recent admin changes" actions={<Link className="cpc-link" href="/dashboard/super-admin/admins">All admins →</Link>}>
        {loading ? (
          <p className="cpc-muted cpc-small">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="cpc-muted cpc-small">No admin changes in this period.</p>
        ) : (
          <div className="cpc-list">
            {recent.map((admin) => (
              <div key={admin.id} className="cpc-list-row">
                <div>
                  <span className="cpc-strong">{admin.organizationName || "No organisation"}</span>{" "}
                  <span className="cpc-muted">· admin {isPendingStatus(admin.status) ? "invited" : "active"}</span>
                  <div className="cpc-person-sub">
                    {admin.name || admin.email}
                    {isPendingStatus(admin.status) ? " · invite sent, not yet accepted" : ""}
                  </div>
                </div>
                <span className="cpc-small cpc-muted cpc-num">{formatDate(admin.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {inviteOpen && !inviteTarget ? (
        <div className="cpc-dialog-layer" onPointerDown={(e) => e.target === e.currentTarget && setInviteOpen(false)}>
          <div className="cpc-dialog" role="dialog" aria-modal="true" aria-label="Choose organisation">
            <div className="cpc-dialog-head">
              <h2 className="cpc-card-title">Invite admin</h2>
            </div>
            <div className="cpc-dialog-body">
              <SelectField
                id="pick-org"
                label="Organisation"
                value={inviteOrgId}
                onChange={setInviteOrgId}
                options={[{ value: "", label: "Choose an organisation" }, ...rows.map((row) => ({ value: row.id, label: row.name }))]}
              />
            </div>
            <div className="cpc-dialog-foot">
              <button type="button" className="cpc-btn" onClick={() => setInviteOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <ChangeAdminDialog
        open={inviteOpen && Boolean(inviteTarget)}
        organisation={inviteTarget}
        currentAdmin={inviteTarget ? currentAdmin(inviteTarget) : null}
        mode={inviteTarget && currentAdmin(inviteTarget) ? "change" : "invite"}
        onClose={() => {
          setInviteOpen(false);
          setInviteOrgId("");
        }}
      />
    </>
  );
}
