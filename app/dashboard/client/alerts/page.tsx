"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useId, useRef } from "react";
import { Skeleton } from "boneyard-js/react";
import { getSession } from "@/src/lib/session";
import { formatCurrencyShort, formatClientCurrency } from "@/app/components/clients/CurrencyFormatter";
import type { CoreEntity } from "@/src/lib/coreApi";
import "../client.css";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

interface AlertItem {
  id: string;
  type: "rent" | "water" | "loan";
  title: string;
  property: string;
  statusText: string;
  statusType: "overdue" | "due";
  amount: number;
  bellBg: string;
  bellColor: string;
  badgeBg: string;
  badgeTextColor: string;
  isPaid?: boolean;
}

interface ActivityItem {
  id: string;
  title: string;
  meta: string;
  badgeText?: string;
  badgeColor?: string;
  badgeBg?: string;
  amount?: string;
  amountType?: "income" | "expense";
  iconType: "clock" | "income" | "expense";
  iconBg: string;
  iconColor: string;
  propertyAddress: string;
  statusText: string;
  fileName?: string;
  fileSize?: string;
}

interface ProofTxOption {
  id: string;
  title: string;
  meta: string;
  amount?: string;
  iconType: "clock" | "expense";
  iconBg: string;
  iconColor: string;
}

function AlertsPageSkeleton() {
  return (
    <div className="alerts-page-container skeleton-page boneyard-fallback" style={{ background: "var(--surface-0)", minHeight: "100vh", padding: "32px", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        
        {/* Header Skeleton */}
        <div style={{ marginBottom: "24px" }}>
          <div className="skeleton-line" style={{ width: "240px", height: "32px", borderRadius: "6px", marginBottom: "8px" }} />
          <div className="skeleton-line" style={{ width: "320px", height: "16px", borderRadius: "4px" }} />
        </div>

        {/* Quick Actions Skeleton */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
          <div className="skeleton-pill" style={{ width: "150px", height: "40px", borderRadius: "12px" }} />
          <div className="skeleton-pill" style={{ width: "130px", height: "40px", borderRadius: "12px" }} />
          <div className="skeleton-pill" style={{ width: "130px", height: "40px", borderRadius: "12px" }} />
        </div>

        {/* Net Equity Card Skeleton */}
        <div className="m-db-net-card" style={{ width: '100%', marginBottom: '32px', minHeight: '160px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="skeleton-line" style={{ width: "120px", height: "16px", borderRadius: "4px" }} />
          <div className="skeleton-line" style={{ width: "200px", height: "42px", borderRadius: "6px" }} />
          <div className="m-db-net-divider" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton-stack" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="skeleton-line" style={{ width: "80px", height: "12px", borderRadius: "3px" }} />
                <div className="skeleton-line" style={{ width: "100px", height: "18px", borderRadius: "4px" }} />
              </div>
            ))}
          </div>
        </div>

        {/* Two Columns Grid Skeleton */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "32px" }} className="skeleton-grid-cols">
          {/* Column 1: Payment Alerts */}
          <div>
            <div className="skeleton-line" style={{ width: "160px", height: "20px", borderRadius: "4px", marginBottom: "16px" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "var(--surface-1)", borderRadius: "16px", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div className="skeleton-circle" style={{ width: "42px", height: "42px", borderRadius: "12px" }} />
                    <div className="skeleton-stack" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div className="skeleton-line" style={{ width: "180px", height: "14px", borderRadius: "3px" }} />
                      <div className="skeleton-line" style={{ width: "120px", height: "12px", borderRadius: "3px" }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div className="skeleton-line" style={{ width: "60px", height: "16px", borderRadius: "3px" }} />
                    <div className="skeleton-pill" style={{ width: "100px", height: "32px", borderRadius: "10px" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Recent Activity */}
          <div>
            <div className="skeleton-line" style={{ width: "140px", height: "20px", borderRadius: "4px", marginBottom: "16px" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "var(--surface-1)", borderRadius: "16px", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div className="skeleton-circle" style={{ width: "36px", height: "36px", borderRadius: "10px" }} />
                    <div className="skeleton-stack" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div className="skeleton-line" style={{ width: "160px", height: "13px", borderRadius: "3px" }} />
                      <div className="skeleton-line" style={{ width: "140px", height: "11px", borderRadius: "3px" }} />
                    </div>
                  </div>
                  <div className="skeleton-pill" style={{ width: "90px", height: "22px", borderRadius: "12px" }} />
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      <style>{`
        /* Base loading animations */
        .skeleton-page .skeleton-line,
        .skeleton-page .skeleton-circle,
        .skeleton-page .skeleton-pill {
          background: linear-gradient(90deg, var(--surface-2) 0%, var(--surface-1) 50%, var(--surface-2) 100%) !important;
          background-size: 200% 100% !important;
          animation: skeletonShimmer 1.5s linear infinite !important;
        }
        @keyframes skeletonShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (max-width: 768px) {
          .skeleton-grid-cols {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function ClientAlertsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ fullName?: string; email?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
  const [selectedProofTxId, setSelectedProofTxId] = useState<string>("");

  // Simulated Alert list (from Figma Image 1)
  const [activeAlerts, setActiveAlerts] = useState<AlertItem[]>([
    {
      id: "alert-1",
      type: "rent",
      title: "Rent - 24 Darling St",
      property: "24 Darling Street",
      statusText: "Overdue by 5 days",
      statusType: "overdue",
      amount: 4200,
      bellBg: "#fef3f2",
      bellColor: "#f04438",
      badgeBg: "#fef3f2",
      badgeTextColor: "#b42318",
      isPaid: true
    },
    {
      id: "alert-2",
      type: "water",
      title: "Water Bill - 24 Darling St",
      property: "24 Darling Street",
      statusText: "Due in 3 days",
      statusType: "due",
      amount: 312,
      bellBg: "#fffaeb",
      bellColor: "#d4a373",
      badgeBg: "#fffaeb",
      badgeTextColor: "#b54708"
    },
    {
      id: "alert-3",
      type: "loan",
      title: "Loan Interest - 12 Church Ave",
      property: "12 Church Ave",
      statusText: "Overdue by 1 day",
      statusType: "overdue",
      amount: 2180,
      bellBg: "#fef3f2",
      bellColor: "#f04438",
      badgeBg: "#fef3f2",
      badgeTextColor: "#b42318"
    }
  ]);

  // Simulated Recent activity (from Figma Image 1)
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([
    {
      id: "act-1",
      title: "Johnson Family Trust",
      meta: "24 Darling Street · Submitted Just now",
      badgeText: "Pending review",
      badgeBg: "#fffaeb",
      badgeColor: "#b54708",
      iconType: "clock",
      iconBg: "#fffaeb",
      iconColor: "#b54708",
      propertyAddress: "24 Darling Street",
      statusText: "Awaiting review",
      fileName: "ME.pdf",
      fileSize: "6 KB"
    },
    {
      id: "act-2",
      title: "SJ Holdings Pty Ltd",
      meta: "8 Harbour Road · Submitted Today, 9:41 AM",
      badgeText: "Pending review",
      badgeBg: "#fffaeb",
      badgeColor: "#b54708",
      iconType: "clock",
      iconBg: "#fffaeb",
      iconColor: "#b54708",
      propertyAddress: "8 Harbour Road",
      statusText: "Awaiting review",
      fileName: "invoice.pdf",
      fileSize: "12 KB"
    },
    {
      id: "act-3",
      title: "Rental Income — 24 Darling Street",
      meta: "Rent · 24 Darling Street",
      amount: "+$4,200",
      amountType: "income",
      iconType: "income",
      iconBg: "#ecfdf3",
      iconColor: "#12b76a",
      propertyAddress: "24 Darling Street",
      statusText: "Cleared"
    },
    {
      id: "act-4",
      title: "Utilities",
      meta: "Water Rates · 24 Darling Street",
      amount: "-$312",
      amountType: "expense",
      iconType: "expense",
      iconBg: "#fef3f2",
      iconColor: "#f04438",
      propertyAddress: "24 Darling Street",
      statusText: "Cleared"
    }
  ]);

  // Simulated Proof transaction options (from Figma Image 2)
  const proofTxOptions: ProofTxOption[] = [
    {
      id: "proof-1",
      title: "Johnson Family Trust",
      meta: "24 Darling Street · Pending review",
      iconType: "clock",
      iconBg: "#fffaeb",
      iconColor: "#b54708"
    },
    {
      id: "proof-2",
      title: "Utilities",
      meta: "24 Darling Street · 4 Jul 2026",
      amount: "-$312",
      iconType: "expense",
      iconBg: "#fef3f2",
      iconColor: "#f04438"
    },
    {
      id: "proof-3",
      title: "Loan Interest",
      meta: "24 Darling Street · 3 Jul 2026",
      amount: "-$2,180",
      iconType: "expense",
      iconBg: "#fef3f2",
      iconColor: "#f04438"
    },
    {
      id: "proof-4",
      title: "SJ Holdings Pty Ltd",
      meta: "8 Harbour Road · Pending review",
      iconType: "clock",
      iconBg: "#fffaeb",
      iconColor: "#b54708"
    },
    {
      id: "proof-5",
      title: "Maintenance",
      meta: "12 Church Ave · 3 Jul 2026",
      amount: "-$670",
      iconType: "expense",
      iconBg: "#fef3f2",
      iconColor: "#f04438"
    }
  ];

  // Load session and dimensions
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;
        if (!session) {
          router.replace("/login/user");
          return;
        }
        const token = session.getIdToken().getJwtToken();

        // Fetch user me
        try {
          const userRes = await fetch("/api/users/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (userRes.ok) {
            const data = await userRes.json();
            setCurrentUser(data);
          }
        } catch (err) {
          console.error("Failed to fetch user in alerts:", err);
        }
      } catch (e) {
        console.error("Auth validation failed:", e);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [router]);

  // Show Toast helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // User details fallback
  const firstWord = (str: string) => (str ? str.split(/[\s,]+/)[0] : "");
  const userName = currentUser?.fullName ? firstWord(currentUser.fullName) : "Sarah";
  const userInitials = currentUser?.fullName
    ? currentUser.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "SJ";

  const ordinalDate = "30th of July"; // Consistent with designs

  // Handle paid submission
  const handleConfirmPaid = () => {
    if (!selectedAlert) return;
    const alertTitle = selectedAlert.title;
    
    if (selectedProofTxId) {
      triggerToast(`Linked transaction as proof and marked "${alertTitle}" as paid.`);
    } else {
      triggerToast(`Marked "${alertTitle}" as paid.`);
    }

    // Mark Alert as Paid
    setActiveAlerts((prev) =>
      prev.map((a) => (a.id === selectedAlert.id ? { ...a, isPaid: true } : a))
    );
    setSelectedAlert(null);
    setSelectedProofTxId("");
  };

  return (
    <Skeleton
      name="client-alerts-page"
      loading={isLoading}
      fallback={<AlertsPageSkeleton />}
    >
      <div className="alerts-page-container" style={{ background: "var(--surface-0)", minHeight: "100vh", fontFamily: "'Inter', -apple-system, sans-serif" }}>
        
        {/* Sticky Header for Mobile */}
        {isMobile && (
          <div style={{
            display: "flex",
            alignItems: "center",
            padding: "16px",
            background: "var(--surface-1)",
            borderBottom: "1px solid var(--border)",
            position: "sticky",
            top: 0,
            zIndex: 50
          }}>
            <Link href="/dashboard/client" style={{ display: "flex", alignItems: "center", textDecoration: "none", color: "var(--text-primary)", marginRight: "12px" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "22px", height: "22px" }}>
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </Link>
            <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", margin: 0, flex: 1 }}>Alerts</h1>
          </div>
        )}

        <div className={`p-4 md:p-8 ${isMobile ? "mobile-content-wrap" : "desktop-content-wrap"}`} style={{ maxWidth: "1200px", margin: "0 auto" }}>
          
          {/* Desktop Greeting Section */}
          {!isMobile && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <div>
                <h1 style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>Good morning, {userName}</h1>
                <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>Here's what's happening across your portfolio.</p>
              </div>
            </div>
          )}

          {/* Quick Actions Row */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "24px", overflowX: "auto", paddingBottom: "4px" }} className="no-scrollbar">
            <Link
              href="/dashboard/client/transactions/new"
              className="action-btn-gold"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 18px",
                borderRadius: "12px",
                fontWeight: 600,
                fontSize: "14px",
                background: "linear-gradient(135deg, #ffd36f 0%, #f7a61a 100%)",
                color: "#1b265c",
                textDecoration: "none",
                boxShadow: "0 2px 8px rgba(247, 166, 26, 0.15)",
                whiteSpace: "nowrap"
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "16px", height: "16px", fill: "none", stroke: "currentColor", strokeWidth: 2.5 }}>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
              Add transaction
            </Link>

            <Link
              href="/dashboard/client/properties/new"
              className="action-btn-white"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 18px",
                borderRadius: "12px",
                fontWeight: 600,
                fontSize: "14px",
                background: "var(--surface-1)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                textDecoration: "none",
                whiteSpace: "nowrap"
              }}
            >
              <span>+ Add property</span>
            </Link>

            <Link
              href="/dashboard/client/entities/new"
              className="action-btn-white"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 18px",
                borderRadius: "12px",
                fontWeight: 600,
                fontSize: "14px",
                background: "var(--surface-1)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                textDecoration: "none",
                whiteSpace: "nowrap"
              }}
            >
              <span>+ Create entity</span>
            </Link>
          </div>

          {/* Net Equity Card */}
          <div className="m-db-net-card" style={{ width: '100%', marginBottom: '32px' }}>
            <div className="m-db-net-label-row">
              <span className="m-db-net-label" style={{ fontSize: '14px', fontWeight: 600 }}>Net Equity</span>
              <span className="m-db-net-date-badge">As of {ordinalDate}</span>
            </div>
            <div className="m-db-net-value" style={{ fontSize: '42px', fontWeight: 800 }}>
              $1.87M
            </div>
            <div className="m-db-net-divider" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="m-db-net-stat-col" style={{ borderLeft: 'none', paddingLeft: 0 }}>
                <span className="m-db-net-stat-label">Market Value</span>
                <span className="m-db-net-stat-value" style={{ fontSize: '20px' }}>
                  $3.25M
                </span>
              </div>
              <div className="m-db-net-stat-col" style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.12)', paddingLeft: '20px' }}>
                <span className="m-db-net-stat-label">Bank Loans</span>
                <span className="m-db-net-stat-value" style={{ fontSize: '20px' }}>
                  -$1.38M
                </span>
              </div>
              <div className="m-db-net-stat-col" style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.12)', paddingLeft: '20px' }}>
                <span className="m-db-net-stat-label">Repayments</span>
                <span className="m-db-net-stat-value" style={{ fontSize: '20px' }}>
                  $5,420
                </span>
              </div>
              <div className="m-db-net-stat-col" style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.12)', paddingLeft: '20px' }}>
                <span className="m-db-net-stat-label">Cash Flow</span>
                <span className="m-db-net-stat-value" style={{ fontSize: '20px', color: '#12b76a' }}>
                  +$8,420
                </span>
              </div>
            </div>
          </div>

          {/* Two Columns Section */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.4fr 1fr", gap: "32px", alignItems: "start" }}>
            
            {/* Column 1: Payment Alerts */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: 750, color: "var(--text-primary)", margin: 0 }}>Payment alerts</h3>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", background: "rgba(0,0,0,0.06)", padding: "2px 8px", borderRadius: "10px" }}>
                  {activeAlerts.filter((a) => !a.isPaid).length} active
                </span>
              </div>

              {activeAlerts.length === 0 ? (
                <div style={{ padding: "32px", textAlign: "center", background: "var(--surface-1)", borderRadius: "16px", border: "1px solid var(--border)" }}>
                  <p style={{ margin: 0, color: "var(--text-secondary)", fontWeight: 500 }}>No active payment alerts. Excellent!</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {activeAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "16px",
                        background: "var(--surface-1)",
                        borderRadius: "16px",
                        border: "1px solid var(--border)",
                        boxShadow: "0 2px 8px rgba(16, 24, 40, 0.02)"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <div
                          className={`bell-icon-box ${alert.isPaid ? 'paid' : alert.statusType}`}
                          style={{
                            width: "42px",
                            height: "42px",
                            borderRadius: "12px",
                            background: alert.isPaid ? "#fef6ee" : alert.bellBg,
                            color: alert.isPaid ? "#c28d48" : alert.bellColor,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0
                          }}
                        >
                          {alert.isPaid ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ width: "16px", height: "16px" }}>
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "20px", height: "20px", fill: "none", stroke: "currentColor", strokeWidth: 2 }}>
                              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <strong style={{
                            fontSize: "14px",
                            fontWeight: 700,
                            color: alert.isPaid ? "#8c9ba5" : "var(--text-primary)",
                            textDecoration: alert.isPaid ? "line-through" : "none"
                          }}>
                            {alert.title}
                          </strong>
                          <p style={{
                            margin: "4px 0 0 0",
                            fontSize: "12px",
                            color: alert.isPaid ? "#c28d48" : alert.statusType === "overdue" ? "#d92d20" : "#b54708",
                            fontWeight: 600
                          }}>
                            {alert.isPaid ? "Marked as paid" : alert.statusText}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        {alert.isPaid ? (
                          <span
                            className="paid-badge"
                            style={{
                              fontSize: "12px",
                              fontWeight: 700,
                              color: "#027a48",
                              background: "#ecfdf3",
                              padding: "4px 12px",
                              borderRadius: "12px"
                            }}
                          >
                            Paid
                          </span>
                        ) : (
                          <>
                            <span style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-primary)" }}>
                              {formatClientCurrency(alert.amount)}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedAlert(alert)}
                              style={{
                                padding: "8px 14px",
                                borderRadius: "10px",
                                background: "var(--surface-1)",
                                color: "var(--text-primary)",
                                border: "1px solid var(--border)",
                                fontWeight: 600,
                                fontSize: "13px",
                                cursor: "pointer",
                                transition: "all 0.15s ease"
                              }}
                              className="mark-as-paid-btn"
                            >
                              Mark as paid
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Column 2: Recent Activity */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: 750, color: "var(--text-primary)", margin: 0 }}>Recent activity</h3>
                <Link href="/dashboard/client/transactions" style={{ fontSize: "13px", fontWeight: 700, color: "#175cd3", textDecoration: "none" }}>
                  View all
                </Link>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    onClick={() => {
                      // Click to open pending review tasks
                      if (activity.iconType === "clock") {
                        setSelectedActivity(activity);
                      } else {
                        triggerToast(`Clicked activity: ${activity.title}`);
                      }
                    }}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "16px",
                      background: "var(--surface-1)",
                      borderRadius: "16px",
                      border: "1px solid var(--border)",
                      boxShadow: "0 2px 8px rgba(16, 24, 40, 0.02)",
                      cursor: "pointer"
                    }}
                    className="activity-item-card"
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                      <div style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "10px",
                        background: activity.iconBg,
                        color: activity.iconColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0
                      }}>
                        {activity.iconType === "clock" && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "18px", height: "18px" }}>
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                        )}
                        {activity.iconType === "income" && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "18px", height: "18px" }}>
                            <line x1="7" y1="17" x2="17" y2="7" />
                            <polyline points="7 7 17 7 17 17" />
                          </svg>
                        )}
                        {activity.iconType === "expense" && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "18px", height: "18px" }}>
                            <line x1="17" y1="7" x2="7" y2="17" />
                            <polyline points="17 17 7 17 7 7" />
                          </svg>
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", display: "block" }} className="truncate">
                          {activity.title}
                        </strong>
                        <span style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block" }} className="truncate">
                          {activity.meta}
                        </span>
                      </div>
                    </div>

                    <div style={{ flexShrink: 0 }}>
                      {activity.badgeText ? (
                        <span style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: activity.badgeColor,
                          background: activity.badgeBg,
                          padding: "2px 8px",
                          borderRadius: "12px"
                        }}>
                          {activity.badgeText}
                        </span>
                      ) : (
                        <span style={{
                          fontSize: "14px",
                          fontWeight: 750,
                          color: activity.amountType === "income" ? "#12b76a" : "#f04438"
                        }}>
                          {activity.amount}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

        {/* MODAL 1: Mark as paid popup */}
        {selectedAlert && (
          <div
            onClick={() => setSelectedAlert(null)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(16, 24, 40, 0.4)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: isMobile ? "flex-end" : "center",
              justifyContent: "center",
              zIndex: 1000
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: isMobile ? "100%" : "480px",
                background: "var(--surface-1)",
                borderTopLeftRadius: "24px",
                borderTopRightRadius: "24px",
                borderBottomLeftRadius: isMobile ? 0 : "24px",
                borderBottomRightRadius: isMobile ? 0 : "24px",
                padding: "24px",
                boxShadow: "0 20px 24px -4px rgba(16, 24, 40, 0.1)",
                maxHeight: "90vh",
                overflowY: "auto",
                position: "relative"
              }}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={() => setSelectedAlert(null)}
                style={{
                  position: "absolute",
                  top: "20px",
                  right: "20px",
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  border: "1px solid var(--border)",
                  background: "var(--surface-1)",
                  color: "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer"
                }}
              >
                ✕
              </button>

              <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", margin: "0 0 4px 0" }}>Mark as paid</h2>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 20px 0" }}>
                {selectedAlert.title} · {selectedAlert.property} · <strong style={{ color: "var(--text-primary)" }}>{formatClientCurrency(selectedAlert.amount)}</strong>
              </p>

              <div style={{ height: "1px", background: "var(--border)", marginBottom: "20px" }} />

              <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 12px 0" }}>
                Already uploaded it? Link a transaction as proof
              </p>

              {/* Transactions List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
                {proofTxOptions.map((option) => {
                  const isChecked = selectedProofTxId === option.id;
                  return (
                    <div
                      key={option.id}
                      onClick={() => setSelectedProofTxId(option.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "12px 14px",
                        borderRadius: "14px",
                        border: isChecked ? "2px solid #1b265c" : "1px solid var(--border)",
                        background: "var(--surface-1)",
                        cursor: "pointer",
                        boxShadow: isChecked ? "0 2px 8px rgba(27, 38, 92, 0.08)" : "none",
                        transition: "all 0.15s ease"
                      }}
                    >
                      {/* Custom radio button indicator */}
                      <div style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        border: isChecked ? "5px solid #1b265c" : "1px solid var(--border)",
                        marginRight: "12px",
                        flexShrink: 0,
                        background: "#ffffff"
                      }} />

                      {/* Icon */}
                      <div style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        background: option.iconBg,
                        color: option.iconColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: "12px",
                        flexShrink: 0
                      }}>
                        {option.iconType === "clock" ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "16px", height: "16px" }}>
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "16px", height: "16px" }}>
                            <line x1="17" y1="7" x2="7" y2="17" />
                            <polyline points="17 17 7 17 7 7" />
                          </svg>
                        )}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", display: "block" }} className="truncate">
                          {option.title}
                        </strong>
                        <span style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block" }} className="truncate">
                          {option.meta}
                        </span>
                      </div>

                      {/* Amount or line */}
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", flexShrink: 0 }}>
                        {option.amount || "—"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Upload dynamic field */}
              <div
                onClick={() => triggerToast("Direct receipt uploading simulated. File picker opened.")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "16px",
                  borderRadius: "14px",
                  border: "1px dashed var(--border)",
                  background: "var(--surface-0)",
                  cursor: "pointer",
                  marginBottom: "24px"
                }}
              >
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  background: "var(--surface-1)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: "12px",
                  color: "var(--text-primary)"
                }}>
                  +
                </div>
                <div>
                  <strong style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", display: "block" }}>Upload a new transaction</strong>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block" }}>Don't see it above? Attach a fresh receipt as proof.</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={handleConfirmPaid}
                  disabled={!selectedProofTxId}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "10px",
                    background: selectedProofTxId ? "#1a235a" : "#cbd5e1",
                    color: selectedProofTxId ? "#ffffff" : "#94a3b8",
                    border: "none",
                    fontWeight: 600,
                    fontSize: "14px",
                    cursor: selectedProofTxId ? "pointer" : "not-allowed",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                    transition: "all 0.15s ease"
                  }}
                >
                  Confirm
                </button>
              </div>

            </div>
          </div>
        )}

        {/* MODAL 2: Recent task popup */}
        {selectedActivity && (
          <div
            onClick={() => setSelectedActivity(null)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(16, 24, 40, 0.4)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: isMobile ? "flex-end" : "center",
              justifyContent: "center",
              zIndex: 1000
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: isMobile ? "100%" : "460px",
                background: "var(--surface-1)",
                borderTopLeftRadius: "24px",
                borderTopRightRadius: "24px",
                borderBottomLeftRadius: isMobile ? 0 : "24px",
                borderBottomRightRadius: isMobile ? 0 : "24px",
                padding: "24px",
                boxShadow: "0 20px 24px -4px rgba(16, 24, 40, 0.1)",
                maxHeight: "90vh",
                overflowY: "auto",
                position: "relative"
              }}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={() => setSelectedActivity(null)}
                style={{
                  position: "absolute",
                  top: "20px",
                  right: "20px",
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  border: "1px solid var(--border)",
                  background: "var(--surface-1)",
                  color: "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer"
                }}
              >
                ✕
              </button>

              {/* Status Badge */}
              <div style={{ marginBottom: "12px" }}>
                <span style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#b54708",
                  background: "#fffaeb",
                  padding: "4px 10px",
                  borderRadius: "12px"
                }}>
                  Pending review
                </span>
              </div>

              <h2 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", margin: "0 0 4px 0" }}>
                {selectedActivity.title}
              </h2>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 24px 0" }}>
                {selectedActivity.meta}
              </p>

              {/* Detail Rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", borderBottom: "1px solid rgba(0,0,0,0.04)", paddingBottom: "10px" }}>
                  <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>Entity</span>
                  <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{selectedActivity.title}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", borderBottom: "1px solid rgba(0,0,0,0.04)", paddingBottom: "10px" }}>
                  <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>Property</span>
                  <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{selectedActivity.propertyAddress}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", paddingBottom: "6px" }}>
                  <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>Status</span>
                  <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>Awaiting review</strong>
                </div>
              </div>

              {/* Attachment Card */}
              {selectedActivity.fileName && (
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 16px",
                  borderRadius: "14px",
                  border: "1px solid var(--border)",
                  background: "var(--surface-1)",
                  marginBottom: "24px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.01)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: "rgba(27, 38, 92, 0.05)",
                      color: "#1b265c",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "20px", height: "20px" }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div>
                      <strong style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", display: "block" }}>{selectedActivity.fileName}</strong>
                      <span style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block" }}>{selectedActivity.fileSize}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => triggerToast(`Downloading ${selectedActivity.fileName}...`)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#1b265c",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer"
                    }}
                  >
                    View
                  </button>
                </div>
              )}

              {/* Bottom Action Button */}
              <button
                type="button"
                onClick={() => {
                  triggerToast(`Starting review flow for "${selectedActivity.title}"...`);
                  setSelectedActivity(null);
                }}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  borderRadius: "12px",
                  background: "#1a235a",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(26, 35, 90, 0.15)"
                }}
              >
                Review now
              </button>

            </div>
          </div>
        )}

        {/* Global Toast component */}
        {toastMessage && (
          <div style={{
            position: "fixed",
            bottom: "85px", // sits nicely above mobile tab bar
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(16, 24, 40, 0.95)",
            color: "#ffffff",
            padding: "12px 24px",
            borderRadius: "30px",
            fontSize: "13px",
            fontWeight: 600,
            zIndex: 2000,
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
            textAlign: "center",
            maxWidth: "90%",
            width: "max-content",
            animation: "fadeIn 0.2s ease"
          }}>
            {toastMessage}
          </div>
        )}

        {/* Custom CSS overrides */}
        <style>{`
          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .mark-as-paid-btn:hover {
            background: var(--surface-2) !important;
            border-color: var(--brand) !important;
          }
          .activity-item-card:hover {
            background: var(--surface-2) !important;
            border-color: var(--brand) !important;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translate(-50%, 10px); }
            to { opacity: 1; transform: translate(-50%, 0); }
          }

          /* Alert Icon & Badge dark mode overrides */
          html.dark .bell-icon-box.overdue,
          .dark .bell-icon-box.overdue {
            background-color: rgba(240, 68, 56, 0.15) !important;
            color: #fda29b !important;
          }
          html.dark .bell-icon-box.due,
          .dark .bell-icon-box.due {
            background-color: rgba(212, 163, 115, 0.15) !important;
            color: #fedf89 !important;
          }
          html.dark .bell-icon-box.paid,
          .dark .bell-icon-box.paid {
            background-color: rgba(194, 141, 72, 0.15) !important;
            color: #f5c589 !important;
          }
          html.dark .paid-badge,
          .dark .paid-badge {
            color: #6cffb4 !important;
            background-color: rgba(18, 183, 106, 0.15) !important;
          }
        `}</style>

      </div>
    </Skeleton>
  );
}
