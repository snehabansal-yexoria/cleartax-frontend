"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "boneyard-js/react";
import { ClientPropertiesSkeleton } from "@/app/components/PortalSkeletons";
import { getIdToken } from "@/src/lib/authToken";
import {
  formatExactCurrency,
  formatClientCurrency,
  formatClientPercent,
  toneClass,
} from "@/app/components/clients/CurrencyFormatter";
import type { CoreEntity } from "@/src/lib/coreApi";
import { usePortfolioSummary } from "@/app/components/usePortfolioSummary";
import { fetchCurrentUser } from "@/app/components/currentUser";
import RegionError from "@/app/components/ui/RegionError";
import {
  currentFinancialYear,
  fyShortLabel,
} from "@/app/components/clients/portfolioDashboard";
import { propertyImageSrc } from "@/src/lib/propertyImage";

export default function ClientPropertyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityIdParam = searchParams.get("entityId");
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [entities, setEntities] = useState<CoreEntity[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);

  // Search & Filters states
  const [propertySearchQuery, setPropertySearchQuery] = useState("");
  const [selectedEntityFilter, setSelectedEntityFilter] = useState(entityIdParam || "all");
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (entityIdParam) {
      setSelectedEntityFilter(entityIdParam);
    } else {
      setSelectedEntityFilter("all");
    }
  }, [entityIdParam]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        let token: string;
        try {
          token = await getIdToken();
        } catch {
          router.replace("/login/user");
          return;
        }

        // The user (for the client id the summary is keyed on) and the
        // entities are independent, so they load together. No transactions:
        // income / expense come from the Portfolio Summary below.
        const [userResult, entitiesResult] = await Promise.allSettled([
          fetchCurrentUser(token),
          fetch("/api/entities", { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (cancelled) return;

        if (userResult.status === "fulfilled") {
          setClientId(userResult.value.id || null);
        } else {
          console.error("Failed to fetch user:", userResult.reason);
        }

        if (entitiesResult.status === "fulfilled" && entitiesResult.value.ok) {
          const data = await entitiesResult.value.json();
          if (cancelled) return;
          const loadedEntities: CoreEntity[] = data.items || [];
          setEntities(loadedEntities);
          setProperties(loadedEntities.flatMap((entity: any) => entity.properties || []));
        }
      } catch (err) {
        console.error("Failed to load property data:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Income / expense / net per property come from the Portfolio Summary — the
  // Reports page's aggregate (gross, each property's share of a split bill,
  // unreviewed rows excluded, this financial year). They used to be summed in
  // the browser from one 50-row page of transactions, so any property whose
  // older rows fell off that page showed too little (or A$ 0).
  const financialYear = currentFinancialYear();
  const summaryRegion = usePortfolioSummary(clientId, financialYear);
  const summary = summaryRegion.data;
  const summaryRows = new Map((summary?.properties ?? []).map((row) => [row.propertyId, row]));

  const propertyListItems = properties.map((prop) => {
    const ent = entities.find(e => e.id === prop.entityId);
    const row = summaryRows.get(prop.id);

    return {
      id: prop.id as string,
      name: prop.name as string,
      entityName: ent ? ent.name : "Individual",
      marketValue: Number(prop.estimatedMarketValue) || 0,
      income: row ? row.income : null,
      expense: row ? row.expenses : null,
      // Net after depreciation, as on the Reports page.
      net: row ? row.netResult : null,
      status: (prop.status as string) || "Rented",
      imageUrl: (prop.imageUrl as string) || null,
      isReal: true,
      entityId: prop.entityId as string,
    };
  });

  // Filter properties
  let filteredProperties = propertyListItems;
  if (selectedEntityFilter !== "all") {
    filteredProperties = filteredProperties.filter(
      p => p.entityId === selectedEntityFilter || p.entityName === selectedEntityFilter
    );
  }
  if (propertySearchQuery.trim()) {
    const q = propertySearchQuery.toLowerCase();
    filteredProperties = filteredProperties.filter(
      p => p.name.toLowerCase().includes(q) || p.entityName.toLowerCase().includes(q)
    );
  }

  // Calculate portfolio stats
  const portfolioValueSum = filteredProperties.reduce((sum, p) => sum + p.marketValue, 0);
  const portfolioNetSum = filteredProperties.reduce((sum, p) => sum + (p.net ?? 0), 0);

  // Net result this financial year over recorded value; null (shown "—")
  // until the summary arrives or when there is no value to divide by.
  const portfolioAvgReturn =
    summary && portfolioValueSum > 0 ? (portfolioNetSum / portfolioValueSum) * 100 : null;

  // Entities list for properties filter row
  const propertiesEntityPills = [
    { id: "all", name: "All Entities" },
    ...entities.map(e => ({ id: e.id, name: e.name }))
  ];

  const getStatusClass = (status: string) => {
    const norm = status?.toLowerCase() || "";
    if (norm.includes("rented")) return "status-rented";
    if (norm.includes("self")) return "status-self";
    if (norm.includes("available")) return "status-available";
    return "status-rented";
  };

  return (
    <Skeleton
      name="client-property-page-skeleton"
      loading={isLoading || (clientId !== null && summaryRegion.status === "loading" && !summary)}
      fallback={<ClientPropertiesSkeleton />}
    >
        <div
          className={isMobile ? "mobile-client-dashboard" : "desktop-client-dashboard"}
          style={isMobile ? { minHeight: "100vh", paddingBottom: "90px" } : undefined}
        >
          {/* Header */}
          <div
            className="m-db-subpage-header"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: isMobile ? "16px 20px" : "20px 40px",
              background: "var(--surface-1)",
              borderBottom: "1px solid var(--border)",
              marginBottom: "20px"
            }}
          >
            <h1 style={{ fontSize: isMobile ? "24px" : "28px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Properties</h1>
            <Link
              href="/dashboard/client/properties/new"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "40px",
                height: "40px",
                borderRadius: "20px",
                background: "var(--brand)",
                color: "#ffffff",
                textDecoration: "none"
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ width: "20px", height: "20px" }}
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </Link>
          </div>

          {/* Content Area */}
          <div style={{ padding: isMobile ? "0 16px" : "0" }}>
            {/* Search Box */}
            <div style={{ position: "relative", margin: isMobile ? "8px 0 16px 0" : "12px 0 24px 0", maxWidth: "100%" }}>
              <div style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "18px", height: "18px", color: "var(--text-muted)" }}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search properties"
                aria-label="Search properties"
                value={propertySearchQuery}
                onChange={(e) => setPropertySearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 16px 12px 40px",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  fontSize: "15px",
                  background: "var(--surface-1)",
                  color: "var(--text-primary)",
                  outline: "none",
                  boxShadow: "0 4px 12px rgba(16, 24, 40, 0.01)"
                }}
              />
            </div>

            {/* Entity Horizontal Pills */}
            <div className="m-db-entity-pills-row">
              {propertiesEntityPills.map((pill) => {
                const isActive = selectedEntityFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setSelectedEntityFilter(pill.id)}
                    className={`m-db-entity-pill ${isActive ? "is-active" : "is-inactive"}`}
                  >
                    {pill.id === "all" ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "16px", height: "16px" }}>
                        <polygon points="12 2 22 7 12 12 2 7 12 2" />
                        <polyline points="2 17 12 22 22 17" />
                        <polyline points="2 12 12 17 22 12" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "16px", height: "16px" }}>
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                      </svg>
                    )}
                    <span>{pill.name}</span>
                  </button>
                );
              })}
            </div>

            {summaryRegion.status === "error" && (
              <div style={{ marginBottom: "16px" }}>
                <RegionError
                  message={`Couldn't load income and expenses. ${summaryRegion.error ?? ""}`.trim()}
                  onRetry={summaryRegion.reload}
                />
              </div>
            )}

            {/* Portfolio Stats Summary Card */}
            <div className="m-db-portfolio-summary-card">
              <div className="m-db-portfolio-col">
                <span className="m-db-portfolio-label">Portfolio Value</span>
                <span className="m-db-portfolio-value">{formatExactCurrency(portfolioValueSum)}</span>
              </div>
              <div className="m-db-portfolio-col divider-left" title={`Net result ${fyShortLabel(financialYear)} ÷ portfolio value`}>
                <span className="m-db-portfolio-label">Avg. Return</span>
                {/* Red when negative — this was always green, even at -151.9%. */}
                <span className={`m-db-portfolio-value ${toneClass(portfolioAvgReturn)}`}>
                  {portfolioAvgReturn != null ? formatClientPercent(portfolioAvgReturn) : "—"}
                </span>
              </div>
              <div className="m-db-portfolio-col divider-left">
                <span className="m-db-portfolio-label">Properties</span>
                <span className="m-db-portfolio-value">{filteredProperties.length}</span>
              </div>
            </div>

            {/* Properties List */}
            {filteredProperties.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-secondary)", background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "16px" }}>
                {properties.length === 0 ? "No properties available. Click the '+' button in the top right to register your first property." : "No properties found matching search or filter criteria."}
              </div>
            ) : (
              <div className="property-cards-container">
                {filteredProperties.map((prop, idx) => {
                  const formattedExpense = prop.expense != null ? formatExactCurrency(-prop.expense) : "—";
                  const isImageBroken = brokenImages[prop.id];
                  const imgTargetSrc = propertyImageSrc(prop.imageUrl);
                  const hasImageUrl = imgTargetSrc !== null;

                  return (
                    <div
                      key={`${prop.id}-${idx}`}
                      className="m-db-property-list-card cursor-pointer"
                      onClick={() => router.push(`/dashboard/client/properties/${prop.id}`)}
                    >
                      <div className="m-db-property-img-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {hasImageUrl && !isImageBroken ? (
                          <img
                            src={imgTargetSrc ?? undefined}
                            alt={prop.name}
                            className="m-db-property-img"
                            onError={() => setBrokenImages(prev => ({ ...prev, [prop.id]: true }))}
                          />
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "32px", height: "32px", color: "var(--text-muted)" }}>
                            <rect x="3" y="3" width="18" height="18" rx="4" />
                            <circle cx="8.5" cy="8.5" r="2" />
                            <path d="M3 19c2.5-3.5 6-3.5 9 0 2.5-3.5 6-7 9-3" />
                          </svg>
                        )}
                      </div>
                      <div className="m-db-property-details">
                        <h3 className="m-db-property-name">{prop.name}</h3>
                        <div className="m-db-property-entity">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "14px", height: "14px", color: "var(--text-muted)" }}>
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                          </svg>
                          <Link
                            href={`/dashboard/client/entities/${prop.entityId}`}
                            style={{ textDecoration: 'none', color: 'var(--text-secondary)' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {prop.entityName}
                          </Link>
                        </div>

                        <div className="m-db-property-stats-line">
                          <div>
                            <span className="m-db-property-stat-label">Income </span>
                            <span className="m-db-property-stat-value income">
                              {prop.income != null ? formatExactCurrency(prop.income, { showPlus: true }) : "—"}
                            </span>
                          </div>
                          <div>
                            <span className="m-db-property-stat-label">Expense </span>
                            <span className="m-db-property-stat-value expense">
                              {formattedExpense}
                            </span>
                          </div>
                        </div>

                        <div className="m-db-property-bottom-line">
                          <span className={`m-db-property-badge ${getStatusClass(prop.status)}`}>
                            {prop.status}
                          </span>
                          <span
                            className={`m-db-property-net ${toneClass(prop.net)}`}
                            title={`Net result, ${fyShortLabel(financialYear)}`}
                          >
                            Net <span style={{ fontWeight: 700 }}>{prop.net != null ? formatExactCurrency(prop.net, { showPlus: true }) : "—"}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Skeleton>
  );
}
