"use client";

import { useCallback } from "react";
import { fetchJson, useAsyncRegion, type AsyncRegion } from "./useAsyncRegion";

/**
 * The signed-in client's entities and their properties, names only — for
 * pickers (the Reports page's scope picker). GET /api/entities already returns
 * each entity with its properties, and a client sees only their own.
 */

export type ClientHoldingProperty = { id: string; name: string; enabled: boolean };

export type ClientHoldingEntity = {
  id: string;
  name: string;
  enabled: boolean;
  properties: ClientHoldingProperty[];
};

type RawProperty = { id?: unknown; name?: unknown; enabled?: unknown };
type RawEntity = RawProperty & { properties?: unknown };

const text = (value: unknown) => (typeof value === "string" ? value : "");
const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

export function useClientHoldings(): AsyncRegion<ClientHoldingEntity[]> {
  const load = useCallback(async (token: string, signal: AbortSignal) => {
    const body = await fetchJson<{ items?: unknown }>("/api/entities", token, signal);
    const items = Array.isArray(body?.items) ? (body.items as RawEntity[]) : [];
    return items
      .filter((e) => text(e.id))
      .map((e) => ({
        id: text(e.id),
        name: text(e.name) || "Untitled entity",
        enabled: e.enabled !== false,
        properties: (Array.isArray(e.properties) ? (e.properties as RawProperty[]) : [])
          .filter((p) => text(p.id))
          .map((p) => ({
            id: text(p.id),
            name: text(p.name) || "Untitled property",
            enabled: p.enabled !== false,
          }))
          .sort(byName),
      }))
      .sort(byName);
  }, []);

  return useAsyncRegion("client-holdings", load);
}
