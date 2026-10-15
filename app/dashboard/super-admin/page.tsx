"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ChangeAdminDialog } from "../_console/components/ChangeAdminDialog";
import { DataTable } from "../_console/components/DataTable";
import { ExportMenu } from "../_console/components/ExportMenu";
import { PlusIcon, UserPlusIcon } from "../_console/components/icons";
import {
  ApiPending,
  Badge,
  BarList,
  Card,
  ColumnChart,
  EmptyState,
  FilterBar,
  Kpi,
  KpiGrid,
  Legend,
  Meter,
  Notice,
  PageHeader,
  Person,
  SelectField,
} from "../_console/components/ui";
import { formatCompactMoney, formatDate, formatNumber } from "../_console/lib/format";
import { lastTwelveMonths, orgMetrics, platformMetrics } from "../_console/lib/sampleData";
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
  const visible = useMemo(() => rows.filter((row) => status === "all" || row.status === status), [rows, status]);
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
  const totals = useMemo(() => platformMetrics(visible.map((row) => row.id)), [visible]);
  const months = useMemo(() => lastTwelveMonths(), []);
  const pending = (value: number | null | undefined, money = false) =>
    totals ? (money ? formatCompactMoney(value) : formatNumber(value)) : "—";
  const pendingHint = (text: ReactNode) => (totals ? text : <ApiPending>{TOTALS_PENDING}</ApiPending>);
  const equityRows = useMemo(
    () =>
      visible
        .map((row) => ({ row, metrics: orgMetrics(row.id) }))
        .filter((item) => item.metrics)
        .sort((a, b) => (b.metrics?.equity ?? 0) - (a.metrics?.equity ?? 0))
        .slice(0, 6),
    [visible],
  );

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
        <Kpi label="Accountants" loading={loading} value={pending(totals?.accountants)} hint={pendingHint("across all organisations")} />
        <Kpi label="Relationship managers" loading={loading} value={pending(totals?.rms)} hint={pendingHint("leading accountant teams")} />
        <Kpi
          label="Clients"
          loading={loading}
          value={pending(totals?.clients)}
          hint={pendingHint(
            totals ? (
              <>
                <span className="cpc-up">↑ {formatNumber(totals.clients - totals.clientsByMonth[0])}</span> in 12 months
              </>
            ) : null,
          )}
        />
        <Kpi label="Properties" loading={loading} value={pending(totals?.properties)} hint={pendingHint(`${formatNumber(totals?.entities)} entities`)} />
        <Kpi label="Equity managed" loading={loading} value={pending(totals?.equity, true)} hint={pendingHint("total portfolio equity")} />
      </KpiGrid>

      <div className="cpc-grid-2">
        <Card
          title="Clients on the platform"
          meta={`Total clients at month end · ${period.label.toLowerCase()}`}
          actions={<Legend items={[{ label: "Clients", color: "#2e387a" }]} />}
        >
          {totals ? (
            <ColumnChart loading={loading} labels={months} series={[{ name: "Clients", color: "#2e387a", values: totals.clientsByMonth }]} />
          ) : (
            <EmptyState title="No platform totals yet">
              Monthly client counts appear here once the backend exposes platform-wide totals.
            </EmptyState>
          )}
        </Card>
        <Card
          title="Equity managed by organisation"
          meta="Top organisations by equity"
          actions={<Link className="cpc-link" href="/dashboard/super-admin/organisations">All organisations →</Link>}
        >
          {totals ? (
            <BarList
              loading={loading}
              color="#f4a117"
              labelWidth="13em"
              rows={equityRows.map(({ row, metrics }) => ({
                key: row.id,
                label: (
                  <Link className="cpc-person-name" href={`/dashboard/super-admin/organisations/${encodeURIComponent(row.id)}`}>
                    {row.name}
                  </Link>
                ),
                value: metrics?.equity ?? 0,
                display: formatCompactMoney(metrics?.equity),
              }))}
            />
          ) : (
            <EmptyState title="No equity totals yet">Each organisation&apos;s equity appears here once platform totals are available.</EmptyState>
          )}
        </Card>
      </div>

      <Card
        flush
        title="Organisations at a glance"
        meta={totals ? "Sorted by equity" : "Sorted by name"}
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
                  { header: "Accountants", value: (row: OrganisationRow) => orgMetrics(row.id)?.accountants },
                  { header: "RMs", value: (row: OrganisationRow) => orgMetrics(row.id)?.rms },
                  { header: "Clients", value: (row: OrganisationRow) => orgMetrics(row.id)?.clients },
                  { header: "Properties", value: (row: OrganisationRow) => orgMetrics(row.id)?.properties },
                  { header: "Equity", value: (row: OrganisationRow) => orgMetrics(row.id)?.equity },
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
          initialSort={totals ? { id: "equity", direction: "desc" } : { id: "name", direction: "asc" }}
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
            { id: "acc", header: "Accountants", align: "right", cell: (row) => formatNumber(orgMetrics(row.id)?.accountants), sortValue: (row) => orgMetrics(row.id)?.accountants ?? 0 },
            { id: "rms", header: "RMs", align: "right", cell: (row) => formatNumber(orgMetrics(row.id)?.rms), sortValue: (row) => orgMetrics(row.id)?.rms ?? 0 },
            { id: "clients", header: "Clients", align: "right", cell: (row) => formatNumber(orgMetrics(row.id)?.clients), sortValue: (row) => orgMetrics(row.id)?.clients ?? 0 },
            { id: "props", header: "Properties", align: "right", cell: (row) => formatNumber(orgMetrics(row.id)?.properties), sortValue: (row) => orgMetrics(row.id)?.properties ?? 0 },
            {
              id: "equity",
              header: "Equity",
              align: "right",
              cell: (row) => <span className="cpc-strong">{formatCompactMoney(orgMetrics(row.id)?.equity)}</span>,
              sortValue: (row) => orgMetrics(row.id)?.equity ?? 0,
            },
            {
              id: "share",
              header: "Clients share",
              cell: (row) => {
                const clients = orgMetrics(row.id)?.clients;
                return clients != null && totals?.clients ? (
                  <Meter value={clients / totals.clients} color="#2e387a" />
                ) : (
                  <span className="cpc-muted">—</span>
                );
              },
            },
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
