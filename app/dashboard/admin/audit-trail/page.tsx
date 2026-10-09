"use client";

import { useMemo, useState } from "react";
import { ActivityLog } from "../../_console/components/ActivityLog";
import { Kpi, KpiGrid, Notice, PageHeader } from "../../_console/components/ui";
import { buildActivity } from "../../_console/lib/activity";
import { formatNumber } from "../../_console/lib/format";
import { useAdminWorkspace } from "../../_console/lib/useAdminWorkspace";

export default function AdminAuditTrailPage() {
  const { people, portfolio } = useAdminWorkspace();
  const events = useMemo(() => buildActivity(people.data, portfolio.data), [people.data, portfolio.data]);
  const loading = people.isLoading || portfolio.isLoading;
  const [weekAgo] = useState(() => Date.now() - 7 * 86_400_000);
  const lastWeek = events.filter((event) => new Date(event.at).getTime() >= weekAgo);
  const count = (predicate: (kind: string) => boolean) => lastWeek.filter((event) => predicate(event.kind)).length;

  return (
    <>
      <PageHeader
        title="Audit trail"
        subtitle="Who did what, when, across the whole organisation. Read-only: no one can edit or delete these logs."
      />

      <Notice tone="blue" title="Before/after values arrive with the audit-log API">
        This log is built from the create and update stamps on users, entities, properties and bank statements. Field-level
        before → after changes, logins and exports will appear once the backend exposes an audit-log endpoint.
      </Notice>

      <KpiGrid>
        <Kpi label="Events" loading={loading} value={formatNumber(lastWeek.length)} hint="in the last 7 days" />
        <Kpi label="Invites" loading={loading} value={formatNumber(count((k) => k === "invite"))} hint="last 7 days" />
        <Kpi label="Records added" loading={loading} value={formatNumber(count((k) => k.endsWith("_created")))} hint="entities & properties" />
        <Kpi label="Records edited" loading={loading} value={formatNumber(count((k) => k.endsWith("_updated")))} hint="entities & properties" />
        <Kpi label="Statements uploaded" loading={loading} value={formatNumber(count((k) => k === "statement_uploaded"))} hint="last 7 days" />
        <Kpi label="All time" loading={loading} value={formatNumber(events.length)} hint="events recorded" />
      </KpiGrid>

      <ActivityLog events={events} loading={loading} title="Events" filename="audit-trail" />
    </>
  );
}
