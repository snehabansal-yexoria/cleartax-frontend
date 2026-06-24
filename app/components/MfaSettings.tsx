"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  associateTotp,
  buildOtpAuthUri,
  disableEmailMfa,
  disableTotp,
  enableEmailMfa,
  getAuthenticatedUser,
  getEmailMfaStatus,
  getMfaStatus,
  verifyAndEnableTotp,
} from "../../src/lib/mfa";

type Phase = "loading" | "idle" | "enrolling";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function MfaSettings({ email }: { email: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [enabled, setEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Enrollment state
  const [secret, setSecret] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [code, setCode] = useState("");

  const refreshStatus = useCallback(async () => {
    try {
      const user = await getAuthenticatedUser();
      const status = await getMfaStatus(user);
      setEnabled(status.enabled);

      // Don't let an email-status failure hide the TOTP controls.
      try {
        const emailStatus = await getEmailMfaStatus();
        setEmailEnabled(emailStatus.enabled);
      } catch {
        setEmailEnabled(false);
      }

      setPhase("idle");
    } catch (err) {
      setError(getErrorMessage(err, "Could not load security settings."));
      setPhase("idle");
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  async function startEnrollment() {
    setBusy(true);
    setError("");
    try {
      const user = await getAuthenticatedUser();
      const newSecret = await associateTotp(user);
      const uri = buildOtpAuthUri(newSecret, email);
      const dataUrl = await QRCode.toDataURL(uri, { width: 200, margin: 1 });

      setSecret(newSecret);
      setQrDataUrl(dataUrl);
      setCode("");
      setPhase("enrolling");
    } catch (err) {
      setError(getErrorMessage(err, "Could not start MFA setup."));
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnrollment() {
    const trimmed = code.trim();
    if (trimmed.length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const user = await getAuthenticatedUser();
      await verifyAndEnableTotp(user, trimmed);
      setSecret("");
      setQrDataUrl("");
      setCode("");
      setEnabled(true);
      setPhase("idle");
    } catch (err) {
      setError(getErrorMessage(err, "Invalid code. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    if (!window.confirm("Turn off two-factor authentication for your account?")) {
      return;
    }

    setBusy(true);
    setError("");
    try {
      const user = await getAuthenticatedUser();
      await disableTotp(user);
      setEnabled(false);
    } catch (err) {
      setError(getErrorMessage(err, "Could not disable MFA."));
    } finally {
      setBusy(false);
    }
  }

  function cancelEnrollment() {
    setSecret("");
    setQrDataUrl("");
    setCode("");
    setError("");
    setPhase("idle");
  }

  async function turnOnEmail() {
    setEmailBusy(true);
    setError("");
    try {
      await enableEmailMfa();
      setEmailEnabled(true);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Could not enable email authentication. Make sure your email is verified.",
        ),
      );
    } finally {
      setEmailBusy(false);
    }
  }

  async function turnOffEmail() {
    if (!window.confirm("Turn off email authentication for your account?")) {
      return;
    }

    setEmailBusy(true);
    setError("");
    try {
      await disableEmailMfa();
      setEmailEnabled(false);
    } catch (err) {
      setError(getErrorMessage(err, "Could not disable email authentication."));
    } finally {
      setEmailBusy(false);
    }
  }

  return (
    <aside className="accountant-admin-card">
      <div className="accountant-admin-card-header">
        <div className="accountant-admin-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div>
          <h3>Two-Factor Authentication</h3>
          <p>
            {phase === "loading"
              ? "Checking status…"
              : enabled
                ? "Enabled — your account is protected"
                : "Add an extra layer of security"}
          </p>
        </div>
      </div>

      {phase === "enrolling" ? (
        <div className="accountant-admin-info" style={{ gap: "14px" }}>
          <p style={{ fontSize: "0.9rem", color: "#4a5565" }}>
            Scan this QR code with Google Authenticator, Authy, or 1Password,
            then enter the 6-digit code it shows.
          </p>

          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="MFA QR code"
              width={200}
              height={200}
              style={{ alignSelf: "center", borderRadius: "12px" }}
            />
          )}

          <div>
            <span>Can&apos;t scan? Enter this key manually</span>
            <strong style={{ wordBreak: "break-all", fontFamily: "monospace" }}>
              {secret}
            </strong>
          </div>

          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #d0d5dd",
              fontSize: "1.1rem",
              letterSpacing: "0.3em",
              textAlign: "center",
            }}
          />

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              className="accountant-admin-cta"
              onClick={confirmEnrollment}
              disabled={busy}
              style={{ flex: 1 }}
            >
              {busy ? "Verifying…" : "Verify & Enable"}
            </button>
            <button
              type="button"
              onClick={cancelEnrollment}
              disabled={busy}
              style={{ color: "#dc2626", fontWeight: 700 }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="accountant-admin-info">
          <div>
            <span>Status</span>
            <strong style={{ color: enabled ? "#2ea86b" : "#717182" }}>
              {phase === "loading"
                ? "—"
                : enabled
                  ? "Active"
                  : "Not enabled"}
            </strong>
          </div>

          {phase !== "loading" &&
            (enabled ? (
              <button
                type="button"
                className="accountant-admin-cta"
                onClick={turnOff}
                disabled={busy}
                style={{ background: "#dc2626" }}
              >
                {busy ? "Working…" : "Disable MFA"}
              </button>
            ) : (
              <button
                type="button"
                className="accountant-admin-cta"
                onClick={startEnrollment}
                disabled={busy}
              >
                {busy ? "Working…" : "Enable MFA"}
              </button>
            ))}
        </div>
      )}

      {phase === "idle" && (
        <div
          className="accountant-admin-info"
          style={{
            marginTop: "16px",
            borderTop: "1px solid #eef0f4",
            paddingTop: "16px",
          }}
        >
          <div>
            <span>Email authentication</span>
            <strong style={{ color: emailEnabled ? "#2ea86b" : "#717182" }}>
              {emailEnabled ? "Active" : "Not enabled"}
            </strong>
          </div>

          <p style={{ fontSize: "0.85rem", color: "#717182" }}>
            Receive a one-time code at {email} when you sign in.
          </p>

          {emailEnabled ? (
            <button
              type="button"
              className="accountant-admin-cta"
              onClick={turnOffEmail}
              disabled={emailBusy}
              style={{ background: "#dc2626" }}
            >
              {emailBusy ? "Working…" : "Disable email codes"}
            </button>
          ) : (
            <button
              type="button"
              className="accountant-admin-cta"
              onClick={turnOnEmail}
              disabled={emailBusy}
            >
              {emailBusy ? "Working…" : "Enable email codes"}
            </button>
          )}
        </div>
      )}

      {error && (
        <p style={{ color: "#dc2626", fontSize: "0.85rem", marginTop: "12px" }}>
          {error}
        </p>
      )}
    </aside>
  );
}