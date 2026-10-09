"use client";

import { useMemo, useState } from "react";
import { DataTable } from "../../_console/components/DataTable";
import { ExportMenu } from "../../_console/components/ExportMenu";
import {
  Badge,
  BarList,
  Card,
  EmptyState,
  Field,
  Kpi,
  KpiGrid,
  Legend,
  Notice,
  PageHeader,
  Presets,
  SearchField,
  SelectField,
  Skeleton,
} from "../../_console/components/ui";
import type { OrgTransaction } from "../../_console/lib/adminData";
import { formatCompactMoney, formatDate, formatMoney, formatNumber, share } from "../../_console/lib/format";
import { findPeriod, inPeriod, sumBy, type PeriodId } from "../../_console/lib/metrics";
import { ALL, useAdminWorkspace } from "../../_console/lib/useAdminWorkspace";

type View = "all" | "unreviewed" | "revenue" | "expense" | "large";

const VIEWS: { id: View; label: string }[] = [
  { id: "all", label: "All transactions" },
  { id: "unreviewed", label: "Unreviewed" },
  { id: "revenue", label: "Revenue" },
  { id: "expense", label: "Expenses" },
  { id: "large", label: "Over $1K" },
];

const amountOf = (txn: OrgTransaction) => Math.abs(txn.clientShareGross ?? txn.grossAmount ?? 0);

export default function AdminTransactionsPage() {
  const { people, portfolio, transactions } = useAdminWorkspace();
  const [view, setView] = useState<View>("all");
  const [periodId, setPeriodId] = useState<PeriodId>("fy-current");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [client, setClient] = useState(ALL);
  const [accountant, setAccountant] = useState(ALL);
  const [entity, setEntity] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [review, setReview] = useState(ALL);
  const [minAmount, setMinAmount] = useState("");

  const all = useMemo(() => transactions.data ?? [], [transactions.data]);
  const clients = useMemo(() => people.data?.clients ?? [], [people.data]);
  const clientAccountant = useMemo(() => new Map(clients.map((c) => [c.id, c.assignedAccountantName || ""])), [clients]);
  const clientAccountantId = useMemo(() => new Map(clients.map((c) => [c.id, c.assignedAccountantId || ""])), [clients]);
  const categories = useMemo(() => [...new Set(all.map((t) => t.categoryName).filter(Boolean))].sort(), [all]);

  const filtered = useMemo(() => {
    const period = findPeriod(periodId);
    const fromTime = from ? new Date(from).getTime() : null;
    const toTime = to ? new Date(to).getTime() + 86_400_000 : null;
    const needle = query.trim().toLowerCase();
    const min = Number(minAmount) || 0;
    return all.filter((txn) => {
      if (!inPeriod(txn.invoiceDate, period)) return false;
      const time = new Date(txn.invoiceDate).getTime();
      if (fromTime && time < fromTime) return false;
      if (toTime && time >= toTime) return false;
      if (client !== ALL && txn.clientId !== client) return false;
      if (accountant !== ALL && clientAccountantId.get(txn.clientId) !== accountant) return false;
      if (entity !== ALL && txn.entityId !== entity) return false;
      if (type !== ALL && txn.type !== type) return false;
      if (category !== ALL && (txn.categoryName || "Unclassified") !== category) return false;
      if (review !== ALL && txn.reviewStatus !== review) return false;
      if (min && amountOf(txn) < min) return false;
      if (view === "unreviewed" && txn.reviewStatus === "reviewed") return false;
      if (view === "revenue" && txn.type !== "revenue") return false;
      if (view === "expense" && txn.type !== "expense") return false;
      if (view === "large" && amountOf(txn) < 1000) return false;
      if (needle && !`${txn.description ?? ""} ${txn.clientName} ${txn.entityName} ${txn.propertyNames.join(" ")} ${txn.id}`.toLowerCase().includes(needle)) {
        return false;
      }
      return true;
    });
  }, [all, periodId, from, to, query, client, accountant, clientAccountantId, entity, type, category, review, minAmount, view]);

  const revenue = filtered.filter((t) => t.type === "revenue");
  const expenses = filtered.filter((t) => t.type === "expense");
  const revenueTotal = revenue.reduce((sum, t) => sum + amountOf(t), 0);
  const expenseTotal = expenses.reduce((sum, t) => sum + amountOf(t), 0);
  const unreviewed = filtered.filter((t) => t.reviewStatus !== "reviewed").length;
  const byCategory = sumBy(filtered, (t) => t.categoryName || "Unclassified", amountOf);
  const countByCategory = new Map(sumBy(filtered, (t) => t.categoryName || "Unclassified", () => 1));
  const period = findPeriod(periodId);

  function reset() {
    setView("all");
    setPeriodId("fy-current");
    setFrom("");
    setTo("");
    setQuery("");
    setClient(ALL);
    setAccountant(ALL);
    setEntity(ALL);
    setType(ALL);
    setCategory(ALL);
    setReview(ALL);
    setMinAmount("");
  }

  return (
    <>
      <PageHeader
        title="Transactions report"
        subtitle="Filter by anything, then export exactly what you see."
        actions={
          <ExportMenu
            variant="dark"
            build={() => ({
              title: "Transactions report",
              filename: "transactions",
              context: [`Period: ${period.label}`, `${filtered.length} transactions`, `Revenue ${formatMoney(revenueTotal)} · Expenses ${formatMoney(expenseTotal)}`],
              columns: [
                { header: "Date", value: (t: OrgTransaction) => t.invoiceDate?.slice(0, 10) },
                { header: "ID", value: (t: OrgTransaction) => t.id },
                { header: "Client", value: (t: OrgTransaction) => t.clientName },
                { header: "Accountant", value: (t: OrgTransaction) => clientAccountant.get(t.clientId) || "Unassigned" },
                { header: "Entity", value: (t: OrgTransaction) => t.entityName },
                { header: "Property", value: (t: OrgTransaction) => t.propertyNames.join("; ") },
                { header: "Description", value: (t: OrgTransaction) => t.description },
                { header: "Type", value: (t: OrgTransaction) => t.type },
                { header: "Category", value: (t: OrgTransaction) => t.categoryName || "Unclassified" },
                { header: "Sub-category", value: (t: OrgTransaction) => t.subcategoryName },
                { header: "Gross (AUD)", value: (t: OrgTransaction) => amountOf(t) },
                { header: "GST (AUD)", value: (t: OrgTransaction) => t.clientShareGst ?? t.gstAmount },
                { header: "Review", value: (t: OrgTransaction) => t.reviewStatus },
              ],
              rows: filtered,
            })}
          />
        }
      />

      {transactions.error ? <Notice tone="red" title="Couldn't load transactions">{transactions.error.message}</Notice> : null}

      <Field label="Saved views">
        <Presets label="Saved views" items={VIEWS} value={view} onChange={setView} />
      </Field>

      <section className="cpc-filters" aria-label="Transaction filters" style={{ flexDirection: "column", alignItems: "stretch", flexWrap: "nowrap" }}>
        <div className="cpc-form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 11.5em), 1fr))" }}>
          <SelectField
            id="t-period"
            label="Period"
            value={periodId}
            onChange={setPeriodId}
            options={[
              { value: "fy-current", label: "This FY" },
              { value: "fy-previous", label: "Last FY" },
              { value: "quarter", label: "This quarter" },
              { value: "month", label: "This month" },
              { value: "last-12", label: "Last 12 months" },
              { value: "all", label: "All time" },
            ]}
          />
          <Field label="From" htmlFor="t-from">
            <input id="t-from" className="cpc-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To" htmlFor="t-to">
            <input id="t-to" className="cpc-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <SelectField
            id="t-client"
            label="Client"
            value={client}
            onChange={setClient}
            options={[{ value: ALL, label: "All clients" }, ...clients.map((c) => ({ value: c.id, label: c.name || c.email }))]}
          />
          <SelectField
            id="t-acc"
            label="Accountant"
            value={accountant}
            onChange={setAccountant}
            options={[{ value: ALL, label: "All accountants" }, ...(people.data?.accountants ?? []).map((a) => ({ value: a.id, label: a.name || a.email }))]}
          />
          <SelectField
            id="t-entity"
            label="Entity"
            value={entity}
            onChange={setEntity}
            options={[{ value: ALL, label: "All entities" }, ...(portfolio.data?.entities ?? []).map((e) => ({ value: e.id, label: e.name }))]}
          />
          <SelectField
            id="t-type"
            label="Type"
            value={type}
            onChange={setType}
            options={[
              { value: ALL, label: "Revenue & expense" },
              { value: "revenue", label: "Revenue" },
              { value: "expense", label: "Expense" },
            ]}
          />
          <SelectField
            id="t-cat"
            label="Category"
            value={category}
            onChange={setCategory}
            options={[{ value: ALL, label: "All categories" }, ...categories.map((name) => ({ value: name, label: name })), { value: "Unclassified", label: "Unclassified" }]}
          />
          <SelectField
            id="t-review"
            label="Review status"
            value={review}
            onChange={setReview}
            options={[
              { value: ALL, label: "Any" },
              { value: "reviewed", label: "Reviewed" },
              { value: "unreviewed", label: "Unreviewed" },
            ]}
          />
          <Field label="Min amount (AUD)" htmlFor="t-min">
            <input id="t-min" className="cpc-input" inputMode="decimal" value={minAmount} onChange={(e) => setMinAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" />
          </Field>
          <SearchField id="t-q" value={query} onChange={setQuery} placeholder="Description, property or ID" />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="cpc-btn cpc-btn-ghost cpc-btn-sm" onClick={reset}>
            Reset filters
          </button>
        </div>
      </section>

      <KpiGrid>
        <Kpi label="Transactions" loading={transactions.isLoading} value={formatNumber(filtered.length)} hint={`${formatNumber(all.length)} in total`} />
        <Kpi label="Revenue" tone="good" loading={transactions.isLoading} value={formatCompactMoney(revenueTotal)} hint={`${formatNumber(revenue.length)} transactions`} />
        <Kpi label="Expenses" tone="bad" loading={transactions.isLoading} value={formatCompactMoney(expenseTotal)} hint={`${formatNumber(expenses.length)} transactions`} />
        <Kpi label="Net" loading={transactions.isLoading} value={formatCompactMoney(revenueTotal - expenseTotal)} hint="before depreciation" />
        <Kpi label="Unreviewed" tone="warn" loading={transactions.isLoading} value={formatNumber(unreviewed)} hint={`${Math.round(share(unreviewed, filtered.length) * 100)}% of filtered`} />
      </KpiGrid>

      <div className="cpc-grid-2">
        <Card title="By category" meta="Amount · count">
          <BarList
            loading={transactions.isLoading}
            labelWidth="11em"
            rows={byCategory.map(([name, value]) => ({
              key: name,
              label: name,
              value,
              color: name === "Unclassified" ? "var(--cpc-gray)" : "var(--cpc-blue)",
              display: (
                <>
                  {formatCompactMoney(value)} <span>· {formatNumber(countByCategory.get(name) ?? 0)}</span>
                </>
              ),
            }))}
          />
        </Card>
        <Card title="By type & review status">
          {transactions.isLoading ? (
            <Skeleton height="8em" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.3em" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6em" }}>
                <span className="cpc-label">Type</span>
                <div className="cpc-stack">
                  <span style={{ width: `${share(revenue.length, filtered.length) * 100}%`, background: "var(--cpc-teal)" }} />
                  <span style={{ width: `${share(expenses.length, filtered.length) * 100}%`, background: "var(--cpc-red)" }} />
                </div>
                <Legend items={[{ label: `Revenue ${formatNumber(revenue.length)}`, color: "var(--cpc-teal)" }, { label: `Expense ${formatNumber(expenses.length)}`, color: "var(--cpc-red)" }]} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6em" }}>
                <span className="cpc-label">Review status</span>
                <div className="cpc-stack">
                  <span style={{ width: `${share(filtered.length - unreviewed, filtered.length) * 100}%`, background: "var(--cpc-teal)" }} />
                  <span style={{ width: `${share(unreviewed, filtered.length) * 100}%`, background: "var(--cpc-amber)" }} />
                </div>
                <Legend items={[{ label: `Reviewed ${formatNumber(filtered.length - unreviewed)}`, color: "var(--cpc-teal)" }, { label: `Unreviewed ${formatNumber(unreviewed)}`, color: "var(--cpc-amber)" }]} />
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card flush title="Transactions" meta={`${formatNumber(filtered.length)} match these filters`}>
        <DataTable<OrgTransaction>
          caption="Transactions"
          loading={transactions.isLoading}
          rows={filtered}
          rowKey={(t) => t.id}
          pageSize={25}
          initialSort={{ id: "date", direction: "desc" }}
          empty={<EmptyState title="No transactions match these filters" />}
          columns={[
            { id: "date", header: "Date", cell: (t) => <span className="cpc-small">{formatDate(t.invoiceDate)}</span>, sortValue: (t) => t.invoiceDate },
            { id: "client", header: "Client", cell: (t) => t.clientName, sortValue: (t) => t.clientName },
            { id: "acc", header: "Accountant", cell: (t) => <span className="cpc-muted">{clientAccountant.get(t.clientId) || "Unassigned"}</span> },
            { id: "property", header: "Property", cell: (t) => t.propertyNames.join(", ") || "—" },
            { id: "desc", header: "Description", wrap: true, cell: (t) => t.description || "—" },
            { id: "type", header: "Type", cell: (t) => <Badge tone={t.type === "revenue" ? "green" : "red"}>{t.type === "revenue" ? "Revenue" : "Expense"}</Badge>, sortValue: (t) => t.type },
            { id: "cat", header: "Category", cell: (t) => <Badge tone="gray">{t.categoryName || "Unclassified"}</Badge>, sortValue: (t) => t.categoryName },
            {
              id: "amount",
              header: "Amount",
              align: "right",
              cell: (t) => (
                <span style={{ color: t.type === "revenue" ? "#0f6b4f" : "#a32d24" }}>
                  {t.type === "revenue" ? "+" : "−"}
                  {formatMoney(amountOf(t))}
                </span>
              ),
              sortValue: amountOf,
            },
            { id: "review", header: "Review", cell: (t) => <Badge tone={t.reviewStatus === "reviewed" ? "green" : "amber"}>{t.reviewStatus === "reviewed" ? "Reviewed" : "Unreviewed"}</Badge> },
          ]}
        />
      </Card>
    </>
  );
}
