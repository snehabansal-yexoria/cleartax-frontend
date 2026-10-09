"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable } from "../../_console/components/DataTable";
import { ExportMenu } from "../../_console/components/ExportMenu";
import { Badge, Card, EmptyState, FilterBar, Kpi, KpiGrid, Notice, PageHeader, SearchField, SelectField } from "../../_console/components/ui";
import type { OrgEntity } from "../../_console/lib/adminData";
import { formatCompactMoney, formatDate, formatNumber } from "../../_console/lib/format";
import { countBy, entityTypeLabel } from "../../_console/lib/metrics";
import { ALL, ENTITY_TYPE_OPTIONS, useAdminWorkspace } from "../../_console/lib/useAdminWorkspace";

const TYPE_COLORS: Record<string, string> = {
  trust: "var(--cpc-purple)",
  smsf: "var(--cpc-teal)",
  individual: "var(--cpc-blue)",
  company: "var(--cpc-amber)",
  partnership: "var(--cpc-gray)",
};

type EntityRow = OrgEntity & { properties: number; equity: number };

export default function AdminEntitiesPage() {
  const { people, portfolio } = useAdminWorkspace();
  const [query, setQuery] = useState("");
  const [type, setType] = useState(ALL);
  const [accountant, setAccountant] = useState(ALL);
  const [owners, setOwners] = useState(ALL);

  const clients = useMemo(() => people.data?.clients ?? [], [people.data]);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const rows = useMemo<EntityRow[]>(() => {
    const props = portfolio.data?.properties ?? [];
    return (portfolio.data?.entities ?? []).map((entity) => {
      const owned = props.filter((p) => p.entityId === entity.id);
      return { ...entity, properties: owned.length, equity: owned.reduce((sum, p) => sum + p.equity, 0) };
    });
  }, [portfolio.data]);

  const filtered = rows.filter((row) => {
    const client = clientById.get(row.clientId);
    const needle = query.trim().toLowerCase();
    if (needle && !`${row.name} ${client?.name ?? ""}`.toLowerCase().includes(needle)) return false;
    if (type !== ALL && row.entityType !== type) return false;
    if (accountant !== ALL && client?.assignedAccountantId !== accountant) return false;
    const count = row.beneficiaries?.length ?? 0;
    if (owners === "single" && count > 1) return false;
    if (owners === "multiple" && count <= 1) return false;
    return true;
  });

  const byType = countBy(filtered, (row) => row.entityType);
  const equityByType = new Map<string, number>();
  for (const row of filtered) equityByType.set(row.entityType, (equityByType.get(row.entityType) ?? 0) + row.equity);

  return (
    <>
      <PageHeader
        title="Entities report"
        subtitle="Ownership structures: who owns what, and how much equity sits in each."
        actions={
          <ExportMenu
            variant="dark"
            build={() => ({
              title: "Entities report",
              filename: "entities",
              context: [`${filtered.length} entities`],
              columns: [
                { header: "Entity", value: (row: EntityRow) => row.name },
                { header: "Type", value: (row: EntityRow) => entityTypeLabel(row.entityType) },
                { header: "Client", value: (row: EntityRow) => clientById.get(row.clientId)?.name },
                { header: "Accountant", value: (row: EntityRow) => clientById.get(row.clientId)?.assignedAccountantName || "Unassigned" },
                { header: "Beneficiaries", value: (row: EntityRow) => row.beneficiaries?.length ?? 0 },
                { header: "Properties", value: (row: EntityRow) => row.properties },
                { header: "Equity (AUD)", value: (row: EntityRow) => Math.round(row.equity) },
                { header: "Created", value: (row: EntityRow) => formatDate(row.createdAt) },
              ],
              rows: filtered,
            })}
          />
        }
      />

      {portfolio.error ? <Notice tone="red" title="Couldn't load entities">{portfolio.error.message}</Notice> : null}

      <FilterBar>
        <SearchField id="e-q" value={query} onChange={setQuery} placeholder="Entity or client name" />
        <SelectField id="e-type" label="Type" value={type} onChange={setType} options={ENTITY_TYPE_OPTIONS} />
        <SelectField
          id="e-acc"
          label="Accountant"
          value={accountant}
          onChange={setAccountant}
          options={[{ value: ALL, label: "All accountants" }, ...(people.data?.accountants ?? []).map((a) => ({ value: a.id, label: a.name || a.email }))]}
        />
        <SelectField
          id="e-owners"
          label="Owners"
          value={owners}
          onChange={setOwners}
          options={[
            { value: ALL, label: "Any" },
            { value: "single", label: "Single owner" },
            { value: "multiple", label: "Multiple owners" },
          ]}
        />
      </FilterBar>

      <KpiGrid>
        <Kpi label="Entities" loading={portfolio.isLoading} value={formatNumber(filtered.length)} hint={`${formatNumber(rows.length)} in total`} />
        {byType.slice(0, 4).map(([entityType, n]) => (
          <Kpi key={entityType} label={entityTypeLabel(entityType)} loading={portfolio.isLoading} value={formatNumber(n)} hint={`${formatCompactMoney(equityByType.get(entityType) ?? 0)} equity`} />
        ))}
      </KpiGrid>

      {byType.length ? (
        <Card title="Entities by type" meta="Share of all entities">
          <div className="cpc-stack" style={{ height: "1.3em" }}>
            {byType.map(([entityType, n]) => (
              <span key={entityType} title={`${entityTypeLabel(entityType)}: ${n}`} style={{ width: `${(n / filtered.length) * 100}%`, background: TYPE_COLORS[entityType] ?? "var(--cpc-gray)" }} />
            ))}
          </div>
        </Card>
      ) : null}

      <Card flush title="All entities" meta={`${formatNumber(filtered.length)} match these filters`}>
        <DataTable<EntityRow>
          caption="Entities"
          loading={portfolio.isLoading}
          rows={filtered}
          rowKey={(row) => row.id}
          pageSize={20}
          initialSort={{ id: "equity", direction: "desc" }}
          empty={<EmptyState title="No entities match these filters" />}
          columns={[
            { id: "name", header: "Entity", cell: (row) => <span className="cpc-strong">{row.name}</span>, sortValue: (row) => row.name },
            { id: "type", header: "Type", cell: (row) => <Badge tone="purple">{entityTypeLabel(row.entityType)}</Badge>, sortValue: (row) => row.entityType },
            {
              id: "client",
              header: "Client",
              cell: (row) => (
                <Link className="cpc-person-name" href={`/dashboard/admin/clients/${encodeURIComponent(row.clientId)}`}>
                  {clientById.get(row.clientId)?.name ?? "—"}
                </Link>
              ),
              sortValue: (row) => clientById.get(row.clientId)?.name ?? "",
            },
            { id: "acc", header: "Accountant", cell: (row) => <span className="cpc-muted">{clientById.get(row.clientId)?.assignedAccountantName || "Unassigned"}</span> },
            { id: "owners", header: "Beneficiaries", align: "right", cell: (row) => row.beneficiaries?.length ?? 0, sortValue: (row) => row.beneficiaries?.length ?? 0 },
            { id: "props", header: "Properties", align: "right", cell: (row) => row.properties, sortValue: (row) => row.properties },
            { id: "equity", header: "Equity", align: "right", cell: (row) => formatCompactMoney(row.equity), sortValue: (row) => row.equity },
            { id: "created", header: "Created", cell: (row) => <span className="cpc-small cpc-muted">{formatDate(row.createdAt)}</span>, sortValue: (row) => row.createdAt },
          ]}
        />
      </Card>
    </>
  );
}
