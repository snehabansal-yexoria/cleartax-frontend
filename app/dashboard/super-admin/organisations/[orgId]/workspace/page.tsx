"use client";

import Link from "next/link";
import { WorkspaceBanner, useWorkspaceOrg, workspacePath } from "../../../../_console/components/Workspace";
import { ApiPending, BackLink, Card, Kpi, KpiGrid, Notice, PageHeader, Skeleton } from "../../../../_console/components/ui";
import { formatCompactMoney, formatNumber } from "../../../../_console/lib/format";
import { orgMetrics } from "../../../../_console/lib/sampleData";
import { currentAdmin } from "../../../../_console/lib/superAdminData";

const TOTALS = "Needs organisation totals API";

export default function OrganisationWorkspacePage() {
  const { orgId, org, rows, loading } = useWorkspaceOrg();

  if (!loading && !org) {
    return (
      <>
        <PageHeader title="Organisation" crumbs={[{ label: "Organisations", href: "/dashboard/super-admin/organisations" }, { label: "Not found" }]} />
        <Notice tone="red" title="Organisation not found">It may have been removed, or the link is out of date.</Notice>
      </>
    );
  }

  const metrics = org ? orgMetrics(org.id) : null;
  const admin = org ? currentAdmin(org) : null;
  const place = [org?.city, org?.state].filter(Boolean).join(" ");
  const value = (n: number | undefined, money = false) => (metrics ? (money ? formatCompactMoney(n) : formatNumber(n)) : "—");
  const hint = (text: string) => (metrics ? text : <ApiPending>{TOTALS}</ApiPending>);

  const areas = [
    { title: "Users & roles", text: "Create, disable, reactivate, assign Admin and other roles", href: workspacePath(orgId, "users") },
    { title: "Permissions", text: "Who can open each screen, report and export", href: workspacePath(orgId, "permissions") },
    { title: "Data settings & rules", text: "Edit lists and lock the ones admins can’t change", href: workspacePath(orgId, "data-settings") },
    { title: "Organisation details", text: "Admin, address and admin history", href: `/dashboard/super-admin/organisations/${encodeURIComponent(orgId)}` },
  ];

  return (
    <>
      <WorkspaceBanner org={org} rows={rows} />
      <BackLink href="/dashboard/super-admin/organisations">Back to organisations</BackLink>
      <PageHeader
        title={org ? org.name : <Skeleton width="14em" height="1.6em" />}
        subtitle={[admin ? `Admin: ${admin.name || admin.email}` : null, place || null].filter(Boolean).join(" · ") || undefined}
      />

      <KpiGrid>
        <Kpi label="Portfolio value" loading={loading} value={value(metrics?.equity, true)} hint={hint("equity managed")} />
        <Kpi label="Clients" loading={loading} value={value(metrics?.clients)} hint={hint(`+${formatNumber(metrics ? metrics.clients - metrics.clientsByMonth[10] : 0)} this month`)} />
        <Kpi label="Accountants" loading={loading} value={value(metrics?.accountants)} hint={hint(`${metrics?.rms ?? 0} relationship managers`)} />
        <Kpi label="Properties" loading={loading} value={value(metrics?.properties)} hint={hint(`${formatNumber(metrics?.entities)} entities`)} />
        <Kpi label="Documents" loading={loading} value={value(metrics?.documents)} hint={hint("in the vault")} />
      </KpiGrid>

      <div className="cpc-section-label">What you can do here</div>
      <div className="cpc-grid-2">
        {areas.map((area) => (
          <Link key={area.title} href={area.href} style={{ textDecoration: "none", color: "inherit" }}>
            <Card title={area.title}>
              <p className="cpc-muted cpc-small">{area.text}</p>
              <span className="cpc-link" style={{ display: "inline-block", marginTop: "0.8em" }}>
                Open →
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
