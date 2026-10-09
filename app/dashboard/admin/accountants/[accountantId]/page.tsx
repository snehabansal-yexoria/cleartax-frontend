"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { ActivityLog } from "../../../_console/components/ActivityLog";
import { DataTable } from "../../../_console/components/DataTable";
import { ExportMenu } from "../../../_console/components/ExportMenu";
import {
  ApiPending,
  Avatar,
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
  Presets,
  Skeleton,
  StatusBadge,
} from "../../../_console/components/ui";
import { buildActivity } from "../../../_console/lib/activity";
import { formatCompactMoney, formatDate, formatNumber, formatPercent, share } from "../../../_console/lib/format";
import { clientsOf, inPeriod, monthBuckets, monthKey, rollupFor, type PeriodId } from "../../../_console/lib/metrics";
import { useAdminWorkspace, usePeriodState } from "../../../_console/lib/useAdminWorkspace";

type ClientLine = { id: string; name: string; email: string; entities: number; properties: number; equity: number; transactions: number; unreviewed: number };

const PRESETS: { id: PeriodId; label: string }[] = [
  { id: "month", label: "This month" },
  { id: "quarter", label: "This quarter" },
  { id: "fy-current", label: "This FY" },
  { id: "fy-previous", label: "Last FY" },
  { id: "all", label: "All time" },
];

function Compare({ label, mine, org, format }: { label: string; mine: number; org: number; format: (n: number) => string }) {
  const diff = org > 0 ? (mine - org) / org : 0;
  return (
    <div className="cpc-list-row">
      <span>{label}</span>
      <span className="cpc-num">
        <strong>{format(mine)}</strong> <span className="cpc-muted">vs {format(org)}</span>{" "}
        {org > 0 && Math.abs(diff) >= 0.01 ? <span className={diff > 0 ? "cpc-up" : "cpc-down"}>{diff > 0 ? "+" : ""}{Math.round(diff * 100)}%</span> : null}
      </span>
    </div>
  );
}

export default function AdminAccountantDetailPage() {
  const { accountantId: rawId } = useParams<{ accountantId: string }>();
  const accountantId = decodeURIComponent(rawId);
  const { people, portfolio, transactions } = useAdminWorkspace();
  const { period, periodId, setPeriodId } = usePeriodState("fy-current");

  const accountant = people.data?.accountants.find((user) => user.id === accountantId);
  const allClients = useMemo(() => people.data?.clients ?? [], [people.data]);
  const myClients = useMemo(() => (accountant ? clientsOf(accountant, allClients) : []), [accountant, allClients]);
  const myIds = useMemo(() => new Set(myClients.map((client) => client.id)), [myClients]);
  const mine = rollupFor(myIds, portfolio.data, transactions.data, period);

  const activeAccountants = Math.max(1, new Set(allClients.map((c) => c.assignedAccountantId).filter(Boolean)).size);
  const assignedIds = useMemo(() => new Set(allClients.filter((c) => c.assignedAccountantId).map((c) => c.id)), [allClients]);
  const org = rollupFor(assignedIds, portfolio.data, transactions.data, period);

  const months = monthBuckets(period);
  const monthly = useMemo(() => {
    const counts = new Map<string, number>();
    for (const txn of transactions.data ?? []) {
      if (!myIds.has(txn.clientId) || !inPeriod(txn.invoiceDate, period)) continue;
      counts.set(monthKey(txn.invoiceDate), (counts.get(monthKey(txn.invoiceDate)) ?? 0) + 1);
    }
    return months.map((month) => counts.get(month.key) ?? 0);
  }, [transactions.data, myIds, period, months]);

  const clientLines = useMemo<ClientLine[]>(
    () =>
      myClients.map((client) => {
        const rollup = rollupFor(new Set([client.id]), portfolio.data, transactions.data, period);
        return {
          id: client.id,
          name: client.name || client.email,
          email: client.email,
          entities: rollup.entities,
          properties: rollup.properties,
          equity: rollup.equity,
          transactions: rollup.transactions,
          unreviewed: rollup.transactions - rollup.reviewed,
        };
      }),
    [myClients, portfolio.data, transactions.data, period],
  );

  const activity = useMemo(
    () => buildActivity(people.data, portfolio.data).filter((event) => myIds.has(event.clientId) || event.actorId === accountantId),
    [people.data, portfolio.data, myIds, accountantId],
  );

  if (!people.isLoading && !accountant) {
    return (
      <>
        <PageHeader title="Accountant" crumbs={[{ label: "Accountants", href: "/dashboard/admin/accountants" }, { label: "Not found" }]} />
        <Notice tone="red" title="This accountant isn't in your organisation">They may have been removed, or the link is out of date.</Notice>
      </>
    );
  }

  const name = accountant?.name || accountant?.email || "Accountant";
  const perClient = (value: number, clients: number) => (clients ? value / clients : 0);

  return (
    <>
      <PageHeader
        title={accountant ? name : <Skeleton width="12em" height="1.6em" />}
        crumbs={[{ label: "Accountants", href: "/dashboard/admin/accountants" }, { label: name }]}
        actions={
          <>
            <PendingAction reason="Relationship managers aren't set up in the backend yet">Change RM</PendingAction>
            <PendingAction reason="Needs an admin endpoint to reassign clients">Transfer clients</PendingAction>
            <PendingAction variant="danger" reason="Needs a deactivate-user endpoint">Deactivate</PendingAction>
          </>
        }
      />

      <Card>
        <div className="cpc-person" style={{ alignItems: "flex-start", gap: "1.15em", flexWrap: "wrap" }}>
          <Avatar name={name} large />
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45em" }}>
            <div style={{ display: "flex", gap: "0.6em", alignItems: "center", flexWrap: "wrap" }}>
              <span className="cpc-card-title" style={{ fontSize: "1.3em" }}>{name}</span>
              {accountant ? <StatusBadge status={accountant.status} /> : null}
            </div>
            <div className="cpc-small cpc-muted" style={{ display: "flex", gap: "1.3em", flexWrap: "wrap" }}>
              <span>{accountant?.email}</span>
              <span>Invited {formatDate(accountant?.createdAt)}</span>
              <span>RM: <ApiPending>not set up</ApiPending></span>
            </div>
          </div>
        </div>
      </Card>

      <section className="cpc-filters" aria-label="Report filters">
        <Field label="Duration">
          <Presets label="Report duration" items={PRESETS} value={periodId} onChange={setPeriodId} />
        </Field>
        <div className="cpc-filters-end">
          <ExportMenu
            variant="dark"
            label="Export accountant report"
            build={() => ({
              title: `${name} · accountant report`,
              filename: `accountant-${accountantId}`,
              context: [
                `Period: ${period.label}`,
                `${mine.clients} clients · ${mine.properties} properties · equity ${formatCompactMoney(mine.equity)} · ${mine.transactions} transactions`,
              ],
              columns: [
                { header: "Client", value: (c: ClientLine) => c.name },
                { header: "Email", value: (c: ClientLine) => c.email },
                { header: "Entities", value: (c: ClientLine) => c.entities },
                { header: "Properties", value: (c: ClientLine) => c.properties },
                { header: "Equity (AUD)", value: (c: ClientLine) => Math.round(c.equity) },
                { header: "Transactions", value: (c: ClientLine) => c.transactions },
                { header: "Unreviewed", value: (c: ClientLine) => c.unreviewed },
              ],
              rows: clientLines,
            })}
          />
        </div>
      </section>

      <KpiGrid>
        <Kpi label="Clients" loading={people.isLoading} value={mine.clients} hint={`Org avg ${(assignedIds.size / activeAccountants).toFixed(1)}`} />
        <Kpi label="Entities" loading={portfolio.isLoading} value={mine.entities} />
        <Kpi label="Properties" loading={portfolio.isLoading} value={mine.properties} />
        <Kpi label="Equity managed" loading={portfolio.isLoading} value={formatCompactMoney(mine.equity)} hint={`${formatPercent(share(mine.equity, org.equity))} of org`} />
        <Kpi label="Transactions" loading={transactions.isLoading} value={formatNumber(mine.transactions)} hint={`${formatNumber(mine.reviewed)} reviewed`} />
        <Kpi label="Docs uploaded" value="—" hint={<ApiPending />} />
        <Kpi label="Bank statements" loading={portfolio.isLoading} value={mine.statements} hint={`${mine.statementsDone} processed`} />
        <Kpi
          label="Statements processed"
          loading={portfolio.isLoading}
          tone={mine.statements && share(mine.statementsDone, mine.statements) >= 0.8 ? "good" : undefined}
          value={mine.statements ? formatPercent(share(mine.statementsDone, mine.statements)) : "—"}
          hint="statements reconciled"
        />
      </KpiGrid>

      <div className="cpc-grid-2">
        <Card title="Monthly output" meta="Transactions on this accountant's clients" actions={<Legend items={[{ label: "Transactions", color: "var(--cpc-blue)" }]} />}>
          <ColumnChart loading={transactions.isLoading} labels={months.map((m) => m.label)} series={[{ name: "Transactions", color: "var(--cpc-blue)", values: monthly }]} />
        </Card>
        <Card title="Compared with org average" meta="Same period, all assigned clients" actions={<Link className="cpc-link" href="/dashboard/admin/efficiency">Efficiency report →</Link>}>
          <div className="cpc-list">
            <Compare label="Transactions per client" mine={perClient(mine.transactions, mine.clients)} org={perClient(org.transactions, org.clients)} format={(n) => n.toFixed(1)} />
            <Compare label="Equity per client" mine={perClient(mine.equity, mine.clients)} org={perClient(org.equity, org.clients)} format={formatCompactMoney} />
            <Compare label="Properties per client" mine={perClient(mine.properties, mine.clients)} org={perClient(org.properties, org.clients)} format={(n) => n.toFixed(1)} />
            <Compare label="Transactions reviewed" mine={share(mine.reviewed, mine.transactions)} org={share(org.reviewed, org.transactions)} format={(n) => formatPercent(n)} />
            <Compare label="Statements processed" mine={share(mine.statementsDone, mine.statements)} org={share(org.statementsDone, org.statements)} format={(n) => formatPercent(n)} />
          </div>
        </Card>
      </div>

      <Card flush title="Assigned clients" meta={`${clientLines.length} clients`}>
        <DataTable<ClientLine>
          caption="Assigned clients"
          loading={people.isLoading}
          rows={clientLines}
          rowKey={(c) => c.id}
          initialSort={{ id: "equity", direction: "desc" }}
          empty={<EmptyState title="No clients assigned yet" />}
          columns={[
            {
              id: "name",
              header: "Client",
              cell: (c) => (
                <Link className="cpc-person-name" href={`/dashboard/admin/clients/${encodeURIComponent(c.id)}`}>
                  {c.name}
                </Link>
              ),
              sortValue: (c) => c.name,
            },
            { id: "entities", header: "Entities", align: "right", cell: (c) => c.entities, sortValue: (c) => c.entities },
            { id: "props", header: "Properties", align: "right", cell: (c) => c.properties, sortValue: (c) => c.properties },
            { id: "equity", header: "Equity", align: "right", cell: (c) => formatCompactMoney(c.equity), sortValue: (c) => c.equity },
            { id: "txns", header: "Transactions", align: "right", cell: (c) => c.transactions, sortValue: (c) => c.transactions },
            { id: "unrev", header: "Unreviewed", align: "right", cell: (c) => c.unreviewed, sortValue: (c) => c.unreviewed },
            {
              id: "actions",
              header: "",
              cell: (c) => (
                <div className="cpc-actions" style={{ flexWrap: "nowrap" }}>
                  <PendingAction small reason="Needs an admin endpoint to reassign clients">Transfer</PendingAction>
                  <Link className="cpc-btn cpc-btn-sm" href={`/dashboard/admin/clients/${encodeURIComponent(c.id)}`}>View</Link>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <ActivityLog
        events={activity}
        loading={people.isLoading || portfolio.isLoading}
        title={`Activity & audit log · ${name}`}
        filename={`accountant-activity-${accountantId}`}
      />
    </>
  );
}
