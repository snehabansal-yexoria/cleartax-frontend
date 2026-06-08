"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { login, completeNewPassword } from "../../src/lib/auth";
import { normalizeRoleName } from "../../src/lib/roleNames";
import { saveSessionBootstrap } from "../../src/lib/sessionBootstrap";
import { CognitoUser } from "amazon-cognito-identity-js";
import Image from "next/image";
import logo from "../../public/clear-tax.svg";
import logoBlue from "../../public/clear-tax-blue.svg";
import shield from "../../public/shield.svg";
import lock from "../../public/lock.svg";
import live from "../../public/live.svg";
import analytics from "../../public/analytics.svg";
import users from "../../public/users.svg";
import realTime from "../../public/real-time.svg";

interface NewPasswordResult {
  type: "NEW_PASSWORD_REQUIRED";
  user: CognitoUser;
  userAttributes?: Record<string, string>;
}

interface LoginSuccessResult {
  type: "SUCCESS";
  idToken: string;
}

type LoginResult = NewPasswordResult | LoginSuccessResult;

// SET THIS TO false TO DISABLE THE PREMIUM FULL-SCREEN LOADING SCREEN AND TRANSITION DELAY
const ENABLE_LOADING_TRANSITION = true;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getInviteEmailFromUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  return String(
    new URLSearchParams(window.location.search).get("email") || "",
  ).trim();
}

function getInvitePasswordFromUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  return String(
    new URLSearchParams(window.location.hash.replace(/^#/, "")).get(
      "temporary_password",
    ) || "",
  );
}

function acceptInvitationInBackground(token: string) {
  void fetch("/api/invitations/accept", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch((error) => {
    console.warn("Invitation acceptance did not complete:", error);
  });
}

function getDashboardPath(role: string) {
  if (role === "super_admin") return "/dashboard/super-admin";
  if (role === "admin") return "/dashboard/admin";
  if (role === "accountant") return "/dashboard/accountant";
  return "/dashboard/client";
}

export default function LoginComponent({
  allowedRoles,
}: {
  allowedRoles: string[];
}) {
  const router = useRouter();

  const [email, setEmail] = useState(getInviteEmailFromUrl);
  const [password, setPassword] = useState(getInvitePasswordFromUrl);
  const [showPassword, setShowPassword] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [requireNewPassword, setRequireNewPassword] = useState(false);
  const [user, setUser] = useState<CognitoUser | null>(null);
  const [attributes, setAttributes] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inviteBootstrapAttempted = useRef(false);

  const [mobileStep, setMobileStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isTestingOnboarding, setIsTestingOnboarding] = useState(false);

  const isClientLogin = allowedRoles.length === 1 && allowedRoles[0] === "client";

  useEffect(() => {
    if (!isClientLogin) {
      setMobileStep(3);
      return;
    }

    const isMobile = window.innerWidth <= 768;
    const isTesting = new URLSearchParams(window.location.search).has("testSplash");

    if (isTesting) {
      setIsTestingOnboarding(true);
    }

    if (!isMobile && !isTesting) {
      setMobileStep(3);
      return;
    }

    const timer = setTimeout(() => {
      setIsTransitioning(true);
      const nextTimer = setTimeout(() => {
        setMobileStep(1);
        setIsTransitioning(false);
      }, 400);
      return () => clearTimeout(nextTimer);
    }, 1500);

    return () => clearTimeout(timer);
  }, [isClientLogin]);

  const handleLogin = useCallback(
    async (
      loginEmail = email,
      loginPassword = password,
      options: { fromInviteLink?: boolean } = {},
    ) => {
      setError("");
      setLoading(true);
      const startTime = Date.now();

      const delayAtLeast2s = async () => {
        if (!ENABLE_LOADING_TRANSITION) return;
        const elapsed = Date.now() - startTime;
        const remainingDelay = Math.max(0, 1000 - elapsed);
        if (remainingDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, remainingDelay));
        }
      };

      try {
        const result = (await login(loginEmail, loginPassword)) as LoginResult;

        if (result.type === "NEW_PASSWORD_REQUIRED") {
          setEmail(loginEmail);
          setUser(result.user);

          const requiredAttributes: Record<string, string> = {};
          requiredAttributes.name = loginEmail;

          setAttributes(requiredAttributes);
          setRequireNewPassword(true);

          await delayAtLeast2s();
          setLoading(false);
          return;
        }

        if (result.type === "SUCCESS") {
          const token = result.idToken;

          document.cookie = `idToken=${token}; path=/`;
          acceptInvitationInBackground(token);

          const meResponse = await fetch("/api/users/me", {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!meResponse.ok) {
            await delayAtLeast2s();
            setError("Unable to load your profile. Contact your administrator.");
            setLoading(false);
            return;
          }

          const me = await meResponse.json();
          const apiRole = normalizeRoleName(me.role);

          if (!allowedRoles.includes(apiRole)) {
            await delayAtLeast2s();
            setError("You are not allowed to login here");
            setLoading(false);
            return;
          }

          document.cookie = `role=${apiRole}; path=/`;
          saveSessionBootstrap({
            email: me.email,
            role: apiRole,
            orgName: me.orgName,
          });

          await delayAtLeast2s();
          router.replace(getDashboardPath(apiRole));
          return; // Keep loading true during redirection to avoid flickering
        }
      } catch (error: unknown) {
        await delayAtLeast2s();
        setError(
          options.fromInviteLink
            ? "This invite link could not be opened automatically. Please sign in with the temporary password from your invitation."
            : getErrorMessage(error, "Login failed"),
        );
      }

      setLoading(false);
    },
    [allowedRoles, email, password, router],
  );

  useEffect(() => {
    if (inviteBootstrapAttempted.current) return;

    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const inviteEmail = String(query.get("email") || "").trim();
    const invitePassword = String(hash.get("temporary_password") || "");

    if (!query.get("invite") || !inviteEmail || !invitePassword) {
      return;
    }

    inviteBootstrapAttempted.current = true;
    window.setTimeout(() => {
      void handleLogin(inviteEmail, invitePassword, { fromInviteLink: true });
    }, 0);
  }, [handleLogin]);

  const handleSetNewPassword = async () => {
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!user) return;

    setLoading(true);
    setError("");

    try {
      const result = await completeNewPassword(user, newPassword, attributes);
      const idToken =
        typeof result === "object" &&
          result !== null &&
          "getIdToken" in result &&
          typeof result.getIdToken === "function"
          ? result.getIdToken().getJwtToken()
          : "";

      if (idToken) {
        acceptInvitationInBackground(idToken);
      }

      alert("Password updated successfully. Please login again.");
      setRequireNewPassword(false);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Password update failed"));
    }

    setLoading(false);
  };

  const role = allowedRoles[0];

  const roleMap: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    accountant: "Accountant",
    client: "Client",
  };

  return (
    <div className={`loginSection${isClientLogin && mobileStep < 3 ? " mobile-client-active" : ""}`}>
      {isClientLogin && mobileStep < 3 && (
        <div className={`mobile-onboarding-container step-${mobileStep}${isTransitioning ? " is-transitioning" : ""}${isTestingOnboarding ? " test-splash" : ""}`}>
          {/* Step 0: Splash Screen */}
          {mobileStep === 0 && (
            <div className="onboarding-splash">
              <div className="mobile-splash-logo" />
              <h1 className="mobile-splash-title">ClearPortfolio</h1>
              <p className="mobile-splash-subtitle">YOUR PORTFOLIO, CLEARLY</p>
            </div>
          )}

          {/* Step 1: Onboarding Details */}
          {mobileStep === 1 && (
            <div className="onboarding-content">
              <div className="onboarding-top">
                <div className="onboarding-logo" />
                <h1 className="onboarding-title">
                  Your Portfolio,<br />clearly.
                </h1>
                <p className="onboarding-subtitle">
                  Track your properties, transactions, and returns - with your accountant in sync.
                </p>
              </div>

              <div className="onboarding-features">
                <div className="feature-item">
                  <div className="feature-icon-wrapper">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#f7a61a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 3v18h18" />
                      <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
                    </svg>
                  </div>
                  <span className="feature-text">Real-time portfolio P&L</span>
                </div>

                <div className="feature-item">
                  <div className="feature-icon-wrapper">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#f7a61a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 10V6a2 2 0 0 1 2-2h4M14 4h4a2 2 0 0 1 2 2v4M20 14v4a2 2 0 0 1-2 2h-4M10 20H6a2 2 0 0 1-2-2v-4" />
                      <path d="M7 12h10" />
                      <path d="M9 8h6" />
                      <path d="M9 16h6" />
                    </svg>
                  </div>
                  <span className="feature-text">OCR receipts in seconds</span>
                </div>

                <div className="feature-item">
                  <div className="feature-icon-wrapper">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#f7a61a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <span className="feature-text">Shared with your accountant</span>
                </div>
              </div>

              <div className="onboarding-footer">
                <button 
                  type="button" 
                  className="onboarding-btn" 
                  onClick={() => {
                    setIsTransitioning(true);
                    setTimeout(() => {
                      setMobileStep(2);
                      setIsTransitioning(false);
                    }, 400);
                  }}
                >
                  Sign In
                </button>
                <p className="onboarding-terms">
                  By continuing you agree to our Terms & Privacy Policy
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Mobile Login Form */}
          {mobileStep === 2 && (
            <div className="onboarding-content">
              <div className="onboarding-top">
                <div className="onboarding-logo" />
                <h1 className="onboarding-title">Welcome Back</h1>
                <p className="onboarding-subtitle">Please sign in to your client account.</p>
              </div>

              <form
                className="mobile-login-form-wrap"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleLogin();
                }}
              >
                <div className="mobile-login-element">
                  <label htmlFor="mobile-email">Email Address</label>
                  <input
                    type="email"
                    placeholder="name@email.com"
                    id="mobile-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div className="mobile-login-element">
                  <label htmlFor="mobile-password">Password</label>
                  <div className="mobile-login-password-field">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      id="mobile-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="mobile-login-password-toggle"
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="mobile-login-error">
                    <p>{error}</p>
                  </div>
                )}

                <div className="onboarding-footer" style={{ marginTop: "24px" }}>
                  <button
                    type="submit"
                    className="onboarding-btn"
                    disabled={loading}
                  >
                    {loading ? "Logging in..." : "Log In to Dashboard"}
                  </button>

                  <button
                    type="button"
                    className="mobile-back-btn"
                    onClick={() => {
                      setIsTransitioning(true);
                      setTimeout(() => {
                        setMobileStep(1);
                        setIsTransitioning(false);
                      }, 400);
                    }}
                  >
                    Back to onboarding
                  </button>

                  <p className="onboarding-terms">
                    By continuing you agree to our Terms & Privacy Policy
                  </p>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
      {ENABLE_LOADING_TRANSITION && loading && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.94) 0%, rgba(244, 246, 250, 0.98) 100%)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            animation: "fadeInPremium 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          }}
        >
          <style>{`
            @keyframes fadeInPremium {
              from { opacity: 0; transform: scale(1.02); }
              to { opacity: 1; transform: scale(1); }
            }
            @keyframes premiumSpin {
              0% {
                stroke-dashoffset: 120;
                transform: rotate(0deg);
              }
              50% {
                stroke-dashoffset: 30;
                transform: rotate(180deg);
              }
              100% {
                stroke-dashoffset: 120;
                transform: rotate(360deg);
              }
            }
            @keyframes pulseDot {
              0%, 100% { transform: scale(0.85); opacity: 0.5; }
              50% { transform: scale(1.15); opacity: 1; }
            }
            @keyframes glowPulse {
              0%, 100% { opacity: 0.15; }
              50% { opacity: 0.3; }
            }
          `}</style>

          {/* Background Ambient Glow */}
          <div
            style={{
              position: "absolute",
              width: "400px",
              height: "400px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(40, 51, 110, 0.05) 0%, rgba(244, 161, 23, 0.04) 50%, transparent 70%)",
              zIndex: 1,
              animation: "glowPulse 4s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 2,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "24px",
              padding: "48px 40px",
              borderRadius: "32px",
              background: "rgba(255, 255, 255, 0.85)",
              border: "1px solid rgba(40, 51, 110, 0.08)",
              boxShadow: "0 30px 80px rgba(40, 51, 110, 0.06), 0 10px 30px rgba(0, 0, 0, 0.02)",
              maxWidth: "360px",
              width: "90%",
              textAlign: "center",
            }}
          >
            {/* Secure Authentication Status Pill */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "999px",
                background: "rgba(40, 51, 110, 0.04)",
                border: "1px solid rgba(40, 51, 110, 0.08)",
                color: "#28336e",
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "#f4a117",
                  boxShadow: "0 0 8px #f4a117",
                  animation: "pulseDot 1.5s ease-in-out infinite",
                }}
              />
              Secure Verification
            </div>

            {/* Custom Premium SVG Dash-Array Spinner */}
            <div style={{ position: "relative", width: "72px", height: "72px", margin: "8px 0" }}>
              <svg width="72" height="72" viewBox="0 0 50 50">
                <circle
                  cx="25"
                  cy="25"
                  r="22"
                  fill="none"
                  stroke="rgba(40, 51, 110, 0.06)"
                  strokeWidth="2.5"
                />
                <circle
                  cx="25"
                  cy="25"
                  r="22"
                  fill="none"
                  stroke="url(#premiumSpinnerGrad)"
                  strokeWidth="2.5"
                  strokeDasharray="138"
                  strokeDashoffset="120"
                  strokeLinecap="round"
                  style={{
                    transformOrigin: "center",
                    animation: "premiumSpin 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite",
                  }}
                />
                <defs>
                  <linearGradient id="premiumSpinnerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#28336e" />
                    <stop offset="100%" stopColor="#f4a117" />
                  </linearGradient>
                </defs>
              </svg>
              {/* Pulsing Core Dot in the center */}
              <div
                style={{
                  position: "absolute",
                  top: "29px",
                  left: "29px",
                  width: "14px",
                  height: "14px",
                  borderRadius: "50%",
                  background: "#28336e",
                  boxShadow: "0 0 12px rgba(40, 51, 110, 0.25)",
                  animation: "pulseDot 1.5s ease-in-out infinite",
                }}
              />
            </div>

            {/* Text details */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <span
                style={{
                  color: "#28336e",
                  fontSize: "1.4rem",
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  fontFamily: '"Public Sans", sans-serif',
                }}
              >
                Authorizing Access
              </span>
              <span
                style={{
                  color: "#4a5565",
                  fontSize: "0.88rem",
                  fontWeight: 400,
                  lineHeight: "1.5",
                }}
              >
                Opening your personalized clear workspace dashboard...
              </span>
            </div>

            {/* Footer with lock */}
            <div
              style={{
                marginTop: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                color: "#717182",
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.02em",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              End-to-End Encrypted
            </div>
          </div>
        </div>
      )}
      <div className="login-container">
        <div className="login-wrapper">
          <div className="login-left">
            <div className="login-left-wrap">
              <div className="ll-top">
                <div className="llt-icon-head">
                  <div className="login-icon">
                    <Image
                      src={logo}
                      alt="Login Illustration"
                      width={100}
                      height={100}
                      className="icon"
                    />
                  </div>
                  <h1>Clear Portfolio</h1>
                </div>
                <h2>{roleMap[role] || "Login"}</h2>
                {(role === "super_admin" || role === "admin") && (
                  <p className="darkBg txt-center">
                    Secure administrative access for financial dashboard
                    management. Monitor, control, and oversee all system
                    operations.
                  </p>
                )}

                {(role === "accountant" || role === "client") && (
                  <p className="darkBg txt-center">
                    Access professional tools for portfolio reconciliation, tax
                    planning, and client financial reporting.
                  </p>
                )}
              </div>
              <div className="ll-bottom">
                <div className="llb-item">
                  <Image src={shield} alt="Secure" width={56} height={56} />
                  <p className="darkBg txt-center">Secure Access</p>
                </div>
                <div className="llb-item">
                  <Image src={lock} alt="Secure" width={56} height={56} />
                  <p className="darkBg txt-center">Encrypted</p>
                </div>
                <div className="llb-item">
                  <Image src={live} alt="Secure" width={56} height={56} />
                  <p className="darkBg txt-center">Live Status</p>
                </div>
                <div className="llb-item">
                  <Image src={analytics} alt="Secure" width={56} height={56} />
                  <p className="darkBg txt-center">Analytics</p>
                </div>
                <div className="llb-item">
                  <Image src={users} alt="Secure" width={56} height={56} />
                  <p className="darkBg txt-center">User Control</p>
                </div>
                <div className="llb-item">
                  <Image src={realTime} alt="Secure" width={56} height={56} />
                  <p className="darkBg txt-center">Real-time</p>
                </div>
              </div>
            </div>
            <div className="ll-copyright">
              <p>© 2026 Clear Portfolio | Internal Use Only</p>
            </div>
          </div>
          <div className="login-right">
            <div className="login-right-wrap">
              <div className="lr-top">
                <div className="login-icon">
                  <Image
                    src={logoBlue}
                    alt="Login Illustration"
                    width={100}
                    height={100}
                    className="icon"
                  />
                </div>
                <div className="lr-top-text">
                  <h2>{roleMap[role] || "Login"} Portal</h2>
                  <p>Please sign in to manage the system.</p>
                </div>
              </div>
              <div className="lr-form">
                {!requireNewPassword && (
                  <form
                    className="login-form-wrap"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleLogin();
                    }}
                  >
                    <div className="login-element">
                      <label htmlFor="email">Email Address</label>
                      <input
                        type="email"
                        placeholder="admin@clearportfolio.com"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="login-element">
                      <label htmlFor="password">Password</label>
                      <div className="login-password-field">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          id="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          className="login-password-toggle"
                          onClick={() => setShowPassword((current) => !current)}
                        >
                          {showPassword ? "Hide" : "View"}
                        </button>
                      </div>
                    </div>
                    <div className="login-submit">
                      <button
                        type="submit"
                        disabled={loading}
                      >
                        {loading ? "Logging in..." : "Log In to Dashboard"}
                      </button>
                    </div>
                  </form>
                )}

                {requireNewPassword && (
                  <form
                    className="login-form-wrap"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSetNewPassword();
                    }}
                  >
                    <div className="login-element">
                      <label htmlFor="password_email">Email Address</label>
                      <input
                        type="email"
                        id="password_email"
                        value={email}
                        disabled
                      />
                    </div>
                    <div className="login-element">
                      <label htmlFor="new_password">New Password</label>
                      <div className="login-password-field">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          id="new_password"
                          placeholder="New password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          className="login-password-toggle"
                          onClick={() =>
                            setShowNewPassword((current) => !current)
                          }
                        >
                          {showNewPassword ? "Hide" : "View"}
                        </button>
                      </div>
                    </div>
                    <div className="login-element">
                      <label htmlFor="confirm_password">Confirm Password</label>
                      <div className="login-password-field">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          id="confirm_password"
                          placeholder="Confirm password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          className="login-password-toggle"
                          onClick={() =>
                            setShowConfirmPassword((current) => !current)
                          }
                        >
                          {showConfirmPassword ? "Hide" : "View"}
                        </button>
                      </div>
                    </div>
                    <div className="login-submit">
                      <button type="submit" disabled={loading}>
                        {loading ? "Creating..." : "Create Password"}
                      </button>
                    </div>
                  </form>
                )}

                {error && (
                  <div className="login-error">
                    <p
                      style={{
                        color: "red",
                        textAlign: "center",
                        paddingTop: "8px",
                      }}
                    >
                      {error}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
