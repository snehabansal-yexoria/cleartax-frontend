import type { AsyncRegion, RegionStatus } from "@/app/components/useAsyncRegion";
import type { CoreRegionalManager } from "@/src/lib/coreApi";

export type EntityTab =
  | "properties"
  | "transactions"
  | "journal"
  | "documents"
  | "reconciliation";

export const entityTabs: ReadonlyArray<{ id: EntityTab; label: string }> = [
  { id: "properties", label: "Properties" },
  { id: "transactions", label: "Transactions" },
  { id: "journal", label: "Journal Entries" },
  { id: "documents", label: "Documents" },
  { id: "reconciliation", label: "Reconciliations" },
];

export function isEntityTab(value: unknown): value is EntityTab {
  return typeof value === "string" && entityTabs.some((tab) => tab.id === value);
}

export type RegionalManager = CoreRegionalManager;

const noop = () => {};

/** A region that is already settled — for values derived synchronously. */
export function readyRegion<T>(data: T): AsyncRegion<T> {
  return { status: "ready", data, error: null, errorKind: null, reload: noop, setData: noop };
}

/** A region nothing has asked for yet — renders as loading. */
export function idleRegion<T>(): AsyncRegion<T> {
  return { status: "idle", data: null, error: null, errorKind: null, reload: noop, setData: noop };
}

/** Projects a region's data without touching its status or error. */
export function mapRegion<T, U>(region: AsyncRegion<T>, fn: (data: T) => U): AsyncRegion<U> {
  return {
    status: region.status,
    data: region.data === null ? null : fn(region.data),
    error: region.error,
    errorKind: region.errorKind,
    reload: region.reload,
    setData: noop,
  };
}

/** `idle` regions (not yet asked for) render exactly like loading ones. */
export function isPending(status: RegionStatus): boolean {
  return status === "idle" || status === "loading";
}
