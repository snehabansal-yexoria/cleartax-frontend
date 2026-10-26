"use client";

import { useEffect } from "react";
import type { CoreGstCategory, CoreGstSummary } from "@/src/lib/coreApi";
import { fetchJson, useAsyncRegion } from "@/app/components/useAsyncRegion";
import ReportDocument from "./ReportDocument";
import {
  Explain,
  Info,
  Kpi,
  Kpis,
  Note,
  Pill,
  ReportProblem,
  ReportSkeleton,
  ReportTable,
  Section,
} from "./reportParts";
import { cents, money, quarterDue, quarterLabel } from "./reportFormat";
import type { ReportContext } from "./reportScope";

/**
 * GST: what was collected and claimed back, quarter by quarter, and the GST
 * inside the costs of owners that are not registered.
 *
 * GST is lodged per entity, so the report reads one GST summary per entity in
 * scope (or the property's own share at property scope), each with
 * `detail=1`: the four quarters, purchases by category, and the entity's GST
 * registration. An entity whose registration nobody has recorded yet is shown
 * the BAS view — what every entity showed before registration existed.
 *
 * The accountant's GST maths, except that for a client caller the API leaves
 * out transactions still awaiting review (as the Portfolio Summary does), so
 * the "awaiting review included" pill stays hidden at 0.
 */

type GstPart = { entityId: string; entityName: string; summary: CoreGstSummary };

const FREQUENCY: Record<string, string> = { monthly: "Monthly", quarterly: "Quarterly", annually: "Annual" };
const BASIS: Record<string, string> = { cash: "Cash", accruals: "Accruals" };

function useGstParts(ctx: ReportContext) {
  const { level, scope } = ctx;
  const targets =
    level === "property" && ctx.property
      ? [{ path: `/api/properties/${encodeURIComponent(ctx.property.id)}`, entityId: ctx.property.entityId, entityName: ctx.property.entityName }]
      : ctx.entities.map((e) => ({ path: `/api/entities/${encodeURIComponent(e.id)}`, entityId: e.id, entityName: e.name }));
  const key = `gst-report:${scope.fy}:${targets.map((t) => t.path).join(",")}`;

  // useAsyncRegion reads `load` at request time, keyed by `key`, so it needs
  // no memoising.
  const load = async (token: string, signal: AbortSignal): Promise<GstPart[]> => {
    const parts = await Promise.all(
      targets.map(async (t) => {
        const summary = await fetchJson<CoreGstSummary>(
          `${t.path}/gst-summary?financial_year=${scope.fy}&detail=1`,
          token,
          signal,
        );
        return { entityId: t.entityId, entityName: t.entityName, summary };
      }),
    );
    // A backend that predates detail=1 answers without the breakdown; a
    // report built from that would print an empty BAS table as if no GST
    // had moved. Refuse it so the page offers Try again instead.
    if (parts.some((p) => !p.summary?.quarters || !p.summary?.registration)) {
      throw new Error("The GST report isn't available yet. Please try again shortly.");
    }
    return parts;
  };

  return useAsyncRegion(targets.length ? key : null, load);
}

export default function ClientGstReport({
  ctx,
  onReady,
}: {
  ctx: ReportContext;
  onReady: (ready: boolean) => void;
}) {
  const region = useGstParts(ctx);
  const ready = region.status === "ready" && region.data != null;
  useEffect(() => {
    onReady(ready);
  }, [ready, onReady]);

  if (ctx.entities.length === 0) {
    return <ReportProblem message="There's nothing to show yet: no entities have been set up." />;
  }
  if (region.status === "error") {
    return <ReportProblem message={region.error ?? "The GST report could not be loaded."} onRetry={region.reload} />;
  }
  if (!region.data || region.status !== "ready") return <ReportSkeleton />;

  const unreviewed = region.data.reduce((n, p) => n + (p.summary.unreviewedCount ?? 0), 0);
  return (
    <ReportDocument
      reportKey="gst"
      title="GST"
      ctx={ctx}
      ready={ready}
      pills={
        unreviewed > 0 ? (
          <Pill tone="amber" title="Included in these figures before your accountant has reviewed them">
            {unreviewed} awaiting review included
          </Pill>
        ) : null
      }
    >
      <GstBody ctx={ctx} parts={region.data} />
    </ReportDocument>
  );
}

/** Purchases by category, merged across parts by name and sorted largest first. */
function mergeCategories(parts: GstPart[]): CoreGstCategory[] {
  const merged = new Map<string, CoreGstCategory>();
  for (const part of parts) {
    for (const c of part.summary.purchasesByCategory ?? []) {
      const row = merged.get(c.categoryName) ?? { ...c, gross: 0, gst: 0, net: 0, count: 0 };
      row.gross += c.gross;
      row.gst += c.gst;
      row.net += c.net;
      row.count += c.count;
      merged.set(c.categoryName, row);
    }
  }
  return [...merged.values()].sort((a, b) => b.gross - a.gross);
}

function GstBody({ ctx, parts }: { ctx: ReportContext; parts: GstPart[] }) {
  const fy = ctx.scope.fy;
  const registered = parts.filter((p) => p.summary.registration?.status !== "not_registered");
  const unregistered = parts.filter((p) => p.summary.registration?.status === "not_registered");
  const unrecorded = registered.filter((p) => p.summary.registration?.status === "unknown");

  const collected = registered.reduce((s, p) => s + p.summary.gstOnSales, 0);
  const claimed = registered.reduce((s, p) => s + p.summary.gstOnPurchases, 0);
  const net = collected - claimed;
  const inside = unregistered.reduce((s, p) => s + p.summary.gstOnPurchases, 0);
  const hasReg = registered.length > 0;
  const hasUnreg = unregistered.length > 0;
  const toAto = net >= 0 ? "paid to" : "refunded by";

  const insideCats = mergeCategories(unregistered);
  const insideWithGst = insideCats.filter((c) => c.gst !== 0);
  const insideFree = insideCats.filter((c) => c.gst === 0);
  const regCats = mergeCategories(registered);
  const atProperty = ctx.level === "property";

  return (
    <>
      <Section bare>
        <Kpis>
          <Kpi
            label="GST you collected"
            value={hasReg ? cents(collected) : "—"}
            sub={hasReg ? "Charged on your sales and rent" : "No GST-registered owner"}
          />
          <Kpi label="GST you claimed back" value={hasReg ? cents(claimed) : "—"} sub={hasReg ? "GST credits on costs" : undefined} />
          <Kpi
            label={net >= 0 ? "Net GST paid to the ATO" : "Net GST refunded by the ATO"}
            value={hasReg ? cents(Math.abs(net)) : cents(0)}
            sub={hasReg ? "Collected minus claimed" : "Nothing to pay"}
          />
          <Kpi
            label="GST inside your costs"
            value={hasUnreg ? cents(inside) : "—"}
            sub={hasUnreg ? "Can't be claimed back" : undefined}
          />
        </Kpis>
        <Explain>
          <b>In short:</b>{" "}
          {hasReg && hasUnreg ? (
            <>
              Some of your owners are registered for GST: they add GST to what they charge and claim back the GST on
              their costs. This year that left <b>{cents(Math.abs(net))}</b> {toAto} the ATO. Owners that aren&apos;t
              registered don&apos;t use GST at all; the GST in their bills is simply part of the cost.
            </>
          ) : hasReg ? (
            <>
              GST is added to what you charge and claimed back on your costs. The difference,{" "}
              <b>{cents(Math.abs(net))}</b> this year, was {toAto} the ATO through your BAS.
            </>
          ) : (
            <>
              There&apos;s no GST to pay or claim: {unregistered.length === 1 ? "this owner isn't" : "these owners aren't"}{" "}
              registered for GST, so the GST in your bills can&apos;t be claimed back. The <b>{cents(inside)}</b> of GST
              inside your costs is already counted as part of each expense.
            </>
          )}
        </Explain>
        {unrecorded.length ? (
          <Info>
            GST registration hasn&apos;t been recorded for {unrecorded.map((p) => p.entityName).join(", ")} yet, so{" "}
            {unrecorded.length === 1 ? "it is" : "they are"} shown with a BAS. Your accountant can update this.
          </Info>
        ) : null}
      </Section>

      {registered.map((p) => {
        const reg = p.summary.registration;
        const frequency = reg?.basFrequency ? FREQUENCY[reg.basFrequency] : null;
        const basis = reg?.basis ? `${BASIS[reg.basis]} basis` : null;
        const showDue = !reg?.basFrequency || reg.basFrequency === "quarterly";
        const quarters = p.summary.quarters ?? [];
        const columns = [
          { key: "q", label: "Quarter", text: "Quarter" },
          { key: "g1", label: <>Sales incl. GST <small>G1</small></>, text: "Sales incl. GST (G1)", numeric: true },
          { key: "1a", label: <>GST collected <small>1A</small></>, text: "GST collected (1A)", numeric: true },
          { key: "1b", label: <>GST claimed <small>1B</small></>, text: "GST claimed (1B)", numeric: true },
          { key: "net", label: "Net GST", text: "Net GST", numeric: true },
          ...(showDue ? [{ key: "due", label: "Due", text: "Due" }] : []),
        ];
        return (
          <Section
            key={p.entityId}
            title={atProperty ? "GST by quarter" : "Your BAS, quarter by quarter"}
            aside={[p.entityName, frequency, basis].filter(Boolean).join(" · ")}
          >
            <ReportTable
              mini
              columns={columns}
              rows={[
                ...quarters.map((q) => ({
                  key: String(q.quarter),
                  cells: [
                    quarterLabel(fy, q.quarter),
                    money(q.g1TotalSales),
                    cents(q.gstOnSales),
                    cents(q.gstOnPurchases),
                    <b key="n">{cents(q.netGst)}</b>,
                    ...(showDue ? [quarterDue(fy, q.quarter)] : []),
                  ],
                })),
                {
                  key: "year",
                  total: true,
                  cells: [
                    "Year",
                    money(p.summary.g1TotalSales),
                    cents(p.summary.gstOnSales),
                    cents(p.summary.gstOnPurchases),
                    cents(p.summary.netGst),
                    ...(showDue ? [""] : []),
                  ],
                },
              ]}
            />
            <Note>
              {atProperty ? `This property's share of ${p.entityName}'s BAS. ` : ""}G1, 1A and 1B are the boxes on your
              Business Activity Statement. Figures are by invoice date.
              {showDue
                ? " Due dates are the standard quarterly dates; your accountant may have later dates through their lodgement program."
                : ""}
            </Note>
          </Section>
        );
      })}

      {hasReg && regCats.length ? (
        <Section title="GST claimed back, by cost" aside={registered.length === 1 ? registered[0].entityName : "Registered owners"}>
          <ReportTable
            columns={[
              { key: "c", label: "Cost", text: "Cost" },
              { key: "p", label: "Paid incl. GST", text: "Paid incl. GST", numeric: true },
              { key: "g", label: "GST claimed", text: "GST claimed", numeric: true },
            ]}
            rows={regCats.map((c) => ({
              key: c.categoryName,
              cells: [
                <>
                  {c.categoryName}
                  {c.gst === 0 ? <small>No GST on this cost</small> : null}
                </>,
                money(c.gross),
                c.gst ? cents(c.gst) : "—",
              ],
            }))}
          />
        </Section>
      ) : null}

      {hasUnreg ? (
        <Section title="GST inside your costs" aside="Not claimable">
          {insideWithGst.length ? (
            <ReportTable
              columns={[
                { key: "c", label: "Cost", text: "Cost" },
                { key: "p", label: "You paid", text: "You paid", numeric: true },
                { key: "g", label: "GST included", text: "GST included", numeric: true },
              ]}
              rows={[
                ...insideWithGst.map((c) => ({
                  key: c.categoryName,
                  cells: [c.categoryName, money(c.gross), cents(c.gst)],
                })),
                {
                  key: "total",
                  total: true,
                  cells: ["Total", money(insideWithGst.reduce((s, c) => s + c.gross, 0)), cents(inside)],
                },
              ]}
            />
          ) : (
            <Note>No costs with GST in this period.</Note>
          )}
          {insideFree.length ? (
            <Note>No GST is charged on {insideFree.map((c) => c.categoryName.toLowerCase()).join(", ")}.</Note>
          ) : null}
          <Info>Owners that aren&apos;t registered for GST don&apos;t lodge a BAS, so these costs never appear on one.</Info>
        </Section>
      ) : null}
    </>
  );
}
