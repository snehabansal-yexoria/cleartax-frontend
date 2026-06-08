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

  // Self-contained CSS styles for styling reliability
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
