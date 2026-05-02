"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { login, completeNewPassword } from "../../src/lib/auth";
import { normalizeRoleName } from "../../src/lib/roleNames";
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

  const handleLogin = useCallback(
    async (
      loginEmail = email,
      loginPassword = password,
      options: { fromInviteLink?: boolean } = {},
    ) => {
      setError("");
      setLoading(true);

      try {
        const result = (await login(loginEmail, loginPassword)) as LoginResult;

        if (result.type === "NEW_PASSWORD_REQUIRED") {
          setEmail(loginEmail);
          setUser(result.user);

          const requiredAttributes: Record<string, string> = {};
          requiredAttributes.name = loginEmail;

          setAttributes(requiredAttributes);
          setRequireNewPassword(true);

          setLoading(false);
          return;
        }

        if (result.type === "SUCCESS") {
          const token = result.idToken;

          document.cookie = `idToken=${token}; path=/`;

          await fetch("/api/invitations/accept", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => undefined);

          const meResponse = await fetch("/api/users/me", {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!meResponse.ok) {
            setError("Unable to load your profile. Contact your administrator.");
            setLoading(false);
            return;
          }

          const me = await meResponse.json();
          const role = normalizeRoleName(me.role);

          if (!allowedRoles.includes(role)) {
            setError("You are not allowed to login here");
            setLoading(false);
            return;
          }

          document.cookie = `role=${role}; path=/`;

          if (role === "super_admin") {
            router.replace("/dashboard/super-admin");
          } else if (role === "admin") {
            router.replace("/dashboard/admin");
          } else if (role === "accountant") {
            router.replace("/dashboard/accountant");
          } else {
            router.replace("/dashboard/client");
          }
        }
      } catch (error: unknown) {
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
        await fetch("/api/invitations/accept", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
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
    <div className="loginSection">
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
                  <div className="login-form-wrap">
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
                        onClick={() => void handleLogin()}
                        disabled={loading}
                      >
                        {loading ? "Logging in..." : "Log In to Dashboard"}
                      </button>
                    </div>
                  </div>
                )}

                {requireNewPassword && (
                  <div className="login-form-wrap">
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
                      <button onClick={handleSetNewPassword} disabled={loading}>
                        {loading ? "Creating..." : "Create Password"}
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
    </div>
  );
}
