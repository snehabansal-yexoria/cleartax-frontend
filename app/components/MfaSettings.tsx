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

  // Custom confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    actionLabel: string;
    onConfirm: () => void;
  } | null>(null);

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
    setConfirmModal({
      title: "Disable Two-Factor Authentication",
      message: "Are you sure you want to turn off two-factor authentication? This will reduce your account security.",
      actionLabel: "Disable",
      onConfirm: async () => {
        setConfirmModal(null);
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
    });
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
    setConfirmModal({
      title: "Disable Email Codes",
      message: "Are you sure you want to turn off email authentication? You will no longer receive verification codes on your email when signing in.",
      actionLabel: "Disable",
      onConfirm: async () => {
        setConfirmModal(null);
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
    });
  }

  return (
    <aside className="accountant-admin-card relative">
      <div className="flex items-center gap-3 pb-4.5 border-b border-[#e8edf6]">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 shrink-0">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-extrabold text-[#233152] leading-tight">Two-Factor Authentication</h3>
          <p className="mt-1 text-xs text-[#7e89a8] font-medium">
            {phase === "loading"
              ? "Checking status…"
              : enabled
                ? "Enabled — your account is protected"
                : "Add an extra layer of security"}
          </p>
        </div>
      </div>

      {phase === "enrolling" ? (
        <div className="flex flex-col gap-5 py-4.5">
          <p className="text-sm text-slate-600 leading-relaxed">
            Scan this QR code with Google Authenticator, Authy, or 1Password,
            then enter the 6-digit code it shows.
          </p>

          {qrDataUrl && (
            <div className="flex justify-center items-center p-4 bg-slate-50 border border-slate-100 rounded-2xl self-center shadow-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="MFA QR code"
                width={180}
                height={180}
                className="rounded-xl shadow-sm border-4 border-white"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-[#95a0bb] font-bold uppercase tracking-wider">
              Can&apos;t scan? Enter key manually
            </span>
            <code className="px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm text-primary font-mono tracking-wide text-center break-all select-all font-semibold">
              {secret}
            </code>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-[#95a0bb] font-bold uppercase tracking-wider text-center">
              Verification Code
            </span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="px-3 py-3 border-2 border-slate-200 rounded-xl text-xl font-bold tracking-[0.4em] text-center w-full shadow-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200 text-slate-800"
            />
          </div>

          <div className="flex gap-3 mt-1">
            <button
              type="button"
              className="flex-1 min-h-[54px] rounded-xl font-bold text-white bg-primary hover:bg-[#1f2858] active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none shadow-sm hover:shadow"
              onClick={confirmEnrollment}
              disabled={busy}
            >
              {busy ? "Verifying…" : "Verify & Enable"}
            </button>
            <button
              type="button"
              className="flex-1 min-h-[54px] rounded-xl border-2 border-slate-200 bg-transparent text-slate-600 font-bold hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none"
              onClick={cancelEnrollment}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5 py-4.5">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[#95a0bb] font-bold uppercase tracking-wider">Status</span>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mt-1 w-fit ${
              enabled ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-500/10 text-slate-500"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${enabled ? "bg-emerald-500" : "bg-slate-400"}`} />
              {phase === "loading" ? "Loading…" : enabled ? "Active" : "Not enabled"}
            </div>
          </div>

          {phase !== "loading" &&
            (enabled ? (
              <button
                type="button"
                className="w-full min-h-[54px] rounded-xl font-bold border border-red-200 text-red-600 bg-transparent hover:bg-red-50 hover:border-red-300 hover:text-red-700 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none"
                onClick={turnOff}
                disabled={busy}
              >
                {busy ? "Working…" : "Disable MFA"}
              </button>
            ) : (
              <button
                type="button"
                className="w-full min-h-[54px] rounded-xl font-bold text-white bg-primary hover:bg-[#1f2858] active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none shadow-sm hover:shadow"
                onClick={startEnrollment}
                disabled={busy}
              >
                {busy ? "Working…" : "Enable MFA"}
              </button>
            ))}
        </div>
      )}

      {phase === "idle" && (
        <div className="flex flex-col gap-5 mt-4 pt-4 border-t border-[#e8edf6]">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[#95a0bb] font-bold uppercase tracking-wider">Email authentication</span>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mt-1 w-fit ${
              emailEnabled ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-500/10 text-slate-500"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${emailEnabled ? "bg-emerald-500" : "bg-slate-400"}`} />
              {emailEnabled ? "Active" : "Not enabled"}
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-normal">
            Receive a one-time code at <span className="font-semibold text-slate-800">{email}</span> when you sign in.
          </p>

          {emailEnabled ? (
            <button
              type="button"
              className="w-full min-h-[54px] rounded-xl font-bold border border-red-200 text-red-600 bg-transparent hover:bg-red-50 hover:border-red-300 hover:text-red-700 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none"
              onClick={turnOffEmail}
              disabled={emailBusy}
            >
              {emailBusy ? "Working…" : "Disable email codes"}
            </button>
          ) : (
            <button
              type="button"
              className="w-full min-h-[54px] rounded-xl font-bold text-white bg-primary hover:bg-[#1f2858] active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none shadow-sm hover:shadow"
              onClick={turnOnEmail}
              disabled={emailBusy}
            >
              {emailBusy ? "Working…" : "Enable email codes"}
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-700 text-xs mt-3.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="font-medium">{error}</span>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-[#101828]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 flex flex-col gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 text-red-600 shrink-0 self-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div className="flex flex-col gap-1 text-center">
              <h3 className="text-lg font-extrabold text-[#233152]">{confirmModal.title}</h3>
              <p className="text-xs text-slate-500 leading-normal mt-1">{confirmModal.message}</p>
            </div>
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                className="flex-1 min-h-[48px] rounded-xl border border-slate-200 bg-transparent text-slate-600 font-bold hover:bg-slate-50 active:scale-[0.98] transition-all duration-150 text-sm cursor-pointer"
                onClick={() => setConfirmModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 min-h-[48px] rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 active:scale-[0.98] transition-all duration-150 text-sm shadow-sm cursor-pointer"
                onClick={confirmModal.onConfirm}
              >
                {confirmModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}