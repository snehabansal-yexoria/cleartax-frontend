"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { signUp } from "../../src/lib/auth";

type SignupRole = "super_admin" | "admin" | "accountant" | "client";

const roleMap: Record<SignupRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  accountant: "Accountant",
  client: "Client",
};

export default function SignupComponent({
  role,
}: {
  role: SignupRole;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [tenantCode, setTenantCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const requiresTenantCode = role !== "super_admin";
  const loginHref = useMemo(() => {
    if (role === "client") {
      return "/login/user";
    }

    if (role === "super_admin") {
      return "/login/super-admin";
    }

    return `/login/${role}`;
  }, [role]);

  async function handleSignup() {
    setError("");
    setSuccessMessage("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (requiresTenantCode && !tenantCode.trim()) {
      setError("Tenant code is required");
      return;
    }

    try {
      setLoading(true);

      await signUp({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        role,
        tenantCode: requiresTenantCode ? tenantCode.trim().toUpperCase() : "",
      });

      setSuccessMessage(
        "Account created successfully. Please sign in so we can complete your workspace setup.",
      );
      setFullName("");
      setEmail("");
      setTenantCode("");
      setPassword("");
      setConfirmPassword("");
    } catch (signupError: unknown) {
      setError(
        signupError instanceof Error
          ? signupError.message
          : "Failed to create account",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="loginSection">
      <div className="login-container">
        <div className="login-wrapper">
          <div className="login-left">
            <div className="login-left-wrap">
              <div className="ll-top">
                <div className="llt-icon-head">
                  <div className="login-icon signup-icon-box">
                    <span>CP</span>
                  </div>
                  <h1>Clear Portfolio</h1>
                </div>
                <h2>{roleMap[role]} Sign Up</h2>
                <p className="darkBg txt-center">
                  Create your account first, then sign in to let the platform
                  provision your role-specific workspace through the API.
                </p>
              </div>
            </div>
          </div>

          <div className="login-right">
            <div className="login-right-wrap">
              <div className="lr-top">
                <div className="lr-top-text">
                  <h2>Create {roleMap[role]} Account</h2>
                  <p>Fill in your details to start the onboarding flow.</p>
                </div>
              </div>

              <div className="lr-form">
                <div className="login-form-wrap">
                  <div className="login-element">
                    <label htmlFor="signup_full_name">Full Name</label>
                    <input
                      id="signup_full_name"
                      type="text"
                      placeholder="Jane Citizen"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                    />
                  </div>

                  <div className="login-element">
                    <label htmlFor="signup_email">Email Address</label>
                    <input
                      id="signup_email"
                      type="email"
                      placeholder="jane@clearportfolio.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>

                  {requiresTenantCode && (
                    <div className="login-element">
                      <label htmlFor="signup_tenant_code">Tenant Code</label>
                      <input
                        id="signup_tenant_code"
                        type="text"
                        placeholder="ACME"
                        value={tenantCode}
                        onChange={(event) =>
                          setTenantCode(event.target.value.toUpperCase())
                        }
                      />
                    </div>
                  )}

                  <div className="login-element">
                    <label htmlFor="signup_password">Password</label>
                    <div className="login-password-field">
                      <input
                        id="signup_password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
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

                  <div className="login-element">
                    <label htmlFor="signup_confirm_password">
                      Confirm Password
                    </label>
                    <div className="login-password-field">
                      <input
                        id="signup_confirm_password"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
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
                    <button
                      onClick={handleSignup}
                      disabled={
                        loading ||
                        !fullName.trim() ||
                        !email.trim() ||
                        !password.trim() ||
                        !confirmPassword.trim() ||
                        (requiresTenantCode && !tenantCode.trim())
                      }
                    >
                      {loading ? "Creating Account..." : "Create Account"}
                    </button>
                  </div>

                  <div className="signup-login-link">
                    <span>Already have an account?</span>
                    <Link href={loginHref}>Sign in</Link>
                  </div>
                </div>

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

                {successMessage && (
                  <div className="signup-success-message">
                    <p>{successMessage}</p>
                    <Link href={loginHref}>Go to sign in</Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
