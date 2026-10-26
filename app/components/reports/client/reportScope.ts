"use client";

import { useCallback, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { currentFinancialYear } from "@/app/components/clients/portfolioDashboard";
import {
  parseFinancialYear,
  parseUuid,
} from "@/app/components/reports/portfolio/useReportSearchParams";
import type {
  ClientHoldingEntity,
  ClientHoldingProperty,
} from "@/app/components/useClientHoldings";
import type { CurrentUser } from "@/app/components/currentUser";

/**
 * What a client report covers, and the URL that holds it.
 *
 * The URL carries the BUILT scope (`?fy=2026&entity=…&property=…`, end-year
 * convention). A report page with no `fy` has not been built yet: the entity
 * and property in its URL are only a preselection (from an entity or property
 * page's Reports button), and the client still chooses the year and selects
 * Build report. The options the client is editing live in page state until
 * then, so changing a select never refetches anything.
 */

export type ReportScope = {
  /** End-year convention: 2026 is FY 2025-26. */
  fy: number;
  entityId: string | null;
  propertyId: string | null;
};

export type ReportLevel = "client" | "entity" | "property";

export function sameScope(a: ReportScope, b: ReportScope): boolean {
  return a.fy === b.fy && a.entityId === b.entityId && a.propertyId === b.propertyId;
}

/** The financial years offered: this one and the five before it, newest first. */
export function reportYearOptions(now: Date = new Date()): number[] {
  const current = currentFinancialYear(now);
  return Array.from({ length: 6 }, (_, i) => current - i);
}

export function useReportQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const fy = parseFinancialYear(searchParams.get("fy"));
  const committed: ReportScope = {
    fy: fy ?? currentFinancialYear(),
    entityId: parseUuid(searchParams.get("entity")),
    propertyId: parseUuid(searchParams.get("property")),
  };

  /** Build (or rebuild) the report for `scope`. Replace, not push: Back
   * returns to the report list, not through every rebuild. */
  const commit = useCallback(
    (scope: ReportScope) => {
      const params = new URLSearchParams({ fy: String(scope.fy) });
      if (scope.entityId) params.set("entity", scope.entityId);
      if (scope.propertyId) params.set("property", scope.propertyId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname],
  );

  return {
    committed,
    built: fy != null,
    commit,
    /** Changes whenever the URL does — keys page state to one URL. */
    search: searchParams.toString(),
  };
}

/** A property with the entity that owns it (every property has exactly one). */
export type ScopeProperty = ClientHoldingProperty & { entityId: string; entityName: string };

/** Everything a report needs to know about who and what it covers. */
export type ReportContext = {
  scope: ReportScope;
  level: ReportLevel;
  clientId: string;
  clientName: string;
  accountantName: string;
  orgName: string;
  holdings: ClientHoldingEntity[];
  /** The scope's entity (the property's owner at property level), else null. */
  entity: ClientHoldingEntity | null;
  property: ScopeProperty | null;
  /** The entities and properties the report covers. */
  entities: ClientHoldingEntity[];
  properties: ScopeProperty[];
  /** Header lines: "All entities" / entity name, and the property line. */
  who: string;
  what: string;
};

export function allProperties(holdings: ClientHoldingEntity[]): ScopeProperty[] {
  return holdings.flatMap((e) =>
    e.properties.map((p) => ({ ...p, entityId: e.id, entityName: e.name })),
  );
}

/**
 * Settle a requested scope against the client's holdings. A property always
 * belongs to one entity, so a property wins over a disagreeing entity, and an
 * id the client does not own is dropped rather than reported on.
 */
export function normaliseScope(scope: ReportScope, holdings: ClientHoldingEntity[]): ReportScope {
  const property = scope.propertyId
    ? allProperties(holdings).find((p) => p.id === scope.propertyId) ?? null
    : null;
  if (property) return { ...scope, entityId: property.entityId, propertyId: property.id };
  const entity = scope.entityId ? holdings.find((e) => e.id === scope.entityId) ?? null : null;
  return { ...scope, entityId: entity?.id ?? null, propertyId: null };
}

export function buildReportContext(
  requested: ReportScope,
  holdings: ClientHoldingEntity[],
  user: CurrentUser,
): ReportContext {
  const scope = normaliseScope(requested, holdings);
  const property = scope.propertyId
    ? allProperties(holdings).find((p) => p.id === scope.propertyId) ?? null
    : null;
  const entity = scope.entityId ? holdings.find((e) => e.id === scope.entityId) ?? null : null;
  const level: ReportLevel = property ? "property" : entity ? "entity" : "client";

  const entities = entity ? [entity] : holdings;
  const properties = property
    ? [property]
    : entity
      ? entity.properties.map((p) => ({ ...p, entityId: entity.id, entityName: entity.name }))
      : allProperties(holdings);

  const what = property
    ? `${property.name}${property.locationText ? `, ${property.locationText}` : ""}`
    : `All properties (${properties.length})`;

  return {
    scope,
    level,
    clientId: user.id,
    clientName: user.fullName || user.email || "Your portfolio",
    accountantName: user.assignedAccountantName ?? "",
    orgName: user.orgName ?? "",
    holdings,
    entity,
    property,
    entities,
    properties,
    who: entity ? entity.name : "All entities",
    what,
  };
}

const PHONE_QUERY = "(max-width: 768px)";

function subscribePhone(onChange: () => void) {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Phones get the mobile report layout; the same 768px switch as the rest of
 * the portal. False on the server and the first client render, so hydration
 * matches.
 */
export function useIsPhone(): boolean {
  return useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}
