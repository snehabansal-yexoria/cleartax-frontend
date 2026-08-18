"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "boneyard-js/react";
import { ClientPropertiesSkeleton } from "@/app/components/PortalSkeletons";
import { getSession } from "@/src/lib/session";
import { formatCurrencyShort, getCurrencyPrefix, formatClientCurrency } from "@/app/components/clients/CurrencyFormatter";
import type { CoreEntity } from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

export default function ClientPropertyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityIdParam = searchParams.get("entityId");
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [entities, setEntities] = useState<CoreEntity[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<{ fullName?: string; email?: string } | null>(null);

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
        const session = (await getSession()) as SessionWithIdToken | null;
        if (!session) {
          router.replace("/login/user");
          return;
        }
        const token = session.getIdToken().getJwtToken();

        // 1. Fetch current user
        try {
          const userRes = await fetch("/api/users/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (userRes.ok) {
            const data = await userRes.json();
            if (!cancelled) setCurrentUser(data);
          }
        } catch (err) {
          console.error("Failed to fetch user:", err);
        }

        // 2. Fetch entities
        const res = await fetch("/api/entities", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;

        let loadedEntities: CoreEntity[] = [];
        if (res.ok) {
          const data = await res.json();
          loadedEntities = data.items || [];
          if (!cancelled) setEntities(loadedEntities);
        }

        if (cancelled || loadedEntities.length === 0) {
          if (!cancelled) setIsLoading(false);
          return;
        }

        // 3. Extract aggregated properties from nested entities response
        const allProperties = loadedEntities.flatMap((entity: any) => entity.properties || []);
        if (!cancelled) setProperties(allProperties);

        if (cancelled) return;

        // 4. Fetch transactions
        try {
          const txRes = await fetch("/api/transactions", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (txRes.ok) {
            const data = await txRes.json();
            if (!cancelled) setTransactions(data.items || []);
          }
        } catch (err) {
          console.error("Failed to fetch transactions:", err);
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

  const propertyListItems = properties.map((prop, idx) => {
    const ent = entities.find(e => e.id === prop.entityId);
    const entName = ent ? ent.name : "Individual";
    const mValue = prop.estimatedMarketValue || 0;
    const oLoans = prop.loanDetails ? Number(prop.loanDetails.loan_amount ?? prop.loanDetails.loanAmount ?? prop.loanDetails.amount ?? 0) : 0;

    const propTxs = transactions.filter(tx => {
      return tx.propertyIds?.includes(prop.id) || tx.propertyNames?.includes(prop.name);
    });

    const inc = propTxs
      .filter(tx => tx.type === "revenue")
      .reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);

    const exp = propTxs
      .filter(tx => tx.type === "expense")
      .reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);

    const netVal = inc - exp;
    const statusVal = prop.status || "Rented";
    const imageUrlVal = prop.imageUrl || null;

    return {
      id: prop.id,
      name: prop.name,
      entityName: entName,
      marketValue: mValue,
      outstandingLoans: oLoans,
      income: inc,
      expense: exp,
      net: netVal,
      status: statusVal,
      imageUrl: imageUrlVal,
      isReal: true,
      entityId: prop.entityId,
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
  const portfolioNetSum = filteredProperties.reduce((sum, p) => sum + p.net, 0);
  const calculatedReturnRate = portfolioValueSum > 0 ? (portfolioNetSum / portfolioValueSum) * 100 : 0;

  // Calculate average return rate
  const portfolioAvgReturn = calculatedReturnRate;

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
    <>
      <style>{`
        /* Baseline styles (Mobile first) */
        .property-cards-container {
          display: flex !important;
          flex-direction: column !important;
          gap: 16px !important;
          margin-bottom: 24px !important;
        }

        .m-db-property-list-card {
          display: flex !important;
          flex-direction: row !important;
          padding: 12px !important;
          gap: 12px !important;
          border-radius: 16px !important;
          overflow: hidden !important;
          height: auto !important;
          margin-bottom: 0 !important;
          border: 1px solid var(--border) !important;
          background: var(--surface-1) !important;
          box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05) !important;
          transition: all 0.2s ease-in-out !important;
        }

        .m-db-property-list-card:hover {
          box-shadow: 0px 4px 6px -2px rgba(16, 24, 40, 0.03), 0px 12px 16px -4px rgba(16, 24, 40, 0.08) !important;
          transform: translateY(-2px) !important;
        }

        .m-db-property-img-container {
          width: 96px !important;
          height: 96px !important;
          aspect-ratio: 1 / 1 !important;
          border-radius: 12px !important;
          flex-shrink: 0 !important;
          overflow: hidden !important;
          background: var(--surface-0) !important;
        }

        .m-db-property-img {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }

        .m-db-property-details {
          padding: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          flex-grow: 1 !important;
          gap: 0 !important;
          justify-content: space-between !important;
        }

        .m-db-property-name {
          font-size: 15px !important;
          font-weight: 600 !important;
          color: var(--text-primary) !important;
          margin: 0 0 2px 0 !important;
          line-height: 20px !important;
        }

        .m-db-property-entity {
          font-size: 12px !important;
          color: var(--text-secondary) !important;
          display: flex !important;
          align-items: center !important;
          gap: 4px !important;
          margin: 0 0 6px 0 !important;
        }

        .m-db-property-stats-line {
          display: flex !important;
          gap: 12px !important;
          margin: 0 0 8px 0 !important;
          font-size: 12px !important;
          color: var(--text-secondary) !important;
          font-weight: 400 !important;
        }

        .m-db-property-stat-label {
          color: var(--text-secondary) !important;
        }

        .m-db-property-stat-value {
          font-weight: 600 !important;
        }

        .m-db-property-stat-value.income {
          color: var(--success) !important;
        }

        .m-db-property-stat-value.expense {
          color: var(--text-primary) !important;
        }

        .m-db-property-bottom-line {
          margin-top: 0 !important;
          border-top: none !important;
          padding-top: 0 !important;
          display: flex !important;
          justify-content: flex-start !important;
          align-items: center !important;
          gap: 12px !important;
        }

        .m-db-property-badge {
          font-size: 12px !important;
          font-weight: 500 !important;
          padding: 4px 8px !important;
          border-radius: 8px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          text-align: center !important;
          line-height: 14px !important;
          max-width: 90px !important;
        }

        .m-db-property-badge.status-rented {
          background: #ecfdf3 !important;
          color: #027a48 !important;
        }
        .m-db-property-badge.status-self {
          background: #eff8ff !important;
          color: #175cd3 !important;
        }
        .m-db-property-badge.status-available {
          background: #fef6e7 !important;
          color: #b54708 !important;
        }

        html.dark .m-db-property-badge.status-rented {
          background: rgba(93, 202, 165, 0.15) !important;
          color: var(--success) !important;
        }
        html.dark .m-db-property-badge.status-self {
          background: var(--surface-2) !important;
          color: var(--text-secondary) !important;
        }
        html.dark .m-db-property-badge.status-available {
          background: rgba(244, 161, 23, 0.15) !important;
          color: var(--accent) !important;
        }

        .m-db-property-net {
          font-size: 13px !important;
          font-weight: 500 !important;
          color: var(--success) !important;
        }

        .m-db-portfolio-value.green-text {
          color: var(--success) !important;
        }

        /* Mobile-specific badge color override */
        @media (max-width: 767px) {
          .m-db-property-badge {
            background: #d1fadf !important;
            color: #027a48 !important;
          }
          html.dark .m-db-property-badge {
            background: rgba(93, 202, 165, 0.15) !important;
            color: var(--success) !important;
          }
        }

        /* Tablet & Desktop overrides */
        @media (min-width: 768px) {
          .m-db-subpage-header {
            background: transparent !important;
            border-bottom: none !important;
            padding: 0 !important;
            margin-bottom: 32px !important;
          }
          
          /* Portfolio Card adjustments */
          .m-db-portfolio-summary-card {
            max-width: 100% !important;
            padding: 24px !important;
            margin-bottom: 32px !important;
            border-radius: 16px !important;
            background: var(--surface-1) !important;
            border: 1px solid var(--border) !important;
            box-shadow: 0 4px 12px rgba(16, 24, 40, 0.01) !important;
          }
          .m-db-portfolio-col {
            padding: 0 8px !important;
          }
          .m-db-portfolio-col.divider-left {
            border-left: 1px solid var(--border) !important;
            padding-left: 32px !important;
          }
          .m-db-portfolio-label {
            font-size: 14px !important;
          }
          .m-db-portfolio-value {
          color: var(--text-primary) !important;
            font-size: 28px !important;
            margin-top: 8px !important;
          }
          
          .property-cards-container {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 24px !important;
          }

          .m-db-property-list-card {
            display: flex !important;
            flex-direction: column !important;
            padding: 0 !important;
            gap: 0 !important;
            border-radius: 12px !important;
            overflow: hidden !important;
            height: 100% !important;
            margin-bottom: 0 !important;
            border: 1px solid var(--border) !important;
            background: var(--surface-1) !important;
            box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05) !important;
          }

          .m-db-property-img-container {
            width: 100% !important;
            height: auto !important;
            aspect-ratio: 16 / 9 !important;
            border-radius: 0 !important;
          }

          .m-db-property-details {
            padding: 20px !important;
            display: flex !important;
            flex-direction: column !important;
            flex-grow: 1 !important;
            gap: 0 !important;
            justify-content: flex-start !important;
          }

          .m-db-property-name {
            font-size: 18px !important;
            font-weight: 600 !important;
            color: var(--text-primary) !important;
            margin: 0 0 6px 0 !important;
            line-height: 28px !important;
          }

          .m-db-property-entity {
            font-size: 14px !important;
            color: var(--text-secondary) !important;
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            margin: 0 0 16px 0 !important;
          }

          .m-db-property-stats-line {
            display: flex !important;
            gap: 16px !important;
            margin: 0 0 16px 0 !important;
            font-size: 14px !important;
            color: var(--text-secondary) !important;
            font-weight: 400 !important;
          }

          .m-db-property-stat-label {
            color: var(--text-secondary) !important;
          }

          .m-db-property-stat-value {
            font-weight: 600 !important;
          }

          .m-db-property-stat-value.expense {
            color: var(--danger) !important;
          }

          .m-db-property-bottom-line {
            margin-top: auto !important;
            border-top: 1px solid var(--border) !important;
            padding-top: 16px !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            gap: 0 !important;
          }

          .m-db-property-badge {
            font-size: 13px !important;
            font-weight: 500 !important;
            padding: 4px 10px !important;
            border-radius: 16px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: initial !important;
            line-height: initial !important;
            max-width: initial !important;
          }

          .m-db-property-net {
            font-size: 15px !important;
            font-weight: 500 !important;
            color: var(--success) !important;
          }
        }

        @media (min-width: 1025px) {
          .property-cards-container {
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 32px !important;
          }
        }

        /* Dark mode overrides for other inline elements in page */
        html.dark .m-db-subpage-header {
          background: transparent !important;
          border-bottom: none !important;
        }
        html.dark .m-db-entity-pill.is-active {
          background: var(--surface-2) !important;
          border-color: #ffb11f !important;
          color: #ffb11f !important;
        }
        html.dark .m-db-entity-pill.is-inactive {
          background: var(--surface-1) !important;
          border-color: var(--border) !important;
          color: var(--text-secondary) !important;
        }

        /* Skeleton specific styles */
        .m-db-subpage-header-skeleton {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          padding: 16px 20px !important;
          background: var(--surface-1) !important;
          border-bottom: 1px solid var(--border) !important;
          margin-bottom: 20px !important;
        }

        @media (min-width: 768px) {
          .m-db-subpage-header-skeleton {
            background: transparent !important;
            border-bottom: none !important;
            padding: 0 !important;
            margin-bottom: 32px !important;
          }
        }

        .m-db-content-container-skeleton {
          padding: 0 16px !important;
        }
        @media (min-width: 768px) {
          .m-db-content-container-skeleton {
            padding: 0 !important;
          }
        }

        .m-db-search-skeleton-container {
          margin: 8px 0 16px 0 !important;
          max-width: 100% !important;
        }
        @media (min-width: 768px) {
          .m-db-search-skeleton-container {
            margin: 12px 0 24px 0 !important;
          }
        }
      `}</style>

      <Skeleton
        name="client-property-page-skeleton"
        loading={isLoading}
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
                background: "#1a235a",
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
                placeholder="Search Transactions"
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

            {/* Portfolio Stats Summary Card */}
            <div className="m-db-portfolio-summary-card">
              <div className="m-db-portfolio-col">
                <span className="m-db-portfolio-label">Portfolio Value</span>
                <span className="m-db-portfolio-value">{formatCurrencyShort(portfolioValueSum)}</span>
              </div>
              <div className="m-db-portfolio-col divider-left">
                <span className="m-db-portfolio-label">Avg. Return</span>
                <span className="m-db-portfolio-value green-text">
                  {portfolioAvgReturn.toFixed(1)}%
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
                  const formattedExpense = formatClientCurrency(-prop.expense, { short: true });
                  const isImageBroken = brokenImages[prop.id];
                  const hasImageUrl = prop.imageUrl && prop.imageUrl !== "null" && prop.imageUrl !== "undefined" && prop.imageUrl.trim() !== "";

                  const imgTargetSrc = hasImageUrl
                    ? (prop.imageUrl.startsWith("http") || prop.imageUrl.startsWith("/")
                      ? prop.imageUrl
                      : `/api/documents/download?key=${encodeURIComponent(prop.imageUrl)}`)
                    : "";

                  return (
                    <div
                      key={`${prop.id}-${idx}`}
                      className="m-db-property-list-card cursor-pointer"
                      onClick={() => router.push(`/dashboard/client/properties/${prop.id}`)}
                    >
                      <div className="m-db-property-img-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {hasImageUrl && !isImageBroken ? (
                          <img
                            src={imgTargetSrc}
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
                              {formatClientCurrency(prop.income, { short: true, showPlus: true })}
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
                          <span className="m-db-property-net">
                            Net <span style={{ fontWeight: 700 }}>{formatClientCurrency(prop.net, { short: true, showPlus: true })}</span>
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
    </>
  );
}
