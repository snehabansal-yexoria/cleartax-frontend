"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Skeleton } from "boneyard-js/react";
import { ClientEntitiesSkeleton } from "@/app/components/PortalSkeletons";
import { logout } from "@/src/lib/logout";
import { getSession } from "@/src/lib/session";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

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

export default function ClientProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ fullName?: string; email?: string; phoneNumber?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailSummariesEnabled, setEmailSummariesEnabled] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
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
        const session = (await getSession()) as SessionWithIdToken | null;
        if (!session) {
          router.replace("/login/user");
          return;
        }
        const token = session.getIdToken().getJwtToken();

        const userRes = await fetch("/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (userRes.ok) {
          const data = await userRes.json();
          if (!cancelled) setCurrentUser(data);
        }
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

  // Derived user values with Figma's fallbacks
  const fullName = currentUser?.fullName || "Sarah Johnson";
  const email = currentUser?.email || "sarah.johnson@email.com";
  const phoneNumber = currentUser?.phoneNumber || "+61 400 123 456";

  function getInitials(nameString: string) {
    if (!nameString) return "SJ";
    const parts = nameString.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return nameString.slice(0, 2).toUpperCase();
  }

  const initials = getInitials(fullName);



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
              <p className="mobile-profile-hero-email" style={inlineStyles.heroEmail}>{email}</p>
            </div>

            {/* Your Accountant */}
            <h3 className="mobile-profile-section-title" style={inlineStyles.sectionTitle}>Your Accountant</h3>
            <div className="mobile-profile-accountant-card" style={inlineStyles.accountantCard}>
              <div className="mobile-profile-accountant-avatar" style={inlineStyles.accountantAvatar}>MC</div>
              <div className="mobile-profile-accountant-info" style={inlineStyles.accountantInfo}>
                <h4 className="mobile-profile-accountant-name" style={inlineStyles.accountantName}>Michael Chen</h4>
                <p className="mobile-profile-accountant-subtitle" style={inlineStyles.accountantSubtitle}>Chen & Associates CPA</p>
              </div>
            </div>

            {/* Personal Details */}
            <h3 className="mobile-profile-section-title" style={inlineStyles.sectionTitle}>Personal Details</h3>
            <div className="mobile-profile-details-card" style={inlineStyles.detailsCard}>
              <div className="mobile-profile-detail-row" style={inlineStyles.detailRow(false)}>
                <span className="mobile-profile-detail-label" style={inlineStyles.detailLabel}>Full Name</span>
                <span className="mobile-profile-detail-value" style={inlineStyles.detailValue}>{fullName}</span>
              </div>
              <div className="mobile-profile-detail-row" style={inlineStyles.detailRow(false)}>
                <span className="mobile-profile-detail-label" style={inlineStyles.detailLabel}>Email</span>
                <span className="mobile-profile-detail-value" style={inlineStyles.detailValue}>{email}</span>
              </div>
              <div className="mobile-profile-detail-row" style={inlineStyles.detailRow(true)}>
                <span className="mobile-profile-detail-label" style={inlineStyles.detailLabel}>Phone</span>
                <span className="mobile-profile-detail-value" style={inlineStyles.detailValue}>{phoneNumber}</span>
              </div>
            </div>

            {/* Bank Connections */}
            <h3 className="mobile-profile-section-title" style={inlineStyles.sectionTitle}>Bank Connections</h3>
            <div className="mobile-profile-details-card" style={inlineStyles.detailsCard}>
              <div className="mobile-profile-detail-row" style={inlineStyles.detailRow(false)}>
                <span className="mobile-profile-detail-label" style={inlineStyles.detailLabel}>Westpac</span>
                <span className="mobile-profile-detail-value-connected" style={inlineStyles.detailValueConnected}>Connected ...3421</span>
              </div>
              <div className="mobile-profile-detail-row" style={inlineStyles.detailRow(true)}>
                <span className="mobile-profile-detail-label" style={inlineStyles.detailLabel}>Commonwealth Bank</span>
                <span className="mobile-profile-detail-value-connected" style={inlineStyles.detailValueConnected}>Connected ...7890</span>
              </div>
            </div>

            {/* Settings */}
            <h3 className="mobile-profile-section-title" style={inlineStyles.sectionTitle}>Settings</h3>
            <div className="mobile-profile-settings-card" style={inlineStyles.settingsCard}>
              <span className="mobile-profile-settings-label" style={inlineStyles.settingsLabel}>Notifications</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => setNotificationsEnabled(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>

            {/* Sign Out */}
            <button type="button" className="mobile-profile-signout-btn" style={inlineStyles.signOutBtn} onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        </div>
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
                <p className="profile-hero-email">{email}</p>
              </div>
            </div>
            <button className="profile-edit-btn">
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
                <div className="profile-accountant-card">
                  <div className="profile-accountant-avatar">MC</div>
                  <div className="profile-accountant-info">
                    <h4 className="profile-accountant-name">Michael Chen</h4>
                    <p className="profile-accountant-subtitle">Chen & Associates CPA</p>
                  </div>
                  <div className="profile-chevron-right">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Personal Details */}
              <div className="profile-section-container">
                <div className="profile-section-title">Personal Details</div>
                <div className="profile-details-card">
                  <div className="profile-detail-row">
                    <span className="profile-detail-label">Full name</span>
                    <span className="profile-detail-value">{fullName}</span>
                  </div>
                  <div className="profile-detail-row">
                    <span className="profile-detail-label">Email</span>
                    <span className="profile-detail-value">{email}</span>
                  </div>
                  <div className="profile-detail-row">
                    <span className="profile-detail-label">Phone</span>
                    <span className="profile-detail-value">{phoneNumber}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="profile-grid-column">
              {/* Bank Connections */}
              <div className="profile-section-container">
                <div className="profile-section-title">Bank Connections</div>
                <div className="profile-details-card">
                  <div className="profile-detail-row profile-clickable-row">
                    <div className="profile-bank-info">
                      <div className="profile-bank-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                        </svg>
                      </div>
                      <div className="profile-bank-details">
                        <span className="profile-bank-name">Westpac</span>
                        <span className="profile-bank-status">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="profile-check-icon">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Connected ...3421
                        </span>
                      </div>
                    </div>
                    <div className="profile-chevron-right">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </div>

                  <div className="profile-detail-row profile-clickable-row">
                    <div className="profile-bank-info">
                      <div className="profile-bank-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                        </svg>
                      </div>
                      <div className="profile-bank-details">
                        <span className="profile-bank-name">Commonwealth Bank</span>
                        <span className="profile-bank-status">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="profile-check-icon">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Connected ...7890
                        </span>
                      </div>
                    </div>
                    <div className="profile-chevron-right">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Settings */}
              <div className="profile-section-container">
                <div className="profile-section-title">Settings</div>
                <div className="profile-details-card">
                  <div className="profile-settings-row">
                    <span className="profile-settings-label">Notifications</span>
                    <label className="desktop-switch">
                      <input
                        type="checkbox"
                        checked={notificationsEnabled}
                        onChange={(e) => setNotificationsEnabled(e.target.checked)}
                      />
                      <span className="desktop-slider"></span>
                    </label>
                  </div>
                  <div className="profile-settings-row">
                    <span className="profile-settings-label">Email summaries</span>
                    <label className="desktop-switch">
                      <input
                        type="checkbox"
                        checked={emailSummariesEnabled}
                        onChange={(e) => setEmailSummariesEnabled(e.target.checked)}
                      />
                      <span className="desktop-slider"></span>
                    </label>
                  </div>
                  <div className="profile-settings-row">
                    <span className="profile-settings-label">Two-factor authentication</span>
                    <label className="desktop-switch">
                      <input
                        type="checkbox"
                        checked={twoFactorEnabled}
                        onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                      />
                      <span className="desktop-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Sign out */}
              <button type="button" className="profile-signout-btn" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </Skeleton>
  );
}
