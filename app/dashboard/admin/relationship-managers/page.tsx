"use client";

import { DataTable } from "../../_console/components/DataTable";
import { ApiPending, Card, EmptyState, Kpi, KpiGrid, Notice, PageHeader, PendingAction, Person, StatusBadge } from "../../_console/components/ui";
import { formatCompactMoney } from "../../_console/lib/format";
import { accountantStats, findPeriod, type AccountantStats } from "../../_console/lib/metrics";
import { useAdminWorkspace } from "../../_console/lib/useAdminWorkspace";

const ALL_TIME = findPeriod("all");

export default function AdminRelationshipManagersPage() {
  const { people, portfolio, transactions } = useAdminWorkspace();
  const stats = accountantStats(people.data?.accountants ?? [], people.data?.clients ?? [], portfolio.data, transactions.data, ALL_TIME);

  return (
    <>
      <PageHeader
        title="Relationship managers"
        subtitle="Each RM oversees several accountants and their clients with read-only access."
        actions={<PendingAction variant="primary" reason="The relationship manager role doesn't exist in the backend yet">Invite RM</PendingAction>}
      />

      <Notice tone="amber" title="Relationship managers aren't set up in the backend yet">
        The platform has admin, accountant and client roles today. Once an RM role and an RM → accountant link are added, this page groups
        accountants under their RM with clients, equity and transactions per RM, and lets you reassign accountants between RMs.
      </Notice>

      <KpiGrid>
        <Kpi label="Relationship managers" value="—" hint={<ApiPending />} />
        <Kpi label="Accountants without an RM" loading={people.isLoading} value={stats.length} hint="all accountants today" />
        <Kpi label="Clients they cover" loading={people.isLoading} value={stats.reduce((s, r) => s + r.clients, 0)} />
        <Kpi label="Equity they cover" loading={portfolio.isLoading} value={formatCompactMoney(stats.reduce((s, r) => s + r.equity, 0))} />
      </KpiGrid>

      <Card flush title="Accountants by RM" meta="Not assigned to an RM">
        <DataTable<AccountantStats>
          caption="Accountants by relationship manager"
          loading={people.isLoading}
          rows={stats}
          rowKey={(row) => row.accountant.id}
          empty={<EmptyState title="No accountants yet" />}
          columns={[
            {
              id: "name",
              header: "Accountant",
              cell: (row) => <Person name={row.accountant.name || row.accountant.email} sub={row.accountant.email} href={`/dashboard/admin/accountants/${encodeURIComponent(row.accountant.id)}`} />,
              sortValue: (row) => row.accountant.name,
            },
            { id: "status", header: "Status", cell: (row) => <StatusBadge status={row.accountant.status} /> },
            { id: "rm", header: "RM", cell: () => <span className="cpc-muted">Not assigned</span> },
            { id: "clients", header: "Clients", align: "right", cell: (row) => row.clients, sortValue: (row) => row.clients },
            { id: "props", header: "Properties", align: "right", cell: (row) => row.properties, sortValue: (row) => row.properties },
            { id: "equity", header: "Equity", align: "right", cell: (row) => formatCompactMoney(row.equity), sortValue: (row) => row.equity },
            { id: "change", header: "", cell: () => <PendingAction small reason="Needs the RM role in the backend">Assign RM</PendingAction> },
          ]}
        />
      </Card>
    </>
  );
}
