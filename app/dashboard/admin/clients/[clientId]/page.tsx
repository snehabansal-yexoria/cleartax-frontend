"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { DataTable } from "../../../_console/components/DataTable";
import { ExportMenu } from "../../../_console/components/ExportMenu";
import { ActivityLog } from "../../../_console/components/ActivityLog";
import {
  ApiPending,
  Avatar,
  Badge,
  Card,
  EmptyState,
  Kpi,
  KpiGrid,
  Notice,
  PageHeader,
  PendingAction,
  Skeleton,
  StatusBadge,
  Tabs,
} from "../../../_console/components/ui";
import { buildActivity } from "../../../_console/lib/activity";
import { apiGet } from "../../../_console/lib/api";
import type { ClientRecord, OrgProperty, OrgTransaction } from "../../../_console/lib/adminData";
import { formatCompactMoney, formatDate, formatMoney, formatNumber, titleCase } from "../../../_console/lib/format";
import { entityTypeLabel, findPeriod, isStatementDone, rollupFor } from "../../../_console/lib/metrics";
import { useAdminWorkspace } from "../../../_console/lib/useAdminWorkspace";
import { useResource } from "../../../_console/lib/useResource";

type Tab = "overview" | "properties" | "entities" | "transactions" | "activity";
const ALL_TIME = findPeriod("all");

export default function AdminClientDetailPage() {
  const { clientId: rawId } = useParams<{ clientId: string }>();
  const clientId = decodeURIComponent(rawId);
  const { people, portfolio, transactions } = useAdminWorkspace();
  const [tab, setTab] = useState<Tab>("overview");

  const detail = useResource(`admin:client:${clientId}`, () =>
    apiGet<{ client: ClientRecord }>(`/api/users/me/clients/${encodeURIComponent(clientId)}`).then((data) => data.client),
  );
  const client = detail.data ?? people.data?.clients.find((item) => item.id === clientId);

  const ids = useMemo(() => new Set([clientId]), [clientId]);
  const rollup = rollupFor(ids, portfolio.data, transactions.data, ALL_TIME);
  const entities = useMemo(() => (portfolio.data?.entities ?? []).filter((e) => e.clientId === clientId), [portfolio.data, clientId]);
  const properties = useMemo(() => (portfolio.data?.properties ?? []).filter((p) => p.clientId === clientId), [portfolio.data, clientId]);
  const statements = useMemo(() => (portfolio.data?.statements ?? []).filter((s) => s.clientId === clientId), [portfolio.data, clientId]);
  const txns = useMemo(() => (transactions.data ?? []).filter((t) => t.clientId === clientId), [transactions.data, clientId]);
  const activity = useMemo(
    () => buildActivity(people.data, portfolio.data).filter((event) => event.clientId === clientId),
    [people.data, portfolio.data, clientId],
  );
  const entityName = new Map(entities.map((entity) => [entity.id, entity.name]));

  if (detail.error && !client) {
    return (
      <>
        <PageHeader title="Client" crumbs={[{ label: "Clients", href: "/dashboard/admin/clients" }, { label: "Not found" }]} />
        <Notice tone="red" title="We couldn't load this client">{detail.error.message}</Notice>
      </>
    );
  }

  const name = client?.name || client?.email || "Client";
  const entityTypes = [...new Set(entities.map((entity) => entity.entityType))];

  return (
    <>
      <PageHeader
        title={client ? name : <Skeleton width="12em" height="1.6em" />}
        crumbs={[{ label: "Clients", href: "/dashboard/admin/clients" }, { label: name }]}
        actions={
          <>
            <PendingAction reason="Needs an admin endpoint to reassign a client's accountant">Change accountant</PendingAction>
            <PendingAction reason="Relationship managers aren't set up in the backend yet">Change RM</PendingAction>
            <ExportMenu
              label="Export client report"
              build={() => ({
                title: `${name} · properties`,
                filename: `client-${name.toLowerCase().replace(/\s+/g, "-")}`,
                context: [`${properties.length} properties · equity ${formatMoney(rollup.equity)}`],
                columns: [
                  { header: "Property", value: (p: OrgProperty) => p.name },
                  { header: "Entity", value: (p: OrgProperty) => p.entityName },
                  { header: "Type", value: (p: OrgProperty) => titleCase(p.propertyType) },
                  { header: "Status", value: (p: OrgProperty) => p.status },
                  { header: "Value (AUD)", value: (p: OrgProperty) => p.estimatedMarketValue },
                  { header: "Loan (AUD)", value: (p: OrgProperty) => p.loanBalance },
                  { header: "Equity (AUD)", value: (p: OrgProperty) => p.equity },
                ],
                rows: properties,
              })}
            />
            <PendingAction variant="danger" reason="Needs a deactivate-user endpoint">
              Deactivate client
            </PendingAction>
          </>
        }
      />

      <Card>
        <div className="cpc-person" style={{ alignItems: "flex-start", gap: "1.15em", flexWrap: "wrap" }}>
          <Avatar name={name} large />
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45em" }}>
            <div style={{ display: "flex", gap: "0.6em", alignItems: "center", flexWrap: "wrap" }}>
              <span className="cpc-card-title" style={{ fontSize: "1.3em" }}>{name}</span>
              {client ? <StatusBadge status={client.status} /> : null}
              {entityTypes.map((type) => (
                <Badge key={type} tone="purple">{entityTypeLabel(type)}</Badge>
              ))}
            </div>
            <div className="cpc-small cpc-muted" style={{ display: "flex", gap: "1.3em", flexWrap: "wrap" }}>
              <span>{client?.email}</span>
              {client?.phoneNumber ? <span>{client.phoneNumber}</span> : null}
              <span>Joined {formatDate(client?.joinedAt)}</span>
            </div>
          </div>
        </div>
      </Card>

      <KpiGrid>
        <Kpi label="Properties" loading={portfolio.isLoading} value={rollup.properties} hint={`${formatCompactMoney(rollup.marketValue)} value`} />
        <Kpi label="Entities" loading={portfolio.isLoading} value={rollup.entities} hint={entityTypes.map(entityTypeLabel).join(" · ") || "None yet"} />
        <Kpi label="Equity" loading={portfolio.isLoading} value={formatCompactMoney(rollup.equity)} hint={`${formatCompactMoney(rollup.loans)} in loans`} />
        <Kpi label="Transactions" loading={transactions.isLoading} value={formatNumber(rollup.transactions)} hint={`${formatNumber(rollup.transactions - rollup.reviewed)} not reviewed`} />
        <Kpi label="Docs uploaded" value="—" hint={<ApiPending />} />
        <Kpi label="Bank statements" loading={portfolio.isLoading} value={rollup.statements} hint={`${rollup.statementsDone} processed`} />
      </KpiGrid>

      <Tabs
        label="Client sections"
        value={tab}
        onChange={setTab}
        items={[
          { id: "overview", label: "Overview" },
          { id: "properties", label: "Properties", count: properties.length },
          { id: "entities", label: "Entities", count: entities.length },
          { id: "transactions", label: "Transactions", count: txns.length },
          { id: "activity", label: "Activity log", count: activity.length },
        ]}
      />

      {tab === "overview" ? (
        <div className="cpc-grid-3">
          <Card title="Client information">
            <dl className="cpc-dl">
              <dt>Email</dt>
              <dd>{client?.email ?? "—"}</dd>
              <dt>Phone</dt>
              <dd>{client?.phoneNumber || "—"}</dd>
              <dt>Invited by</dt>
              <dd>{client?.invitedByEmail || "—"}</dd>
              <dt>Joined</dt>
              <dd>{formatDate(client?.joinedAt)}</dd>
              <dt>Tax details</dt>
              <dd className="cpc-muted">Visible to the client and their accountant</dd>
            </dl>
          </Card>
          <Card title="Assigned team">
            <div className="cpc-list">
              <div className="cpc-list-row">
                {client?.assignedAccountantId ? (
                  <Link className="cpc-person-name" href={`/dashboard/admin/accountants/${encodeURIComponent(client.assignedAccountantId)}`}>
                    {client.assignedAccountantName || "Assigned accountant"}
                  </Link>
                ) : (
                  <span className="cpc-muted">No accountant assigned</span>
                )}
                <PendingAction small reason="Needs an admin endpoint to reassign a client's accountant">Change</PendingAction>
              </div>
              <div className="cpc-list-row">
                <span className="cpc-muted">Relationship manager</span>
                <ApiPending />
              </div>
            </div>
          </Card>
          <Card title="Bank statements" meta={`${statements.filter(isStatementDone).length} of ${statements.length} processed`}>
            {statements.length === 0 ? (
              <p className="cpc-muted cpc-small">No bank statements uploaded yet.</p>
            ) : (
              <div className="cpc-list">
                {statements.slice(0, 6).map((statement) => (
                  <div key={statement.id} className="cpc-list-row">
                    <div>
                      <div>{entityName.get(statement.entityId) ?? "Entity"}</div>
                      <div className="cpc-person-sub">{formatDate(statement.createdAt)} · {statement.summary?.totalTransactions ?? 0} lines</div>
                    </div>
                    <Badge tone={isStatementDone(statement) ? "green" : "amber"}>{isStatementDone(statement) ? "Processed" : titleCase(statement.status || "pending")}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {tab === "properties" ? (
        <Card flush>
          <DataTable<OrgProperty>
            caption="Properties"
            loading={portfolio.isLoading}
            rows={properties}
            rowKey={(p) => p.id}
            initialSort={{ id: "equity", direction: "desc" }}
            empty={<EmptyState title="No properties yet" />}
            columns={[
              { id: "name", header: "Property", cell: (p) => <div><div className="cpc-strong">{p.name}</div><div className="cpc-person-sub">{p.locationText}</div></div>, sortValue: (p) => p.name },
              { id: "entity", header: "Owned by", cell: (p) => p.entityName, sortValue: (p) => p.entityName },
              { id: "type", header: "Type", cell: (p) => titleCase(p.propertyType) },
              { id: "status", header: "Status", cell: (p) => (p.status ? <Badge tone="gray">{p.status}</Badge> : "—") },
              { id: "value", header: "Value", align: "right", cell: (p) => formatCompactMoney(p.estimatedMarketValue), sortValue: (p) => p.estimatedMarketValue },
              { id: "loan", header: "Loan", align: "right", cell: (p) => formatCompactMoney(p.loanBalance), sortValue: (p) => p.loanBalance },
              { id: "equity", header: "Equity", align: "right", cell: (p) => formatCompactMoney(p.equity), sortValue: (p) => p.equity },
            ]}
          />
        </Card>
      ) : null}

      {tab === "entities" ? (
        <Card flush>
          <DataTable
            caption="Entities"
            loading={portfolio.isLoading}
            rows={entities}
            rowKey={(e) => e.id}
            empty={<EmptyState title="No entities yet" />}
            columns={[
              { id: "name", header: "Entity", cell: (e) => <span className="cpc-strong">{e.name}</span>, sortValue: (e) => e.name },
              { id: "type", header: "Type", cell: (e) => <Badge tone="purple">{entityTypeLabel(e.entityType)}</Badge>, sortValue: (e) => e.entityType },
              { id: "owners", header: "Beneficiaries", align: "right", cell: (e) => e.beneficiaries?.length ?? 0 },
              { id: "props", header: "Properties", align: "right", cell: (e) => properties.filter((p) => p.entityId === e.id).length },
              { id: "created", header: "Created", cell: (e) => formatDate(e.createdAt), sortValue: (e) => e.createdAt },
            ]}
          />
        </Card>
      ) : null}

      {tab === "transactions" ? (
        <Card flush>
          <DataTable<OrgTransaction>
            caption="Transactions"
            loading={transactions.isLoading}
            rows={txns}
            rowKey={(t) => t.id}
            initialSort={{ id: "date", direction: "desc" }}
            empty={<EmptyState title="No transactions yet" />}
            columns={[
              { id: "date", header: "Date", cell: (t) => formatDate(t.invoiceDate), sortValue: (t) => t.invoiceDate },
              { id: "property", header: "Property", cell: (t) => t.propertyNames.join(", ") || "—" },
              { id: "desc", header: "Description", wrap: true, cell: (t) => t.description || "—" },
              { id: "cat", header: "Category", cell: (t) => <Badge tone="gray">{t.categoryName || "Unclassified"}</Badge>, sortValue: (t) => t.categoryName },
              { id: "amount", header: "Amount", align: "right", cell: (t) => <span style={{ color: t.type === "revenue" ? "#0f6b4f" : "#a32d24" }}>{t.type === "revenue" ? "+" : "−"}{formatMoney(Math.abs(t.clientShareGross ?? t.grossAmount))}</span>, sortValue: (t) => t.grossAmount },
              { id: "status", header: "Review", cell: (t) => <Badge tone={t.reviewStatus === "reviewed" ? "green" : "amber"}>{t.reviewStatus === "reviewed" ? "Reviewed" : "Unreviewed"}</Badge> },
            ]}
          />
        </Card>
      ) : null}

      {tab === "activity" ? <ActivityLog events={activity} loading={people.isLoading || portfolio.isLoading} title={`Activity log for ${name}`} filename={`activity-${clientId}`} hideClient /> : null}
    </>
  );
}
