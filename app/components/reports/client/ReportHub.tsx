"use client";

import Link from "next/link";
import { CLIENT_REPORTS } from "./reportRegistry";
import { clientReportHrefFor, type ReportScopeQuery } from "./reportLinks";

/**
 * The list of client reports. `cards` is the desktop Reports page; `list` is
 * the phone's Insights → Reports tab. Either way each report opens with
 * `scope` (from an entity or property page) already selected.
 */
export default function ReportHub({
  variant,
  scope,
  scopeName,
  clearHref,
}: {
  variant: "cards" | "list";
  scope: ReportScopeQuery;
  /** The preselected entity or property, when there is one. */
  scopeName?: string | null;
  /** Where "show all" goes: the same list with nothing preselected. */
  clearHref?: string;
}) {
  const preselected = scopeName ? (
    <div className="cp-preselect">
      Reports open with <b>{scopeName}</b> selected.
      {clearHref ? (
        <>
          {" "}
          <Link href={clearHref}>Show all</Link>
        </>
      ) : null}
    </div>
  ) : null;

  if (variant === "cards") {
    return (
      <>
        {preselected}
        <div className="cp-cards">
          {CLIENT_REPORTS.map((r) => (
            <Link key={r.key} className="cp-card" href={clientReportHrefFor(r.key, scope)}>
              <span className="cp-card-ic">{r.icon}</span>
              <h2>{r.title}</h2>
              <span className="cp-card-blurb">{r.blurb}</span>
              <ul>
                {r.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <span className="cp-card-go">
                Open report <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="cp-m-hub">
      <div className="cp-m-intro">Choose a report, set the entity, property and year, then download it as a PDF.</div>
      {preselected}
      {CLIENT_REPORTS.map((r) => (
        <Link key={r.key} className="cp-m-rc" href={clientReportHrefFor(r.key, scope)}>
          <span className="cp-m-rc-ic">{r.icon}</span>
          <span>
            <span className="cp-m-rc-t">{r.title}</span>
            <span className="cp-m-rc-b">{r.blurb}</span>
          </span>
          <span className="cp-m-rc-chev" aria-hidden="true">
            ›
          </span>
        </Link>
      ))}
      <div className="cp-m-tip">
        Need one property only? Open it from <b>Property</b> and tap <b>Reports</b>. It opens with that property already
        selected.
      </div>
    </div>
  );
}
