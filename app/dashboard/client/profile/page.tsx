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

  // Self-contained CSS styles for mobile styling reliability
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

  if (isMobile) {
    return (
      <Skeleton
        name="client-profile-page-skeleton"
        loading={isLoading}
        fallback={<ClientEntitiesSkeleton />}
      >
        <div style={inlineStyles.wrapper}>
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
          `}</style>

          <div style={inlineStyles.container}>
            {/* Header */}
            <div style={inlineStyles.header}>
              <button onClick={() => router.back()} style={inlineStyles.backLink}>
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
              <h1 style={inlineStyles.title}>Profile</h1>
              <div style={{ width: "40px" }} />
            </div>

            {/* Hero Section */}
            <div style={inlineStyles.hero}>
              <div style={inlineStyles.heroAvatar}>{initials}</div>
              <h2 style={inlineStyles.heroName}>{fullName}</h2>
              <p style={inlineStyles.heroEmail}>{email}</p>
            </div>

            {/* Your Accountant */}
            <h3 style={inlineStyles.sectionTitle}>Your Accountant</h3>
            <div style={inlineStyles.accountantCard}>
              <div style={inlineStyles.accountantAvatar}>MC</div>
              <div style={inlineStyles.accountantInfo}>
                <h4 style={inlineStyles.accountantName}>Michael Chen</h4>
                <p style={inlineStyles.accountantSubtitle}>Chen & Associates CPA</p>
              </div>
            </div>

            {/* Personal Details */}
            <h3 style={inlineStyles.sectionTitle}>Personal Details</h3>
            <div style={inlineStyles.detailsCard}>
              <div style={inlineStyles.detailRow(false)}>
                <span style={inlineStyles.detailLabel}>Full Name</span>
                <span style={inlineStyles.detailValue}>{fullName}</span>
              </div>
              <div style={inlineStyles.detailRow(false)}>
                <span style={inlineStyles.detailLabel}>Email</span>
                <span style={inlineStyles.detailValue}>{email}</span>
              </div>
              <div style={inlineStyles.detailRow(true)}>
                <span style={inlineStyles.detailLabel}>Phone</span>
                <span style={inlineStyles.detailValue}>{phoneNumber}</span>
              </div>
            </div>

            {/* Bank Connections */}
            <h3 style={inlineStyles.sectionTitle}>Bank Connections</h3>
            <div style={inlineStyles.detailsCard}>
              <div style={inlineStyles.detailRow(false)}>
                <span style={inlineStyles.detailLabel}>Westpac</span>
                <span style={inlineStyles.detailValueConnected}>Connected ...3421</span>
              </div>
              <div style={inlineStyles.detailRow(true)}>
                <span style={inlineStyles.detailLabel}>Commonwealth Bank</span>
                <span style={inlineStyles.detailValueConnected}>Connected ...7890</span>
              </div>
            </div>

            {/* Settings */}
            <h3 style={inlineStyles.sectionTitle}>Settings</h3>
            <div style={inlineStyles.settingsCard}>
              <span style={inlineStyles.settingsLabel}>Notifications</span>
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
            <button type="button" style={inlineStyles.signOutBtn} onClick={handleLogout}>
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
      fallback={<ClientEntitiesSkeleton />}
    >
      <div className="desktop-profile-wrapper">
        <style>{`
          .desktop-profile-wrapper {
            min-height: 100vh;
            background-color: #f7f9fc;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 24px;
            width: 100%;
            box-sizing: border-box;
          }
          @media (min-width: 1200px) {
            .desktop-profile-wrapper {
              padding: 24px 40px 40px 40px;
            }
          }
          .desktop-profile-container {
            width: 100%;
            max-width: 1000px;
            margin: 0 auto;
          }
          .profile-header-nav {
            margin-top: 8px;
            margin-bottom: 8px;
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
            margin: 8px 0 24px 0;
          }
          .profile-hero-card {
            background: #ffffff;
            border: 1px solid #eaeef4;
            border-radius: 16px;
            padding: 24px 32px;
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
        `}</style>

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
