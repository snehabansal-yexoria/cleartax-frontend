"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import logoBlue from "../../public/clear-tax-blue.svg";

function getLoginPathForRole(role: string) {
  const normalizedRole = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");

  if (normalizedRole === "super_admin") return "/login/super-admin";
  if (normalizedRole === "admin") return "/login/admin";
  if (normalizedRole === "accountant") return "/login/accountant";

  return "/login/user";
}

function getRoleLabel(role: string) {
  const normalized = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/_/g, " ");
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function InviteClient({
  email,
  role,
  token,
}: {
  email: string;
  role: string;
  token: string;
}) {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState(3);

  const handleRedirectNow = useCallback(() => {
    const loginUrl = new URL(getLoginPathForRole(role), window.location.origin);

    if (token) {
      loginUrl.searchParams.set("invite", token);
    }

    if (email) {
      loginUrl.searchParams.set("email", email);
    }

    router.replace(
      `${loginUrl.pathname}${loginUrl.search}${window.location.hash}`,
    );
  }, [email, role, router, token]);

  useEffect(() => {
    if (timeLeft <= 0) {
      handleRedirectNow();
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, handleRedirectNow]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-radial from-slate-50 via-slate-100 to-blue-50 p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 text-center relative overflow-hidden animate-[scaleIn_0.35s_cubic-bezier(0.34,1.56,0.64,1)]">
        {/* Brand Logo */}
        <div className="flex justify-center mb-8">
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm">
            <Image
              src={logoBlue}
              alt="Clear Portfolio Logo"
              width={48}
              height={48}
              className="h-10 w-auto"
            />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
          Accept Invitation
        </h1>
        <p className="text-slate-500 text-sm mb-6 max-w-[280px] mx-auto leading-relaxed">
          You have been invited to join the Clear Portfolio platform.
        </p>

        {/* Invite Info Card */}
        <div className="bg-slate-50/80 border border-slate-100 p-5 rounded-2xl mb-8 text-left space-y-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Email Address
            </span>
            <span className="text-sm font-medium text-slate-800 break-all font-mono">
              {email || "—"}
            </span>
          </div>

          <div className="h-px bg-slate-100" />

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Assigned Role
            </span>
            <div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100/60 uppercase">
                {getRoleLabel(role)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Button & Loader */}
        <div className="space-y-4">
          <button
            onClick={handleRedirectNow}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-[#28336e] to-[#1a224c] hover:from-[#1a224c] hover:to-[#121836] text-white rounded-2xl font-semibold shadow-lg shadow-[#28336e]/20 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <span>Continue to Login</span>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
              />
            </svg>
          </button>

          {/* Countdown timer / Progress Bar */}
          <div className="pt-2">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 px-1 font-medium font-sans">
              <span>Automatic redirect</span>
              <span className="text-slate-500 tabular-nums font-mono">
                {timeLeft > 0 ? `in ${timeLeft}s` : "now..."}
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${(timeLeft / 3) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mt-8 pt-4 border-t border-slate-100/60">
          <p className="text-xs text-slate-400 leading-normal">
            Your account was configured by the administrator. Please log in using the temporary credentials sent to you.
          </p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes scaleIn {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        `
      }} />
    </div>
  );
}
