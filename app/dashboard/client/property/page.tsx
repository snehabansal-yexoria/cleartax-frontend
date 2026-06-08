"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Skeleton } from "boneyard-js/react";
import { ClientEntitiesSkeleton } from "@/app/components/PortalSkeletons";
import { getSession } from "@/src/lib/session";
import type { CoreEntity } from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

export default function ClientPropertyPage() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [entities, setEntities] = useState<CoreEntity[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<{ fullName?: string; email?: string } | null>(null);

  // Search & Filters states
  const [propertySearchQuery, setPropertySearchQuery] = useState("");
  const [selectedEntityFilter, setSelectedEntityFilter] = useState("all");
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

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

        // 3. Fetch properties in parallel
        const propertyPromises = loadedEntities.map(async (entity) => {
          try {
            const propRes = await fetch(`/api/entities/${entity.id}/properties`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (propRes.ok) {
              const data = await propRes.json();
              return (data.items || []).map((p: any) => ({ ...p, entityId: entity.id }));
            }
          } catch (err) {
            console.error(`Failed to fetch properties for entity ${entity.id}:`, err);
          }
          return [];
        });

        const propertiesArrays = await Promise.all(propertyPromises);
        const allProperties = propertiesArrays.flat();
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

  function formatCurrencyShort(value: number) {
    const sign = value < 0 ? "-" : "";
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
      return `${sign}$${(absValue / 1000000).toFixed(2)}M`;
    }
    if (absValue >= 10000) {
      const kVal = absValue / 1000;
      if (kVal % 1 === 0) {
        return `${sign}$${kVal.toFixed(0)}K`;
      }
      return `${sign}$${kVal.toFixed(1)}K`;
    }
    return `${sign}$${absValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }

  const isDemoDetailed = properties.length === 0;

  const propertyListItems = isDemoDetailed
    ? [
        {
          id: "demo-prop-1",
          name: "24 Darling Street",
          entityName: "Johnson Family Trust",
          marketValue: 1200000,
          outstandingLoans: 680000,
          income: 54600,
          expense: 30400,
          net: 24200,
          status: "Rented",
          imageUrl: "/house_darling_st.png",
          isReal: false,
          entityId: "demo-entity-1",
        },
        {
          id: "demo-prop-2",
          name: "12 Church Ave",
          entityName: "Johnson Family Trust",
          marketValue: 1050000,
          outstandingLoans: 420000,
          income: 45600,
          expense: 24000,
          net: 24200,
          status: "Self Occupied",
          imageUrl: "/house_church_ave.png",
          isReal: false,
          entityId: "demo-entity-1",
        },
        {
          id: "demo-prop-3",
          name: "8 Harbour Road",
          entityName: "SJ Holdings Pvt Ltd.",
          marketValue: 1000000,
          outstandingLoans: 280000,
          income: 39000,
          expense: 18400,
          net: 24200,
          status: "Available for Rent",
          imageUrl: "/house_harbour_rd.png",
          isReal: false,
          entityId: "demo-entity-2",
        }
      ]
    : properties.map((prop, idx) => {
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

  // Use Figma spec returns in demo mode, calculate dynamically in live mode
  const portfolioAvgReturn = properties.length === 0
    ? (selectedEntityFilter === "all" ? 4.7 : selectedEntityFilter === "Johnson Family Trust" ? 4.6 : 4.8)
    : (calculatedReturnRate > 0 ? calculatedReturnRate : 4.7);

  // Entities list for properties filter row
  const propertiesEntityPills = properties.length === 0
    ? [
        { id: "all", name: "All Entities" },
        { id: "Johnson Family Trust", name: "Johnson Family Trust" },
        { id: "SJ Holdings Pvt Ltd.", name: "SJ Holdings Pvt Ltd." },
        { id: "Sarah Johnson", name: "Sarah Johnson" }
      ]
    : [
        { id: "all", name: "All Entities" },
        ...entities.map(e => ({ id: e.id, name: e.name }))
      ];

  return (
    <Skeleton
      name="client-property-page-skeleton"
      loading={isLoading}
      fallback={<ClientEntitiesSkeleton />}
    >
      <div 
        className="mobile-client-dashboard" 
        style={{ 
          background: "#f7f9fc", 
          minHeight: "100vh",
          paddingBottom: isMobile ? "90px" : "40px"
        }}
      >
        <style>{`
          @media (min-width: 769px) {
            .property-cards-container {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
              gap: 20px;
            }
            .m-db-portfolio-summary-card {
              max-width: 600px;
            }
            .m-db-property-list-card {
              margin-bottom: 0 !important;
            }
          }
        `}</style>
        
        {/* Header */}
        <div 
          className="m-db-subpage-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: isMobile ? "16px 20px" : "20px 40px",
            background: "#ffffff",
            borderBottom: "1px solid #eaeef4",
            marginBottom: "20px"
          }}
        >
          <h1 style={{ fontSize: isMobile ? "24px" : "28px", fontWeight: 700, color: "#101828", margin: 0 }}>Properties</h1>
          <Link 
            href={entities.length > 0 ? `/dashboard/client/entities/${entities[0].id}/properties/new` : "/dashboard/client/entities/new"} 
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "40px",
              height: "40px",
              borderRadius: "20px",
              background: "#1a235a",
              color: "#ffffff",
              textDecoration: "none",
              fontSize: "24px",
              fontWeight: 400
            }}
          >
            +
          </Link>
        </div>

        {/* Content Area */}
        <div style={{ padding: isMobile ? "0 16px" : "0 40px" }}>
          {/* Search Box */}
          <div style={{ position: "relative", margin: "8px 0 16px 0", maxWidth: isMobile ? "100%" : "400px" }}>
            <div style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "18px", height: "18px", color: "#98a2b3" }}>
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
                border: "1px solid #eaeef4",
                fontSize: "15px",
                background: "#ffffff",
                color: "#101828",
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
          <div style={{ textAlign: "center", padding: "32px 16px", color: "#667085", background: "#ffffff", border: "1px solid #eaeef4", borderRadius: "16px" }}>
            No properties found matching search or filter criteria.
          </div>
        ) : (
          <div className="property-cards-container">
            {filteredProperties.map((prop, idx) => {
              const formattedExpense = formatCurrencyShort(prop.expense).replace("$", "");
              const isImageBroken = brokenImages[prop.id];
              const hasImageUrl = prop.imageUrl && prop.imageUrl !== "null" && prop.imageUrl !== "undefined" && prop.imageUrl.trim() !== "";
              
              const imgTargetSrc = hasImageUrl
                ? (prop.imageUrl.startsWith("http") || prop.imageUrl.startsWith("/")
                  ? prop.imageUrl
                  : `/api/documents/download?key=${encodeURIComponent(prop.imageUrl)}`)
                : "";

              return (
                <div key={`${prop.id}-${idx}`} className="m-db-property-list-card">
                  <div className="m-db-property-img-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {hasImageUrl && !isImageBroken ? (
                      <img 
                        src={imgTargetSrc} 
                        alt={prop.name} 
                        className="m-db-property-img" 
                        onError={() => setBrokenImages(prev => ({ ...prev, [prop.id]: true }))}
                      />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "32px", height: "32px", color: "#98a2b3" }}>
                        <rect x="3" y="3" width="18" height="18" rx="4" />
                        <circle cx="8.5" cy="8.5" r="2" />
                        <path d="M3 19c2.5-3.5 6-3.5 9 0 2.5-3.5 6-7 9-3" />
                      </svg>
                    )}
                  </div>
                  <div className="m-db-property-details">
                    <h3 className="m-db-property-name">{prop.name}</h3>
                    <div className="m-db-property-entity" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '13px' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "14px", height: "14px", color: "#667085" }}>
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                      </svg>
                      <Link 
                        href={`/dashboard/client/entities/${prop.entityId}`} 
                        style={{ textDecoration: 'none', color: '#667085' }}
                      >
                        {prop.entityName}
                      </Link>
                    </div>
                    
                    <div className="m-db-property-stats-line">
                      <div>
                        <span className="m-db-property-stat-label">Income </span>
                        <span className="m-db-property-stat-value income">
                          +{formatCurrencyShort(prop.income)}
                        </span>
                      </div>
                      <div>
                        <span className="m-db-property-stat-label">Expense </span>
                        <span className="m-db-property-stat-value expense">
                          -{formattedExpense}
                        </span>
                      </div>
                    </div>

                    <div className="m-db-property-bottom-line">
                      <span className="m-db-property-badge">
                        {prop.status}
                      </span>
                      <span className="m-db-property-net">
                        Net +{formatCurrencyShort(prop.net)}
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
