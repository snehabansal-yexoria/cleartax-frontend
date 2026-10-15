"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ChangeAdminDialog } from "../../_console/components/ChangeAdminDialog";
import { DataTable } from "../../_console/components/DataTable";
import { ExportMenu } from "../../_console/components/ExportMenu";
import { PlusIcon } from "../../_console/components/icons";
import {
  ApiPending,
  Badge,
  Card,
  EmptyState,
  Field,
  FilterBar,
  Kpi,
  KpiGrid,
  Notice,
  PageHeader,
  Person,
  SearchField,
  SelectField,
  Tabs,
} from "../../_console/components/ui";
import { formatCompactMoney, formatDate, formatNumber, titleCase } from "../../_console/lib/format";
import { SHOW_SAMPLE_DATA, orgMetrics } from "../../_console/lib/sampleData";
import {
  ORG_STATUS_LABEL,
  currentAdmin,
  joinOrganisations,
  useAdmins,
  useOrganisations,
  type OrgStatus,
  type OrganisationRow,
} from "../../_console/lib/superAdminData";

type Tab = "all" | OrgStatus;
type Created = "any" | "30d" | "year";
type ClientBand = "any" | "lt100" | "100-300" | "gt300";
type EquityBand = "any" | "lt100" | "100-300" | "gt300";

const inBand = (value: number | undefined, band: ClientBand | EquityBand, unit = 1) => {
  if (band === "any") return true;
  if (value == null) return false;
  const v = value / unit;
  return band === "lt100" ? v < 100 : band === "100-300" ? v >= 100 && v <= 300 : v > 300;
};

const ALL = "all";
const TOTALS_REASON = "Needs per-organisation totals from the backend";

export default function SuperAdminOrganisationsPage() {
  const params = useSearchParams();
  const orgs = useOrganisations();
  const admins = useAdmins();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [tab, setTab] = useState<Tab>("all");
  const [plan, setPlan] = useState(ALL);
  const [state, setState] = useState(ALL);
  const [created, setCreated] = useState<Created>("any");
  const [clientBand, setClientBand] = useState<ClientBand>("any");
  const [equityBand, setEquityBand] = useState<EquityBand>("any");
  const [changeFor, setChangeFor] = useState<OrganisationRow | null>(null);
  const [now] = useState(() => Date.now());

  const rows = useMemo(() => joinOrganisations(orgs.data, admins.data), [orgs.data, admins.data]);
  const plans = useMemo(() => [...new Set(rows.map((row) => row.subscriptionPlan).filter(Boolean) as string[])].sort(), [rows]);
  const states = useMemo(() => [...new Set(rows.map((row) => row.state).filter(Boolean) as string[])].sort(), [rows]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (needle) {
        const admin = currentAdmin(row);
        const hay = `${row.name} ${row.email} ${admin?.name ?? ""} ${admin?.email ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (plan !== ALL && row.subscriptionPlan !== plan) return false;
      if (state !== ALL && row.state !== state) return false;
      if (!inBand(orgMetrics(row.id)?.clients, clientBand)) return false;
      if (!inBand(orgMetrics(row.id)?.equity, equityBand, 1_000_000)) return false;
      if (created !== "any") {
        const time = row.createdAt ? new Date(row.createdAt).getTime() : NaN;
        if (Number.isNaN(time)) return false;
        if (created === "30d" && now - time > 30 * 86_400_000) return false;
        if (created === "year" && new Date(time).getFullYear() !== new Date().getFullYear()) return false;
      }
      return true;
    });
  }, [rows, query, plan, state, created, now, clientBand, equityBand]);

  const visible = filtered.filter((row) => tab === "all" || row.status === tab);
  const count = (value: OrgStatus) => rows.filter((row) => row.status === value).length;
  const loading = orgs.isLoading || admins.isLoading;
  const metrics = rows.map((row) => orgMetrics(row.id)).filter((m) => m != null);
  const avg = (pick: (m: NonNullable<ReturnType<typeof orgMetrics>>) => number) =>
    metrics.length ? metrics.reduce((sum, m) => sum + pick(m), 0) / metrics.length : null;
  const avgClients = avg((m) => m.clients);
  const avgEquity = avg((m) => m.equity);

  return (
    <>
      <PageHeader
        title="Organisations"
        subtitle="Each organisation has one admin who runs it day to day."
        actions={
          <>
            <ExportMenu
              build={() => ({
                title: "Organisations",
                filename: "organisations",
                context: [`${visible.length} organisations`],
                columns: [
                  { header: "Organisation", value: (row: OrganisationRow) => row.name },
                  { header: "Contact email", value: (row: OrganisationRow) => row.email },
                  { header: "Admin", value: (row: OrganisationRow) => currentAdmin(row)?.name ?? "" },
                  { header: "Admin email", value: (row: OrganisationRow) => currentAdmin(row)?.email ?? "" },
                  { header: "Status", value: (row: OrganisationRow) => ORG_STATUS_LABEL[row.status].label },
                  { header: "Plan", value: (row: OrganisationRow) => row.subscriptionPlan ?? "" },
                  { header: "Accountants", value: (row: OrganisationRow) => orgMetrics(row.id)?.accountants },
                  { header: "RMs", value: (row: OrganisationRow) => orgMetrics(row.id)?.rms },
                  { header: "Clients", value: (row: OrganisationRow) => orgMetrics(row.id)?.clients },
                  { header: "Properties", value: (row: OrganisationRow) => orgMetrics(row.id)?.properties },
                  { header: "Equity", value: (row: OrganisationRow) => orgMetrics(row.id)?.equity },
                  { header: "State", value: (row: OrganisationRow) => row.state ?? "" },
                  { header: "Created", value: (row: OrganisationRow) => formatDate(row.createdAt) },
                ],
                rows: visible,
              })}
            />
            <Link className="cpc-btn cpc-btn-primary" href="/dashboard/super-admin/create-organization">
              <PlusIcon />
              Add organisation
            </Link>
          </>
        }
      />

      {orgs.error ? <Notice tone="red" title="Couldn't load organisations">{orgs.error.message}</Notice> : null}

      <KpiGrid>
        <Kpi label="Active" tone="good" loading={loading} value={formatNumber(count("active"))} hint="running normally" />
        <Kpi label="Onboarding" tone="warn" loading={loading} value={formatNumber(count("onboarding"))} hint="admin invite pending" />
        <Kpi label="Suspended" tone="bad" loading={loading} value={formatNumber(count("suspended"))} hint="no access, data kept" />
        <Kpi
          label="Avg clients"
          loading={loading}
          value={formatNumber(avgClients == null ? null : Math.round(avgClients))}
          hint={avgClients == null ? <ApiPending>Needs platform totals API</ApiPending> : "per organisation"}
        />
        <Kpi
          label="Avg equity"
          loading={loading}
          value={formatCompactMoney(avgEquity)}
          hint={avgEquity == null ? <ApiPending>Needs platform totals API</ApiPending> : "per organisation"}
        />
      </KpiGrid>

      <FilterBar>
        <SearchField id="o-q" value={query} onChange={setQuery} placeholder="Organisation or admin name" />
        <SelectField
          id="o-status"
          label="Status"
          value={tab}
          onChange={setTab}
          options={[
            { value: "all", label: "All statuses" },
            { value: "active", label: "Active" },
            { value: "onboarding", label: "Onboarding" },
            { value: "suspended", label: "Suspended" },
          ]}
        />
        <SelectField
          id="o-plan"
          label="Plan"
          value={plan}
          onChange={setPlan}
          options={[{ value: ALL, label: "All plans" }, ...plans.map((value) => ({ value, label: titleCase(value) }))]}
        />
        {SHOW_SAMPLE_DATA ? (
          <>
            <SelectField
              id="o-clients"
              label="Clients"
              value={clientBand}
              onChange={setClientBand}
              options={[
                { value: "any", label: "Any" },
                { value: "lt100", label: "Under 100" },
                { value: "100-300", label: "100 – 300" },
                { value: "gt300", label: "Over 300" },
              ]}
            />
            <SelectField
              id="o-equity"
              label="Equity"
              value={equityBand}
              onChange={setEquityBand}
              options={[
                { value: "any", label: "Any" },
                { value: "lt100", label: "Under $100M" },
                { value: "100-300", label: "$100M – $300M" },
                { value: "gt300", label: "Over $300M" },
              ]}
            />
          </>
        ) : (
          <>
            <Field label="Clients" htmlFor="o-clients">
              <select id="o-clients" className="cpc-select" disabled title={TOTALS_REASON}>
                <option>Any</option>
              </select>
            </Field>
            <Field label="Equity" htmlFor="o-equity">
              <select id="o-equity" className="cpc-select" disabled title={TOTALS_REASON}>
                <option>Any</option>
              </select>
            </Field>
          </>
        )}
        <SelectField
          id="o-state"
          label="State"
          value={state}
          onChange={setState}
          options={[{ value: ALL, label: "All states" }, ...states.map((value) => ({ value, label: value }))]}
        />
        <SelectField
          id="o-created"
          label="Created"
          value={created}
          onChange={setCreated}
          options={[
            { value: "any", label: "Any time" },
            { value: "30d", label: "Last 30 days" },
            { value: "year", label: "This year" },
          ]}
        />
      </FilterBar>

      <Card flush>
        <div style={{ padding: "0 1em" }}>
          <Tabs
            label="Organisation status"
            value={tab}
            onChange={setTab}
            items={[
              { id: "all", label: "All", count: filtered.length },
              { id: "active", label: "Active", count: filtered.filter((r) => r.status === "active").length },
              { id: "onboarding", label: "Onboarding", count: filtered.filter((r) => r.status === "onboarding").length },
              { id: "suspended", label: "Suspended", count: filtered.filter((r) => r.status === "suspended").length },
            ]}
          />
        </div>
        <DataTable<OrganisationRow>
          caption="Organisations"
          loading={loading}
          rows={visible}
          rowKey={(row) => row.id}
          initialSort={{ id: "name", direction: "asc" }}
          footer={SHOW_SAMPLE_DATA ? `${visible.length} organisations` : `${visible.length} organisations · accountant, client and equity totals appear once the platform totals API is connected`}
          empty={<EmptyState title="No organisations match these filters" />}
          columns={[
            {
              id: "name",
              header: "Organisation",
              cell: (row) => <Person name={row.name} sub={row.email} href={`/dashboard/super-admin/organisations/${encodeURIComponent(row.id)}`} />,
              sortValue: (row) => row.name,
            },
            {
              id: "admin",
              header: "Admin",
              cell: (row) => {
                const admin = currentAdmin(row);
                if (!admin) return <span className="cpc-muted">—</span>;
                return row.status === "onboarding" ? `${admin.name || admin.email} (invited)` : admin.name || admin.email;
              },
              sortValue: (row) => currentAdmin(row)?.name ?? "",
            },
            {
              id: "status",
              header: "Status",
              cell: (row) => (
                <Badge tone={ORG_STATUS_LABEL[row.status].tone} dot>
                  {ORG_STATUS_LABEL[row.status].label}
                </Badge>
              ),
              sortValue: (row) => row.status,
            },
            { id: "acc", header: "Accountants", align: "right", cell: (row) => formatNumber(orgMetrics(row.id)?.accountants), sortValue: (row) => orgMetrics(row.id)?.accountants ?? 0 },
            { id: "rms", header: "RMs", align: "right", cell: (row) => formatNumber(orgMetrics(row.id)?.rms), sortValue: (row) => orgMetrics(row.id)?.rms ?? 0 },
            { id: "clients", header: "Clients", align: "right", cell: (row) => formatNumber(orgMetrics(row.id)?.clients), sortValue: (row) => orgMetrics(row.id)?.clients ?? 0 },
            { id: "props", header: "Properties", align: "right", cell: (row) => formatNumber(orgMetrics(row.id)?.properties), sortValue: (row) => orgMetrics(row.id)?.properties ?? 0 },
            {
              id: "equity",
              header: "Equity",
              align: "right",
              cell: (row) => <span className="cpc-strong">{formatCompactMoney(orgMetrics(row.id)?.equity)}</span>,
              sortValue: (row) => orgMetrics(row.id)?.equity ?? 0,
            },
            { id: "state", header: "State", cell: (row) => row.state || "—", sortValue: (row) => row.state ?? "" },
            {
              id: "created",
              header: "Created",
              cell: (row) => <span className="cpc-small cpc-muted">{formatDate(row.createdAt)}</span>,
              sortValue: (row) => row.createdAt ?? "",
            },
            {
              id: "actions",
              header: "",
              cell: (row) => (
                <div className="cpc-actions" style={{ flexWrap: "nowrap" }}>
                  <Link className="cpc-btn cpc-btn-sm" href={`/dashboard/super-admin/organisations/${encodeURIComponent(row.id)}`}>
                    View
                  </Link>
                  <button type="button" className="cpc-btn cpc-btn-sm" onClick={() => setChangeFor(row)}>
                    {row.admins.length ? "Change admin" : "Invite admin"}
                  </button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <ChangeAdminDialog
        open={Boolean(changeFor)}
        onClose={() => setChangeFor(null)}
        organisation={changeFor}
        currentAdmin={changeFor ? currentAdmin(changeFor) : null}
        mode={changeFor?.admins.length ? "change" : "invite"}
      />
    </>
  );
}
