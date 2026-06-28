"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import logoBlue from "../../../public/clear-tax-blue.svg";
import {
  requestPasswordReset,
  confirmPasswordReset,
} from "../../../src/lib/auth";

// Same generic copy whether the account exists or not — never confirm at the
// request step whether an email is registered.
const CODE_SENT_MESSAGE =
  "If an account exists for that email, we've sent a reset code. Check your inbox.";

// Maps the internal role name (passed as ?role= from the login page) back to its
// login route segment. Note client -> /login/user and super_admin -> /login/super-admin.
function loginPathForRole(role: string) {
  switch (role) {
    case "admin":
      return "/login/admin";
    case "super_admin":
      return "/login/super-admin";
    case "accountant":
      return "/login/accountant";
    case "client":
      return "/login/user";
    default:
      return "/login";
  }
}

function errName(error: unknown) {
  return error instanceof Error ? error.name : "";
}

function errMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function ForgotPasswordClient({
  role,
  initialEmail,
}: {
  role: string;
  initialEmail: string;
}) {
  const router = useRouter();
  const loginPath = loginPathForRole(role);

  const [step, setStep] = useState<"request" | "confirm">("request");
  const [done, setDone] = useState(false);

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const handleRequest = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError("");
    setInfo("");

    try {
      await requestPasswordReset(normalizedEmail);
      setEmail(normalizedEmail);
      setStep("confirm");
      setInfo(CODE_SENT_MESSAGE);
    } catch (error: unknown) {
      const name = errName(error);
      if (name === "UserNotFoundException") {
        // Don't reveal whether the account exists — advance with the same message.
        setEmail(normalizedEmail);
        setStep("confirm");
        setInfo(CODE_SENT_MESSAGE);
      } else if (name === "InvalidParameterException") {
        setError(
          "This account can't be reset automatically yet. If you were recently invited, please use your invitation link, or contact your administrator.",
        );
      } else if (name === "LimitExceededException") {
        setError("Too many attempts. Please wait a little while and try again.");
      } else {
        setError(errMessage(error, "We couldn't start the reset. Please try again."));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setError("");
    setInfo("");

    try {
      await requestPasswordReset(email.trim());
      setInfo("We've sent a new code to your email.");
    } catch (error: unknown) {
      if (errName(error) === "LimitExceededException") {
        setError("Too many attempts. Please wait a little while and try again.");
      } else {
        setError(errMessage(error, "Couldn't resend the code. Please try again."));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setError("Enter the code from your email.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    setInfo("");

    try {
      await confirmPasswordReset(email.trim(), trimmedCode, newPassword);
      setDone(true);
    } catch (error: unknown) {
      const name = errName(error);
      if (name === "CodeMismatchException" || name === "ExpiredCodeException") {
        setError("That code is invalid or has expired. Request a new one below.");
      } else if (name === "InvalidPasswordException") {
        setError(errMessage(error, "Your new password doesn't meet the requirements."));
      } else if (name === "LimitExceededException") {
        setError("Too many attempts. Please wait a little while and try again.");
      } else {
        setError(errMessage(error, "We couldn't reset your password. Please try again."));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="loginSection">
      <div
        className="login-container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div className="login-right-wrap" style={{ width: "100%", maxWidth: "520px" }}>
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
              <h2>Reset Password</h2>
              {!done && (
                <p>
                  {step === "request"
                    ? "Enter your email and we'll send you a reset code."
                    : "Enter the code we emailed you and choose a new password."}
                </p>
              )}
            </div>
          </div>

          <div className="lr-form">
            {done && (
              <div className="login-form-wrap">
                <p style={{ textAlign: "center", color: "#364153", fontSize: "1rem" }}>
                  Your password has been reset. You can now sign in with your new
                  password.
                </p>
                <div className="login-submit">
                  <button type="button" onClick={() => router.push(loginPath)}>
                    Continue to login
                  </button>
                </div>
              </div>
            )}

            {!done && step === "request" && (
              <form
                className="login-form-wrap"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleRequest();
                }}
              >
                <div className="login-element">
                  <label htmlFor="reset_email">Email Address</label>
                  <input
                    type="email"
                    id="reset_email"
                    placeholder="you@clearportfolio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="login-submit">
                  <button type="submit" disabled={loading}>
                    {loading ? "Sending..." : "Send Reset Code"}
                  </button>
                </div>
              </form>
            )}

            {!done && step === "confirm" && (
              <form
                className="login-form-wrap"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleConfirm();
                }}
              >
                <div className="login-element">
                  <label htmlFor="reset_code">Verification Code</label>
                  <p style={{ fontSize: "0.85rem", color: "#717182", marginBottom: "8px" }}>
                    Enter the code we emailed to {email}.{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setStep("request");
                        setInfo("");
                        setError("");
                      }}
                      style={{
                        border: 0,
                        background: "transparent",
                        color: "#2f3c82",
                        fontWeight: 700,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      Change
                    </button>
                  </p>
                  <input
                    type="text"
                    id="reset_code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    autoFocus
                  />
                </div>
                <div className="login-element">
                  <label htmlFor="reset_new_password">New Password</label>
                  <div className="login-password-field">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      id="reset_new_password"
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="login-password-toggle"
                      onClick={() => setShowNewPassword((current) => !current)}
                    >
                      {showNewPassword ? "Hide" : "View"}
                    </button>
                  </div>
                </div>
                <div className="login-element">
                  <label htmlFor="reset_confirm_password">Confirm Password</label>
                  <div className="login-password-field">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      id="reset_confirm_password"
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="login-password-toggle"
                      onClick={() => setShowConfirmPassword((current) => !current)}
                    >
                      {showConfirmPassword ? "Hide" : "View"}
                    </button>
                  </div>
                </div>
                <div className="login-submit">
                  <button type="submit" disabled={loading}>
                    {loading ? "Resetting..." : "Reset Password"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void handleResend()}
                  disabled={loading}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: "#2f3c82",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Didn&apos;t get a code? Resend
                </button>
              </form>
            )}

            {info && (
              <div className="login-info">
                <p style={{ color: "#1f7a4d", textAlign: "center", paddingTop: "8px" }}>
                  {info}
                </p>
              </div>
            )}

            {error && (
              <div className="login-error">
                <p style={{ color: "red", textAlign: "center", paddingTop: "8px" }}>
                  {error}
                </p>
              </div>
            )}

            {!done && (
              <div style={{ textAlign: "center", paddingTop: "8px" }}>
                <Link href={loginPath} style={{ color: "#2f3c82", fontWeight: 600 }}>
                  Back to login
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
