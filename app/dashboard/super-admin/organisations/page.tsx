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
import { formatDate, formatNumber, titleCase } from "../../_console/lib/format";
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
      if (created !== "any") {
        const time = row.createdAt ? new Date(row.createdAt).getTime() : NaN;
        if (Number.isNaN(time)) return false;
        if (created === "30d" && now - time > 30 * 86_400_000) return false;
        if (created === "year" && new Date(time).getFullYear() !== new Date().getFullYear()) return false;
      }
      return true;
    });
  }, [rows, query, plan, state, created, now]);

  const visible = filtered.filter((row) => tab === "all" || row.status === tab);
  const count = (value: OrgStatus) => rows.filter((row) => row.status === value).length;
  const loading = orgs.isLoading || admins.isLoading;

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
        <Kpi label="Avg clients" value="—" hint={<ApiPending>Needs platform totals API</ApiPending>} />
        <Kpi label="Avg equity" value="—" hint={<ApiPending>Needs platform totals API</ApiPending>} />
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
          footer={`${visible.length} organisations · accountant, client and equity totals appear once the platform totals API is connected`}
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
            { id: "acc", header: "Accountants", align: "right", cell: () => "—" },
            { id: "rms", header: "RMs", align: "right", cell: () => "—" },
            { id: "clients", header: "Clients", align: "right", cell: () => "—" },
            { id: "props", header: "Properties", align: "right", cell: () => "—" },
            { id: "equity", header: "Equity", align: "right", cell: () => "—" },
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
