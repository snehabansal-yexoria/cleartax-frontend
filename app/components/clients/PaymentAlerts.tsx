"use client";

import React, { useState, useEffect } from "react";
import { formatClientCurrency } from "@/app/components/clients/CurrencyFormatter";

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

interface ProofTxOption {
  id: string;
  title: string;
  meta: string;
  amount?: string;
  iconType: "clock" | "expense";
  iconBg: string;
  iconColor: string;
}

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

export default function PaymentAlerts() {
  const [isMobile, setIsMobile] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [selectedProofTxId, setSelectedProofTxId] = useState<string>("");

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleConfirmPaid = () => {
    if (!selectedAlert) return;
    const alertTitle = selectedAlert.title;
    
    if (selectedProofTxId) {
      triggerToast(`Linked transaction as proof and marked "${alertTitle}" as paid.`);
    } else {
      triggerToast(`Marked "${alertTitle}" as paid.`);
    }

    setActiveAlerts((prev) =>
      prev.map((a) => (a.id === selectedAlert.id ? { ...a, isPaid: true } : a))
    );
    setSelectedAlert(null);
    setSelectedProofTxId("");
  };

  return (
    <>
      <div className="flex justify-between items-center">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h3 className="text-[#101828] text-base font-bold">Payment alerts</h3>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", background: "rgba(0,0,0,0.06)", padding: "2px 8px", borderRadius: "10px" }}>
            {activeAlerts.filter((a) => !a.isPaid).length} active
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {activeAlerts.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", background: "var(--surface-1)", borderRadius: "16px", border: "1px solid var(--border)" }}>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontWeight: 500 }}>No active payment alerts. Excellent!</p>
          </div>
        ) : (
          activeAlerts.map((alert) => (
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
              <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
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
                <div style={{ minWidth: 0 }}>
                  <strong style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: alert.isPaid ? "#8c9ba5" : "var(--text-primary)",
                    textDecoration: alert.isPaid ? "line-through" : "none",
                    display: "block"
                  }} className="truncate">
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

              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
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
          ))
        )}
      </div>

      {/* Mark as paid popup */}
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

      {/* Global Toast component */}
      {toastMessage && (
        <div style={{
          position: "fixed",
          bottom: "85px",
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
          animation: "fadeInAlert 0.2s ease"
        }}>
          {toastMessage}
        </div>
      )}

      {/* Custom CSS styles */}
      <style>{`
        .mark-as-paid-btn:hover {
          background: var(--surface-2) !important;
          border-color: var(--brand) !important;
        }
        @keyframes fadeInAlert {
          from { opacity: 0; transform: translate(-50%, 10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
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
    </>
  );
}
