"use client";

import { useMemo, useState } from "react";
import { ACTIVITY_LABELS, type ActivityEvent, type ActivityKind } from "../lib/activity";
import { formatDateTime } from "../lib/format";
import { findPeriod, inPeriod, type PeriodId } from "../lib/metrics";
import { DataTable } from "./DataTable";
import { ExportMenu } from "./ExportMenu";
import { Badge, Card, EmptyState, Field, Person, Presets, SearchField, SelectField } from "./ui";

const ALL = "all";

const PRESETS: { id: PeriodId; label: string }[] = [
  { id: "month", label: "This month" },
  { id: "quarter", label: "This quarter" },
  { id: "fy-current", label: "This FY" },
  { id: "last-12", label: "Last 12 months" },
  { id: "all", label: "All time" },
];

/**
 * Filterable, exportable activity table. Used by the audit trail and by the
 * per-client and per-accountant pages.
 */
export function ActivityLog({
  events,
  loading,
  title = "Activity",
  filename = "activity-log",
  hideClient,
  hideActor,
}: {
  events: ActivityEvent[];
  loading?: boolean;
  title?: string;
  filename?: string;
  hideClient?: boolean;
  hideActor?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [preset, setPreset] = useState<PeriodId>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [actor, setActor] = useState(ALL);
  const [kind, setKind] = useState<string>(ALL);
  const [module, setModule] = useState(ALL);
  const [client, setClient] = useState(ALL);

  const actors = useMemo(() => [...new Set(events.map((event) => event.actorName))].sort(), [events]);
  const clients = useMemo(
    () => [...new Set(events.map((event) => event.clientName).filter((name) => name && name !== "—"))].sort(),
    [events],
  );
  const modules = useMemo(() => [...new Set(events.map((event) => event.module))].sort(), [events]);

  const filtered = useMemo(() => {
    const period = findPeriod(preset);
    const fromTime = from ? new Date(from).getTime() : null;
    const toTime = to ? new Date(to).getTime() + 86_400_000 : null;
    const needle = query.trim().toLowerCase();
    return events.filter((event) => {
      if (!inPeriod(event.at, period)) return false;
      const time = new Date(event.at).getTime();
      if (fromTime && time < fromTime) return false;
      if (toTime && time >= toTime) return false;
      if (actor !== ALL && event.actorName !== actor) return false;
      if (kind !== ALL && event.kind !== kind) return false;
      if (module !== ALL && event.module !== module) return false;
      if (client !== ALL && event.clientName !== client) return false;
      if (needle && !`${event.record} ${event.detail} ${event.actorName} ${event.clientName}`.toLowerCase().includes(needle)) {
        return false;
      }
      return true;
    });
  }, [events, preset, from, to, actor, kind, module, client, query]);

  return (
    <Card
      flush
      title={title}
      meta="Built from create and update stamps on every record. Logs are read-only."
      actions={
        <ExportMenu
          small
          variant="dark"
          label="Export log"
          build={() => ({
            title,
            filename,
            context: [`${filtered.length} events`, `Exported from ClearPortfolio`],
            columns: [
              { header: "Timestamp", value: (e: ActivityEvent) => new Date(e.at).toISOString() },
              { header: "Action", value: (e: ActivityEvent) => e.action },
              { header: "Done by", value: (e: ActivityEvent) => e.actorName },
              { header: "Role", value: (e: ActivityEvent) => e.actorRole },
              { header: "Client", value: (e: ActivityEvent) => e.clientName },
              { header: "Module", value: (e: ActivityEvent) => e.module },
              { header: "Record", value: (e: ActivityEvent) => e.record },
              { header: "Detail", value: (e: ActivityEvent) => e.detail },
            ],
            rows: filtered,
          })}
        />
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "0.85em", padding: "0 1.45em 1.15em" }}>
        <Field label="Time">
          <Presets label="Time range" items={PRESETS} value={preset} onChange={setPreset} />
        </Field>
        <div className="cpc-form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 11em), 1fr))" }}>
          <SearchField id={`${filename}-q`} value={query} onChange={setQuery} placeholder="Record, value or name" />
          {!hideActor ? (
            <SelectField
              id={`${filename}-actor`}
              label="Done by"
              value={actor}
              onChange={setActor}
              options={[{ value: ALL, label: "Anyone" }, ...actors.map((name) => ({ value: name, label: name }))]}
            />
          ) : null}
          <SelectField
            id={`${filename}-kind`}
            label="Action"
            value={kind}
            onChange={setKind}
            options={[
              { value: ALL, label: "All actions" },
              ...(Object.keys(ACTIVITY_LABELS) as ActivityKind[]).map((key) => ({ value: key, label: ACTIVITY_LABELS[key].label })),
            ]}
          />
          <SelectField
            id={`${filename}-module`}
            label="Module"
            value={module}
            onChange={setModule}
            options={[{ value: ALL, label: "All modules" }, ...modules.map((name) => ({ value: name, label: name }))]}
          />
          {!hideClient ? (
            <SelectField
              id={`${filename}-client`}
              label="Client"
              value={client}
              onChange={setClient}
              options={[{ value: ALL, label: "All clients" }, ...clients.map((name) => ({ value: name, label: name }))]}
            />
          ) : null}
          <Field label="From" htmlFor={`${filename}-from`}>
            <input id={`${filename}-from`} className="cpc-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To" htmlFor={`${filename}-to`}>
            <input id={`${filename}-to`} className="cpc-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
      </div>
      <DataTable<ActivityEvent>
        caption={title}
        loading={loading}
        rows={filtered}
        rowKey={(event) => event.id}
        pageSize={20}
        initialSort={{ id: "at", direction: "desc" }}
        footer={`${filtered.length} events`}
        empty={<EmptyState title="No activity matches these filters" />}
        columns={[
          { id: "at", header: "Timestamp", cell: (e) => <span className="cpc-small cpc-num">{formatDateTime(e.at)}</span>, sortValue: (e) => e.at },
          { id: "action", header: "Action", cell: (e) => <Badge tone={ACTIVITY_LABELS[e.kind].tone}>{e.action}</Badge>, sortValue: (e) => e.action },
          ...(hideActor
            ? []
            : [{ id: "actor", header: "Done by", cell: (e: ActivityEvent) => <Person name={e.actorName} sub={e.actorRole} />, sortValue: (e: ActivityEvent) => e.actorName }]),
          ...(hideClient ? [] : [{ id: "client", header: "On client", cell: (e: ActivityEvent) => e.clientName, sortValue: (e: ActivityEvent) => e.clientName }]),
          { id: "record", header: "Module · record", cell: (e) => <div><div>{e.record}</div><div className="cpc-person-sub">{e.module}</div></div> },
          { id: "detail", header: "Detail", wrap: true, cell: (e) => e.detail },
        ]}
      />
    </Card>
  );
}
