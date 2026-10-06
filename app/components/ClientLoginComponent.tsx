"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  login,
  completeNewPassword,
  respondTotp,
  respondEmailOtp,
  selectMfa,
  type LoginResult,
} from "../../src/lib/auth";
import { normalizeRoleName } from "../../src/lib/roleNames";
import { saveSessionBootstrap } from "../../src/lib/sessionBootstrap";

import logo from "../../public/clear-tax.svg";
import logoBlue from "../../public/clear-tax-blue.svg";
import shield from "../../public/shield.svg";
import lock from "../../public/lock.svg";
import live from "../../public/live.svg";
import analytics from "../../public/analytics.svg";
import users from "../../public/users.svg";
import realTime from "../../public/real-time.svg";

interface PendingChallenge {
  session: string;
  username: string;
}

const ENABLE_LOADING_TRANSITION = true;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getInviteEmailFromUrl() {
  if (typeof window === "undefined") return "";
  return String(new URLSearchParams(window.location.search).get("email") || "").trim();
}

function getInvitePasswordFromUrl() {
  if (typeof window === "undefined") return "";
  return String(
    new URLSearchParams(window.location.hash.replace(/^#/, "")).get("temporary_password") || "",
  );
}

function acceptInvitationInBackground(
  token: string,
  options: { welcome?: boolean } = {},
) {
  void fetch("/api/invitations/accept", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ welcome: options.welcome === true }),
  }).catch((error) => {
    console.warn("Invitation acceptance did not complete:", error);
  });
}

function maskEmail(emailStr: string): string {
  if (!emailStr) return "";
  const parts = emailStr.split("@");
  if (parts.length !== 2) return emailStr;
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0] || ""}*@${domain}`;
  }
  const maskedLocal = local[0] + "*".repeat(local.length - 2) + local[local.length - 1];
  return `${maskedLocal}@${domain}`;
}

export default function ClientLoginComponent() {
  const router = useRouter();

  // Screen state for mobile view: "initial" | "splash" | "login"
  const [currentScreen, setCurrentScreen] = useState<"initial" | "splash" | "login">(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get("email") || searchParams.get("invite") || searchParams.get("view") === "login") {
        return "login";
      }
    }
    return "splash";
  });

  const [email, setEmail] = useState(getInviteEmailFromUrl);
  const [password, setPassword] = useState(getInvitePasswordFromUrl);
  const [showPassword, setShowPassword] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [requireNewPassword, setRequireNewPassword] = useState(false);
  const [challenge, setChallenge] = useState<PendingChallenge | null>(null);
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const [requireTotp, setRequireTotp] = useState(false);
  const [requireEmailOtp, setRequireEmailOtp] = useState(false);
  const [selectMfaChoice, setSelectMfaChoice] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const inviteBootstrapAttempted = useRef(false);

  const completeLogin = useCallback(
    async (token: string): Promise<string | null> => {
      document.cookie = `idToken=${token}; path=/`;
      acceptInvitationInBackground(token);

      const meResponse = await fetch("/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!meResponse.ok) {
        return "Unable to load your profile. Contact your administrator.";
      }

      const me = await meResponse.json();
      const apiRole = normalizeRoleName(me.role);

      if (apiRole !== "client") {
        return "You are not allowed to login here as client";
      }

      document.cookie = `role=${apiRole}; path=/`;
      saveSessionBootstrap({
        email: me.email,
        role: apiRole,
        orgName: me.orgName,
      });

      router.replace("/dashboard/client");
      return null;
    },
    [router],
  );

  const routeResult = useCallback(
    async (
      result: LoginResult,
    ): Promise<{ pending: true } | { pending: false; error: string | null }> => {
      setRequireNewPassword(false);
      setRequireTotp(false);
      setRequireEmailOtp(false);
      setSelectMfaChoice(false);

      switch (result.type) {
        case "NEW_PASSWORD_REQUIRED":
          setChallenge({ session: result.session, username: result.username });
          setAttributes({ name: result.username });
          setRequireNewPassword(true);
          return { pending: true };
        case "TOTP_REQUIRED":
          setChallenge({ session: result.session, username: result.username });
          setMfaCode("");
          setRequireTotp(true);
          return { pending: true };
        case "EMAIL_OTP_REQUIRED":
          setChallenge({ session: result.session, username: result.username });
          setMfaCode("");
          setRequireEmailOtp(true);
          return { pending: true };
        case "SELECT_MFA":
          setChallenge({ session: result.session, username: result.username });
          setSelectMfaChoice(true);
          return { pending: true };
        case "SUCCESS":
          return { pending: false, error: await completeLogin(result.idToken) };
      }
    },
    [completeLogin],
  );

  const handleLogin = useCallback(
    async (
      loginEmail = email,
      loginPassword = password,
      options: { fromInviteLink?: boolean } = {},
    ) => {
      setError("");
      setEmailError("");
      setPasswordError("");

      let hasError = false;
      const trimmedEmail = (loginEmail || "").trim();

      if (!trimmedEmail) {
        setEmailError("Email address is required.");
        hasError = true;
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
          setEmailError("Please enter a valid email address.");
          hasError = true;
        }
      }

      if (!loginPassword) {
        setPasswordError("Password is required.");
        hasError = true;
      }

      if (hasError) {
        return;
      }

      setLoading(true);
      const startTime = Date.now();

      const delayAtLeast1s = async () => {
        if (!ENABLE_LOADING_TRANSITION) return;
        const elapsed = Date.now() - startTime;
        const remainingDelay = Math.max(0, 1000 - elapsed);
        if (remainingDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, remainingDelay));
        }
      };

      try {
        setEmail(loginEmail);
        const result = await login(loginEmail, loginPassword);
        const outcome = await routeResult(result);

        await delayAtLeast1s();

        if (outcome.pending) {
          setLoading(false);
          return;
        }

        if (outcome.error) {
          setError(outcome.error);
          setLoading(false);
        }
        return;
      } catch (error: unknown) {
        await delayAtLeast1s();
        setError(
          options.fromInviteLink
            ? "This invite link could not be opened automatically. Please sign in with the temporary password from your invitation."
            : getErrorMessage(error, "Login failed"),
        );
      }

      setLoading(false);
    },
    [routeResult, email, password],
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

    setCurrentScreen("login");
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

    if (!challenge) return;

    setLoading(true);
    setError("");

    try {
      const { idToken } = await completeNewPassword(
        challenge.session,
        challenge.username,
        newPassword,
        attributes,
      );

      if (idToken) {
        acceptInvitationInBackground(idToken, { welcome: true });
      }

      setAlertMessage("Password updated successfully. Please login again.");
      setRequireNewPassword(false);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Password update failed"));
    }

    setLoading(false);
  };

  const applyChallengeOutcome = (
    outcome: { pending: true } | { pending: false; error: string | null },
  ) => {
    if (outcome.pending) {
      setLoading(false);
      return;
    }
    if (outcome.error) {
      setError(outcome.error);
      setLoading(false);
    }
  };

  const handleSubmitTotp = async () => {
    if (!challenge) return;

    const code = mfaCode.trim();
    if (!code) {
      setError("Enter the code from your authenticator app.");
      return;
    }

    if (code.length < 6 || code.length > 10) {
      setError("Invalid code. Please try again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await respondTotp(challenge.session, challenge.username, code);
      applyChallengeOutcome(await routeResult(result));
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Invalid code. Please try again."));
      setLoading(false);
    }
  };

  const handleSubmitEmailOtp = async () => {
    if (!challenge) return;

    const code = mfaCode.trim();
    if (!code) {
      setError(`Enter the code we sent to your email (${maskEmail(email)}).`);
      return;
    }

    if (code.length < 6 || code.length > 10) {
      setError("Invalid code. Please try again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await respondEmailOtp(
        challenge.session,
        challenge.username,
        code,
      );
      applyChallengeOutcome(await routeResult(result));
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Invalid code. Please try again."));
      setLoading(false);
    }
  };

  const handleSelectMfa = async (answer: "EMAIL_OTP" | "SOFTWARE_TOKEN_MFA") => {
    if (!challenge) return;

    setLoading(true);
    setError("");

    try {
      const result = await selectMfa(challenge.session, challenge.username, answer);
      applyChallengeOutcome(await routeResult(result));
    } catch (error: unknown) {
      setError(
        getErrorMessage(error, "Could not start verification. Please try again."),
      );
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        /* Responsive display toggles */
        .client-desktop-layout {
          display: block;
        }
        .client-mobile-layout {
          display: none;
        }

        @media (max-width: 768px) {
          .client-desktop-layout {
            display: none !important;
          }
          .client-mobile-layout {
            display: flex !important;
          }
        }

        /* MOBILE FIGMA STYLING */
        .client-mobile-layout {
          min-height: 100dvh;
          width: 100%;
          background: #1e295d;
          flex-direction: column;
          font-family: 'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          position: relative;
          overflow-x: hidden;
          box-sizing: border-box;
        }

        .mobile-blueprint-bg {
          position: absolute;
          inset: 0;
          background-color: #1e295d;
          background-image: 
            linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 32px 32px;
          pointer-events: none;
          z-index: 0;
        }

        .mobile-screen-wrapper {
          position: relative;
          z-index: 2;
          width: 100%;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
        }

        .brand-squircle {
          background: #f4a117;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 25px rgba(244, 161, 23, 0.3);
          flex-shrink: 0;
        }

        /* INITIAL SCREEN */
        .initial-screen-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 24px;
          text-align: center;
          background-color: #1e295d;
          background-image: 
            linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 32px 32px;
          cursor: pointer;
        }

        /* SPLASH SCREEN */
        .splash-screen-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 44px 28px 32px 28px;
          background-color: #1e295d;
          background-image: 
            linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 32px 32px;
          box-sizing: border-box;
        }

        .feature-badge-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
        }

        .feature-icon-container {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: rgba(244, 161, 23, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #f4a117;
          flex-shrink: 0;
        }

        .splash-sign-in-btn {
          width: 100%;
          height: 52px;
          border-radius: 14px;
          background: #f4a117;
          color: #ffffff;
          border: none;
          font-size: 1.05rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(244, 161, 23, 0.35);
          font-family: inherit;
        }

        /* MOBILE LOGIN SCREEN */
        .login-screen-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          padding: 32px 28px 28px 28px;
          background: #f7f9fd;
          box-sizing: border-box;
        }

        .login-input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 16px;
        }

        .login-input-label {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #64748b;
        }

        .login-input-box {
          position: relative;
          display: flex;
          align-items: center;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 0 14px;
          height: 48px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
        }

        .login-input-box:focus-within {
          border-color: #263574;
          box-shadow: 0 0 0 3px rgba(38, 53, 116, 0.12);
        }

        .login-input-box.has-error {
          border-color: #ef4444;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        }

        .login-input-field {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 0.95rem;
          color: #1e293b;
          font-family: inherit;
          padding: 0 10px;
          outline: none;
          width: 100%;
        }

        .login-input-field::placeholder {
          color: #94a3b8;
        }

        .login-submit-btn {
          width: 100%;
          height: 50px;
          border-radius: 12px;
          background: #232f65;
          color: #ffffff;
          border: none;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 20px rgba(35, 47, 101, 0.25);
          font-family: inherit;
        }

        .phone-notch-bar {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          padding: 0 2px 14px 2px;
          color: #1e293b;
        }
      `}</style>

      {/* Loading Overlay */}
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
          }}
        >
          <div
            style={{
              position: "relative",
              zIndex: 2,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "20px",
              padding: "40px 32px",
              borderRadius: "28px",
              background: "rgba(255, 255, 255, 0.9)",
              border: "1px solid rgba(40, 51, 110, 0.08)",
              boxShadow: "0 30px 80px rgba(40, 51, 110, 0.08)",
              maxWidth: "340px",
              width: "90%",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                border: "3px solid rgba(35, 47, 101, 0.1)",
                borderTopColor: "#f4a117",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <span style={{ color: "#28336e", fontSize: "1.2rem", fontWeight: 800 }}>
              Authorizing Access
            </span>
            <span style={{ color: "#64748b", fontSize: "0.88rem" }}>
              Opening your client portfolio dashboard...
            </span>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. DESKTOP VIEW: ORIGINAL SPLIT-SCREEN CLIENT LOGIN       */}
      {/* ========================================================= */}
      <div className="client-desktop-layout">
        <div className="loginSection">
          <div className="login-container">
            <div className="login-wrapper">
              {/* Left Column */}
              <div className="login-left">
                <div className="login-left-wrap">
                  <div className="ll-top">
                    <div className="llt-icon-head">
                      <div className="login-icon">
                        <Image
                          src={logo}
                          alt="Clear Portfolio"
                          width={100}
                          height={100}
                          className="icon"
                        />
                      </div>
                      <h1>Clear Portfolio</h1>
                    </div>
                    <h2>Client</h2>
                    <p className="darkBg txt-center">
                      Access professional tools for portfolio reconciliation, tax
                      planning, and client financial reporting.
                    </p>
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

              {/* Right Column */}
              <div className="login-right">
                <div className="login-right-wrap">
                  <div className="lr-top">
                    <div className="login-icon">
                      <Image
                        src={logoBlue}
                        alt="Clear Portfolio"
                        width={100}
                        height={100}
                        className="icon"
                      />
                    </div>
                    <div className="lr-top-text">
                      <h2>Client Portal</h2>
                      <p>Please sign in to manage the system.</p>
                    </div>
                  </div>
                  <div className="lr-form">
                    {!requireNewPassword &&
                      !requireTotp &&
                      !requireEmailOtp &&
                      !selectMfaChoice && (
                      <form
                        className="login-form-wrap"
                        noValidate
                        onSubmit={(e) => {
                          e.preventDefault();
                          void handleLogin();
                        }}
                      >
                        <div className="login-element">
                          <label htmlFor="desktop-email">Email Address</label>
                          <input
                            type="email"
                            placeholder="client@clearportfolio.com"
                            id="desktop-email"
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              setEmailError("");
                            }}
                            className={emailError ? "has-error" : ""}
                          />
                          {emailError && (
                            <span className="login-field-error">
                              {emailError}
                            </span>
                          )}
                        </div>
                        <div className="login-element">
                          <label htmlFor="desktop-password">Password</label>
                          <div className="login-password-field">
                            <input
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter your password"
                              id="desktop-password"
                              value={password}
                              onChange={(e) => {
                                setPassword(e.target.value);
                                setPasswordError("");
                              }}
                              className={passwordError ? "has-error" : ""}
                            />
                            <button
                              type="button"
                              className="login-password-toggle"
                              onClick={() => setShowPassword((current) => !current)}
                            >
                              {showPassword ? "Hide" : "View"}
                            </button>
                          </div>
                          {passwordError && (
                            <span className="login-field-error">
                              {passwordError}
                            </span>
                          )}
                        </div>
                        <div className="login-submit">
                          <button
                            type="submit"
                            disabled={loading}
                          >
                            {loading ? "Logging in..." : "Log In to Dashboard"}
                          </button>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <Link
                            href="/login/forgot-password?role=client"
                            style={{ color: "#2f3c82", fontWeight: 600, fontSize: "0.95rem" }}
                          >
                            Forgot password?
                          </Link>
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
                          <label>Email Address</label>
                          <input type="email" value={email} disabled />
                        </div>
                        <div className="login-element">
                          <label>New Password</label>
                          <div className="login-password-field">
                            <input
                              type={showNewPassword ? "text" : "password"}
                              placeholder="New password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <button
                              type="button"
                              className="login-password-toggle"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                            >
                              {showNewPassword ? "Hide" : "View"}
                            </button>
                          </div>
                        </div>
                        <div className="login-element">
                          <label>Confirm Password</label>
                          <div className="login-password-field">
                            <input
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="Confirm password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                            <button
                              type="button"
                              className="login-password-toggle"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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

                    {requireTotp && (
                      <form
                        className="login-form-wrap"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void handleSubmitTotp();
                        }}
                      >
                        <div className="login-element">
                          <label htmlFor="desktop_mfa_code">Authentication Code</label>
                          <p style={{ fontSize: "0.85rem", color: "#717182", marginBottom: "8px" }}>
                            Enter the code from your authenticator app.
                          </p>
                          <input
                            type="text"
                            id="desktop_mfa_code"
                            autoComplete="one-time-code"
                            maxLength={10}
                            placeholder="Code"
                            value={mfaCode}
                            onChange={(e) => setMfaCode(e.target.value)}
                            autoFocus
                          />
                        </div>
                        <div className="login-submit">
                          <button type="submit" disabled={loading}>
                            {loading ? "Verifying..." : "Verify & Continue"}
                          </button>
                        </div>
                      </form>
                    )}

                    {requireEmailOtp && (
                      <form
                        className="login-form-wrap"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void handleSubmitEmailOtp();
                        }}
                      >
                        <div className="login-element">
                          <label htmlFor="desktop_email_mfa_code">Email Verification Code</label>
                          <p style={{ fontSize: "0.85rem", color: "#717182", marginBottom: "8px" }}>
                            Enter the code we sent to your email ({maskEmail(email)}).
                          </p>
                          <input
                            type="text"
                            id="desktop_email_mfa_code"
                            autoComplete="one-time-code"
                            maxLength={10}
                            placeholder="Code"
                            value={mfaCode}
                            onChange={(e) => setMfaCode(e.target.value)}
                            autoFocus
                          />
                        </div>
                        <div className="login-submit">
                          <button type="submit" disabled={loading}>
                            {loading ? "Verifying..." : "Verify & Continue"}
                          </button>
                        </div>
                      </form>
                    )}

                    {selectMfaChoice && (
                      <div className="login-form-wrap">
                        <div className="login-element">
                          <label>Choose a verification method</label>
                          <p style={{ fontSize: "0.85rem", color: "#717182", marginBottom: "8px" }}>
                            How would you like to receive your one-time code?
                          </p>
                        </div>
                        <div className="login-submit" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => void handleSelectMfa("EMAIL_OTP")}
                          >
                            {loading ? "Please wait..." : "Email me a code"}
                          </button>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => void handleSelectMfa("SOFTWARE_TOKEN_MFA")}
                          >
                            {loading ? "Please wait..." : "Use authenticator app"}
                          </button>
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className="login-error">
                        <p style={{ color: "red", textAlign: "center", paddingTop: "8px" }}>
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
      </div>

      {/* ========================================================= */}
      {/* 2. MOBILE VIEW: FIGMA RESPONSIVE DESIGN (<= 768px)         */}
      {/* ========================================================= */}
      <div className="client-mobile-layout">
        <div className="mobile-blueprint-bg" />

        <div className="mobile-screen-wrapper">
          {/* A. INITIAL SCREEN */}
          {currentScreen === "initial" && (
            <div
              className="initial-screen-content"
              onClick={() => setCurrentScreen("splash")}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
                <div
                  className="brand-squircle"
                  style={{ width: "96px", height: "96px", borderRadius: "28px" }}
                >
                  <svg width="46" height="46" viewBox="0 0 80 80" fill="none">
                    <path
                      d="M56.6668 31.6666L42.5002 45.8333L34.1668 37.5L23.3335 48.3333"
                      stroke="#1e295d"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M46.6665 31.6666H56.6665V41.6666"
                      stroke="#1e295d"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div>
                  <h1
                    style={{
                      color: "#ffffff",
                      fontSize: "1.95rem",
                      fontWeight: 800,
                      letterSpacing: "-0.03em",
                      margin: 0,
                    }}
                  >
                    ClearPortfolio
                  </h1>
                  <p
                    style={{
                      color: "rgba(255, 255, 255, 0.65)",
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      marginTop: "8px",
                    }}
                  >
                    Your Portfolio, Clearly
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* B. SPLASH SCREEN */}
          {currentScreen === "splash" && (
            <div className="splash-screen-content">
              <div>
                {/* Back button */}
                <div style={{ display: "flex", alignItems: "center", marginBottom: "16px" }}>
                  <button
                    type="button"
                    onClick={() => router.push("/login")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "rgba(255, 255, 255, 0.75)",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      padding: 0,
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                    Back
                  </button>
                </div>

                {/* Logo */}
                <div
                  className="brand-squircle"
                  style={{ width: "56px", height: "56px", borderRadius: "16px" }}
                >
                  <svg width="28" height="28" viewBox="0 0 80 80" fill="none">
                    <path
                      d="M56.6668 31.6666L42.5002 45.8333L34.1668 37.5L23.3335 48.3333"
                      stroke="#1e295d"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M46.6665 31.6666H56.6665V41.6666"
                      stroke="#1e295d"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                {/* Headline */}
                <div style={{ marginTop: "28px" }}>
                  <h1
                    style={{
                      color: "#ffffff",
                      fontSize: "2.1rem",
                      fontWeight: 800,
                      lineHeight: "1.15",
                      letterSpacing: "-0.03em",
                      margin: 0,
                    }}
                  >
                    Your Portfolio,<br />clearly.
                  </h1>
                  <p
                    style={{
                      color: "rgba(255, 255, 255, 0.72)",
                      fontSize: "0.95rem",
                      lineHeight: "1.5",
                      marginTop: "12px",
                      maxWidth: "28ch",
                    }}
                  >
                    Track your properties, transactions, and returns - with your accountant in sync.
                  </p>
                </div>

                {/* 3 Feature Badges */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    marginTop: "32px",
                  }}
                >
                  <div className="feature-badge-item">
                    <div className="feature-icon-container">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M3 3v18h18" />
                        <path d="m19 9-5 5-4-4-3 3" />
                      </svg>
                    </div>
                    <span style={{ color: "#ffffff", fontSize: "0.95rem", fontWeight: 600 }}>
                      Real-time portfolio P&L
                    </span>
                  </div>

                  <div className="feature-badge-item">
                    <div className="feature-icon-container">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M4 7V4h3" />
                        <path d="M20 7V4h-3" />
                        <path d="M4 17v3h3" />
                        <path d="M20 17v3h-3" />
                        <line x1="8" y1="9" x2="16" y2="9" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                        <line x1="8" y1="15" x2="13" y2="15" />
                      </svg>
                    </div>
                    <span style={{ color: "#ffffff", fontSize: "0.95rem", fontWeight: 600 }}>
                      OCR receipts in seconds
                    </span>
                  </div>

                  <div className="feature-badge-item">
                    <div className="feature-icon-container">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <span style={{ color: "#ffffff", fontSize: "0.95rem", fontWeight: 600 }}>
                      Shared with your accountant
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "36px" }}>
                <button
                  type="button"
                  className="splash-sign-in-btn"
                  onClick={() => setCurrentScreen("login")}
                >
                  Sign In
                </button>
                <p
                  style={{
                    color: "rgba(255, 255, 255, 0.55)",
                    fontSize: "0.74rem",
                    textAlign: "center",
                    marginTop: "12px",
                    marginBottom: "8px",
                  }}
                >
                  By continuing you agree to our Terms &amp; Privacy Policy
                </p>
              </div>
            </div>
          )}

          {/* C. MOBILE LOGIN SCREEN */}
          {currentScreen === "login" && (
            <div className="login-screen-content">
              <div>
                <div className="phone-notch-bar">
                  <button
                    type="button"
                    onClick={() => setCurrentScreen("splash")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#64748b",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      cursor: "pointer",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      padding: 0,
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                    Back
                  </button>
                </div>

                <div
                  className="brand-squircle"
                  style={{ width: "48px", height: "48px", borderRadius: "14px", marginTop: "8px" }}
                >
                  <svg width="24" height="24" viewBox="0 0 80 80" fill="none">
                    <path
                      d="M56.6668 31.6666L42.5002 45.8333L34.1668 37.5L23.3335 48.3333"
                      stroke="#1e295d"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M46.6665 31.6666H56.6665V41.6666"
                      stroke="#1e295d"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <div style={{ marginTop: "20px", marginBottom: "24px" }}>
                  <h2
                    style={{
                      color: "#0f172a",
                      fontSize: "1.75rem",
                      fontWeight: 800,
                      letterSpacing: "-0.03em",
                      margin: 0,
                    }}
                  >
                    Welcome Back
                  </h2>
                  <p
                    style={{
                      color: "#64748b",
                      fontSize: "0.9rem",
                      margin: "4px 0 0 0",
                    }}
                  >
                    Sign in to track your portfolio
                  </p>
                </div>

                {!requireNewPassword &&
                  !requireTotp &&
                  !requireEmailOtp &&
                  !selectMfaChoice && (
                  <form
                    noValidate
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleLogin();
                    }}
                  >
                    <div className="login-input-group">
                      <label htmlFor="mobile-client-email" className="login-input-label">
                        Email
                      </label>
                      <div className={`login-input-box ${emailError ? "has-error" : ""}`}>
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#94a3b8"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                        </svg>
                        <input
                          id="mobile-client-email"
                          type="email"
                          placeholder="sarah@example.com"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setEmailError("");
                          }}
                          className="login-input-field"
                          autoComplete="email"
                        />
                      </div>
                      {emailError && (
                        <span style={{ color: "#ef4444", fontSize: "0.78rem", fontWeight: 500 }}>
                          {emailError}
                        </span>
                      )}
                    </div>

                    <div className="login-input-group">
                      <label htmlFor="mobile-client-password" className="login-input-label">
                        Password
                      </label>
                      <div className={`login-input-box ${passwordError ? "has-error" : ""}`}>
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#94a3b8"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <input
                          id="mobile-client-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••••••"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setPasswordError("");
                          }}
                          className="login-input-field"
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#94a3b8",
                            cursor: "pointer",
                            padding: "4px",
                          }}
                        >
                          {showPassword ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                      </div>
                      {passwordError && (
                        <span style={{ color: "#ef4444", fontSize: "0.78rem", fontWeight: 500 }}>
                          {passwordError}
                        </span>
                      )}

                      <div style={{ textAlign: "right", marginTop: "6px" }}>
                        <Link
                          href="/login/forgot-password?role=client"
                          style={{
                            color: "#263574",
                            fontSize: "0.82rem",
                            fontWeight: 700,
                            textDecoration: "none",
                          }}
                        >
                          Forget password?
                        </Link>
                      </div>
                    </div>

                    <div style={{ marginTop: "24px" }}>
                      <button
                        type="submit"
                        disabled={loading}
                        className="login-submit-btn"
                      >
                        {loading ? "Signing in..." : "Sign In"}
                      </button>
                    </div>
                  </form>
                )}

                {requireNewPassword && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSetNewPassword();
                    }}
                  >
                    <div className="login-input-group">
                      <label className="login-input-label">Email</label>
                      <div className="login-input-box" style={{ background: "#f1f5f9" }}>
                        <input
                          type="email"
                          value={email}
                          disabled
                          className="login-input-field"
                          style={{ color: "#64748b" }}
                        />
                      </div>
                    </div>
                    <div className="login-input-group">
                      <label className="login-input-label">New Password</label>
                      <div className="login-input-box">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          placeholder="New password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="login-input-field"
                        />
                      </div>
                    </div>
                    <div className="login-input-group">
                      <label className="login-input-label">Confirm Password</label>
                      <div className="login-input-box">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="login-input-field"
                        />
                      </div>
                    </div>
                    <div style={{ marginTop: "20px" }}>
                      <button type="submit" disabled={loading} className="login-submit-btn">
                        {loading ? "Creating..." : "Create Password"}
                      </button>
                    </div>
                  </form>
                )}

                {requireTotp && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSubmitTotp();
                    }}
                  >
                    <div className="login-input-group">
                      <label className="login-input-label">Authentication Code</label>
                      <p style={{ fontSize: "0.82rem", color: "#64748b", margin: "4px 0 8px 0" }}>
                        Enter the code from your authenticator app.
                      </p>
                      <div className="login-input-box">
                        <input
                          type="text"
                          maxLength={10}
                          placeholder="Code"
                          value={mfaCode}
                          onChange={(e) => setMfaCode(e.target.value)}
                          className="login-input-field"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div style={{ marginTop: "20px" }}>
                      <button type="submit" disabled={loading} className="login-submit-btn">
                        {loading ? "Verifying..." : "Verify & Continue"}
                      </button>
                    </div>
                  </form>
                )}

                {requireEmailOtp && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSubmitEmailOtp();
                    }}
                  >
                    <div className="login-input-group">
                      <label className="login-input-label">Email Verification Code</label>
                      <p style={{ fontSize: "0.82rem", color: "#64748b", margin: "4px 0 8px 0" }}>
                        Enter the code sent to {maskEmail(email)}.
                      </p>
                      <div className="login-input-box">
                        <input
                          type="text"
                          maxLength={10}
                          placeholder="Code"
                          value={mfaCode}
                          onChange={(e) => setMfaCode(e.target.value)}
                          className="login-input-field"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div style={{ marginTop: "20px" }}>
                      <button type="submit" disabled={loading} className="login-submit-btn">
                        {loading ? "Verifying..." : "Verify & Continue"}
                      </button>
                    </div>
                  </form>
                )}

                {selectMfaChoice && (
                  <div>
                    <label className="login-input-label">Choose verification method</label>
                    <p style={{ fontSize: "0.82rem", color: "#64748b", margin: "4px 0 14px 0" }}>
                      How would you like to receive your one-time verification code?
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void handleSelectMfa("EMAIL_OTP")}
                        className="login-submit-btn"
                      >
                        Email me a code
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void handleSelectMfa("SOFTWARE_TOKEN_MFA")}
                        className="login-submit-btn"
                        style={{ background: "#475569" }}
                      >
                        Use authenticator app
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <div
                    style={{
                      marginTop: "16px",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: "rgba(239, 68, 68, 0.08)",
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                      color: "#dc2626",
                      fontSize: "0.84rem",
                      fontWeight: 500,
                      textAlign: "center",
                    }}
                  >
                    {error}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Success Alert Modal */}
      {alertMessage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "24px",
              padding: "32px 28px",
              width: "360px",
              maxWidth: "90%",
              textAlign: "center",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
          >
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                background: "#ecfdf5",
                color: "#10b981",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 style={{ margin: "0 0 8px 0", color: "#0f172a", fontSize: "1.3rem", fontWeight: 700 }}>
              Password Updated!
            </h3>
            <p style={{ color: "#64748b", fontSize: "0.9rem", margin: "0 0 20px 0" }}>
              {alertMessage}
            </p>
            <button
              onClick={() => setAlertMessage(null)}
              className="login-submit-btn"
              style={{ height: "44px" }}
            >
              Continue to Sign In
            </button>
          </div>
        </div>
      )}
    </>
  );
}
