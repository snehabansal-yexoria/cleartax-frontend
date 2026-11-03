"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ChangeAdminDialog } from "../../../_console/components/ChangeAdminDialog";
import { DataTable } from "../../../_console/components/DataTable";
import { ExportMenu } from "../../../_console/components/ExportMenu";
import {
  ApiPending,
  Avatar,
  BackLink,
  Badge,
  Card,
  ColumnChart,
  EmptyState,
  Field,
  Kpi,
  KpiGrid,
  Legend,
  Notice,
  PageHeader,
  PendingAction,
  Person,
  Presets,
  Skeleton,
  StatusBadge,
} from "../../../_console/components/ui";
import { formatCompactMoney, formatDate, formatDateTime, formatNumber, initials } from "../../../_console/lib/format";
import { adminAuth, changeReason, lastTwelveMonths, orgMetrics, orgPeople, type SampleRm } from "../../../_console/lib/sampleData";
import {
  ORG_STATUS_LABEL,
  currentAdmin,
  isPendingStatus,
  joinOrganisations,
  orgAddress,
  useAdmins,
  useOrganisations,
  type InvitedUser,
  type PeriodId,
} from "../../../_console/lib/superAdminData";

const TOTALS = "Needs organisation totals API";

const TIME_ZONES: Record<string, string> = {
  NSW: "Australia/Sydney",
  ACT: "Australia/Sydney",
  VIC: "Australia/Melbourne",
  TAS: "Australia/Hobart",
  QLD: "Australia/Brisbane",
  SA: "Australia/Adelaide",
  NT: "Australia/Darwin",
  WA: "Australia/Perth",
};

/** How many of the 12 monthly points each period preset shows. */
const PERIOD_MONTHS: Record<PeriodId, number> = { month: 1, quarter: 3, "fy-current": 12, "last-12": 12, all: 12 };

type HistoryRow = InvitedUser & { to: string | null; isCurrent: boolean };

export default function SuperAdminOrganisationDetailPage() {
  const { orgId: rawId } = useParams<{ orgId: string }>();
  const orgId = decodeURIComponent(rawId);
  const orgs = useOrganisations();
  const admins = useAdmins();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [periodId, setPeriodId] = useState<PeriodId>("last-12");

  const row = useMemo(() => joinOrganisations(orgs.data, admins.data).find((item) => item.id === orgId), [orgs.data, admins.data, orgId]);
  const loading = orgs.isLoading || admins.isLoading;
  const admin = useMemo(() => (row ? currentAdmin(row) : null), [row]);
  const metrics = row ? orgMetrics(row.id) : null;
  const people = useMemo(() => (row ? orgPeople(row.id) : []), [row]);
  const auth = admin ? adminAuth(admin) : null;
  const months = useMemo(() => lastTwelveMonths(), []);
  const shown = PERIOD_MONTHS[periodId];
  const kpi = (value: number | undefined, money = false) => (metrics ? (money ? formatCompactMoney(value) : formatNumber(value)) : "—");
  const kpiHint = (text: string) => (metrics ? text : <ApiPending>{TOTALS}</ApiPending>);

  // Each admin's tenure runs until the next admin was invited.
  const history = useMemo<HistoryRow[]>(() => {
    const ordered = [...(row?.admins ?? [])].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    return ordered
      .map((item, index) => ({ ...item, to: ordered[index + 1]?.createdAt ?? null, isCurrent: item.id === admin?.id }))
      .reverse();
  }, [row, admin]);

  if (!loading && !row) {
    return (
      <>
        <BackLink href="/dashboard/super-admin/organisations">Back to organisations</BackLink>
      <PageHeader title="Organisation" crumbs={[{ label: "Organisations", href: "/dashboard/super-admin/organisations" }, { label: "Not found" }]} />
        <Notice tone="red" title="Organisation not found">
          It may have been removed, or the link is out of date.
        </Notice>
      </>
    );
  }

  const name = row?.name ?? "Organisation";
  const address = row ? orgAddress(row) : "";

  return (
    <>
      <BackLink href="/dashboard/super-admin/organisations">Back to organisations</BackLink>
      <PageHeader title={row ? name : <Skeleton width="14em" height="1.6em" />} crumbs={[{ label: "Organisations", href: "/dashboard/super-admin/organisations" }, { label: name }]} />

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1.3em", flexWrap: "wrap", alignItems: "flex-start" }}>
          <div className="cpc-person" style={{ alignItems: "flex-start", gap: "1.15em" }}>
            <span className="cpc-brand-logo" style={{ width: "4em", height: "4em", fontSize: "1.15em", borderRadius: "0.9em" }} aria-hidden="true">
              {initials(name)}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45em" }}>
              <div style={{ display: "flex", gap: "0.6em", alignItems: "center", flexWrap: "wrap" }}>
                <span className="cpc-card-title" style={{ fontSize: "1.3em" }}>
                  {name}
                </span>
                {row ? (
                  <Badge tone={ORG_STATUS_LABEL[row.status].tone} dot>
                    {ORG_STATUS_LABEL[row.status].label}
                  </Badge>
                ) : null}
              </div>
              <div className="cpc-small cpc-muted" style={{ display: "flex", gap: "1.3em", flexWrap: "wrap" }}>
                {row?.email ? <span>{row.email}</span> : null}
                {row?.contactNumber ? <span>{row.contactNumber}</span> : null}
                {row?.city || row?.state ? <span>{[row.city, row.state].filter(Boolean).join(", ")}</span> : null}
                {row?.createdAt ? <span>Created {formatDate(row.createdAt)}</span> : null}
              </div>
            </div>
          </div>
          <div className="cpc-actions">
            <button type="button" className="cpc-btn" onClick={() => setDialogOpen(true)} disabled={!row}>
              {admin ? "Change admin" : "Invite admin"}
            </button>
            <PendingAction reason="Editing an organisation needs an organisation update endpoint">Edit details</PendingAction>
            <ExportMenu
              label="Export summary"
              build={() => ({
                title: `${name} · summary`,
                filename: `organisation-${orgId}`,
                context: [
                  `Contact: ${row?.email ?? ""}`,
                  `Address: ${address}`,
                  `Status: ${row ? ORG_STATUS_LABEL[row.status].label : ""}`,
                ],
                columns: [
                  { header: "Admin", value: (a: HistoryRow) => a.name },
                  { header: "Email", value: (a: HistoryRow) => a.email },
                  { header: "From", value: (a: HistoryRow) => formatDate(a.createdAt) },
                  { header: "To", value: (a: HistoryRow) => (a.isCurrent ? "Current" : formatDate(a.to)) },
                  { header: "Invited by", value: (a: HistoryRow) => a.invitedByEmail },
                ],
                rows: history,
              })}
            />
          </div>
        </div>
      </Card>

      <section className="cpc-filters" aria-label="Period">
        <Field label="Period">
          <Presets
            label="Period"
            value={periodId}
            onChange={setPeriodId}
            items={[
              { id: "month", label: "This month" },
              { id: "quarter", label: "This quarter" },
              { id: "last-12", label: "Last 12 months" },
              { id: "all", label: "All time" },
            ]}
          />
        </Field>
      </section>

      <KpiGrid>
        <Kpi label="Accountants" loading={loading} value={kpi(metrics?.accountants)} hint={kpiHint(`across ${metrics?.rms ?? 0} RM teams`)} />
        <Kpi label="RMs" loading={loading} value={kpi(metrics?.rms)} hint={kpiHint("relationship managers")} />
        <Kpi
          label="Clients"
          loading={loading}
          value={kpi(metrics?.clients)}
          hint={kpiHint(`+${formatNumber(metrics ? metrics.clients - metrics.clientsByMonth[12 - shown] : 0)} in period`)}
        />
        <Kpi label="Properties" loading={loading} value={kpi(metrics?.properties)} hint={kpiHint("under management")} />
        <Kpi label="Entities" loading={loading} value={kpi(metrics?.entities)} hint={kpiHint("trusts, companies, SMSFs")} />
        <Kpi label="Equity managed" loading={loading} value={kpi(metrics?.equity, true)} hint={kpiHint("total portfolio equity")} />
        <Kpi label="Documents" loading={loading} value={kpi(metrics?.documents)} hint={kpiHint("uploaded to the vault")} />
        <Kpi label="Bank accounts" loading={loading} value={kpi(metrics?.bankAccounts)} hint={kpiHint("connected feeds")} />
      </KpiGrid>

      <div className="cpc-grid-2">
        <Card
          title="Current admin"
          actions={
            <button type="button" className="cpc-btn cpc-btn-sm" onClick={() => setDialogOpen(true)} disabled={!row}>
              {admin ? "Change" : "Invite"}
            </button>
          }
        >
          {loading ? (
            <Skeleton height="6em" />
          ) : admin ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1em" }}>
              <div className="cpc-person">
                <Avatar name={admin.name || admin.email} />
                <div>
                  <div className="cpc-person-name cpc-strong">{admin.name || admin.email}</div>
                  <div className="cpc-person-sub">{admin.email}</div>
                </div>
              </div>
              <dl className="cpc-dl">
                <dt>Status</dt>
                <dd>
                  <StatusBadge status={admin.status} />
                </dd>
                <dt>Admin since</dt>
                <dd>{formatDate(admin.createdAt)}</dd>
                <dt>Phone</dt>
                <dd className={auth ? undefined : "cpc-muted"}>{auth?.phone ?? "—"}</dd>
                <dt>Last login</dt>
                <dd className={auth?.lastLogin ? undefined : "cpc-muted"}>{auth?.lastLogin ? formatDateTime(auth.lastLogin) : "—"}</dd>
                <dt>MFA</dt>
                <dd>
                  {auth ? (
                    <Badge tone={auth.mfa ? "green" : "amber"} dot>
                      {auth.mfa ? "On" : "Off"}
                    </Badge>
                  ) : (
                    <span className="cpc-muted">—</span>
                  )}
                </dd>
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
              <dt>Legal name</dt>
              <dd>{row?.name}</dd>
              <dt>Contact email</dt>
              <dd>{row?.email || "—"}</dd>
              <dt>Address</dt>
              <dd>{address || "—"}</dd>
              <dt>Phone</dt>
              <dd>{row?.contactNumber || "—"}</dd>
              <dt>Time zone</dt>
              <dd className={metrics && row?.state ? undefined : "cpc-muted"}>{metrics && row?.state ? TIME_ZONES[row.state] ?? "Australia/Sydney" : "—"}</dd>
              <dt>FY starts</dt>
              <dd>1 July</dd>
            </dl>
          )}
        </Card>
      </div>

      <div className="cpc-grid-2">
        <Card title="Growth" meta="Clients at month end" actions={<Legend items={[{ label: "Clients", color: "#2e387a" }]} />}>
          {metrics ? (
            <ColumnChart
              loading={loading}
              labels={months.slice(12 - Math.max(shown, 6))}
              series={[{ name: "Clients", color: "#2e387a", values: metrics.clientsByMonth.slice(12 - Math.max(shown, 6)) }]}
            />
          ) : (
            <EmptyState title="No growth data yet">Monthly client and equity totals appear once the organisation totals API is available.</EmptyState>
          )}
        </Card>
        <Card flush title="People" meta="RMs and the accountants under them">
          <DataTable<SampleRm>
            caption="Relationship managers"
            loading={loading}
            rows={people}
            rowKey={(item) => item.id}
            initialSort={{ id: "clients", direction: "desc" }}
            empty={<EmptyState title="No people data yet">RMs and their accountants appear once the organisation totals API is available.</EmptyState>}
            columns={[
              { id: "rm", header: "Relationship manager", cell: (item) => <Person name={item.name} />, sortValue: (item) => item.name },
              { id: "acc", header: "Accountants", align: "right", cell: (item) => formatNumber(item.accountants), sortValue: (item) => item.accountants },
              { id: "clients", header: "Clients", align: "right", cell: (item) => formatNumber(item.clients), sortValue: (item) => item.clients },
              { id: "props", header: "Properties", align: "right", cell: (item) => formatNumber(item.properties), sortValue: (item) => item.properties },
              { id: "equity", header: "Equity", align: "right", cell: (item) => formatCompactMoney(item.equity), sortValue: (item) => item.equity },
            ]}
          />
        </Card>
      </div>

      <Card
        flush
        title="Admin history"
        meta="Everyone who has been admin of this organisation"
        actions={
          <ExportMenu
            small
            build={() => ({
              title: `${name} · admin history`,
              filename: `admin-history-${orgId}`,
              columns: [
                { header: "Admin", value: (a: HistoryRow) => a.name },
                { header: "Email", value: (a: HistoryRow) => a.email },
                { header: "From", value: (a: HistoryRow) => formatDate(a.createdAt) },
                { header: "To", value: (a: HistoryRow) => (a.isCurrent ? "Current" : formatDate(a.to)) },
                { header: "Changed by", value: (a: HistoryRow) => a.invitedByEmail },
              ],
              rows: history,
            })}
          />
        }
      >
        <DataTable<HistoryRow>
          caption="Admin history"
          loading={loading}
          rows={history}
          rowKey={(a) => a.id}
          empty={<EmptyState title="No admins invited yet" />}
          columns={[
            { id: "admin", header: "Admin", cell: (a) => <Person name={a.name || a.email} sub={a.email} />, sortValue: (a) => a.name },
            { id: "from", header: "From", cell: (a) => <span className="cpc-small">{formatDate(a.createdAt)}</span>, sortValue: (a) => a.createdAt ?? "" },
            {
              id: "to",
              header: "To",
              cell: (a) =>
                a.isCurrent ? (
                  <Badge tone="green">Current</Badge>
                ) : isPendingStatus(a.status) && !a.to ? (
                  <StatusBadge status={a.status} />
                ) : (
                  <span className="cpc-small">{formatDate(a.to)}</span>
                ),
            },
            { id: "by", header: "Changed by", cell: (a) => <span className="cpc-muted">{a.invitedByEmail || "—"}</span> },
            {
              id: "reason",
              header: "Reason",
              cell: (a) => <span className="cpc-muted">{a.isCurrent ? "—" : changeReason(a.id) ?? "—"}</span>,
            },
            {
              id: "account",
              header: "Previous admin's account",
              cell: (a) =>
                a.isCurrent ? (
                  <span className="cpc-muted">—</span>
                ) : isPendingStatus(a.status) ? (
                  <span className="cpc-small cpc-muted">Invite pending</span>
                ) : (
                  <Badge tone="gray">Deactivated</Badge>
                ),
            },
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
