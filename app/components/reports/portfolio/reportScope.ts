import type { CorePortfolioSummary } from "@/src/lib/coreApi";

/**
 * What the Portfolio Summary report says about its own scope — titles, the
 * subject line, which breakdowns are worth showing — kept apart from the
 * markup so the report can be re-skinned without touching the rules.
 *
 * One report, three scopes: the whole client, one entity, one property. The
 * figures are the same aggregate narrowed server-side; only what is worth
 * printing changes (a By Entity table with one row says nothing).
 */

export type ReportScopeLevel = "client" | "entity" | "property";

export type ReportScopeRequest = {
  entityId?: string | null;
  propertyId?: string | null;
};

export type ReportScopeView = {
  level: ReportScopeLevel;
  /** Page heading: "Portfolio Summary" / "Entity Summary" / "Property Summary". */
  title: string;
  /** Small label over the subject in the scope bar. */
  kicker: string;
  /** What the report is about, e.g. "Sarah Johnson · All entities". */
  subject: string;
  showEntityTable: boolean;
  showPropertyTable: boolean;
  /** The By Property table's Entity column (pointless inside one entity). */
  showEntityColumn: boolean;
  emptyTitle: string;
  emptyText: string;
  errorText: string;
};

/** The level a request asks for, before the server has answered. */
export function requestedReportLevel(requested: ReportScopeRequest): ReportScopeLevel {
  if (requested.propertyId) return "property";
  if (requested.entityId) return "entity";
  return "client";
}

function toLevel(value: string | undefined): ReportScopeLevel | null {
  return value === "client" || value === "entity" || value === "property" ? value : null;
}

export function describeReportScope(
  summary: CorePortfolioSummary | null,
  requested: ReportScopeRequest,
): ReportScopeView {
  // The server's scope wins once it has answered; until then, what was asked.
  const level = toLevel(summary?.scope.level) ?? requestedReportLevel(requested);
  const name = summary?.scope.name?.trim() ?? "";

  switch (level) {
    case "property": {
      const entityName = summary?.properties[0]?.entityName?.trim();
      return {
        level,
        title: "Property Summary",
        kicker: "Property summary",
        subject: summary ? [name || "This property", entityName].filter(Boolean).join(" · ") : "",
        showEntityTable: false,
        showPropertyTable: false,
        showEntityColumn: false,
        emptyTitle: "Nothing to report yet",
        emptyText: "This property has no recorded figures for the period.",
        errorText: "Couldn't load this property's summary.",
      };
    }
    case "entity":
      return {
        level,
        title: "Entity Summary",
        kicker: "Entity summary",
        subject: summary ? `${name || "This entity"} · All properties` : "",
        showEntityTable: false,
        showPropertyTable: true,
        showEntityColumn: false,
        emptyTitle: "No properties in this entity yet",
        emptyText: "Add a property to this entity to see its summary here.",
        errorText: "Couldn't load this entity's summary.",
      };
    default:
      return {
        level: "client",
        title: "Portfolio Summary",
        kicker: "Portfolio summary",
        subject: summary ? `${name || "Your portfolio"} · All entities` : "",
        showEntityTable: true,
        showPropertyTable: true,
        showEntityColumn: true,
        emptyTitle: "No properties yet",
        emptyText: "Add an entity and a property to see your portfolio summary here.",
        errorText: "Couldn't load your portfolio summary.",
      };
  }
}
