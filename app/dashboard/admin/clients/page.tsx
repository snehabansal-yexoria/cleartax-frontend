"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { DataTable, type Column } from "../../_console/components/DataTable";
import { ExportMenu } from "../../_console/components/ExportMenu";
import { PlusIcon } from "../../_console/components/icons";
import {
  FilterBar,
  Kpi,
  KpiGrid,
  Notice,
  PageHeader,
  PendingAction,
  Person,
  SearchField,
  SelectField,
  StatusBadge,
  Tabs,
  Card,
} from "../../_console/components/ui";
import { isPendingStatus, type ClientRecord } from "../../_console/lib/adminData";
import { formatCompactMoney, formatDate, formatNumber } from "../../_console/lib/format";
import { findPeriod, rollupFor } from "../../_console/lib/metrics";
import {
  ALL,
  ENTITY_TYPE_OPTIONS,
  STATE_OPTIONS,
  scopeClients,
  useAdminWorkspace,
} from "../../_console/lib/useAdminWorkspace";

type Tab = "all" | "registered" | "pending" | "unassigned";

type ClientRow = ClientRecord & {
  entities: number;
  properties: number;
  equity: number;
  transactions: number;
  primaryState: string;
};

const ALL_TIME = findPeriod("all");

export default function AdminClientsPage() {
  const params = useSearchParams();
  const { people, portfolio, transactions } = useAdminWorkspace();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [tab, setTab] = useState<Tab>("all");
  const [accountantId, setAccountantId] = useState(ALL);
  const [entityType, setEntityType] = useState(ALL);
  const [state, setState] = useState(ALL);
  const [propertyBand, setPropertyBand] = useState(ALL);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const accountants = people.data?.accountants ?? [];

  const rows = useMemo<ClientRow[]>(() => {
    const clients = people.data?.clients ?? [];
    return clients.map((client) => {
      const ids = new Set([client.id]);
      const rollup = rollupFor(ids, portfolio.data, transactions.data, ALL_TIME);
      const states = (portfolio.data?.properties ?? []).filter((p) => p.clientId === client.id).map((p) => p.state);
      return {
        ...client,
        entities: rollup.entities,
        properties: rollup.properties,
        equity: rollup.equity,
        transactions: rollup.transactions,
        primaryState: states[0] ?? "—",
      };
    });
  }, [people.data, portfolio.data, transactions.data]);

  const scoped = useMemo(() => {
    const ids = new Set(scopeClients(rows, portfolio.data, { accountantId, entityType, state }).map((row) => row.id));
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (!ids.has(row.id)) return false;
      if (needle && !`${row.name} ${row.email}`.toLowerCase().includes(needle)) return false;
      if (propertyBand === "0" && row.properties !== 0) return false;
      if (propertyBand === "1-2" && (row.properties < 1 || row.properties > 2)) return false;
      if (propertyBand === "3+" && row.properties < 3) return false;
      return true;
    });
  }, [rows, portfolio.data, accountantId, entityType, state, query, propertyBand]);

  const counts = {
    all: scoped.length,
    registered: scoped.filter((row) => !isPendingStatus(row.status)).length,
    pending: scoped.filter((row) => isPendingStatus(row.status)).length,
    unassigned: scoped.filter((row) => !row.assignedAccountantId).length,
  };

  const visible = scoped.filter((row) =>
    tab === "registered"
      ? !isPendingStatus(row.status)
      : tab === "pending"
        ? isPendingStatus(row.status)
        : tab === "unassigned"
          ? !row.assignedAccountantId
          : true,
  );

  const withProperties = rows.filter((row) => row.properties > 0);
  const totalEquity = rows.reduce((sum, row) => sum + row.equity, 0);

  const columns: Column<ClientRow>[] = [
    {
      id: "client",
      header: "Client",
      cell: (row) => <Person name={row.name || row.email} sub={row.email} href={`/dashboard/admin/clients/${encodeURIComponent(row.id)}`} />,
      sortValue: (row) => row.name || row.email,
    },
    { id: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status },
    {
      id: "accountant",
      header: "Accountant",
      cell: (row) =>
        row.assignedAccountantId ? (
          <Link className="cpc-person-name" href={`/dashboard/admin/accountants/${encodeURIComponent(row.assignedAccountantId)}`}>
            {row.assignedAccountantName || "Assigned"}
          </Link>
        ) : (
          <span className="cpc-muted">Unassigned</span>
        ),
      sortValue: (row) => row.assignedAccountantName,
    },
    { id: "entities", header: "Entities", align: "right", cell: (row) => row.entities, sortValue: (row) => row.entities },
    { id: "properties", header: "Properties", align: "right", cell: (row) => row.properties, sortValue: (row) => row.properties },
    { id: "equity", header: "Equity", align: "right", cell: (row) => formatCompactMoney(row.equity), sortValue: (row) => row.equity },
    { id: "txns", header: "Transactions", align: "right", cell: (row) => formatNumber(row.transactions), sortValue: (row) => row.transactions },
    { id: "state", header: "State", cell: (row) => row.primaryState, sortValue: (row) => row.primaryState },
    { id: "joined", header: "Joined", cell: (row) => <span className="cpc-small cpc-muted">{formatDate(row.joinedAt)}</span>, sortValue: (row) => row.joinedAt ?? "" },
    {
      id: "view",
      header: "",
      cell: (row) => (
        <Link className="cpc-btn cpc-btn-sm" href={`/dashboard/admin/clients/${encodeURIComponent(row.id)}`}>
          View
        </Link>
      ),
    },
  ];

  const selectedRows = visible.filter((row) => selected.has(row.id));
  const exportRequest = (subset: ClientRow[]) => ({
    title: "Clients",
    filename: "clients",
    context: [`${subset.length} clients`],
    columns: [
      { header: "Name", value: (row: ClientRow) => row.name },
      { header: "Email", value: (row: ClientRow) => row.email },
      { header: "Status", value: (row: ClientRow) => (isPendingStatus(row.status) ? "Invite pending" : "Active") },
      { header: "Accountant", value: (row: ClientRow) => row.assignedAccountantName || "Unassigned" },
      { header: "Entities", value: (row: ClientRow) => row.entities },
      { header: "Properties", value: (row: ClientRow) => row.properties },
      { header: "Equity (AUD)", value: (row: ClientRow) => Math.round(row.equity) },
      { header: "Transactions", value: (row: ClientRow) => row.transactions },
      { header: "State", value: (row: ClientRow) => row.primaryState },
      { header: "Joined", value: (row: ClientRow) => formatDate(row.joinedAt) },
    ],
    rows: subset,
  });

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Every client in your organisation, with their accountant and portfolio."
        actions={
          <>
            <ExportMenu build={() => exportRequest(visible)} />
            <Link className="cpc-btn cpc-btn-primary" href="/dashboard/admin/invite?role=client">
              <PlusIcon />
              Invite client
            </Link>
          </>
        }
      />

      {people.error ? <Notice tone="red" title="Couldn't load clients">{people.error.message}</Notice> : null}

      <KpiGrid>
        <Kpi label="Registered" loading={people.isLoading} value={formatNumber(rows.filter((r) => !isPendingStatus(r.status)).length)} hint="Active on the platform" />
        <Kpi label="Pending invite" loading={people.isLoading} tone="warn" value={formatNumber(rows.filter((r) => isPendingStatus(r.status)).length)} hint="Invite sent, not activated" />
        <Kpi label="No accountant" loading={people.isLoading} tone="bad" value={formatNumber(rows.filter((r) => !r.assignedAccountantId).length)} hint="Need assigning" />
        <Kpi
          label="Avg properties"
          loading={portfolio.isLoading}
          value={withProperties.length ? (rows.reduce((s, r) => s + r.properties, 0) / rows.length).toFixed(1) : "0"}
          hint="per client"
        />
        <Kpi label="Avg equity" loading={portfolio.isLoading} value={formatCompactMoney(rows.length ? totalEquity / rows.length : 0)} hint="per client" />
      </KpiGrid>

      <FilterBar>
        <SearchField id="c-q" value={query} onChange={setQuery} placeholder="Name or email" />
        <SelectField
          id="c-acc"
          label="Accountant"
          value={accountantId}
          onChange={setAccountantId}
          options={[
            { value: ALL, label: "All accountants" },
            { value: "unassigned", label: "Unassigned" },
            ...accountants.map((user) => ({ value: user.id, label: user.name || user.email })),
          ]}
        />
        <SelectField id="c-ent" label="Entity type" value={entityType} onChange={setEntityType} options={ENTITY_TYPE_OPTIONS} />
        <SelectField
          id="c-props"
          label="Properties"
          value={propertyBand}
          onChange={setPropertyBand}
          options={[
            { value: ALL, label: "Any" },
            { value: "0", label: "None" },
            { value: "1-2", label: "1–2" },
            { value: "3+", label: "3 or more" },
          ]}
        />
        <SelectField id="c-state" label="State" value={state} onChange={setState} options={STATE_OPTIONS} />
      </FilterBar>

      <Card flush>
        <div style={{ padding: "0 1em" }}>
          <Tabs
            label="Client status"
            value={tab}
            onChange={setTab}
            items={[
              { id: "all", label: "All", count: counts.all },
              { id: "registered", label: "Registered", count: counts.registered },
              { id: "pending", label: "Pending", count: counts.pending },
              { id: "unassigned", label: "No accountant", count: counts.unassigned },
            ]}
          />
        </div>
        {selectedRows.length ? (
          <div className="cpc-bulk">
            <span>{selectedRows.length} selected</span>
            <PendingAction small reason="Reassigning clients needs an admin assignment endpoint">
              Change accountant
            </PendingAction>
            <ExportMenu small label="Export selected" build={() => exportRequest(selectedRows)} />
            <button type="button" className="cpc-btn" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
        ) : null}
        <DataTable
          caption="Clients"
          loading={people.isLoading}
          rows={visible}
          rowKey={(row) => row.id}
          columns={columns}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          initialSort={{ id: "equity", direction: "desc" }}
          footer={`${visible.length} clients`}
          empty={<p className="cpc-empty">No clients match these filters.</p>}
        />
      </Card>
    </>
  );
}
