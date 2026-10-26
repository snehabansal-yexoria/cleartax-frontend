"use client";

import { useCallback } from "react";
import type { CoreGstRegistrationStatus } from "@/src/lib/coreApi";
import { fetchJson, useAsyncRegion, type AsyncRegion } from "./useAsyncRegion";

/**
 * The signed-in client's entities and their properties — for pickers (the
 * Reports pages' scope options) and report headers. GET /api/entities already
 * returns each entity with its properties, and a client sees only their own.
 */

export type ClientHoldingProperty = {
  id: string;
  name: string;
  enabled: boolean;
  /** "residential" | "commercial" | "vacant_land", or "" when unknown. */
  propertyType: string;
  /** Free-text address line, "" when not recorded. */
  locationText: string;
};

export type ClientHoldingEntity = {
  id: string;
  name: string;
  enabled: boolean;
  /** "individual" | "trust" | "company" | "partnership" | "smsf". */
  entityType: string;
  /** GST registration (migration 0054); "unknown" until recorded. */
  gstStatus: CoreGstRegistrationStatus;
  properties: ClientHoldingProperty[];
};

type RawProperty = {
  id?: unknown;
  name?: unknown;
  enabled?: unknown;
  propertyType?: unknown;
  locationText?: unknown;
};
type RawEntity = {
  id?: unknown;
  name?: unknown;
  enabled?: unknown;
  entityType?: unknown;
  gstStatus?: unknown;
  properties?: unknown;
};

const text = (value: unknown) => (typeof value === "string" ? value : "");
const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

// Mirrors coreApi's toGstRegistrationStatus; kept local so this client hook
// does not pull the server-side API module into the browser bundle.
const gstStatus = (value: unknown): CoreGstRegistrationStatus =>
  value === "registered" || value === "not_registered" ? value : "unknown";

/**
 * GET /api/entities' `items` as holdings, sorted by name. Exported for pages
 * that already fetch /api/entities for other reasons (Insights), so they do
 * not fetch it twice.
 */
export function toClientHoldings(rawItems: unknown): ClientHoldingEntity[] {
  const items = Array.isArray(rawItems) ? (rawItems as RawEntity[]) : [];
  return items
    .filter((e) => text(e.id))
    .map((e) => ({
      id: text(e.id),
      name: text(e.name) || "Untitled entity",
      enabled: e.enabled !== false,
      entityType: text(e.entityType),
      gstStatus: gstStatus(e.gstStatus),
      properties: (Array.isArray(e.properties) ? (e.properties as RawProperty[]) : [])
        .filter((p) => text(p.id))
        .map((p) => ({
          id: text(p.id),
          name: text(p.name) || "Untitled property",
          enabled: p.enabled !== false,
          propertyType: text(p.propertyType),
          locationText: text(p.locationText),
        }))
        .sort(byName),
    }))
    .sort(byName);
}

export function useClientHoldings(): AsyncRegion<ClientHoldingEntity[]> {
  const load = useCallback(async (token: string, signal: AbortSignal) => {
    const body = await fetchJson<{ items?: unknown }>("/api/entities", token, signal);
    return toClientHoldings(body?.items);
  }, []);

  return useAsyncRegion("client-holdings", load);
}
