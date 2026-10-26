"use client";

import { useMemo, useState } from "react";
import { DataTable } from "../../_console/components/DataTable";
import { Badge, Card, EmptyState, Field, FilterBar, Kpi, KpiGrid, PageHeader, Presets, SearchField, SelectField } from "../../_console/components/ui";
import { formatNumber } from "../../_console/lib/format";
import { SAMPLE_AUDIT, type AuditEvent, type AuditKind } from "../../_console/lib/workspaceData";

type Range = "today" | "7d" | "30d" | "fy";

const KIND_TONE: Record<AuditKind, "blue" | "gray" | "red" | "purple" | "teal"> = {
  "Data change": "blue",
  Export: "gray",
  "Failed access": "red",
  "Admin action": "purple",
  "Sign-in": "teal",
};
const KINDS = Object.keys(KIND_TONE) as AuditKind[];
const MAX_DAYS: Record<Range, number> = { today: 0, "7d": 6, "30d": 29, fy: 365 };

function whenLabel(event: AuditEvent) {
  if (event.daysAgo === 0) return `Today, ${event.time}`;
  if (event.daysAgo === 1) return `Yesterday, ${event.time}`;
  return `${event.daysAgo} days ago, ${event.time}`;
}

export default function SuperAdminAuditPage() {
  const [range, setRange] = useState<Range>("7d");
  const [query, setQuery] = useState("");
  const [org, setOrg] = useState("all");
  const [kind, setKind] = useState<"all" | AuditKind>("all");
  const [role, setRole] = useState("all");

  const orgs = useMemo(() => [...new Set(SAMPLE_AUDIT.map((event) => event.org))].sort(), []);
  const roles = useMemo(() => [...new Set(SAMPLE_AUDIT.map((event) => event.role).filter((value) => value !== "—"))].sort(), []);

  const inRange = SAMPLE_AUDIT.filter((event) => event.daysAgo <= MAX_DAYS[range]);
  const visible = inRange.filter((event) => {
    const needle = query.trim().toLowerCase();
    if (needle && !`${event.what} ${event.who} ${event.before} ${event.after} ${event.org}`.toLowerCase().includes(needle)) return false;
    if (org !== "all" && event.org !== org) return false;
    if (kind !== "all" && event.kind !== kind) return false;
    if (role !== "all" && event.role !== role) return false;
    return true;
  });
  const countKind = (value: AuditKind) => inRange.filter((event) => event.kind === value).length;

  return (
    <>
      <PageHeader title="Audit log" subtitle="Every data change, export, failed sign-in and admin action across every organisation. Read-only." />

      <KpiGrid>
        <Kpi label="Events" value={formatNumber(inRange.length)} hint={`${orgs.length} organisations`} />
        <Kpi label="Data changes" value={formatNumber(countKind("Data change"))} hint="added, edited, deleted" />
        <Kpi label="Exports" value={formatNumber(countKind("Export"))} hint="files downloaded" />
        <Kpi label="Failed access" value={formatNumber(countKind("Failed access"))} hint="wrong password · blocked screen" />
        <Kpi label="Admin actions" value={formatNumber(countKind("Admin action"))} hint="roles, permissions, rules" />
      </KpiGrid>

      <FilterBar>
        <Field label="Time">
          <Presets
            label="Time"
            value={range}
            onChange={setRange}
            items={[
              { id: "today", label: "Today" },
              { id: "7d", label: "Last 7 days" },
              { id: "30d", label: "Last 30 days" },
              { id: "fy", label: "This FY" },
            ]}
          />
        </Field>
        <SearchField id="au-q" value={query} onChange={setQuery} placeholder="Record, value, email" />
        <SelectField id="au-o" label="Organisation" value={org} onChange={setOrg} options={[{ value: "all", label: "All organisations" }, ...orgs.map((value) => ({ value, label: value }))]} />
        <SelectField id="au-k" label="Kind" value={kind} onChange={setKind} options={[{ value: "all", label: "All kinds" }, ...KINDS.map((value) => ({ value, label: value }))]} />
        <SelectField id="au-r" label="Role" value={role} onChange={setRole} options={[{ value: "all", label: "All roles" }, ...roles.map((value) => ({ value, label: value }))]} />
      </FilterBar>

      <Card flush>
        <DataTable<AuditEvent>
          caption="Audit log"
          rows={visible}
          rowKey={(event) => event.id}
          pageSize={20}
          footer={`${visible.length} events · logs kept for 7 years`}
          empty={<EmptyState title="No events match these filters" />}
          columns={[
            { id: "when", header: "When", cell: (event) => <span className="cpc-small cpc-num">{whenLabel(event)}</span>, sortValue: (event) => -event.daysAgo * 10000 + Number(event.time.replace(":", "")) },
            { id: "kind", header: "Kind", cell: (event) => <Badge tone={KIND_TONE[event.kind]}>{event.kind}</Badge>, sortValue: (event) => event.kind },
            { id: "org", header: "Organisation", cell: (event) => event.org, sortValue: (event) => event.org },
            {
              id: "who",
              header: "Done by",
              cell: (event) => (
                <div>
                  <div>{event.who}</div>
                  <div className="cpc-person-sub">{event.role}</div>
                </div>
              ),
            },
            {
              id: "what",
              header: "What",
              cell: (event) => (
                <div>
                  <div>{event.what}</div>
                  <div className="cpc-person-sub">{event.module}</div>
                </div>
              ),
            },
            {
              id: "change",
              header: "Before → after",
              cell: (event) => (
                <span className="cpc-small">
                  <span className="cpc-muted">{event.before}</span> → <strong>{event.after}</strong>
                </span>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
