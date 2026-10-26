"use client";

import { useEffect } from "react";
import type { CoreDepreciationList, CoreDepreciationSchedule } from "@/src/lib/coreApi";
import { useDepreciation } from "@/app/components/useDepreciation";
import ReportDocument from "./ReportDocument";
import {
  Bars,
  Explain,
  Kpi,
  Kpis,
  Note,
  ReportProblem,
  ReportSkeleton,
  ReportTable,
  Section,
} from "./reportParts";
import { compact, fyFromStartYear, lifeLabel, money, monthYear, titleWord } from "./reportFormat";
import type { ReportContext, ScopeProperty } from "./reportScope";

/**
 * Depreciation: this year's claim for buildings (capital works, Div 43) and
 * fixtures and fittings (plant and equipment, Div 40), property by property.
 *
 * Read from the stored schedules (GET /…/depreciation?fy=), the same rows the
 * schedule PDFs are printed from — nothing is recomputed in the browser. The
 * depreciation API numbers a financial year by its START year (fy=2025 is
 * FY 2025-26) while every other report uses the end year; the conversion
 * happens once, here.
 */
export default function ClientDepreciationReport({
  ctx,
  onReady,
}: {
  ctx: ReportContext;
  onReady: (ready: boolean) => void;
}) {
  const { scope, level } = ctx;
  const startYear = scope.fy - 1;
  const [apiLevel, apiId] =
    level === "property"
      ? (["property", scope.propertyId ?? ""] as const)
      : level === "entity"
        ? (["entity", scope.entityId ?? ""] as const)
        : (["client", ctx.clientId] as const);
  const { data, isLoading, error, reload } = useDepreciation(apiLevel, apiId, { fy: startYear });

  // A backend that predates the per-year fields answers without a projection.
  // Building the report from it would print "—" for every value, so it is
  // treated as not available yet.
  const outdated = data != null && data.projection == null;
  const ready = data != null && !outdated && !isLoading;
  useEffect(() => {
    onReady(ready);
  }, [ready, onReady]);

  if (error) return <ReportProblem message={error} onRetry={reload} />;
  if (outdated) {
    return <ReportProblem message="The Depreciation report isn't available yet. Please try again shortly." onRetry={reload} />;
  }
  if (!data || isLoading) return <ReportSkeleton />;

  return (
    <ReportDocument reportKey="depreciation" title="Depreciation" ctx={ctx} ready={ready}>
      <DepreciationBody ctx={ctx} data={data} />
    </ReportDocument>
  );
}

const isBuilding = (s: CoreDepreciationSchedule) => s.assetClass === "capital_works";
/** The schedule has a row for the requested year: bought by then, not yet written off. */
const inYear = (s: CoreDepreciationSchedule) => s.fyOpeningValue != null;
const claimOf = (s: CoreDepreciationSchedule) => s.fyDepreciation ?? 0;
const sum = (items: CoreDepreciationSchedule[], pick: (s: CoreDepreciationSchedule) => number) =>
  items.reduce((total, s) => total + pick(s), 0);

function DepreciationBody({ ctx, data }: { ctx: ReportContext; data: CoreDepreciationList }) {
  const { totals } = data;
  const total = totals.depreciation;

  const byProperty = new Map<string, CoreDepreciationSchedule[]>();
  for (const item of data.items) {
    const list = byProperty.get(item.propertyId) ?? [];
    list.push(item);
    byProperty.set(item.propertyId, list);
  }
  // Every property in scope gets a section, plus any the schedules name that
  // the holdings list does not (an inactive property, say), so the sections
  // always add up to the headline.
  const known = new Set(ctx.properties.map((p) => p.id));
  const extra: ScopeProperty[] = data.items
    .filter((s) => !known.has(s.propertyId))
    .filter((s, i, all) => all.findIndex((o) => o.propertyId === s.propertyId) === i)
    .map((s) => ({
      id: s.propertyId,
      name: s.propertyName,
      enabled: true,
      propertyType: "",
      locationText: "",
      entityId: s.entityId,
      entityName: s.entityName,
    }));
  const properties = [...ctx.properties, ...extra];
  const withClaim = properties.filter((p) => (byProperty.get(p.id) ?? []).some(inYear)).length;

  const owners = new Map<string, { name: string; building: number; fixtures: number }>();
  for (const item of data.items.filter(inYear)) {
    const row = owners.get(item.entityId) ?? { name: item.entityName, building: 0, fixtures: 0 };
    if (isBuilding(item)) row.building += claimOf(item);
    else row.fixtures += claimOf(item);
    owners.set(item.entityId, row);
  }
  const showOwners = ctx.level === "client" && owners.size > 1;
  const entityType = (id: string) => titleWord(ctx.holdings.find((e) => e.id === id)?.entityType ?? "");

  const projection = data.projection ?? [];

  return (
    <>
      <Section bare>
        <Kpis>
          <Kpi label="Total depreciation (FY)" value={compact(total)} sub="Deduction for this year" />
          <Kpi label="Building" value={compact(totals.capitalWorks)} sub="Capital works (Div 43)" />
          <Kpi label="Fixtures and fittings" value={compact(totals.capitalAllowances)} sub="Plant and equipment (Div 40)" />
          <Kpi
            label="Properties"
            value={String(properties.length)}
            sub={`${withClaim} with a claim this year`}
          />
        </Kpis>
        <Explain>
          <b>What is depreciation?</b> Buildings and the items inside them wear out over time. The tax rules let you
          claim that wear as a deduction each year, even though no money leaves your account. This year that&apos;s{" "}
          <b>{money(total)}</b> you can claim against your rent.
        </Explain>
      </Section>

      {properties.map((p) => (
        <PropertySection key={p.id} property={p} items={byProperty.get(p.id) ?? []} />
      ))}

      {showOwners ? (
        <Section title="Who claims what" aside="By the entity that owns each property">
          <ReportTable
            columns={[
              { key: "o", label: "Owner", text: "Owner" },
              { key: "b", label: "Building", text: "Building", numeric: true },
              { key: "f", label: "Fixtures and fittings", text: "Fixtures and fittings", numeric: true },
              { key: "t", label: "Total", text: "Total", numeric: true },
            ]}
            rows={[
              ...[...owners.entries()].map(([id, o]) => ({
                key: id,
                cells: [
                  <>
                    {o.name}
                    {entityType(id) ? <small>{entityType(id)}</small> : null}
                  </>,
                  money(o.building),
                  money(o.fixtures),
                  money(o.building + o.fixtures),
                ],
              })),
              {
                key: "total",
                total: true,
                cells: ["Total", money(totals.capitalWorks), money(totals.capitalAllowances), money(total)],
              },
            ]}
          />
        </Section>
      ) : null}

      <Section title="Next five years" aside="Estimate, if no new items are bought">
        {projection.length ? (
          <Bars
            rows={projection.map((y) => ({
              key: String(y.fyStartYear),
              label: fyFromStartYear(y.fyStartYear),
              value: y.depreciation,
            }))}
            total={0}
            variant="proj"
            showShare={false}
          />
        ) : (
          <Note>Nothing left to claim on the items recorded so far.</Note>
        )}
        <Note>
          The building amount stays about the same each year. Fixtures and fittings claimed on the diminishing value
          method get smaller each year.
        </Note>
      </Section>
    </>
  );
}

function PropertySection({ property, items }: { property: ScopeProperty; items: CoreDepreciationSchedule[] }) {
  const current = items.filter(inYear);
  const buildings = current.filter(isBuilding);
  const fixtures = current.filter((s) => !isBuilding(s));
  const building = sum(buildings, claimOf);
  const fixturesClaim = sum(fixtures, claimOf);
  const left = sum(buildings, (s) => s.fyClosingValue ?? 0);
  const use = titleWord(property.propertyType);

  const lastYear = Math.max(0, ...buildings.map((s) => s.lastFyStartYear ?? 0));
  const rates = [...new Set(buildings.map((s) => s.annualRate))];
  const before = sum(buildings, (s) => s.claimedBeforeFy ?? 0);

  return (
    <section className="cp-sec">
      <div className="cp-prop-h">
        <h4>
          {property.name}
          {property.locationText ? `, ${property.locationText}` : ""}
        </h4>
        <span>{[use, property.entityName].filter(Boolean).join(" · ")}</span>
      </div>
      {items.length === 0 ? (
        <Note>No depreciation schedule has been recorded for this property.</Note>
      ) : (
        <>
          <div className="cp-mini-kpis">
            <div>
              <span>Building</span>
              <b>{money(building)}</b>
            </div>
            <div>
              <span>Fixtures and fittings</span>
              <b>{money(fixturesClaim)}</b>
            </div>
            <div>
              <span>This year in total</span>
              <b>{money(building + fixturesClaim)}</b>
            </div>
            <div>
              <span>Building left to claim</span>
              <b>{buildings.length ? `≈ ${money(left)}` : "—"}</b>
            </div>
          </div>
          {buildings.length ? (
            <Note>
              Building: {money(sum(buildings, (s) => s.depreciableAmount))} of capital works
              {rates.length === 1 ? `, claimed at ${rates[0]}% a year` : ""}
              {lastYear ? ` until ${fyFromStartYear(lastYear)}` : ""}.{" "}
              {before > 0 ? `${money(before)} was claimed in earlier years.` : "This is the first year of the claim."}
            </Note>
          ) : null}
          {fixtures.length ? (
            <ReportTable
              mini
              columns={[
                { key: "n", label: "Item", text: "Item" },
                { key: "b", label: "Bought", text: "Bought" },
                { key: "c", label: "Cost", text: "Cost", numeric: true },
                { key: "l", label: "Life", text: "Life" },
                { key: "o", label: "Value at 1 Jul", text: "Value at 1 Jul", numeric: true },
                { key: "y", label: "Claim this year", text: "Claim this year", numeric: true },
                { key: "z", label: "Value at 30 Jun", text: "Value at 30 Jun", numeric: true },
              ]}
              rows={[
                ...fixtures.map((s) => ({
                  key: s.id,
                  cells: [
                    <>
                      {s.assetName}
                      {s.personalPercentage > 0 ? <small>{s.personalPercentage}% private use left out</small> : null}
                    </>,
                    monthYear(s.startDate),
                    money(s.depreciableAmount),
                    lifeLabel(s.effectiveLifeYears),
                    money(s.fyOpeningValue),
                    money(claimOf(s)),
                    money(s.fyClosingValue),
                  ],
                })),
                { key: "total", total: true, cells: ["Total", "", "", "", "", money(fixturesClaim), ""] },
              ]}
            />
          ) : (
            <Note>No fixtures or fittings to claim for this property this year.</Note>
          )}
        </>
      )}
    </section>
  );
}
