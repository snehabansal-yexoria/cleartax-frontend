"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable, type Column } from "../../_console/components/DataTable";
import { ExportMenu } from "../../_console/components/ExportMenu";
import { PlusIcon } from "../../_console/components/icons";
import {
  Card,
  FilterBar,
  Kpi,
  KpiGrid,
  Meter,
  Notice,
  PageHeader,
  PendingAction,
  Person,
  SearchField,
  SectionLabel,
  SelectField,
  Skeleton,
  StatusBadge,
} from "../../_console/components/ui";
import { isPendingStatus } from "../../_console/lib/adminData";
import { formatCompactMoney, formatNumber, formatDate, share } from "../../_console/lib/format";
import { accountantStats, type AccountantStats } from "../../_console/lib/metrics";
import { ALL, useAdminWorkspace, usePeriodState } from "../../_console/lib/useAdminWorkspace";

const LEADERBOARDS: { title: string; value: (row: AccountantStats) => number; format: (n: number) => string }[] = [
  { title: "Most clients", value: (row) => row.clients, format: formatNumber },
  { title: "Most equity managed", value: (row) => row.equity, format: formatCompactMoney },
  { title: "Most properties", value: (row) => row.properties, format: formatNumber },
  { title: "Most transactions", value: (row) => row.transactions, format: formatNumber },
];

export default function AdminAccountantsPage() {
  const { people, portfolio, transactions } = useAdminWorkspace();
  const { period, periodId, setPeriodId, periodOptions } = usePeriodState();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(ALL);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const stats = useMemo(
    () =>
      accountantStats(people.data?.accountants ?? [], people.data?.clients ?? [], portfolio.data, transactions.data, period),
    [people.data, portfolio.data, transactions.data, period],
  );

  const visible = stats.filter((row) => {
    const needle = query.trim().toLowerCase();
    if (needle && !`${row.accountant.name} ${row.accountant.email}`.toLowerCase().includes(needle)) return false;
    if (status === "active" && isPendingStatus(row.accountant.status)) return false;
    if (status === "invited" && !isPendingStatus(row.accountant.status)) return false;
    return true;
  });

  const active = stats.filter((row) => !isPendingStatus(row.accountant.status)).length;
  const assignedClients = stats.reduce((sum, row) => sum + row.clients, 0);
  const totalClients = people.data?.clients.length ?? 0;
  const sum = (pick: (row: AccountantStats) => number) => stats.reduce((total, row) => total + pick(row), 0);
  const loading = people.isLoading;
  const portfolioLoading = portfolio.isLoading;

  const columns: Column<AccountantStats>[] = [
    {
      id: "name",
      header: "Accountant",
      cell: (row) => (
        <Person
          name={row.accountant.name || row.accountant.email}
          sub={row.accountant.email}
          href={`/dashboard/admin/accountants/${encodeURIComponent(row.accountant.id)}`}
        />
      ),
      sortValue: (row) => row.accountant.name || row.accountant.email,
    },
    { id: "status", header: "Status", cell: (row) => <StatusBadge status={row.accountant.status} />, sortValue: (row) => row.accountant.status },
    { id: "clients", header: "Clients", align: "right", cell: (row) => row.clients, sortValue: (row) => row.clients },
    { id: "entities", header: "Entities", align: "right", cell: (row) => row.entities, sortValue: (row) => row.entities },
    { id: "properties", header: "Properties", align: "right", cell: (row) => row.properties, sortValue: (row) => row.properties },
    { id: "equity", header: "Equity", align: "right", cell: (row) => formatCompactMoney(row.equity), sortValue: (row) => row.equity },
    { id: "txns", header: "Transactions", align: "right", cell: (row) => formatNumber(row.transactions), sortValue: (row) => row.transactions },
    { id: "statements", header: "Statements", align: "right", cell: (row) => row.statements, sortValue: (row) => row.statements },
    {
      id: "reconciled",
      header: "Statements processed",
      cell: (row) => (row.statements ? <Meter value={share(row.statementsDone, row.statements)} /> : <span className="cpc-muted">—</span>),
      sortValue: (row) => share(row.statementsDone, row.statements),
    },
    { id: "invited", header: "Invited", cell: (row) => <span className="cpc-small cpc-muted">{formatDate(row.accountant.createdAt)}</span>, sortValue: (row) => row.accountant.createdAt ?? "" },
    {
      id: "view",
      header: "",
      cell: (row) => (
        <Link className="cpc-btn cpc-btn-sm" href={`/dashboard/admin/accountants/${encodeURIComponent(row.accountant.id)}`}>
          View
        </Link>
      ),
    },
  ];

  const exportRequest = (rows: AccountantStats[]) => ({
    title: "Accountants",
    filename: "accountants",
    context: [`Period: ${period.label}`, `${rows.length} accountants`],
    columns: [
      { header: "Name", value: (row: AccountantStats) => row.accountant.name },
      { header: "Email", value: (row: AccountantStats) => row.accountant.email },
      { header: "Status", value: (row: AccountantStats) => (isPendingStatus(row.accountant.status) ? "Invite pending" : "Active") },
      { header: "Clients", value: (row: AccountantStats) => row.clients },
      { header: "Entities", value: (row: AccountantStats) => row.entities },
      { header: "Properties", value: (row: AccountantStats) => row.properties },
      { header: "Equity (AUD)", value: (row: AccountantStats) => Math.round(row.equity) },
      { header: "Transactions", value: (row: AccountantStats) => row.transactions },
      { header: "Statements", value: (row: AccountantStats) => row.statements },
      { header: "Statements processed", value: (row: AccountantStats) => row.statementsDone },
    ],
    rows,
  });

  const selectedRows = visible.filter((row) => selected.has(row.accountant.id));

  return (
    <>
      <PageHeader
        title="Accountants"
        subtitle="Workload, portfolio and output for every accountant. Open one for their full report and activity log."
        actions={
          <>
            <Link className="cpc-btn" href="/dashboard/admin/efficiency">
              Compare efficiency
            </Link>
            <ExportMenu build={() => exportRequest(visible)} />
            <Link className="cpc-btn cpc-btn-primary" href="/dashboard/admin/invite?role=accountant">
              <PlusIcon />
              Invite accountant
            </Link>
          </>
        }
      />

      {people.error ? <Notice tone="red" title="Couldn't load accountants">{people.error.message}</Notice> : null}

      <KpiGrid>
        <Kpi label="Total accountants" loading={loading} value={stats.length} hint={`${active} active · ${stats.length - active} invited`} />
        <Kpi
          label="Clients assigned"
          loading={loading}
          value={formatNumber(assignedClients)}
          hint={`${active ? (assignedClients / active).toFixed(1) : 0} per accountant · ${totalClients - assignedClients} unassigned`}
        />
        <Kpi label="Equity managed" loading={portfolioLoading} value={formatCompactMoney(sum((r) => r.equity))} hint="across assigned clients" />
        <Kpi label="Entities · Properties" loading={portfolioLoading} value={`${sum((r) => r.entities)} · ${sum((r) => r.properties)}`} hint="for assigned clients" />
        <Kpi label="Transactions" loading={transactions.isLoading} value={formatNumber(sum((r) => r.transactions))} hint={period.label} />
        <Kpi label="Bank statements" loading={portfolioLoading} value={formatNumber(sum((r) => r.statements))} hint={`${sum((r) => r.statementsDone)} processed`} />
      </KpiGrid>

      <SectionLabel>By relationship manager</SectionLabel>
      <Notice
        tone="amber"
        title="Relationship managers aren't set up in the backend yet"
        action={<Link className="cpc-btn cpc-btn-sm" href="/dashboard/admin/relationship-managers">See details</Link>}
      >
        Once the RM role and the RM–accountant link exist, accountants will be grouped by RM here.
      </Notice>

      <SectionLabel>Leaders · {period.label}</SectionLabel>
      <div className="cpc-grid-4">
        {LEADERBOARDS.map((board) => {
          const top = [...stats].sort((a, b) => board.value(b) - board.value(a)).filter((row) => board.value(row) > 0).slice(0, 3);
          return (
            <Card key={board.title} title={board.title}>
              {loading ? (
                <Skeleton height="4em" />
              ) : top.length === 0 ? (
                <p className="cpc-muted cpc-small">No data in this period.</p>
              ) : (
                <div className="cpc-list">
                  {top.map((row, index) => (
                    <div key={row.accountant.id} className="cpc-list-row">
                      <span>
                        <span className="cpc-muted cpc-num" style={{ marginRight: "0.7em" }}>{index + 1}</span>
                        <Link className="cpc-person-name" href={`/dashboard/admin/accountants/${encodeURIComponent(row.accountant.id)}`}>
                          {row.accountant.name || row.accountant.email}
                        </Link>
                      </span>
                      <span className="cpc-num cpc-strong">{board.format(board.value(row))}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <FilterBar>
        <SearchField id="a-q" value={query} onChange={setQuery} placeholder="Name or email" />
        <SelectField
          id="a-status"
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: ALL, label: "All statuses" },
            { value: "active", label: "Active" },
            { value: "invited", label: "Invite pending" },
          ]}
        />
        <SelectField id="a-period" label="Period" value={periodId} onChange={setPeriodId} options={periodOptions} />
      </FilterBar>

      <Card flush>
        {selectedRows.length ? (
          <div className="cpc-bulk">
            <span>{selectedRows.length} selected</span>
            <PendingAction small reason="Relationship managers aren't set up in the backend yet">Change RM</PendingAction>
            <PendingAction small reason="Needs an admin endpoint to reassign clients">Transfer clients</PendingAction>
            <ExportMenu small label="Export selected" build={() => exportRequest(selectedRows)} />
            <PendingAction small reason="Needs a deactivate-user endpoint">Deactivate</PendingAction>
          </div>
        ) : null}
        <DataTable
          caption="Accountants"
          loading={loading}
          rows={visible}
          rowKey={(row) => row.accountant.id}
          columns={columns}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          initialSort={{ id: "equity", direction: "desc" }}
          footer={`${visible.length} accountants · statements processed = bank statements reconciled`}
          empty={<p className="cpc-empty">No accountants match these filters.</p>}
        />
      </Card>
    </>
  );
}
