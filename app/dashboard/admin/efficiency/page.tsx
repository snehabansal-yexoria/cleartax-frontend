"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable } from "../../_console/components/DataTable";
import { ExportMenu } from "../../_console/components/ExportMenu";
import {
  BarList,
  Card,
  EmptyState,
  Field,
  Kpi,
  KpiGrid,
  Meter,
  PageHeader,
  Presets,
  Skeleton,
  cx,
} from "../../_console/components/ui";
import { formatCompactMoney, formatNumber, formatPercent, share } from "../../_console/lib/format";
import {
  accountantStats,
  findPeriod,
  inPeriod,
  monthBuckets,
  monthKey,
  type AccountantStats,
  type Period,
  type PeriodId,
} from "../../_console/lib/metrics";
import { useAdminWorkspace } from "../../_console/lib/useAdminWorkspace";

type Measure = "transactions" | "clients" | "entities" | "properties" | "equity" | "statementsDone";

const MEASURES: { id: Measure; label: string; format: (n: number) => string }[] = [
  { id: "transactions", label: "Transactions", format: formatNumber },
  { id: "clients", label: "Clients", format: formatNumber },
  { id: "entities", label: "Entities", format: formatNumber },
  { id: "properties", label: "Properties", format: formatNumber },
  { id: "equity", label: "Equity", format: formatCompactMoney },
  { id: "statementsDone", label: "Statements processed", format: formatNumber },
];

const DURATIONS: { id: PeriodId | "custom"; label: string }[] = [
  { id: "month", label: "This month" },
  { id: "quarter", label: "This quarter" },
  { id: "fy-current", label: "This FY" },
  { id: "fy-previous", label: "Last FY" },
  { id: "last-12", label: "Last 12 months" },
  { id: "custom", label: "Custom" },
];

export default function AccountantEfficiencyPage() {
  const { people, portfolio, transactions } = useAdminWorkspace();
  const [duration, setDuration] = useState<PeriodId | "custom">("fy-current");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [measure, setMeasure] = useState<Measure>("transactions");

  const period: Period = useMemo(() => {
    if (duration !== "custom") return findPeriod(duration);
    return {
      id: "all",
      label: from || to ? `${from || "start"} to ${to || "today"}` : "Custom range",
      from: from ? new Date(from) : null,
      to: to ? new Date(new Date(to).getTime() + 86_400_000) : null,
    };
  }, [duration, from, to]);

  const accountants = useMemo(() => people.data?.accountants ?? [], [people.data]);
  const stats = useMemo(
    () => accountantStats(accountants, people.data?.clients ?? [], portfolio.data, transactions.data, period),
    [accountants, people.data, portfolio.data, transactions.data, period],
  );
  const selected = stats.filter((row) => !excluded.has(row.accountant.id));
  const sum = (pick: (row: AccountantStats) => number) => selected.reduce((total, row) => total + pick(row), 0);
  const measureMeta = MEASURES.find((item) => item.id === measure)!;

  const months = monthBuckets(period);
  const heat = useMemo(() => {
    const byAccountant = new Map<string, Map<string, number>>();
    const clientToAccountant = new Map((people.data?.clients ?? []).map((c) => [c.id, c.assignedAccountantId]));
    for (const txn of transactions.data ?? []) {
      if (!inPeriod(txn.invoiceDate, period)) continue;
      const accountantId = clientToAccountant.get(txn.clientId);
      if (!accountantId) continue;
      const counts = byAccountant.get(accountantId) ?? new Map<string, number>();
      counts.set(monthKey(txn.invoiceDate), (counts.get(monthKey(txn.invoiceDate)) ?? 0) + 1);
      byAccountant.set(accountantId, counts);
    }
    return byAccountant;
  }, [people.data, transactions.data, period]);
  const heatMax = Math.max(
    1,
    ...selected.flatMap((row) => months.map((month) => heat.get(row.accountant.id)?.get(month.key) ?? 0)),
  );

  const loading = people.isLoading || portfolio.isLoading || transactions.isLoading;

  function toggle(id: string) {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const exportBuild = () => ({
    title: "Accountant efficiency report",
    filename: "accountant-efficiency",
    context: [`Period: ${period.label}`, `${selected.length} of ${stats.length} accountants`],
    columns: [
      { header: "Accountant", value: (row: AccountantStats) => row.accountant.name || row.accountant.email },
      { header: "Email", value: (row: AccountantStats) => row.accountant.email },
      { header: "Clients", value: (row: AccountantStats) => row.clients },
      { header: "Entities", value: (row: AccountantStats) => row.entities },
      { header: "Properties", value: (row: AccountantStats) => row.properties },
      { header: "Equity (AUD)", value: (row: AccountantStats) => Math.round(row.equity) },
      { header: "Transactions", value: (row: AccountantStats) => row.transactions },
      { header: "Transactions per client", value: (row: AccountantStats) => (row.clients ? (row.transactions / row.clients).toFixed(1) : "0") },
      { header: "Reviewed", value: (row: AccountantStats) => row.reviewed },
      { header: "Bank statements", value: (row: AccountantStats) => row.statements },
      { header: "Statements processed", value: (row: AccountantStats) => row.statementsDone },
      ...months.map((month) => ({
        header: `Txns ${month.label}`,
        value: (row: AccountantStats) => heat.get(row.accountant.id)?.get(month.key) ?? 0,
      })),
    ],
    rows: selected,
  });

  return (
    <>
      <PageHeader
        title="Accountant efficiency report"
        subtitle="How many clients, entities, properties and transactions each accountant handled, and how much equity they manage, in the period you choose."
        actions={<ExportMenu variant="dark" label="Export report" build={exportBuild} />}
      />

      <section className="cpc-filters" aria-label="Report filters" style={{ flexDirection: "column", alignItems: "stretch", flexWrap: "nowrap" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.85em", alignItems: "flex-end" }}>
          <Field label="Duration">
            <Presets label="Duration" items={DURATIONS} value={duration} onChange={setDuration} />
          </Field>
          {duration === "custom" ? (
            <>
              <Field label="From" htmlFor="e-from">
                <input id="e-from" className="cpc-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="To" htmlFor="e-to">
                <input id="e-to" className="cpc-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </Field>
            </>
          ) : null}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6em", alignItems: "center" }}>
          <span className="cpc-label">
            Accountants · {selected.length} of {stats.length} selected
          </span>
          <button type="button" className="cpc-btn cpc-btn-ghost cpc-btn-sm" onClick={() => setExcluded(new Set())}>
            Select all
          </button>
          <button
            type="button"
            className="cpc-btn cpc-btn-ghost cpc-btn-sm"
            onClick={() => setExcluded(new Set(stats.map((row) => row.accountant.id)))}
          >
            Clear
          </button>
        </div>
        <div className="cpc-presets" role="group" aria-label="Accountants in this report">
          {people.isLoading
            ? Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} width="8em" height="2.15em" radius="99px" />)
            : stats.map((row) => {
                const on = !excluded.has(row.accountant.id);
                return (
                  <button
                    key={row.accountant.id}
                    type="button"
                    aria-pressed={on}
                    className={cx("cpc-preset", on && "is-on")}
                    onClick={() => toggle(row.accountant.id)}
                  >
                    {row.accountant.name || row.accountant.email}
                  </button>
                );
              })}
        </div>
      </section>

      <KpiGrid>
        <Kpi label="Accountants" loading={people.isLoading} value={selected.length} hint="in this report" />
        <Kpi label="Clients handled" loading={people.isLoading} value={formatNumber(sum((r) => r.clients))} hint={`${selected.length ? (sum((r) => r.clients) / selected.length).toFixed(1) : 0} per accountant`} />
        <Kpi label="Entities" loading={portfolio.isLoading} value={formatNumber(sum((r) => r.entities))} />
        <Kpi label="Properties" loading={portfolio.isLoading} value={formatNumber(sum((r) => r.properties))} />
        <Kpi label="Equity managed" loading={portfolio.isLoading} value={formatCompactMoney(sum((r) => r.equity))} hint="value − loans" />
        <Kpi label="Transactions" loading={transactions.isLoading} value={formatNumber(sum((r) => r.transactions))} hint={`${formatNumber(sum((r) => r.reviewed))} reviewed`} />
        <Kpi label="Bank statements" loading={portfolio.isLoading} value={formatNumber(sum((r) => r.statements))} hint={`${formatNumber(sum((r) => r.statementsDone))} processed`} />
        <Kpi
          label="Statements reconciled"
          loading={portfolio.isLoading}
          value={sum((r) => r.statements) ? formatPercent(share(sum((r) => r.statementsDone), sum((r) => r.statements))) : "—"}
          hint="across selection"
        />
      </KpiGrid>

      <Card
        title="Compare accountants"
        meta="Pick a measure. Bars are sorted highest first."
        actions={
          <div className="cpc-seg" role="group" aria-label="Measure">
            {MEASURES.map((item) => (
              <button key={item.id} type="button" aria-pressed={item.id === measure} className={cx(item.id === measure && "is-on")} onClick={() => setMeasure(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        }
      >
        <BarList
          loading={loading}
          labelWidth="12em"
          emptyText={selected.length ? "No data in this period." : "Select at least one accountant to compare."}
          rows={[...selected]
            .sort((a, b) => b[measure] - a[measure])
            .map((row) => ({
              key: row.accountant.id,
              label: (
                <Link className="cpc-person-name" href={`/dashboard/admin/accountants/${encodeURIComponent(row.accountant.id)}`}>
                  {row.accountant.name || row.accountant.email}
                </Link>
              ),
              value: row[measure],
              display: measureMeta.format(row[measure]),
            }))}
        />
      </Card>

      <Card flush title="Efficiency table" meta="Everything each selected accountant handled in the period. Click a name for their full report and activity log.">
        <DataTable<AccountantStats>
          caption="Efficiency table"
          loading={loading}
          rows={selected}
          rowKey={(row) => row.accountant.id}
          initialSort={{ id: "transactions", direction: "desc" }}
          empty={<EmptyState title="No accountants selected" />}
          footer={`Totals · ${formatNumber(sum((r) => r.clients))} clients · ${formatNumber(sum((r) => r.properties))} properties · ${formatCompactMoney(sum((r) => r.equity))} equity · ${formatNumber(sum((r) => r.transactions))} transactions`}
          columns={[
            {
              id: "name",
              header: "Accountant",
              cell: (row) => (
                <Link className="cpc-person-name" href={`/dashboard/admin/accountants/${encodeURIComponent(row.accountant.id)}`}>
                  {row.accountant.name || row.accountant.email}
                </Link>
              ),
              sortValue: (row) => row.accountant.name,
            },
            { id: "clients", header: "Clients", align: "right", cell: (row) => row.clients, sortValue: (row) => row.clients },
            { id: "entities", header: "Entities", align: "right", cell: (row) => row.entities, sortValue: (row) => row.entities },
            { id: "properties", header: "Properties", align: "right", cell: (row) => row.properties, sortValue: (row) => row.properties },
            { id: "equity", header: "Equity", align: "right", cell: (row) => formatCompactMoney(row.equity), sortValue: (row) => row.equity },
            { id: "transactions", header: "Transactions", align: "right", cell: (row) => formatNumber(row.transactions), sortValue: (row) => row.transactions },
            { id: "tpc", header: "Txns / client", align: "right", cell: (row) => (row.clients ? (row.transactions / row.clients).toFixed(1) : "—"), sortValue: (row) => (row.clients ? row.transactions / row.clients : 0) },
            { id: "reviewed", header: "Reviewed", cell: (row) => (row.transactions ? <Meter value={share(row.reviewed, row.transactions)} /> : "—"), sortValue: (row) => share(row.reviewed, row.transactions) },
            { id: "statements", header: "Statements", align: "right", cell: (row) => `${row.statementsDone} / ${row.statements}`, sortValue: (row) => row.statements },
          ]}
        />
      </Card>

      <Card title="Transactions per month" meta="Darker cells mean more transactions handled that month">
        {loading ? (
          <Skeleton height="12em" />
        ) : selected.length === 0 ? (
          <EmptyState title="Select accountants to see their months" />
        ) : (
          <div className="cpc-table-wrap">
            <table className="cpc-table" style={{ tableLayout: "fixed", minWidth: `${12 + months.length * 4}em` }}>
              <caption className="sr-only">Transactions per month by accountant</caption>
              <thead>
                <tr>
                  <th style={{ width: "12em" }}>Accountant</th>
                  {months.map((month) => (
                    <th key={month.key} style={{ textAlign: "center" }}>{month.label}</th>
                  ))}
                  <th className="is-right" style={{ width: "5.5em" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {selected.map((row) => (
                  <tr key={row.accountant.id}>
                    <td className="cpc-strong" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{row.accountant.name || row.accountant.email}</td>
                    {months.map((month) => {
                      const value = heat.get(row.accountant.id)?.get(month.key) ?? 0;
                      const alpha = 0.08 + 0.82 * (value / heatMax);
                      return (
                        <td key={month.key} style={{ padding: "0.2em" }}>
                          <div className="cpc-heat" style={{ background: `rgba(47, 91, 211, ${alpha.toFixed(2)})`, color: alpha > 0.5 ? "#fff" : "#16181d" }}>
                            {value}
                          </div>
                        </td>
                      );
                    })}
                    <td className="is-right cpc-num cpc-strong">{formatNumber(row.transactions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
