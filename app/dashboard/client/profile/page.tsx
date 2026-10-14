"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Skeleton } from "boneyard-js/react";
import { ClientEntitiesSkeleton } from "@/app/components/PortalSkeletons";
import { logout } from "@/src/lib/logout";
import { getIdToken } from "@/src/lib/authToken";
import {
  fetchCurrentUser,
  invalidateCurrentUser,
  type CurrentUser,
} from "@/app/components/currentUser";

const inlineStyles = {
  wrapper: {
    display: "flex",
    justifyContent: "center",
    minHeight: "100vh",
    width: "100%",
  },
  container: {
    width: "100%",
    maxWidth: "480px",
    padding: "0 20px 40px 20px",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "24px 0 16px 0",
    position: "relative" as const,
  },
  backLink: {
    fontSize: "16px",
    fontWeight: 600,
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  title: {
    fontSize: "20px",
    fontWeight: 700,
    margin: 0,
    position: "absolute" as const,
    left: "50%",
    transform: "translateX(-50%)",
  },
  hero: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    margin: "24px 0",
    textAlign: "center" as const,
  },
  heroAvatar: {
    width: "96px",
    height: "96px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "32px",
    fontWeight: 700,
    marginBottom: "16px",
  },
  heroName: {
    fontSize: "24px",
    fontWeight: 700,
    margin: "0 0 4px 0",
    letterSpacing: "-0.01em",
  },
  heroEmail: {
    fontSize: "14px",
    margin: 0,
  },
  sectionTitle: {
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    margin: "24px 0 8px 4px",
  },
  accountantCard: {
    borderRadius: "20px",
    padding: "20px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  accountantAvatar: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    fontWeight: 600,
  },
  accountantInfo: {
    display: "flex",
    flexDirection: "column" as const,
  },
  accountantName: {
    fontSize: "16px",
    fontWeight: 700,
    margin: 0,
  },
  accountantSubtitle: {
    fontSize: "13px",
    margin: "2px 0 0 0",
  },
  detailsCard: {
    borderRadius: "20px",
    padding: "0 16px",
  },
  detailRow: (isLast: boolean) => ({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 0",
  }),
  detailLabel: {
    fontSize: "14px",
    fontWeight: 500,
  },
  detailValue: {
    fontSize: "15px",
    fontWeight: 600,
  },
  detailValueConnected: {
    fontSize: "15px",
    fontWeight: 600,
  },
  settingsCard: {
    borderRadius: "20px",
    padding: "16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settingsLabel: {
    fontSize: "15px",
    fontWeight: 600,
  },
  signOutBtn: {
    width: "100%",
    fontSize: "16px",
    fontWeight: 700,
    padding: "16px",
    borderRadius: "16px",
    border: "none",
    cursor: "pointer",
    marginTop: "32px",
    marginBottom: "24px",
    textAlign: "center" as const,
  },
};

function ClientProfileSkeleton({ isMobile }: { isMobile: boolean }) {
  if (isMobile) {
    return (
      <div className="mobile-profile-wrapper" style={inlineStyles.wrapper}>
        <div className="mobile-profile-container" style={inlineStyles.container}>
          {/* Header */}
          <div style={inlineStyles.header}>
            <div className="skeleton-pill" style={{ ...inlineStyles.backLink, width: "60px", height: "20px" }} />
            <div className="skeleton-pill" style={{ ...inlineStyles.title, width: "80px", height: "24px" }} />
            <div style={{ width: "40px" }} />
          </div>

          {/* Hero Section */}
          <div className="mobile-profile-hero" style={inlineStyles.hero}>
            <div className="skeleton-circle" style={{ width: "96px", height: "96px", marginBottom: "16px" }} />
            <div className="skeleton-line" style={{ width: "150px", height: "20px", marginBottom: "8px" }} />
            <div className="skeleton-line" style={{ width: "200px", height: "14px" }} />
          </div>

          {/* Your Accountant */}
          <div className="skeleton-line" style={{ width: "100px", height: "12px", margin: "24px 0 8px 4px" }} />
          <div className="mobile-profile-accountant-card" style={inlineStyles.accountantCard}>
            <div className="skeleton-circle" style={{ width: "48px", height: "48px" }} />
            <div className="mobile-profile-accountant-info" style={{ ...inlineStyles.accountantInfo, gap: "6px", flexGrow: 1 }}>
              <div className="skeleton-line" style={{ width: "120px", height: "14px", marginBottom: "2px" }} />
              <div className="skeleton-line" style={{ width: "150px", height: "12px" }} />
            </div>
          </div>

          {/* Personal Details */}
          <div className="skeleton-line" style={{ width: "110px", height: "12px", margin: "24px 0 8px 4px" }} />
          <div className="mobile-profile-details-card" style={inlineStyles.detailsCard}>
            <div className="mobile-profile-detail-row" style={inlineStyles.detailRow(false)}>
              <div className="skeleton-line" style={{ width: "80px", height: "14px" }} />
              <div className="skeleton-line" style={{ width: "120px", height: "14px" }} />
            </div>
            <div className="mobile-profile-detail-row" style={inlineStyles.detailRow(false)}>
              <div className="skeleton-line" style={{ width: "50px", height: "14px" }} />
              <div className="skeleton-line" style={{ width: "160px", height: "14px" }} />
            </div>
            <div className="mobile-profile-detail-row" style={inlineStyles.detailRow(true)}>
              <div className="skeleton-line" style={{ width: "60px", height: "14px" }} />
              <div className="skeleton-line" style={{ width: "110px", height: "14px" }} />
            </div>
          </div>

          {/* Bank Connections */}
          <div className="skeleton-line" style={{ width: "120px", height: "12px", margin: "24px 0 8px 4px" }} />
          <div className="mobile-profile-details-card" style={inlineStyles.detailsCard}>
            <div className="mobile-profile-detail-row" style={inlineStyles.detailRow(false)}>
              <div className="skeleton-line" style={{ width: "80px", height: "14px" }} />
              <div className="skeleton-line" style={{ width: "130px", height: "14px" }} />
            </div>
            <div className="mobile-profile-detail-row" style={inlineStyles.detailRow(true)}>
              <div className="skeleton-line" style={{ width: "130px", height: "14px" }} />
              <div className="skeleton-line" style={{ width: "140px", height: "14px" }} />
            </div>
          </div>

          {/* Settings */}
          <div className="skeleton-line" style={{ width: "80px", height: "12px", margin: "24px 0 8px 4px" }} />
          <div className="mobile-profile-settings-card" style={inlineStyles.settingsCard}>
            <div className="skeleton-line" style={{ width: "100px", height: "14px" }} />
            <div className="skeleton-pill" style={{ width: "44px", height: "24px" }} />
          </div>

          {/* Sign Out */}
          <div className="skeleton-pill" style={{
            width: "100%",
            height: "56px",
            marginTop: "32px",
            marginBottom: "24px",
            borderRadius: "16px"
          }} />
        </div>
      </div>
    );
  }

  // Desktop view skeleton
  return (
    <div className="desktop-client-dashboard">
      <div className="desktop-profile-container">
        {/* Back link */}
        <div className="profile-header-nav">
          <div className="skeleton-pill" style={{ width: "60px", height: "20px" }} />
        </div>

        <div className="skeleton-line" style={{ width: "120px", height: "32px", marginBottom: "24px", borderRadius: "8px" }} />

        {/* Hero Card */}
        <div className="profile-hero-card">
          <div className="profile-hero-left">
            <div className="skeleton-circle" style={{ width: "80px", height: "80px" }} />
            <div className="profile-hero-info">
              <div className="skeleton-line" style={{ width: "180px", height: "24px", marginBottom: "4px" }} />
              <div className="skeleton-line" style={{ width: "220px", height: "14px" }} />
            </div>
          </div>
          <div className="skeleton-pill" style={{ width: "120px", height: "38px", borderRadius: "8px" }} />
        </div>

        <div className="profile-grid">
          {/* Left Column */}
          <div className="profile-grid-column">
            {/* Accountant */}
            <div className="profile-section-container">
              <div className="skeleton-line" style={{ width: "100px", height: "12px", margin: "8px 0 8px 4px" }} />
              <div className="profile-accountant-card">
                <div className="skeleton-circle" style={{ width: "48px", height: "48px" }} />
                <div className="profile-accountant-info" style={{ gap: "6px" }}>
                  <div className="skeleton-line" style={{ width: "120px", height: "14px", marginBottom: "2px" }} />
                  <div className="skeleton-line" style={{ width: "150px", height: "12px" }} />
                </div>
                <div className="profile-chevron-right">
                  <div className="skeleton-pill" style={{ width: "16px", height: "16px" }} />
                </div>
              </div>
            </div>

            {/* Personal Details */}
            <div className="profile-section-container">
              <div className="skeleton-line" style={{ width: "110px", height: "12px", margin: "8px 0 8px 4px" }} />
              <div className="profile-details-card">
                <div className="profile-detail-row">
                  <div className="skeleton-line" style={{ width: "80px", height: "14px" }} />
                  <div className="skeleton-line" style={{ width: "120px", height: "14px" }} />
                </div>
                <div className="profile-detail-row">
                  <div className="skeleton-line" style={{ width: "50px", height: "14px" }} />
                  <div className="skeleton-line" style={{ width: "160px", height: "14px" }} />
                </div>
                <div className="profile-detail-row">
                  <div className="skeleton-line" style={{ width: "60px", height: "14px" }} />
                  <div className="skeleton-line" style={{ width: "110px", height: "14px" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="profile-grid-column">
            {/* Bank Connections */}
            <div className="profile-section-container">
              <div className="skeleton-line" style={{ width: "120px", height: "12px", margin: "8px 0 8px 4px" }} />
              <div className="profile-details-card">
                <div className="profile-detail-row">
                  <div className="profile-bank-info">
                    <div className="skeleton-circle" style={{ width: "40px", height: "40px" }} />
                    <div className="profile-bank-details" style={{ gap: "4px" }}>
                      <div className="skeleton-line" style={{ width: "80px", height: "14px", marginBottom: "2px" }} />
                      <div className="skeleton-line" style={{ width: "120px", height: "12px" }} />
                    </div>
                  </div>
                  <div className="profile-chevron-right">
                    <div className="skeleton-pill" style={{ width: "16px", height: "16px" }} />
                  </div>
                </div>

                <div className="profile-detail-row">
                  <div className="profile-bank-info">
                    <div className="skeleton-circle" style={{ width: "40px", height: "40px" }} />
                    <div className="profile-bank-details" style={{ gap: "4px" }}>
                      <div className="skeleton-line" style={{ width: "140px", height: "14px", marginBottom: "2px" }} />
                      <div className="skeleton-line" style={{ width: "120px", height: "12px" }} />
                    </div>
                  </div>
                  <div className="profile-chevron-right">
                    <div className="skeleton-pill" style={{ width: "16px", height: "16px" }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="profile-section-container">
              <div className="skeleton-line" style={{ width: "80px", height: "12px", margin: "8px 0 8px 4px" }} />
              <div className="profile-details-card">
                <div className="profile-settings-row">
                  <div className="skeleton-line" style={{ width: "100px", height: "14px" }} />
                  <div className="skeleton-pill" style={{ width: "44px", height: "24px" }} />
                </div>
                <div className="profile-settings-row">
                  <div className="skeleton-line" style={{ width: "120px", height: "14px" }} />
                  <div className="skeleton-pill" style={{ width: "44px", height: "24px" }} />
                </div>
                <div className="profile-settings-row">
                  <div className="skeleton-line" style={{ width: "160px", height: "14px" }} />
                  <div className="skeleton-pill" style={{ width: "44px", height: "24px" }} />
                </div>
              </div>
            </div>

            {/* Sign Out */}
            <div className="skeleton-pill" style={{ width: "100%", height: "48px", marginTop: "8px", borderRadius: "12px" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function initialsOf(nameString: string) {
  const trimmed = nameString.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

/**
 * Edit name and phone through the existing PATCH /api/users/me (Cognito + DB),
 * the same call the accountant's account page makes. The phone must carry its
 * country code; the route rejects anything else with a message we show as is.
 */
function EditProfileModal({
  initialName,
  initialPhone,
  onClose,
  onSaved,
}: {
  initialName: string;
  initialPhone: string;
  onClose: () => void;
  onSaved: (next: { fullName: string; phoneNumber: string }) => void;
}) {
  const [fullName, setFullName] = useState(initialName);
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = fullName.trim();
    const phone = phoneNumber.trim();
    if (!name) {
      setError("Enter your full name.");
      return;
    }
    if (phone && !phone.startsWith("+")) {
      setError("Include the country code, e.g. +61 491 570 156.");
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      const token = await getIdToken();
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fullName: name, phoneNumber: phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't save your details. Please try again.");
        return;
      }
      onSaved({ fullName: name, phoneNumber: phone });
    } catch (err) {
      console.error("Failed to update profile:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    height: "44px",
    padding: "0 14px",
    borderRadius: "10px",
    border: "1px solid var(--border)",
    background: "var(--surface-2)",
    color: "var(--text-primary)",
    fontSize: "14px",
    outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: "6px",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-profile-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(16, 24, 40, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <form
        onSubmit={handleSave}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.18)",
        }}
      >
        <h2 id="edit-profile-title" style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>
          Edit profile
        </h2>
        <div>
          <label htmlFor="edit-profile-name" style={labelStyle}>Full name</label>
          <input
            id="edit-profile-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            style={fieldStyle}
          />
        </div>
        <div>
          <label htmlFor="edit-profile-phone" style={labelStyle}>Phone</label>
          <input
            id="edit-profile-phone"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+61 491 570 156"
            autoComplete="tel"
            style={fieldStyle}
          />
        </div>
        {error && (
          <div role="alert" style={{ color: "var(--danger)", fontSize: "13px", fontWeight: 600 }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{ height: "40px", padding: "0 16px", borderRadius: "10px", border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontWeight: 600, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            style={{ height: "40px", padding: "0 18px", borderRadius: "10px", border: "none", background: "var(--brand)", color: "#ffffff", fontWeight: 700, cursor: isSaving ? "not-allowed" : "pointer", opacity: isSaving ? 0.7 : 1 }}
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ClientProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Responsive design listener
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
        // The layout's request, shared — not a second /api/users/me.
        const me = await fetchCurrentUser(token);
        if (!cancelled) setCurrentUser(me);
      } catch (err) {
        console.error("Failed to fetch current user in profile:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  // Real values only. The demo fallbacks ("Sarah Johnson", a sample email,
  // "+61 400 123 456") made a missing phone look like a real one.
  const fullName = currentUser?.fullName || "";
  const email = currentUser?.email || "";
  const phoneNumber = currentUser?.phoneNumber || "";
  const initials = initialsOf(fullName || email.split("@")[0] || "");

  const accountantName = currentUser?.assignedAccountantName || "";
  const accountantEmail = currentUser?.assignedAccountantEmail || "";
  const accountantInitials = initialsOf(accountantName || accountantEmail.split("@")[0] || "");
  const accountantLabel = accountantName || accountantEmail || "Not assigned yet";
  const accountantSubtitle = accountantName && accountantEmail
    ? accountantEmail
    : accountantEmail || accountantName
      ? "Your accountant"
      : "Your accountant will appear here once one is assigned.";
  const accountantHref = accountantEmail ? `mailto:${accountantEmail}` : null;

  const editModal = isEditing ? (
    <EditProfileModal
      initialName={fullName}
      initialPhone={phoneNumber}
      onClose={() => setIsEditing(false)}
      onSaved={(next) => {
        invalidateCurrentUser();
        setCurrentUser((prev) => (prev ? { ...prev, ...next } : prev));
        setIsEditing(false);
      }}
    />
  ) : null;

  const phoneValue = phoneNumber || (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", fontWeight: 600, cursor: "pointer", font: "inherit" }}
    >
      Add phone
    </button>
  );

  if (isMobile) {
    return (
      <Skeleton
            name="client-profile-page-skeleton"
            loading={isLoading}
            fallback={<ClientProfileSkeleton isMobile={true} />}
          >
            <div className="mobile-profile-wrapper" style={inlineStyles.wrapper}>
              <div className="mobile-profile-container" style={inlineStyles.container}>
            {/* Header */}
            <div style={inlineStyles.header}>
              <button onClick={() => router.back()} className="mobile-profile-back-link" style={inlineStyles.backLink}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  style={{ width: "18px", height: "18px" }}
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Back
              </button>
              <h1 className="mobile-profile-title" style={inlineStyles.title}>Profile</h1>
              <div style={{ width: "40px" }} />
            </div>

            {/* Hero Section */}
            <div className="mobile-profile-hero" style={inlineStyles.hero}>
              <div className="mobile-profile-hero-avatar" style={inlineStyles.heroAvatar}>{initials}</div>
              <h2 className="mobile-profile-hero-name" style={inlineStyles.heroName}>{fullName}</h2>
              <div className="mobile-profile-hero-email" style={inlineStyles.heroEmail}>{email}</div>
            </div>

            {/* Your Accountant */}
            <h3 className="mobile-profile-section-title" style={inlineStyles.sectionTitle}>Your Accountant</h3>
            {accountantHref ? (
              <a href={accountantHref} className="mobile-profile-accountant-card" style={{ ...inlineStyles.accountantCard, textDecoration: "none" }}>
                <div className="mobile-profile-accountant-avatar" style={inlineStyles.accountantAvatar}>{accountantInitials}</div>
                <div className="mobile-profile-accountant-info" style={inlineStyles.accountantInfo}>
                  <h4 className="mobile-profile-accountant-name" style={inlineStyles.accountantName}>{accountantLabel}</h4>
                  <div className="mobile-profile-accountant-subtitle" style={inlineStyles.accountantSubtitle}>{accountantSubtitle}</div>
                </div>
              </a>
            ) : (
              <div className="mobile-profile-accountant-card" style={inlineStyles.accountantCard}>
                <div className="mobile-profile-accountant-avatar" style={inlineStyles.accountantAvatar}>{accountantInitials || "—"}</div>
                <div className="mobile-profile-accountant-info" style={inlineStyles.accountantInfo}>
                  <h4 className="mobile-profile-accountant-name" style={inlineStyles.accountantName}>{accountantLabel}</h4>
                  <div className="mobile-profile-accountant-subtitle" style={inlineStyles.accountantSubtitle}>{accountantSubtitle}</div>
                </div>
              </div>
            )}

            {/* Personal Details */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h3 className="mobile-profile-section-title" style={inlineStyles.sectionTitle}>Personal Details</h3>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
              >
                Edit
              </button>
            </div>
            <div className="mobile-profile-details-card" style={inlineStyles.detailsCard}>
              <div className="mobile-profile-detail-row" style={inlineStyles.detailRow(false)}>
                <span className="mobile-profile-detail-label" style={inlineStyles.detailLabel}>Full Name</span>
                <span className="mobile-profile-detail-value" style={inlineStyles.detailValue}>{fullName || "—"}</span>
              </div>
              <div className="mobile-profile-detail-row" style={inlineStyles.detailRow(false)}>
                <span className="mobile-profile-detail-label" style={inlineStyles.detailLabel}>Email</span>
                <span className="mobile-profile-detail-value" style={inlineStyles.detailValue}>{email || "—"}</span>
              </div>
              <div className="mobile-profile-detail-row" style={inlineStyles.detailRow(true)}>
                <span className="mobile-profile-detail-label" style={inlineStyles.detailLabel}>Phone</span>
                <span className="mobile-profile-detail-value" style={inlineStyles.detailValue}>{phoneValue}</span>
              </div>
            </div>

            {/* Bank connections and the notification / email-summary / 2FA
                switches were demo UI with no backend behind them, so they are
                hidden until there is one. */}

            {/* Sign Out */}
            <button type="button" className="mobile-profile-signout-btn" style={inlineStyles.signOutBtn} onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        </div>
        {editModal}
      </Skeleton>
    );
  }

  // Desktop / Tablet view
  return (
    <Skeleton
      name="client-profile-desktop-skeleton"
      loading={isLoading}
      fallback={<ClientProfileSkeleton isMobile={false} />}
    >
      <div className="desktop-client-dashboard">
          <div className="desktop-profile-container">
          {/* Back button */}
          <div className="profile-header-nav">
            <button onClick={() => router.back()} className="profile-back-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>
          </div>

          <h1 className="profile-page-title">Profile</h1>

          {/* Hero Card */}
          <div className="profile-hero-card">
            <div className="profile-hero-left">
              <div className="profile-hero-avatar">{initials}</div>
              <div className="profile-hero-info">
                <h2 className="profile-hero-name">{fullName}</h2>
                <div className="profile-hero-email">{email}</div>
              </div>
            </div>
            <button type="button" className="profile-edit-btn" onClick={() => setIsEditing(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit profile
            </button>
          </div>

          <div className="profile-grid">
            {/* Left Column */}
            <div className="profile-grid-column">
              {/* Accountant */}
              <div className="profile-section-container">
                <div className="profile-section-title">Your Accountant</div>
                {accountantHref ? (
                  <a href={accountantHref} className="profile-accountant-card" style={{ textDecoration: "none" }} title={`Email ${accountantLabel}`}>
                    <div className="profile-accountant-avatar">{accountantInitials}</div>
                    <div className="profile-accountant-info">
                      <h4 className="profile-accountant-name">{accountantLabel}</h4>
                      <div className="profile-accountant-subtitle">{accountantSubtitle}</div>
                    </div>
                    <div className="profile-chevron-right">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </a>
                ) : (
                  <div className="profile-accountant-card">
                    <div className="profile-accountant-avatar">{accountantInitials || "—"}</div>
                    <div className="profile-accountant-info">
                      <h4 className="profile-accountant-name">{accountantLabel}</h4>
                      <div className="profile-accountant-subtitle">{accountantSubtitle}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column */}
            <div className="profile-grid-column">
              {/* Personal Details */}
              <div className="profile-section-container">
                <div className="profile-section-title">Personal Details</div>
                <div className="profile-details-card">
                  <div className="profile-detail-row">
                    <span className="profile-detail-label">Full name</span>
                    <span className="profile-detail-value">{fullName || "—"}</span>
                  </div>
                  <div className="profile-detail-row">
                    <span className="profile-detail-label">Email</span>
                    <span className="profile-detail-value">{email || "—"}</span>
                  </div>
                  <div className="profile-detail-row">
                    <span className="profile-detail-label">Phone</span>
                    <span className="profile-detail-value">{phoneValue}</span>
                  </div>
                </div>
              </div>

              {/* Bank connections and the notification / email-summary / 2FA
                  switches were demo UI with no backend behind them, so they
                  are hidden until there is one. */}

              {/* Sign out */}
              <button type="button" className="profile-signout-btn" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
      {editModal}
    </Skeleton>
  );
}
