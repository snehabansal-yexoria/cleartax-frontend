"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ChangeAdminDialog } from "../../../_console/components/ChangeAdminDialog";
import { DataTable } from "../../../_console/components/DataTable";
import { ExportMenu } from "../../../_console/components/ExportMenu";
import {
  ApiPending,
  Avatar,
  Badge,
  Card,
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
import { formatDate, initials } from "../../../_console/lib/format";
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
  const admin = row ? currentAdmin(row) : null;

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
        <Kpi label="Accountants" value="—" hint={<ApiPending>{TOTALS}</ApiPending>} />
        <Kpi label="RMs" value="—" hint={<ApiPending>{TOTALS}</ApiPending>} />
        <Kpi label="Clients" value="—" hint={<ApiPending>{TOTALS}</ApiPending>} />
        <Kpi label="Properties" value="—" hint={<ApiPending>{TOTALS}</ApiPending>} />
        <Kpi label="Entities" value="—" hint={<ApiPending>{TOTALS}</ApiPending>} />
        <Kpi label="Equity managed" value="—" hint={<ApiPending>{TOTALS}</ApiPending>} />
        <Kpi label="Documents" value="—" hint={<ApiPending>{TOTALS}</ApiPending>} />
        <Kpi label="Bank accounts" value="—" hint={<ApiPending>{TOTALS}</ApiPending>} />
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
                <dd className="cpc-muted">—</dd>
                <dt>Last login</dt>
                <dd className="cpc-muted">—</dd>
                <dt>MFA</dt>
                <dd className="cpc-muted">—</dd>
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
              <dt>Time zone</dt>
              <dd className="cpc-muted">—</dd>
              <dt>FY starts</dt>
              <dd>1 July</dd>
            </dl>
          )}
        </Card>
      </div>

      <div className="cpc-grid-2">
        <Card title="Growth" meta="Clients and equity at month end" actions={<Legend items={[{ label: "Clients", color: "var(--cpc-blue)" }]} />}>
          <EmptyState title="No growth data yet">Monthly client and equity totals appear once the organisation totals API is available.</EmptyState>
        </Card>
        <Card flush title="People" meta="RMs and the accountants under them">
          <DataTable<{ id: string }>
            caption="Relationship managers"
            rows={[]}
            rowKey={(item) => item.id}
            empty={<EmptyState title="No people data yet">RMs and their accountants appear once the organisation totals API is available.</EmptyState>}
            columns={[
              { id: "rm", header: "Relationship manager", cell: () => null },
              { id: "acc", header: "Accountants", align: "right", cell: () => null },
              { id: "clients", header: "Clients", align: "right", cell: () => null },
              { id: "props", header: "Properties", align: "right", cell: () => null },
              { id: "equity", header: "Equity", align: "right", cell: () => null },
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
            { id: "reason", header: "Reason", cell: () => <span className="cpc-muted">—</span> },
            {
              id: "account",
              header: "Previous admin's account",
              cell: (a) => <span className="cpc-small cpc-muted">{a.isCurrent ? "—" : isPendingStatus(a.status) ? "Invite pending" : "Active"}</span>,
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
