/**
 * Where the client Reports live, and how to link into them with an entity or
 * property already selected.
 *
 * Desktop: the sidebar's Reports page (`/dashboard/client/reports`).
 * Phones: the Insights screen's Reports tab — the bottom nav stays at five
 * tabs, so Reports is a tab inside Insights rather than a sixth destination.
 * Both lists open the same report pages, so the numbers are the same on both.
 */

export type ClientReportKey = "pl" | "depreciation" | "gst" | "portfolio";

export type ReportScopeQuery = {
  entityId?: string | null;
  propertyId?: string | null;
};

export const CLIENT_REPORTS_PATH = "/dashboard/client/reports";
export const CLIENT_INSIGHTS_PATH = "/dashboard/client/insights";

function withScope(params: URLSearchParams, scope: ReportScopeQuery): URLSearchParams {
  if (scope.entityId) params.set("entity", scope.entityId);
  if (scope.propertyId) params.set("property", scope.propertyId);
  return params;
}

function href(path: string, params: URLSearchParams): string {
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * The list of reports, with `scope` preselected for whichever one is opened.
 * The entity and property pages' "Reports" buttons link here.
 */
export function clientReportsHubHref(
  scope: ReportScopeQuery,
  options: { mobile: boolean },
): string {
  if (options.mobile) {
    return href(CLIENT_INSIGHTS_PATH, withScope(new URLSearchParams({ tab: "reports" }), scope));
  }
  return href(CLIENT_REPORTS_PATH, withScope(new URLSearchParams(), scope));
}

/** One report, with `scope` preselected (not yet built). */
export function clientReportHrefFor(key: ClientReportKey, scope: ReportScopeQuery): string {
  const path =
    key === "portfolio"
      ? `${CLIENT_REPORTS_PATH}/portfolio-summary`
      : `${CLIENT_REPORTS_PATH}/${key}`;
  return href(path, withScope(new URLSearchParams(), scope));
}
