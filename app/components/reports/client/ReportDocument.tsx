"use client";

import type { ReactNode } from "react";
import { fyLongLabel, fyRangeLabel } from "@/app/components/clients/portfolioDashboard";
import { Pill } from "./reportParts";
import { todayLabel } from "./reportFormat";
import type { ReportContext } from "./reportScope";

/**
 * The report as a document: a header naming who and what it covers, the
 * report's sections, and a footer. This element is what Download PDF
 * captures, so everything a reader needs to interpret the figures — the
 * scope, the year, what was left out — is inside it.
 */
export default function ReportDocument({
  reportKey,
  title,
  ctx,
  pills,
  ready,
  children,
}: {
  reportKey: string;
  title: string;
  ctx: ReportContext;
  /** Extra header pills, e.g. how many transactions await review. */
  pills?: ReactNode;
  /** False while sections are still loading; Download PDF waits for true. */
  ready: boolean;
  children: ReactNode;
}) {
  const fy = ctx.scope.fy;
  // "Sunrise Accounting Co." must not end the sentence with "..".
  const org = ctx.orgName.trim().replace(/\.+$/, "");
  const preparedBy = ctx.accountantName
    ? `Prepared from your records with ${ctx.accountantName}${org ? `, ${org}` : ""}.`
    : `Prepared from your records${org ? ` with ${org}` : ""}.`;

  return (
    <article className="cp-doc" data-report={reportKey} data-ready={ready ? "true" : "false"}>
      <div className="cp-pdf-brand">
        <i aria-hidden="true" />
        Clear Portfolio · {title}
      </div>
      <header className="cp-box cp-rhead">
        <div>
          <div className="cp-eyebrow">{title}</div>
          <h2>
            {ctx.clientName} · {ctx.who}
          </h2>
          <div className="cp-rhead-sub">{ctx.what}</div>
        </div>
        <div className="cp-pills">
          <Pill>
            {fyLongLabel(fy)} · {fyRangeLabel(fy)}
          </Pill>
          {pills}
        </div>
      </header>
      {children}
      <footer className="cp-doc-foot">
        <span>{preparedBy} A summary for your information, not tax advice or a tax return.</span>
        <span>Generated {todayLabel()}</span>
      </footer>
    </article>
  );
}
