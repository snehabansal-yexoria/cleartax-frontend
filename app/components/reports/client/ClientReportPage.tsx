"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/app/components/currentUser";
import { useClientHoldings } from "@/app/components/useClientHoldings";
import ClientPlReport from "./ClientPlReport";
import ClientDepreciationReport from "./ClientDepreciationReport";
import ClientGstReport from "./ClientGstReport";
import { ReportOptionsBar, ReportOptionsSheet } from "./ReportOptions";
import { ReportProblem, ReportSkeleton } from "./reportParts";
import { DownloadIcon, reportDef, type BuildableReportKey } from "./reportRegistry";
import { clientReportsHubHref } from "./reportLinks";
import { downloadReportPdf, reportFileName } from "./downloadReportPdf";
import { fyOption } from "./reportFormat";
import {
  allProperties,
  buildReportContext,
  normaliseScope,
  sameScope,
  useIsPhone,
  useReportQuery,
  type ReportContext,
  type ReportScope,
} from "./reportScope";

const BODIES: Record<
  BuildableReportKey,
  (props: { ctx: ReportContext; onReady: (ready: boolean) => void }) => ReactNode
> = {
  pl: ClientPlReport,
  depreciation: ClientDepreciationReport,
  gst: ClientGstReport,
};

/**
 * One client report page: choose entity → property → financial year, Build
 * report, then read it or Download PDF.
 *
 * Desktop puts the options in the page header. A phone shows the options as
 * a bottom sheet (opened straight away until the report is built), chips
 * under the title to reopen it, and a sticky Download PDF above the bottom
 * nav. Both render the same report component, so the numbers match.
 */
export default function ClientReportPage({ reportKey }: { reportKey: BuildableReportKey }) {
  const def = reportDef(reportKey);
  const Body = BODIES[reportKey];
  const isPhone = useIsPhone();
  const { committed, built, commit, search } = useReportQuery();
  const user = useCurrentUser();
  const holdings = useClientHoldings();

  // The options being edited, until Build. Keyed to the URL it started from,
  // so a Build, Back or new deep link resets it to what the URL now says.
  const [edit, setEdit] = useState<{ search: string; scope: ReportScope } | null>(null);
  const draft = edit && edit.search === search ? edit.scope : committed;
  const setDraft = (scope: ReportScope) => setEdit({ search, scope });
  const stale = built && !sameScope(draft, committed);

  const [sheetOpen, setSheetOpen] = useState(!built);
  const [ready, setReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const outRef = useRef<HTMLDivElement>(null);

  const ctx =
    user.data && holdings.data ? buildReportContext(committed, holdings.data, user.data) : null;

  const onReady = useCallback((value: boolean) => setReady(value), []);

  const build = (scope: ReportScope) => {
    setSheetOpen(false);
    commit(holdings.data ? normaliseScope(scope, holdings.data) : scope);
  };

  const scopeName = ctx?.property?.name ?? ctx?.entity?.name ?? "";
  const download = async () => {
    const doc = outRef.current?.querySelector<HTMLElement>('.cp-doc[data-ready="true"]');
    if (!doc || !ctx) return;
    setDownloading(true);
    try {
      await downloadReportPdf(doc, reportFileName(def.fileName, scopeName, fyOption(ctx.scope.fy)));
    } finally {
      setDownloading(false);
    }
  };

  const hubScope = { entityId: committed.entityId, propertyId: committed.propertyId };

  const output = !built ? null : user.status === "error" || holdings.status === "error" ? (
    <ReportProblem
      message={user.error ?? holdings.error ?? "Your details could not be loaded."}
      onRetry={() => {
        user.reload();
        holdings.reload();
      }}
    />
  ) : !ctx ? (
    <ReportSkeleton />
  ) : (
    <Body key={search} ctx={ctx} onReady={onReady} />
  );

  if (isPhone) {
    const props = holdings.data ? allProperties(holdings.data) : [];
    const chipEntity = committed.entityId
      ? holdings.data?.find((e) => e.id === committed.entityId)?.name ?? "Entity"
      : committed.propertyId
        ? props.find((p) => p.id === committed.propertyId)?.entityName ?? "Entity"
        : "All entities";
    const chipProperty = committed.propertyId
      ? props.find((p) => p.id === committed.propertyId)?.name ?? "Property"
      : "All properties";

    return (
      <div className={`cp-report cp-m-page${built ? " has-dl" : ""}`}>
        <Link className="cp-m-back cp-noprint" href={clientReportsHubHref(hubScope, { mobile: true })}>
          ← Reports
        </Link>
        <h1 className="cp-m-title">{def.title}</h1>
        <div className="cp-m-chips cp-noprint" role="group" aria-label="Report options">
          {[chipEntity, chipProperty, fyOption(committed.fy)].map((text, i) => (
            <button key={i} type="button" onClick={() => setSheetOpen(true)} aria-haspopup="dialog">
              <span>{text}</span>
            </button>
          ))}
        </div>
        <div ref={outRef} className="cp-m-rep">
          {built ? (
            output
          ) : (
            <div className="cp-m-empty">
              <span>
                Choose the <b>entity</b>, <b>property</b> and <b>financial year</b> for this report.
              </span>
              <button type="button" className="cp-m-btn cp-m-btn--sm" onClick={() => setSheetOpen(true)}>
                Choose options
              </button>
            </div>
          )}
        </div>
        {built ? (
          <div className="cp-m-dl cp-noprint">
            <button type="button" className="cp-m-btn" onClick={download} disabled={!ready || downloading}>
              <DownloadIcon />
              {downloading ? "Preparing PDF…" : "Download PDF"}
            </button>
          </div>
        ) : null}
        {sheetOpen ? (
          <ReportOptionsSheet
            reportTitle={def.title}
            initial={committed}
            holdings={holdings.data}
            built={built}
            onClose={() => setSheetOpen(false)}
            onBuild={build}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="cp-report cp-page-wrap">
      <div className="cp-page">
        <div className="cp-phead cp-noprint">
          <div>
            <Link className="cp-back" href={clientReportsHubHref(hubScope, { mobile: false })}>
              ← All reports
            </Link>
            <div className="cp-eyebrow">Clear Portfolio · Client portal · Reports</div>
            <h1>{def.title}</h1>
          </div>
          <ReportOptionsBar
            draft={draft}
            holdings={holdings.data}
            onChange={setDraft}
            built={built}
            stale={stale}
            onBuild={() => build(draft)}
            download={
              built ? (
                <button
                  type="button"
                  className="cp-btn cp-btn--primary"
                  onClick={download}
                  disabled={!ready || downloading || stale}
                  title={stale ? "Update the report first" : undefined}
                >
                  <DownloadIcon />
                  {downloading ? "Preparing PDF…" : "Download PDF"}
                </button>
              ) : null
            }
          />
        </div>
        <div ref={outRef}>
          {built ? (
            output
          ) : (
            <div className="cp-empty">
              Choose the <b>entity</b>, <b>property</b> and <b>financial year</b> above, then select <b>Build report</b>.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
