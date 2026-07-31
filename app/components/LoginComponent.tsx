"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import Image from "next/image";
import logo from "../../public/clear-tax.svg";
import logoBlue from "../../public/clear-tax-blue.svg";
import shield from "../../public/shield.svg";
import lock from "../../public/lock.svg";
import live from "../../public/live.svg";
import analytics from "../../public/analytics.svg";
import users from "../../public/users.svg";
import realTime from "../../public/real-time.svg";

// Carries the Cognito Session token + username between an interrupted login and
// the challenge step that completes it (TOTP, email OTP, new password).
interface PendingChallenge {
  session: string;
  username: string;
}

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

function getDashboardPath(role: string) {
  if (role === "super_admin") return "/dashboard/super-admin";
  if (role === "admin") return "/dashboard/admin";
  if (role === "accountant") return "/dashboard/accountant";
  return "/dashboard/client";
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


  // Shared post-authentication path: set cookies, load profile, gate by role,
  // redirect. Returns an error message to display, or null on success (in which
  // case the redirect has been issued and loading should stay on).
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

      if (!allowedRoles.includes(apiRole)) {
        return "You are not allowed to login here";
      }

      document.cookie = `role=${apiRole}; path=/`;
      saveSessionBootstrap({
        email: me.email,
        role: apiRole,
        orgName: me.orgName,
      });

      router.replace(getDashboardPath(apiRole));
      return null;
    },
    [allowedRoles, router],
  );

  // Routes a login / challenge result to the right next step. Returns whether
  // the flow is still pending a user-entered code (caller stops the spinner),
  // or — on SUCCESS — any error from the post-login profile/role check.
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

      const delayAtLeast2s = async () => {
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

        await delayAtLeast2s();

        if (outcome.pending) {
          setLoading(false);
          return;
        }

        if (outcome.error) {
          setError(outcome.error);
          setLoading(false);
        }
        return; // On success keep loading true during redirection to avoid flickering
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
    [routeResult, email, password, setEmailError, setPasswordError],
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
        // Setting the password is the one moment we send the welcome email.
        acceptInvitationInBackground(idToken, { welcome: true });
      }

      setAlertMessage("Password updated successfully. Please login again.");
      setRequireNewPassword(false);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Password update failed"));
    }

    setLoading(false);
  };

  // Shared tail for the challenge-submit handlers: apply the routed outcome.
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
    // On success keep loading true while the redirect happens.
  };

  const handleSubmitTotp = async () => {
    if (!challenge) return;

    const code = mfaCode.trim();
    if (!code) {
      setError("Enter the code from your authenticator app.");
      return;
    }

    if (code.length !== 6) {
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

    if (code.length !== 6) {
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

  const role = allowedRoles[0];

  const roleMap: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    accountant: "Accountant",
    client: "Client",
  };

  return (
    <div className="loginSection">
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
                      <label htmlFor="email">Email Address</label>
                      <input
                        type="email"
                        placeholder="admin@clearportfolio.com"
                        id="email"
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
                      <label htmlFor="password">Password</label>
                      <div className="login-password-field">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          id="password"
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
                        href={`/login/forgot-password?role=${encodeURIComponent(role)}`}
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

                {requireTotp && (
                  <form
                    className="login-form-wrap"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSubmitTotp();
                    }}
                  >
                    <div className="login-element">
                      <label htmlFor="mfa_code">Authentication Code</label>
                      <p style={{ fontSize: "0.85rem", color: "#717182", marginBottom: "8px" }}>
                        Enter the code from your authenticator app.
                      </p>
                      <input
                        type="text"
                        id="mfa_code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        placeholder="Code"
                        value={mfaCode}
                        onChange={(e) =>
                          setMfaCode(e.target.value.replace(/\D/g, ""))
                        }
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
                      <label htmlFor="email_mfa_code">Email Verification Code</label>
                      <p style={{ fontSize: "0.85rem", color: "#717182", marginBottom: "8px" }}>
                        Enter the code we sent to your email ({maskEmail(email)}).
                      </p>
                      <input
                        type="text"
                        id="email_mfa_code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        placeholder="Code"
                        value={mfaCode}
                        onChange={(e) =>
                          setMfaCode(e.target.value.replace(/\D/g, ""))
                        }
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
      {alertMessage && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "24px",
              padding: "36px 32px 32px 32px",
              width: "420px",
              maxWidth: "90%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 40px 0 rgba(0, 0, 0, 0.03)",
              border: "1px solid rgba(226, 232, 240, 0.8)",
              textAlign: "center",
              transform: "scale(1)",
              animation: "scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            {/* Success Checkmark Icon */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)",
                marginBottom: "24px",
                boxShadow: "0 8px 16px rgba(16, 185, 129, 0.12)",
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#10B981"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>

            {/* Title */}
            <h3
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                color: "#0F172A",
                margin: "0 0 10px 0",
                fontFamily: "system-ui, -apple-system, sans-serif",
                letterSpacing: "-0.02em",
              }}
            >
              Password Updated!
            </h3>

            {/* Description */}
            <p
              style={{
                fontSize: "0.95rem",
                lineHeight: "1.6",
                color: "#475569",
                margin: "0 0 28px 0",
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            >
              Your password has been successfully reset. Please sign in again with your new credentials.
            </p>

            {/* Button */}
            <button
              onClick={() => setAlertMessage(null)}
              style={{
                width: "100%",
                padding: "14px 28px",
                background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: "14px",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
                transition: "all 0.2s ease",
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(37, 99, 235, 0.35)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(37, 99, 235, 0.25)";
              }}
            >
              Continue to Login
            </button>
          </div>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes scaleIn {
              from { transform: scale(0.9) translateY(10px); opacity: 0; }
              to { transform: scale(1) translateY(0); opacity: 1; }
            }
          `}} />
        </div>
      )}
    </div>
  );
}