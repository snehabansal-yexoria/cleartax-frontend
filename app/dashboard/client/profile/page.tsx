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
    background: "#f7f9fc",
    minHeight: "100vh",
    width: "100%",
  },
  container: {
    width: "100%",
    maxWidth: "480px",
    padding: "0 20px 40px 20px",
    background: "#f7f9fc",
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
    color: "#1a235a",
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
    color: "#101828",
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
    background: "#1a235a",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "32px",
    fontWeight: 700,
    marginBottom: "16px",
    boxShadow: "0 8px 20px rgba(26, 35, 90, 0.15)",
    border: "4px solid #ffffff",
  },
  heroName: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#101828",
    margin: "0 0 4px 0",
    letterSpacing: "-0.01em",
  },
  heroEmail: {
    fontSize: "14px",
    color: "#667085",
    margin: 0,
  },
  sectionTitle: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#8c9ba5",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    margin: "24px 0 8px 4px",
  },
  accountantCard: {
    background: "#1a235a",
    borderRadius: "20px",
    padding: "20px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    boxShadow: "0 8px 24px rgba(26, 35, 90, 0.18)",
    color: "#ffffff",
  },
  accountantAvatar: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.15)",
    color: "#ffffff",
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
    color: "#ffffff",
    margin: 0,
  },
  accountantSubtitle: {
    fontSize: "13px",
    color: "rgba(255, 255, 255, 0.6)",
    margin: "2px 0 0 0",
  },
  detailsCard: {
    background: "#ffffff",
    border: "1px solid #eaeef4",
    borderRadius: "20px",
    padding: "0 16px",
    boxShadow: "0 4px 12px rgba(16, 24, 40, 0.01)",
  },
  detailRow: (isLast: boolean) => ({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 0",
    borderBottom: isLast ? "none" : "1px solid #eaeef4",
  }),
  detailLabel: {
    fontSize: "14px",
    color: "#98a2b3",
    fontWeight: 500,
  },
  detailValue: {
    fontSize: "15px",
    color: "#101828",
    fontWeight: 600,
  },
  detailValueConnected: {
    fontSize: "15px",
    color: "#12b76a",
    fontWeight: 600,
  },
  settingsCard: {
    background: "#ffffff",
    border: "1px solid #eaeef4",
    borderRadius: "20px",
    padding: "16px",
    boxShadow: "0 4px 12px rgba(16, 24, 40, 0.01)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settingsLabel: {
    fontSize: "15px",
    color: "#101828",
    fontWeight: 600,
  },
  signOutBtn: {
    width: "100%",
    background: "#fef3f2",
    color: "#b42318",
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
      <>
        <style>{`
            .switch {
              position: relative;
              display: inline-block;
              width: 50px;
              height: 28px;
            }

            .switch input {
              opacity: 0;
              width: 0;
              height: 0;
            }

            .slider {
              position: absolute;
              cursor: pointer;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background-color: #ccc;
              transition: .4s;
              border-radius: 34px;
            }

            .slider:before {
              position: absolute;
              content: "";
              height: 22px;
              width: 22px;
              left: 3px;
              bottom: 3px;
              background-color: white;
              transition: .4s;
              border-radius: 50%;
            }

            input:checked + .slider {
              background-color: #1a235a;
            }

            input:focus + .slider {
              box-shadow: 0 0 1px #1a235a;
            }

            input:checked + .slider:before {
              transform: translateX(22px);
            }

            /* Mobile Dark Mode Overrides */
            .dark .mobile-profile-wrapper {
              background: #0f172a !important;
            }
            .dark .mobile-profile-container {
              background: #0f172a !important;
            }
            .dark .mobile-profile-back-link {
              color: #f8fafc !important;
            }
            .dark .mobile-profile-back-link:hover {
              color: #f4a117 !important;
            }
            .dark .mobile-profile-title {
              color: #f8fafc !important;
            }
            .dark .mobile-profile-hero-avatar {
              background: #1e293b !important;
              border-color: #334155 !important;
              box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3) !important;
            }
            .dark .mobile-profile-hero-name {
              color: #f8fafc !important;
            }
            .dark .mobile-profile-hero-email {
              color: #94a3b8 !important;
            }
            .dark .mobile-profile-section-title {
              color: #64748b !important;
            }
            .dark .mobile-profile-accountant-card {
              background: #1e293b !important;
              box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2) !important;
              border: 1px solid #334155 !important;
            }
            .dark .mobile-profile-accountant-avatar {
              background: rgba(255, 255, 255, 0.1) !important;
            }
            .dark .mobile-profile-accountant-name {
              color: #f8fafc !important;
            }
            .dark .mobile-profile-accountant-subtitle {
              color: #94a3b8 !important;
            }
            .dark .mobile-profile-details-card {
              background: #1e293b !important;
              border-color: #334155 !important;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
            }
            .dark .mobile-profile-detail-row {
              border-bottom-color: #334155 !important;
            }
            .dark .mobile-profile-detail-label {
              color: #94a3b8 !important;
            }
            .dark .mobile-profile-detail-value {
              color: #f8fafc !important;
            }
            .dark .mobile-profile-detail-value-connected {
              color: #4ade80 !important;
            }
            .dark .mobile-profile-settings-card {
              background: #1e293b !important;
              border-color: #334155 !important;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
            }
            .dark .mobile-profile-settings-label {
              color: #f8fafc !important;
            }
            .dark .mobile-profile-signout-btn {
              background: #7f1d1d !important;
              color: #fca5a5 !important;
            }
            .dark .mobile-profile-signout-btn:hover {
              background: #991b1b !important;
            }
            .dark input:checked + .slider {
              background-color: #f4a117 !important;
            }
            .dark .slider {
              background-color: #475569 !important;
            }
          `}</style>

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
        </>
      );
    }

  // Desktop / Tablet view
  return (
    <>
      <style>{`
          .desktop-profile-container {
            width: 100%;
          }
          .profile-header-nav {
            margin-top: 0;
            margin-bottom: 12px;
          }
          .profile-back-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            background: none;
            border: none;
            color: #667085;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            padding: 0;
            transition: color 0.2s ease;
          }
          .profile-back-btn:hover {
            color: #1a235a;
          }
          .profile-back-btn svg {
            width: 16px;
            height: 16px;
          }
          .profile-page-title {
            font-size: 28px;
            font-weight: 700;
            color: #101828;
            margin: 0 0 24px 0;
          }
          .profile-hero-card {
            background: #ffffff;
            border: 1px solid #eaeef4;
            border-radius: 16px;
            padding: 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 4px 12px rgba(16, 24, 40, 0.01);
            margin-bottom: 24px;
          }
          .profile-hero-left {
            display: flex;
            align-items: center;
            gap: 24px;
          }
          .profile-hero-avatar {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: #1a235a;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 26px;
            font-weight: 700;
          }
          .profile-hero-info {
            display: flex;
            flex-direction: column;
          }
          .profile-hero-name {
            font-size: 22px;
            font-weight: 700;
            color: #101828;
            margin: 0 0 4px 0;
          }
          .profile-hero-email {
            font-size: 14px;
            color: #667085;
            margin: 0;
          }
          .profile-edit-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            background: #ffffff;
            border: 1px solid #d0d5dd;
            border-radius: 8px;
            padding: 8px 16px;
            color: #344054;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);
            transition: all 0.2s ease;
          }
          .profile-edit-btn:hover {
            background: #f9fafb;
            border-color: #d0d5dd;
            color: #1a235a;
          }
          .profile-edit-btn svg {
            width: 16px;
            height: 16px;
          }
          .profile-grid {
            display: grid;
            gap: 24px;
          }
          @media (min-width: 1025px) {
            .profile-grid {
              grid-template-columns: 1fr 1fr;
            }
          }
          @media (max-width: 1024px) {
            .profile-grid {
              grid-template-columns: 1fr;
            }
          }
          .profile-grid-column {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .profile-section-container {
            display: flex;
            flex-direction: column;
          }
          .profile-section-title {
            font-size: 11px;
            font-weight: 700;
            color: #8c9ba5;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin: 8px 0 8px 4px;
          }
          .profile-accountant-card {
            background: #f4f6fa;
            border-radius: 16px;
            padding: 16px 20px;
            display: flex;
            align-items: center;
            gap: 16px;
            cursor: pointer;
            transition: background 0.2s ease;
          }
          .profile-accountant-card:hover {
            background: #eaedf5;
          }
          .profile-accountant-avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: #1a235a;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            font-weight: 700;
          }
          .profile-accountant-info {
            display: flex;
            flex-direction: column;
            flex-grow: 1;
          }
          .profile-accountant-name {
            font-size: 15px;
            font-weight: 700;
            color: #101828;
            margin: 0;
          }
          .profile-accountant-subtitle {
            font-size: 13px;
            color: #667085;
            margin: 2px 0 0 0;
          }
          .profile-chevron-right {
            display: flex;
            align-items: center;
            color: #98a2b3;
          }
          .profile-chevron-right svg {
            width: 18px;
            height: 18px;
          }
          .profile-details-card {
            background: #ffffff;
            border: 1px solid #eaeef4;
            border-radius: 16px;
            padding: 0 20px;
            box-shadow: 0 4px 12px rgba(16, 24, 40, 0.01);
          }
          .profile-detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 0;
            border-bottom: 1px solid #f2f4f7;
          }
          .profile-detail-row:last-child {
            border-bottom: none;
          }
          .profile-detail-label {
            font-size: 14px;
            color: #667085;
            font-weight: 500;
          }
          .profile-detail-value {
            font-size: 14px;
            color: #101828;
            font-weight: 600;
          }
          .profile-clickable-row {
            cursor: pointer;
            transition: background 0.2s ease;
          }
          .profile-clickable-row:hover {
            background: #f9fafb;
          }
          .profile-bank-info {
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .profile-bank-icon {
            width: 40px;
            height: 40px;
            background: #f4f6fa;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #1a235a;
            flex-shrink: 0;
          }
          .profile-bank-icon svg {
            width: 20px;
            height: 20px;
          }
          .profile-bank-details {
            display: flex;
            flex-direction: column;
          }
          .profile-bank-name {
            font-size: 14px;
            font-weight: 700;
            color: #101828;
          }
          .profile-bank-status {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            color: #12b76a;
            font-weight: 600;
            margin-top: 2px;
          }
          .profile-check-icon {
            width: 14px;
            height: 14px;
            stroke-width: 2.5;
          }
          .profile-settings-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 0;
            border-bottom: 1px solid #f2f4f7;
          }
          .profile-settings-row:last-child {
            border-bottom: none;
          }
          .profile-settings-label {
            font-size: 14px;
            color: #475467;
            font-weight: 500;
          }
          .profile-signout-btn {
            width: 100%;
            background: #fef3f2;
            color: #b42318;
            font-size: 15px;
            font-weight: 700;
            padding: 14px;
            border-radius: 12px;
            border: none;
            cursor: pointer;
            margin-top: 8px;
            text-align: center;
            transition: background 0.2s ease;
          }
          .profile-signout-btn:hover {
            background: #fee4e2;
          }

          /* Desktop custom switch styles */
          .desktop-switch {
            position: relative;
            display: inline-block;
            width: 44px;
            height: 24px;
          }
          .desktop-switch input {
            opacity: 0;
            width: 0;
            height: 0;
          }
          .desktop-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #eaecf0;
            transition: .3s;
            border-radius: 24px;
          }
          .desktop-slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: .3s;
            border-radius: 50%;
            box-shadow: 0 1px 3px rgba(16, 24, 40, 0.1);
          }
          .desktop-switch input:checked + .desktop-slider {
            background-color: #1a235a;
          }
          .desktop-switch input:checked + .desktop-slider:before {
            transform: translateX(20px);
          }

          /* Desktop dark mode overrides */
          html.dark .profile-page-title {
            color: #ffffff;
          }
          html.dark .profile-back-btn {
            color: #94a3b8;
          }
          html.dark .profile-back-btn:hover {
            color: #f4a117;
          }
          html.dark .profile-hero-card {
            background: #1e293b;
            border-color: #334155;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          }
          html.dark .profile-hero-name {
            color: #ffffff;
          }
          html.dark .profile-hero-email {
            color: #94a3b8;
          }
          html.dark .profile-edit-btn {
            background: #1e293b;
            border-color: #475569;
            color: #cbd5e1;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          }
          html.dark .profile-edit-btn:hover {
            background: #334155;
            color: #ffffff;
            border-color: #475569;
          }
          html.dark .profile-section-title {
            color: #64748b;
          }
          html.dark .profile-accountant-card {
            background: #1e293b;
            border: 1px solid #334155;
          }
          html.dark .profile-accountant-card:hover {
            background: #334155;
          }
          html.dark .profile-accountant-name {
            color: #ffffff;
          }
          html.dark .profile-accountant-subtitle {
            color: #94a3b8;
          }
          html.dark .profile-details-card {
            background: #1e293b;
            border-color: #334155;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.01);
          }
          html.dark .profile-detail-row {
            border-bottom-color: #334155;
          }
          html.dark .profile-detail-label {
            color: #94a3b8;
          }
          html.dark .profile-detail-value {
            color: #ffffff;
          }
          html.dark .profile-clickable-row:hover {
            background: #334155;
          }
          html.dark .profile-bank-icon {
            background: #334155;
            color: #f4a117;
          }
          html.dark .profile-bank-name {
            color: #ffffff;
          }
          html.dark .profile-bank-status {
            color: #4ade80;
          }
          html.dark .profile-settings-row {
            border-bottom-color: #334155;
          }
          html.dark .profile-settings-label {
            color: #cbd5e1;
          }
          html.dark .profile-signout-btn {
            background: #7f1d1d;
            color: #fca5a5;
          }
          html.dark .profile-signout-btn:hover {
            background: #991b1b;
          }
          html.dark .desktop-slider {
            background-color: #475569;
          }
          html.dark .desktop-switch input:checked + .desktop-slider {
            background-color: #f4a117;
          }
      `}</style>
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
   </>
  );
}
