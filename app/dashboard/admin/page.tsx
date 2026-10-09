"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable, type Column } from "../_console/components/DataTable";
import { ExportMenu } from "../_console/components/ExportMenu";
import { PlusIcon, UserPlusIcon } from "../_console/components/icons";
import {
  ApiPending,
  Badge,
  BarList,
  Card,
  ColumnChart,
  FilterBar,
  Kpi,
  KpiGrid,
  Legend,
  Meter,
  Notice,
  PageHeader,
  Person,
  SectionLabel,
  SelectField,
} from "../_console/components/ui";
import { ACTIVITY_LABELS, buildActivity } from "../_console/lib/activity";
import { isPendingStatus } from "../_console/lib/adminData";
import { formatCompactMoney, formatNumber, formatRelative, share } from "../_console/lib/format";
import {
  accountantStats,
  countBy,
  entityTypeLabel,
  equityBands,
  monthBuckets,
  monthKey,
  propertiesPerClientBands,
  rollupFor,
  sumBy,
  inPeriod,
  type AccountantStats,
} from "../_console/lib/metrics";
import {
  ALL,
  ENTITY_TYPE_OPTIONS,
  STATE_OPTIONS,
  scopeClients,
  useAdminWorkspace,
  usePeriodState,
} from "../_console/lib/useAdminWorkspace";

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default function AdminDashboardPage() {
  const { organization, people, portfolio, transactions } = useAdminWorkspace();
  const { period, periodId, setPeriodId, periodOptions } = usePeriodState();
  const [accountantId, setAccountantId] = useState(ALL);
  const [entityType, setEntityType] = useState(ALL);
  const [state, setState] = useState(ALL);

  const allClients = useMemo(() => people.data?.clients ?? [], [people.data]);
  const accountants = useMemo(() => people.data?.accountants ?? [], [people.data]);
  const scope = { accountantId, entityType, state };
  const clients = useMemo(
    () => scopeClients(allClients, portfolio.data, scope),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allClients, portfolio.data, accountantId, entityType, state],
  );
  const clientIds = useMemo(() => new Set(clients.map((client) => client.id)), [clients]);
  const totals = rollupFor(clientIds, portfolio.data, transactions.data, period);
  const properties = useMemo(
    () => (portfolio.data?.properties ?? []).filter((property) => clientIds.has(property.clientId)),
    [portfolio.data, clientIds],
  );

  const months = monthBuckets(period);
  const txnByMonth = useMemo(() => {
    const counts = new Map<string, number>();
    for (const txn of transactions.data ?? []) {
      if (!clientIds.has(txn.clientId) || !inPeriod(txn.invoiceDate, period)) continue;
      const key = monthKey(txn.invoiceDate);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return months.map((month) => counts.get(month.key) ?? 0);
  }, [transactions.data, clientIds, period, months]);

  const workload = useMemo(
    () =>
      accountantStats(accountants, allClients, portfolio.data, transactions.data, period)
        .filter((row) => accountantId === ALL || row.accountant.id === accountantId)
        .sort((a, b) => b.transactions - a.transactions || b.clients - a.clients),
    [accountants, allClients, portfolio.data, transactions.data, period, accountantId],
  );

  const activity = useMemo(() => buildActivity(people.data, portfolio.data).slice(0, 7), [people.data, portfolio.data]);
  const unassigned = allClients.filter((client) => !client.assignedAccountantId).length;
  const portfolioLoading = portfolio.isLoading;
  const peopleLoading = people.isLoading;
  const pendingClients = people.data?.invitedClients.filter((user) => isPendingStatus(user.status)).length ?? 0;

  const entityByClient = useMemo(() => {
    const entities = (portfolio.data?.entities ?? []).filter((entity) => clientIds.has(entity.clientId));
    const holders = new Map<string, Set<string>>();
    for (const entity of entities) {
      const set = holders.get(entity.entityType) ?? new Set<string>();
      set.add(entity.clientId);
      holders.set(entity.entityType, set);
    }
    return [...holders.entries()].map(([type, set]) => [type, set.size] as const).sort((a, b) => b[1] - a[1]);
  }, [portfolio.data, clientIds]);

  // A client is counted in the state where most of their properties are.
  const clientsByState = useMemo(() => {
    const perClient = new Map<string, Map<string, number>>();
    for (const property of properties) {
      const states = perClient.get(property.clientId) ?? new Map<string, number>();
      states.set(property.state, (states.get(property.state) ?? 0) + 1);
      perClient.set(property.clientId, states);
    }
    const primary = [...perClient.values()].map((states) => [...states.entries()].sort((a, b) => b[1] - a[1])[0][0]);
    return countBy(primary, (value) => value);
  }, [properties]);

  const equityByState = useMemo(() => sumBy(properties, (p) => p.state, (p) => p.equity), [properties]);
  const propsByState = useMemo(() => new Map(countBy(properties, (p) => p.state)), [properties]);
  const clientsByStateMap = new Map(clientsByState);

  const workloadColumns: Column<AccountantStats>[] = [
    {
      id: "name",
      header: "Accountant",
      cell: (row) => (
        <Person
          name={row.accountant.name || row.accountant.email}
          href={`/dashboard/admin/accountants/${encodeURIComponent(row.accountant.id)}`}
        />
      ),
      sortValue: (row) => row.accountant.name,
    },
    { id: "clients", header: "Clients", align: "right", cell: (row) => row.clients, sortValue: (row) => row.clients },
    { id: "properties", header: "Properties", align: "right", cell: (row) => row.properties, sortValue: (row) => row.properties },
    { id: "equity", header: "Equity", align: "right", cell: (row) => formatCompactMoney(row.equity), sortValue: (row) => row.equity },
    { id: "txns", header: "Transactions", align: "right", cell: (row) => formatNumber(row.transactions), sortValue: (row) => row.transactions },
  ];

  return (
    <>
      <PageHeader
        title={`${greeting()}`}
        subtitle={`How ${organization.data?.name || "your organisation"} is tracking. Filters apply to every number on this page.`}
        actions={
          <>
            <Link className="cpc-btn" href="/dashboard/admin/invite?role=accountant">
              <UserPlusIcon />
              Invite user
            </Link>
            <Link className="cpc-btn cpc-btn-primary" href="/dashboard/admin/invite?role=client">
              <PlusIcon />
              Invite client
            </Link>
            <ExportMenu
              label="Export dashboard"
              build={() => ({
                title: `${organization.data?.name ?? "Organisation"} dashboard`,
                filename: "dashboard-summary",
                context: [`Period: ${period.label}`],
                columns: [
                  { header: "Metric", value: (row: [string, string | number]) => row[0] },
                  { header: "Value", value: (row: [string, string | number]) => row[1] },
                ],
                rows: [
                  ["Clients", totals.clients],
                  ["Accountants", accountants.length],
                  ["Properties", totals.properties],
                  ["Market value (AUD)", Math.round(totals.marketValue)],
                  ["Loans (AUD)", Math.round(totals.loans)],
                  ["Equity managed (AUD)", Math.round(totals.equity)],
                  ["Transactions", totals.transactions],
                  ["Bank statements processed", `${totals.statementsDone} of ${totals.statements}`],
                ] as [string, string | number][],
              })}
            />
          </>
        }
      />

      {people.error ? (
        <Notice tone="red" title="Couldn't load your organisation's people" action={<button className="cpc-btn cpc-btn-sm" onClick={people.reload}>Retry</button>}>
          {people.error.message}
        </Notice>
      ) : null}

      <FilterBar
        end={
          <button
            type="button"
            className="cpc-btn cpc-btn-ghost cpc-btn-sm"
            onClick={() => {
              setPeriodId("fy-current");
              setAccountantId(ALL);
              setEntityType(ALL);
              setState(ALL);
            }}
          >
            Reset
          </button>
        }
      >
        <SelectField id="d-period" label="Period" value={periodId} onChange={setPeriodId} options={periodOptions} />
        <SelectField
          id="d-accountant"
          label="Accountant"
          value={accountantId}
          onChange={setAccountantId}
          options={[
            { value: ALL, label: `All accountants (${accountants.length})` },
            { value: "unassigned", label: "No accountant" },
            ...accountants.map((user) => ({ value: user.id, label: user.name || user.email })),
          ]}
        />
        <SelectField id="d-entity" label="Entity type" value={entityType} onChange={setEntityType} options={ENTITY_TYPE_OPTIONS} />
        <SelectField id="d-state" label="Location" value={state} onChange={setState} options={STATE_OPTIONS} />
      </FilterBar>

      <KpiGrid>
        <Kpi
          label="Clients"
          href="/dashboard/admin/clients"
          loading={peopleLoading}
          value={formatNumber(totals.clients)}
          hint={`${pendingClients} pending · ${unassigned} without accountant`}
        />
        <Kpi
          label="Accountants"
          href="/dashboard/admin/accountants"
          loading={peopleLoading}
          value={formatNumber(accountants.length)}
          hint={`${accountants.filter((a) => isPendingStatus(a.status)).length} invite pending`}
        />
        <Kpi label="Relationship managers" href="/dashboard/admin/relationship-managers" value="—" hint={<ApiPending />} />
        <Kpi
          label="Properties"
          href="/dashboard/admin/properties"
          loading={portfolioLoading}
          value={formatNumber(totals.properties)}
          hint={`${formatNumber(totals.entities)} entities`}
        />
        <Kpi
          label="Total equity managed"
          href="/dashboard/admin/properties"
          loading={portfolioLoading}
          value={formatCompactMoney(totals.equity)}
          hint={`${formatCompactMoney(totals.marketValue)} value − ${formatCompactMoney(totals.loans)} loans`}
        />
        <Kpi
          label="Transactions"
          href="/dashboard/admin/transactions"
          loading={transactions.isLoading}
          value={formatNumber(totals.transactions)}
          hint={period.label}
        />
      </KpiGrid>

      <div className="cpc-grid-2">
        <Card title="Transactions by month" meta={period.label} actions={<Legend items={[{ label: "Transactions", color: "var(--cpc-blue)" }]} />}>
          <ColumnChart
            loading={transactions.isLoading}
            labels={months.map((month) => month.label)}
            series={[{ name: "Transactions", color: "var(--cpc-blue)", values: txnByMonth }]}
          />
        </Card>

        <Card
          title="Bank statements & documents reconciled"
          meta="Only bank statements and uploaded documents are reconciled"
          actions={<Link className="cpc-link" href="/dashboard/admin/transactions">Open report →</Link>}
        >
          <div className="cpc-grid-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 13em), 1fr))" }}>
            <div className="cpc-card" style={{ padding: "1.15em", display: "flex", flexDirection: "column", gap: "0.6em" }}>
              <span className="cpc-kpi-label">Bank statements</span>
              <span className="cpc-kpi-value">{portfolioLoading ? "…" : totals.statements ? `${Math.round(share(totals.statementsDone, totals.statements) * 100)}%` : "—"}</span>
              <Meter value={share(totals.statementsDone, totals.statements)} />
              <span className="cpc-kpi-hint">
                {formatNumber(totals.statementsDone)} of {formatNumber(totals.statements)} processed
              </span>
            </div>
            <div className="cpc-card" style={{ padding: "1.15em", display: "flex", flexDirection: "column", gap: "0.6em" }}>
              <span className="cpc-kpi-label">Documents</span>
              <span className="cpc-kpi-value">—</span>
              <span className="cpc-kpi-hint">
                <ApiPending>Document matching API not connected</ApiPending>
              </span>
            </div>
          </div>
          <div className="cpc-list" style={{ marginTop: "1em" }}>
            <div className="cpc-list-row">
              <span>Transactions reviewed</span>
              <span className="cpc-num">
                {formatNumber(totals.reviewed)} of {formatNumber(totals.transactions)}
              </span>
            </div>
            <div className="cpc-list-row">
              <span>Statements waiting to process</span>
              <span className="cpc-num">{formatNumber(totals.statements - totals.statementsDone)}</span>
            </div>
          </div>
        </Card>
      </div>

      <SectionLabel>Client breakdown</SectionLabel>
      <div className="cpc-grid-4">
        <Card title="By number of properties" meta={`${clients.length} clients`}>
          <BarList
            loading={portfolioLoading}
            labelWidth="7.5em"
            rows={propertiesPerClientBands(clients, properties).map(([label, value]) => ({ label, value }))}
          />
        </Card>
        <Card title="By entity type" meta="Clients holding each">
          <BarList
            loading={portfolioLoading}
            labelWidth="7.5em"
            color="var(--cpc-purple)"
            rows={entityByClient.map(([type, value]) => ({ label: entityTypeLabel(type), value, key: type }))}
          />
        </Card>
        <Card title="By equity" meta="Equity per client">
          <BarList
            loading={portfolioLoading}
            labelWidth="7.5em"
            color="var(--cpc-teal)"
            rows={equityBands(clients, properties).map(([label, value]) => ({ label, value }))}
          />
        </Card>
        <Card title="By location" meta="Clients per state">
          <BarList
            loading={portfolioLoading}
            labelWidth="5em"
            color="var(--cpc-amber)"
            rows={clientsByState.map(([label, value]) => ({ label, value, key: label }))}
          />
        </Card>
      </div>

      <div className="cpc-grid-2">
        <Card flush title="Location detail" meta="Clients, properties and equity by state"
          actions={
            <ExportMenu
              small
              build={() => ({
                title: "Location detail",
                filename: "location-detail",
                context: [`Period: ${period.label}`],
                columns: [
                  { header: "State", value: (row: [string, number]) => row[0] },
                  { header: "Clients", value: (row: [string, number]) => clientsByStateMap.get(row[0]) ?? 0 },
                  { header: "Properties", value: (row: [string, number]) => propsByState.get(row[0]) ?? 0 },
                  { header: "Equity (AUD)", value: (row: [string, number]) => Math.round(row[1]) },
                ],
                rows: equityByState,
              })}
            />
          }
        >
          <DataTable
            caption="Clients, properties and equity by state"
            loading={portfolioLoading}
            rows={equityByState}
            rowKey={(row) => row[0]}
            empty={<p className="cpc-empty">No property locations yet.</p>}
            columns={[
              { id: "state", header: "State", cell: (row) => <span className="cpc-strong">{row[0]}</span> },
              { id: "clients", header: "Clients", align: "right", cell: (row) => clientsByStateMap.get(row[0]) ?? 0 },
              { id: "props", header: "Properties", align: "right", cell: (row) => propsByState.get(row[0]) ?? 0 },
              { id: "equity", header: "Equity", align: "right", cell: (row) => formatCompactMoney(row[1]) },
              {
                id: "share",
                header: "Share of equity",
                width: "28%",
                cell: (row) => <Meter value={share(row[1], totals.equity)} color="var(--cpc-teal)" />,
              },
            ]}
          />
        </Card>

        <Card
          flush
          title="Accountant workload"
          meta="Top 5 by transactions in the period"
          actions={<Link className="cpc-link" href="/dashboard/admin/efficiency">Full efficiency report →</Link>}
        >
          <DataTable
            caption="Accountant workload"
            loading={peopleLoading || transactions.isLoading}
            rows={workload.slice(0, 5)}
            rowKey={(row) => row.accountant.id}
            columns={workloadColumns}
            empty={<p className="cpc-empty">No accountants yet. Invite one to get started.</p>}
          />
        </Card>
      </div>

      <Card title="Recent activity" actions={<Link className="cpc-link" href="/dashboard/admin/audit-trail">Open audit trail →</Link>}>
        {peopleLoading ? (
          <BarList rows={[]} loading />
        ) : activity.length === 0 ? (
          <p className="cpc-muted cpc-small">No activity recorded yet.</p>
        ) : (
          <div className="cpc-list">
            {activity.map((event) => (
              <div key={event.id} className="cpc-list-row" style={{ alignItems: "flex-start" }}>
                <div className="cpc-person" style={{ alignItems: "flex-start" }}>
                  <Badge tone={ACTIVITY_LABELS[event.kind].tone}>{event.action}</Badge>
                  <div>
                    <div>{event.record}</div>
                    <div className="cpc-person-sub">
                      {event.actorName} · {event.clientName !== "—" ? event.clientName : event.module}
                    </div>
                  </div>
                </div>
                <span className="cpc-small cpc-muted cpc-num" style={{ whiteSpace: "nowrap" }}>
                  {formatRelative(event.at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
