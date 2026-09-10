"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EntityPropertyListSkeleton } from "@/app/components/PortalSkeletons";
import { RegionError } from "@/app/components/ui/RegionError";
import {
  fetchJson,
  toRegion,
  useAsyncRegion,
  type AsyncRegion,
} from "@/app/components/useAsyncRegion";
import { useGstSummary } from "@/app/components/useGstSummary";
import {
  useAssetTransactions,
  usePersonalSummary,
} from "@/app/components/usePersonalAndAssetTransactions";
import {
  currentFinancialYear,
  fyLabel,
  parseFyLabel,
  usePnlTrend,
} from "@/app/components/usePnlTrend";
import { EntityProfitLossTrendCard } from "@/app/components/ProfitLossTrendCard";
import { getIdToken } from "@/src/lib/authToken";
import type {
  CoreEntity,
  CorePaginated,
  CorePersonalSummary,
  CoreProperty,
  CoreTransactionListItem,
  ReconciliationSession,
} from "@/src/lib/coreApi";
import EntityHeader from "./entity/EntityHeader";
import EntityStatCards from "./entity/EntityStatCards";
import EntityGstCards from "./entity/EntityGstCards";
import PersonalPanel from "./entity/PersonalPanel";
import AssetPanel from "./entity/AssetPanel";
import RegionalManagerCard from "./entity/RegionalManagerCard";
import EntityTabs, { tabPanelId } from "./entity/EntityTabs";
import PropertiesTab from "./entity/PropertiesTab";
import ReconciliationTab from "./entity/ReconciliationTab";
import {
  idleRegion,
  isEntityTab,
  mapRegion,
  readyRegion,
  type EntityTab,
  type RegionalManager,
} from "./entity/types";

// Tab bodies and modals load on first use: the transactions feature alone is
// ~10k lines and most visits never leave the Properties tab.
const AllTransactionsView = dynamic(
  () => import("@/app/components/TransactionsFeature").then((m) => m.AllTransactionsView),
  { ssr: false, loading: () => <EntityPropertyListSkeleton rows={2} /> },
);
const JournalEntriesList = dynamic(() => import("@/app/components/journal/JournalEntriesList"), {
  ssr: false,
  loading: () => <EntityPropertyListSkeleton rows={2} />,
});
const DocumentsListView = dynamic(() => import("@/app/components/DocumentsListView"), {
  ssr: false,
  loading: () => <EntityPropertyListSkeleton rows={2} />,
});
const GstSummaryModal = dynamic(() => import("@/app/components/GstSummaryModal"), { ssr: false });
const InactiveReasonModal = dynamic(() => import("@/app/components/InactiveReasonModal"), {
  ssr: false,
});

export type EntityDetailViewProps = {
  entityId: string;
  backHref: string;
  backLabel: string;
  addPropertyHref: string;
  addTransactionHref?: string;
  transactionRulesHref?: string;
  transactionRulesLabel?: string;
  transactionRulesClassName?: string;
  transactionRulesIcon?: "rules" | "reconcile";
  editEntityHref: string;
  propertyDetailHrefBase: string;
  reconciliationHref?: string;
};

function readSearchParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}

function writeSearchParam(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(key, value);
  else url.searchParams.delete(key);
  window.history.replaceState(null, "", url.toString());
}

const headStyle = { display: "flex", justifyContent: "space-between", alignItems: "center" } as const;
const headActionsStyle = { display: "flex", gap: 10, alignItems: "center" } as const;

export default function EntityDetailView({
  entityId,
  backHref,
  backLabel,
  addPropertyHref,
  addTransactionHref = "/dashboard/accountant/transactions/new",
  transactionRulesHref,
  transactionRulesLabel,
  transactionRulesClassName,
  transactionRulesIcon,
  editEntityHref,
  propertyDetailHrefBase,
  reconciliationHref,
}: EntityDetailViewProps) {
  const router = useRouter();
  const params = useParams<{ clientId?: string }>();
  const clientId = params?.clientId ?? "";
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The client dashboard has its own view today; kept for parity.
  const isClientView = (pathname || "").startsWith("/dashboard/client");
  const encodedId = encodeURIComponent(entityId);

  // ---------------------------------------------------------------------------
  // Tabs: the URL is the source of truth (history.replaceState updates
  // useSearchParams), so a same-page link to ?tab=… switches tabs without a
  // remount. Opened tabs stay mounted, hidden, so their state survives.
  // ---------------------------------------------------------------------------
  const urlTab = searchParams.get("tab");
  const currentTab: EntityTab = isEntityTab(urlTab) ? urlTab : "properties";
  const [openedTabsState, setOpenedTabsState] = useState<Set<EntityTab>>(() => new Set());
  const openedTabs = useMemo(() => {
    const set = new Set(openedTabsState);
    set.add(currentTab);
    return set;
  }, [openedTabsState, currentTab]);

  const selectTab = useCallback((tab: EntityTab) => {
    setOpenedTabsState((current) => {
      if (current.has(tab)) return current;
      const next = new Set(current);
      next.add(tab);
      return next;
    });
    writeSearchParam("tab", tab);
  }, []);

  // ---------------------------------------------------------------------------
  // Local UI state
  // ---------------------------------------------------------------------------
  const [isPersonalExpanded, setIsPersonalExpanded] = useState(false);
  const [personalOpened, setPersonalOpened] = useState(false);
  const [isAssetExpanded, setIsAssetExpanded] = useState(false);
  const [assetOpened, setAssetOpened] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const [rmError, setRmError] = useState<string | null>(null);
  const [enabledError, setEnabledError] = useState<string | null>(null);
  const [isTogglingEnabled, setIsTogglingEnabled] = useState(false);
  const [isInactiveModalOpen, setIsInactiveModalOpen] = useState(false);
  const [isGstModalOpen, setIsGstModalOpen] = useState(false);
  const [propertyToDeactivate, setPropertyToDeactivate] = useState<CoreProperty | null>(null);
  const [togglingPropertyId, setTogglingPropertyId] = useState<string | null>(null);
  const [pickedFy, setPickedFy] = useState<number | null>(() => {
    const raw = readSearchParam("trendYear");
    return raw ? parseFyLabel(raw) : null;
  });
  const trendFy = pickedFy ?? currentFinancialYear();

  // Journal and Documents still take a raw token prop.
  useEffect(() => {
    let cancelled = false;
    getIdToken()
      .then((token) => {
        if (!cancelled) setSessionToken(token);
      })
      .catch(() => {
        if (!cancelled) router.replace("/login/user");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  // ---------------------------------------------------------------------------
  // Regions. Wave 1 fires on mount; wave 2 waits for the entity so the header
  // paints first and the core API never sees more than three calls at once.
  // ---------------------------------------------------------------------------
  const entityKey = entityId || null;

  const entityRegion = useAsyncRegion<CoreEntity>(entityKey, (token, signal) =>
    fetchJson<CoreEntity>(`/api/entities/${encodedId}`, token, signal),
  );

  const propertiesRegion = useAsyncRegion<CoreProperty[]>(entityKey, async (token, signal) => {
    const data = await fetchJson<{ items?: CoreProperty[] }>(
      `/api/entities/${encodedId}/properties`,
      token,
      signal,
    );
    return data.items ?? [];
  });

  const entity = entityRegion.data;
  const entityReady = entityRegion.status === "ready" && entity !== null;
  const entityDisabled = entity?.enabled === false;
  const entityReconciled = entity?.reconciled === true;

  useEffect(() => {
    if (entityRegion.errorKind === "auth") router.replace("/login/user");
  }, [entityRegion.errorKind, router]);

  // The single-entity GET only carries counts on a current backend; when it
  // reports zero, one cheap paginated request confirms the real total.
  const needsTxCount = entityReady && (entity?.transactionsCount ?? 0) === 0;
  const txCountRegion = useAsyncRegion<number>(needsTxCount ? entityId : null, async (token, signal) => {
    const page = await fetchJson<CorePaginated<CoreTransactionListItem>>(
      `/api/entities/${encodedId}/transactions?limit=1&sort=date&dir=desc`,
      token,
      signal,
    );
    return page.total;
  });

  const transactionsCount: AsyncRegion<number> =
    entityReady && entity && entity.transactionsCount > 0
      ? readyRegion(entity.transactionsCount)
      : entityReady
        ? txCountRegion
        : mapRegion(entityRegion, (e) => e.transactionsCount);

  const propertiesCount: AsyncRegion<number> =
    propertiesRegion.status === "ready" && propertiesRegion.data
      ? readyRegion(propertiesRegion.data.length)
      : entityReady && entity && entity.propertiesCount > 0
        ? readyRegion(entity.propertiesCount)
        : mapRegion(propertiesRegion, (list) => list.length);

  const marketValue = useMemo(
    () =>
      mapRegion(propertiesRegion, (list) => ({
        value: list.reduce((sum, p) => sum + (p.estimatedMarketValue ?? 0), 0),
        propertyCount: list.length,
      })),
    [propertiesRegion],
  );

  // GST sits above the fold, so it loads with wave 1.
  const gst = useGstSummary("entity", entityId);
  const gstRegion = toRegion(
    gst.isLoading,
    gst.error,
    gst.summary
      ? { gstOnPurchases: gst.gstOnPurchases, gstOnSales: gst.gstOnSales, periodLabel: gst.periodLabel }
      : null,
    gst.reload,
  );

  // Collapsed panels load on first expansion, so an unopened panel costs the
  // page nothing.
  const personal = usePersonalSummary("entity", entityId, { enabled: personalOpened });
  const personalRegion = personalOpened
    ? toRegion(personal.isLoading, personal.error, personal.summary, personal.reload)
    // Not `typeof personal.summary` — that is `CorePersonalSummary | null`, and
    // AsyncRegion<T> already nulls its own data. Naming the payload keeps both
    // ternary branches on one instantiation, as the two panels below do.
    : idleRegion<CorePersonalSummary>();

  const assets = useAssetTransactions("entity", entityId, { enabled: assetOpened });
  const assetsRegion = assetOpened
    ? toRegion(assets.isLoading, assets.error, { rows: assets.rows, total: assets.total }, assets.reload)
    : idleRegion<{ rows: CoreTransactionListItem[]; total: number }>();

  // Wave 2. Until the user picks a year, an empty current year yields to the
  // latest year with data, which is what the card has always defaulted to.
  const trend = usePnlTrend(entityId, trendFy, {
    enabled: entityReady,
    autoSelectLatest: pickedFy === null,
  });
  const shownFy = trend.data?.financialYear ?? trendFy;

  const selectedRm: RegionalManager | null = entity?.regionalManager ?? null;
  const managersRegion = useAsyncRegion<RegionalManager[]>(
    !isClientView && entityReady && !selectedRm ? entityId : null,
    async (token, signal) => {
      const data = await fetchJson<{ regionalManagers?: RegionalManager[] }>(
        "/api/users/me/regional-managers",
        token,
        signal,
      );
      return data.regionalManagers ?? [];
    },
  );

  const sessionsRegion = useAsyncRegion<ReconciliationSession[]>(
    openedTabs.has("reconciliation") ? entityId : null,
    async (token, signal) => {
      const data = await fetchJson<unknown>(
        `/api/entities/${encodedId}/reconciliation-sessions`,
        token,
        signal,
      );
      return Array.isArray(data) ? (data as ReconciliationSession[]) : [];
    },
  );

  // ---------------------------------------------------------------------------
  // Mutations (optimistic, rolled back on failure)
  // ---------------------------------------------------------------------------
  async function patchJson<T>(url: string, body: unknown, fallbackMessage: string): Promise<T> {
    const token = await getIdToken();
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    if (!res.ok) throw new Error(data.message || data.error || fallbackMessage);
    return data as T;
  }

  async function handleAssignRm(rmId: string) {
    if (!entity) return;
    const previous = entity;
    const optimistic = rmId ? (managersRegion.data?.find((rm) => rm.id === rmId) ?? null) : null;
    setRmError(null);
    entityRegion.setData((current) =>
      current ? { ...current, regionalManager: rmId ? (optimistic ?? current.regionalManager) : null } : current,
    );
    try {
      const updated = await patchJson<CoreEntity>(
        `/api/entities/${encodedId}`,
        { assignedRegionalManagerId: rmId || null },
        "Failed to assign regional manager",
      );
      entityRegion.setData(() => updated);
    } catch {
      entityRegion.setData(() => previous);
      setRmError("Failed to assign Regional Manager. Please try again.");
    }
  }

  async function handleToggleEnabled(next: boolean, reason?: string) {
    if (!entity || isTogglingEnabled) return;
    const previous = entity;
    setEnabledError(null);
    setIsTogglingEnabled(true);
    entityRegion.setData((current) => (current ? { ...current, enabled: next } : current));
    try {
      const updated = await patchJson<Partial<CoreEntity>>(
        `/api/entities/${encodedId}`,
        { enabled: next, ...(next === false && reason ? { inactiveReason: reason } : {}) },
        `Failed to ${next ? "activate" : "deactivate"} entity`,
      );
      entityRegion.setData(() => ({ ...previous, ...updated }));
    } catch (err) {
      entityRegion.setData(() => previous);
      setEnabledError(
        err instanceof Error ? err.message : `Failed to ${next ? "activate" : "deactivate"} entity. Please try again.`,
      );
    } finally {
      setIsTogglingEnabled(false);
    }
  }

  async function handleTogglePropertyEnabled(property: CoreProperty, next: boolean, reason?: string) {
    if (togglingPropertyId) return;
    setEnabledError(null);
    setTogglingPropertyId(property.id);
    const apply = (enabled: boolean) =>
      propertiesRegion.setData((current) =>
        current ? current.map((p) => (p.id === property.id ? { ...p, enabled } : p)) : current,
      );
    apply(next);
    try {
      await patchJson(
        `/api/properties/${encodeURIComponent(property.id)}`,
        { enabled: next, ...(next === false && reason ? { inactiveReason: reason } : {}) },
        `Failed to ${next ? "activate" : "deactivate"} property`,
      );
    } catch (err) {
      apply(!next);
      setEnabledError(
        err instanceof Error ? err.message : `Failed to ${next ? "activate" : "deactivate"} property. Please try again.`,
      );
    } finally {
      setTogglingPropertyId(null);
    }
  }

  function handleTrendFyChange(fy: number) {
    setPickedFy(fy);
    writeSearchParam("trendYear", fyLabel(fy));
  }

  function handleViewAllAssets() {
    selectTab("transactions");
    requestAnimationFrame(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document
        .getElementById(tabPanelId("transactions"))
        ?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    });
  }

  const gstScope = useMemo(
    () => ({ level: "entity" as const, id: entityId, name: entity?.name ?? "" }),
    [entityId, entity?.name],
  );

  const entityName = entity?.name ?? "";
  const assetHrefBase = `/dashboard/accountant/clients/${clientId}/entities/${entityId}/assets`;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (entityRegion.status === "error" && entityRegion.errorKind !== "auth") {
    return (
      <section className="client-detail-page entity-detail-page">
        <Link href={backHref} className="entity-wizard-back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Back to {backLabel}
        </Link>
        <RegionError
          message={
            entityRegion.errorKind === "http" && entityRegion.error?.includes("404")
              ? "Entity not found."
              : entityRegion.error ?? "Failed to load entity."
          }
          onRetry={entityRegion.reload}
        />
      </section>
    );
  }

  return (
    <>
      <section className="client-detail-page entity-detail-page">
        <EntityHeader
          entity={entityRegion}
          propertiesCount={propertiesCount.status === "ready" ? propertiesCount.data : null}
          backHref={backHref}
          backLabel={backLabel}
          editEntityHref={editEntityHref}
          isClientView={isClientView}
          isTogglingEnabled={isTogglingEnabled}
          enabledError={enabledError}
          onToggleEnabled={(checked) => {
            if (!checked) setIsInactiveModalOpen(true);
            else void handleToggleEnabled(true);
          }}
          onOpenGst={() => setIsGstModalOpen(true)}
        />

        <EntityStatCards
          propertiesCount={propertiesCount}
          transactionsCount={transactionsCount}
          marketValue={marketValue}
        />

        <EntityGstCards gst={gstRegion} />

        <div className="entity-panel-grid">
          <PersonalPanel
            personal={personalRegion}
            expanded={isPersonalExpanded}
            onToggle={() => {
              setPersonalOpened(true);
              setIsPersonalExpanded((open) => !open);
            }}
          />
          <AssetPanel
            assets={assetsRegion}
            assetHrefBase={assetHrefBase}
            expanded={isAssetExpanded}
            onToggle={() => {
              setAssetOpened(true);
              setIsAssetExpanded((open) => !open);
            }}
            onViewAll={handleViewAllAssets}
          />
        </div>

        <EntityProfitLossTrendCard trend={trend} selectedFy={shownFy} onFyChange={handleTrendFyChange} />

        <RegionalManagerCard
          entityStatus={entityRegion.status}
          selectedRm={selectedRm}
          managers={managersRegion}
          disabled={entityDisabled}
          error={rmError}
          onAssign={(rmId) => void handleAssignRm(rmId)}
          onRemove={() => void handleAssignRm("")}
          onDismissError={() => setRmError(null)}
        />

        <EntityTabs
          currentTab={currentTab}
          openedTabs={openedTabs}
          onChange={selectTab}
          panels={{
            properties: (
              <PropertiesTab
                properties={propertiesRegion}
                entityDisabled={entityDisabled}
                entityReconciled={entityReconciled}
                isClientView={isClientView}
                addPropertyHref={addPropertyHref}
                propertyDetailHrefBase={propertyDetailHrefBase}
                addTransactionHref={addTransactionHref}
                togglingPropertyId={togglingPropertyId}
                onToggleProperty={(property, next) => {
                  if (!next) setPropertyToDeactivate(property);
                  else void handleTogglePropertyEnabled(property, true);
                }}
              />
            ),
            transactions: (
              <AllTransactionsView
                context={{ kind: "entity", entityId }}
                addTransactionHref={addTransactionHref}
                addTransactionDisabled={entityReconciled || entityDisabled}
                addTransactionDisabledReason={entityReconciled ? "Entity is reconciled" : "Entity is inactive"}
                rulesHref={transactionRulesHref}
                rulesButtonLabel={transactionRulesLabel}
                rulesButtonClassName={transactionRulesClassName}
                rulesButtonIcon={transactionRulesIcon}
                compact
              />
            ),
            journal: (
              <>
                <div className="entity-resource-head" style={headStyle}>
                  <h2>Journal Entries</h2>
                  <div style={headActionsStyle}>
                    <button
                      type="button"
                      className="property-outline-button"
                      onClick={() =>
                        router.push(`/dashboard/accountant/clients/${clientId}/entities/${entityId}/general-ledger`)
                      }
                    >
                      General Ledger
                    </button>
                    <button
                      type="button"
                      className="entity-wizard-primary is-orange"
                      disabled={entityDisabled}
                      title={entityDisabled ? "Entity is inactive" : undefined}
                      onClick={() => {
                        if (entityDisabled) return;
                        router.push(
                          `/dashboard/accountant/clients/${clientId}/entities/${entityId}/journal-entry/new?from=journal&fromName=${encodeURIComponent(entityName)}`,
                        );
                      }}
                    >
                      + Add Journal Entry
                    </button>
                  </div>
                </div>
                <JournalEntriesList
                  entityId={entityId}
                  clientId={clientId}
                  token={sessionToken}
                  disabled={entityDisabled}
                  disabledReason="Entity is inactive"
                />
              </>
            ),
            documents: (
              <DocumentsListView
                context={{ kind: "entity", entityId }}
                token={sessionToken}
                disabled={entityDisabled}
              />
            ),
            reconciliation: (
              <ReconciliationTab
                entityId={entityId}
                clientId={clientId}
                entityName={entityName}
                entityDisabled={entityDisabled}
                reconciliationHref={reconciliationHref}
                sessions={sessionsRegion}
                onCreated={(created) =>
                  sessionsRegion.setData((current) => [created, ...(current ?? [])])
                }
              />
            ),
          }}
        />
      </section>

      {isInactiveModalOpen && (
        <InactiveReasonModal
          isOpen
          onClose={() => setIsInactiveModalOpen(false)}
          onConfirm={(reason) => {
            setIsInactiveModalOpen(false);
            void handleToggleEnabled(false, reason);
          }}
          infoMessage="While disabling the entity, the properties under this entity will also be disabled."
        />
      )}
      {propertyToDeactivate && (
        <InactiveReasonModal
          isOpen
          onClose={() => setPropertyToDeactivate(null)}
          onConfirm={(reason) => {
            const property = propertyToDeactivate;
            setPropertyToDeactivate(null);
            void handleTogglePropertyEnabled(property, false, reason);
          }}
          type="property"
        />
      )}
      {isGstModalOpen && (
        <GstSummaryModal isOpen onClose={() => setIsGstModalOpen(false)} scope={gstScope} />
      )}
    </>
  );
}
