"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable } from "../../_console/components/DataTable";
import { ExportMenu } from "../../_console/components/ExportMenu";
import { Badge, BarList, Card, EmptyState, FilterBar, Kpi, KpiGrid, Notice, PageHeader, SearchField, SelectField } from "../../_console/components/ui";
import type { OrgProperty } from "../../_console/lib/adminData";
import { formatCompactMoney, formatNumber, formatPercent, share, titleCase } from "../../_console/lib/format";
import { countBy, sumBy } from "../../_console/lib/metrics";
import { ALL, STATE_OPTIONS, useAdminWorkspace } from "../../_console/lib/useAdminWorkspace";

const STATUS_COLORS: Record<string, string> = {
  Rented: "var(--cpc-teal)",
  Vacant: "var(--cpc-gray)",
  "Available for Rent": "var(--cpc-blue)",
  "Self Occupied": "var(--cpc-purple)",
  "Listed for Sale": "var(--cpc-amber)",
  "Under Renovation": "var(--cpc-amber)",
};

export default function AdminPropertiesPage() {
  const { people, portfolio } = useAdminWorkspace();
  const [query, setQuery] = useState("");
  const [state, setState] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [accountant, setAccountant] = useState(ALL);
  const [depreciation, setDepreciation] = useState(ALL);

  const clients = useMemo(() => people.data?.clients ?? [], [people.data]);
  const clientName = useMemo(() => new Map(clients.map((c) => [c.id, c.name || c.email])), [clients]);
  const clientAccountant = useMemo(() => new Map(clients.map((c) => [c.id, c.assignedAccountantId])), [clients]);
  const clientAccountantName = useMemo(() => new Map(clients.map((c) => [c.id, c.assignedAccountantName])), [clients]);
  const all = useMemo(() => portfolio.data?.properties ?? [], [portfolio.data]);
  const statuses = useMemo(() => [...new Set(all.map((p) => p.status).filter(Boolean))].sort(), [all]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return all.filter((p) => {
      if (needle && !`${p.name} ${p.locationText} ${p.entityName} ${clientName.get(p.clientId) ?? ""}`.toLowerCase().includes(needle)) return false;
      if (state !== ALL && p.state !== state) return false;
      if (type !== ALL && p.propertyType !== type) return false;
      if (status !== ALL && p.status !== status) return false;
      if (accountant !== ALL && clientAccountant.get(p.clientId) !== accountant) return false;
      if (depreciation === "yes" && !p.hasDepreciationSchedule) return false;
      if (depreciation === "no" && p.hasDepreciationSchedule) return false;
      return true;
    });
  }, [all, query, state, type, status, accountant, depreciation, clientName, clientAccountant]);

  const value = filtered.reduce((sum, p) => sum + (Number(p.estimatedMarketValue) || 0), 0);
  const loans = filtered.reduce((sum, p) => sum + p.loanBalance, 0);
  const withDep = filtered.filter((p) => p.hasDepreciationSchedule).length;

  return (
    <>
      <PageHeader
        title="Properties report"
        subtitle="Value, loans and equity for every property, with status and location."
        actions={
          <ExportMenu
            variant="dark"
            build={() => ({
              title: "Properties report",
              filename: "properties",
              context: [`${filtered.length} properties · equity ${formatCompactMoney(value - loans)}`],
              columns: [
                { header: "Property", value: (p: OrgProperty) => p.name },
                { header: "Location", value: (p: OrgProperty) => p.locationText },
                { header: "State", value: (p: OrgProperty) => p.state },
                { header: "Client", value: (p: OrgProperty) => clientName.get(p.clientId) },
                { header: "Owned by", value: (p: OrgProperty) => p.entityName },
                { header: "Accountant", value: (p: OrgProperty) => clientAccountantName.get(p.clientId) || "Unassigned" },
                { header: "Type", value: (p: OrgProperty) => titleCase(p.propertyType) },
                { header: "Status", value: (p: OrgProperty) => p.status },
                { header: "Value (AUD)", value: (p: OrgProperty) => p.estimatedMarketValue },
                { header: "Loan (AUD)", value: (p: OrgProperty) => p.loanBalance },
                { header: "Equity (AUD)", value: (p: OrgProperty) => p.equity },
                { header: "Depreciation schedule", value: (p: OrgProperty) => (p.hasDepreciationSchedule ? "Yes" : "No") },
              ],
              rows: filtered,
            })}
          />
        }
      />

      {portfolio.error ? <Notice tone="red" title="Couldn't load properties">{portfolio.error.message}</Notice> : null}
      {portfolio.data?.failedCalls ? (
        <Notice tone="amber" title="Some portfolios couldn't be loaded">
          {portfolio.data.failedCalls} entity or property requests failed, so totals may be incomplete.
        </Notice>
      ) : null}

      <FilterBar>
        <SearchField id="p-q" value={query} onChange={setQuery} placeholder="Address, entity or client" />
        <SelectField id="p-state" label="State" value={state} onChange={setState} options={STATE_OPTIONS} />
        <SelectField
          id="p-type"
          label="Type"
          value={type}
          onChange={setType}
          options={[
            { value: ALL, label: "All types" },
            { value: "residential", label: "Residential" },
            { value: "commercial", label: "Commercial" },
            { value: "vacant_land", label: "Vacant land" },
          ]}
        />
        <SelectField id="p-status" label="Status" value={status} onChange={setStatus} options={[{ value: ALL, label: "All statuses" }, ...statuses.map((s) => ({ value: s, label: s }))]} />
        <SelectField
          id="p-acc"
          label="Accountant"
          value={accountant}
          onChange={setAccountant}
          options={[{ value: ALL, label: "All accountants" }, ...(people.data?.accountants ?? []).map((a) => ({ value: a.id, label: a.name || a.email }))]}
        />
        <SelectField
          id="p-dep"
          label="Depreciation"
          value={depreciation}
          onChange={setDepreciation}
          options={[
            { value: ALL, label: "Any" },
            { value: "yes", label: "Has schedule" },
            { value: "no", label: "No schedule" },
          ]}
        />
      </FilterBar>

      <KpiGrid>
        <Kpi label="Properties" loading={portfolio.isLoading} value={formatNumber(filtered.length)} hint={`${formatNumber(all.length)} in total`} />
        <Kpi label="Market value" loading={portfolio.isLoading} value={formatCompactMoney(value)} hint="estimated" />
        <Kpi label="Loan balance" loading={portfolio.isLoading} value={formatCompactMoney(loans)} hint={`LVR ${formatPercent(share(loans, value))}`} />
        <Kpi label="Equity" tone="good" loading={portfolio.isLoading} value={formatCompactMoney(value - loans)} hint="value − loans" />
        <Kpi label="With depreciation" loading={portfolio.isLoading} value={formatNumber(withDep)} hint={`${formatPercent(share(withDep, filtered.length))} have a schedule`} />
      </KpiGrid>

      <div className="cpc-grid-3">
        <Card title="By status" meta={`${filtered.length} properties`}>
          <BarList
            loading={portfolio.isLoading}
            labelWidth="9.5em"
            rows={countBy(filtered, (p) => p.status || "Not set").map(([label, n]) => ({
              key: label,
              label,
              value: n,
              color: STATUS_COLORS[label] ?? "var(--cpc-gray)",
              display: (
                <>
                  {n} <span>{formatPercent(share(n, filtered.length))}</span>
                </>
              ),
            }))}
          />
        </Card>
        <Card title="By type" meta="Value · count">
          <BarList
            loading={portfolio.isLoading}
            labelWidth="7.5em"
            rows={sumBy(filtered, (p) => titleCase(p.propertyType), (p) => Number(p.estimatedMarketValue) || 0).map(([label, v]) => ({
              key: label,
              label,
              value: v,
              display: (
                <>
                  {formatCompactMoney(v)} <span>· {filtered.filter((p) => titleCase(p.propertyType) === label).length}</span>
                </>
              ),
            }))}
          />
        </Card>
        <Card title="By state" meta="Properties">
          <BarList loading={portfolio.isLoading} labelWidth="5em" color="var(--cpc-amber)" rows={countBy(filtered, (p) => p.state).map(([label, n]) => ({ key: label, label, value: n }))} />
        </Card>
      </div>

      <Card flush title="All properties" meta={`${formatNumber(filtered.length)} match these filters`}>
        <DataTable<OrgProperty>
          caption="Properties"
          loading={portfolio.isLoading}
          rows={filtered}
          rowKey={(p) => p.id}
          pageSize={20}
          initialSort={{ id: "equity", direction: "desc" }}
          empty={<EmptyState title="No properties match these filters" />}
          columns={[
            { id: "name", header: "Property", cell: (p) => <div><div className="cpc-strong">{p.name}</div><div className="cpc-person-sub">{p.locationText}</div></div>, sortValue: (p) => p.name },
            {
              id: "client",
              header: "Client",
              cell: (p) => (
                <Link className="cpc-person-name" href={`/dashboard/admin/clients/${encodeURIComponent(p.clientId)}`}>
                  {clientName.get(p.clientId) ?? "—"}
                </Link>
              ),
              sortValue: (p) => clientName.get(p.clientId) ?? "",
            },
            { id: "entity", header: "Owned by", cell: (p) => <span className="cpc-muted">{p.entityName}</span>, sortValue: (p) => p.entityName },
            { id: "acc", header: "Accountant", cell: (p) => <span className="cpc-muted">{clientAccountantName.get(p.clientId) || "Unassigned"}</span> },
            { id: "type", header: "Type", cell: (p) => titleCase(p.propertyType), sortValue: (p) => p.propertyType },
            { id: "status", header: "Status", cell: (p) => (p.status ? <Badge tone="gray">{p.status}</Badge> : "—"), sortValue: (p) => p.status },
            { id: "value", header: "Value", align: "right", cell: (p) => formatCompactMoney(p.estimatedMarketValue), sortValue: (p) => p.estimatedMarketValue },
            { id: "loan", header: "Loan", align: "right", cell: (p) => formatCompactMoney(p.loanBalance), sortValue: (p) => p.loanBalance },
            { id: "equity", header: "Equity", align: "right", cell: (p) => formatCompactMoney(p.equity), sortValue: (p) => p.equity },
            { id: "dep", header: "Depreciation", cell: (p) => (p.hasDepreciationSchedule ? <Badge tone="green">Yes</Badge> : <span className="cpc-muted">No</span>) },
          ]}
        />
      </Card>
    </>
  );
}
