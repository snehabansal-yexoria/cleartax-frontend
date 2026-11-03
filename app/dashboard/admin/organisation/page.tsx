"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import MfaSettings from "../../../components/MfaSettings";
import { getSession } from "@/src/lib/session";
import { getAuthenticatedUser, getEmailMfaStatus, getMfaStatus } from "@/src/lib/mfa";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

type OrgForm = { legalName: string; contactEmail: string; phone: string; address: string };
type MeForm = { firstName: string; lastName: string; email: string; phone: string };
type Toast = { id: number; type: "success" | "info"; message: string };

// Shown until the organisation API returns these fields.
const SAMPLE_ORG: OrgForm = {
  legalName: "Sunrise Accounting Co. Pty Ltd",
  contactEmail: "admin@sunrise.com.au",
  phone: "+61 2 9555 0142",
  address: "Level 4, 88 Phillip St, Parramatta NSW 2150",
};
const SAMPLE_CREATED = "12 Feb 2024";

const inputClass =
  "w-full h-10 px-3.5 border border-slate-200 rounded-lg text-[13.5px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition font-sans";
const labelClass = "text-[11.5px] font-bold text-slate-400 uppercase tracking-wider font-sans";
const cardClass = "bg-white rounded-2xl p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)]";

function splitName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

function initialsOf(text: string) {
  const words = text.replace(/pty|ltd|co\.?/gi, "").trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "OR";
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const session = (await getSession()) as SessionWithIdToken | null;
  if (!session) return null;
  return { Authorization: `Bearer ${session.getIdToken().getJwtToken()}` };
}

export default function AdminOrganisationPage() {
  const [savedOrg, setSavedOrg] = useState<OrgForm>(SAMPLE_ORG);
  const [org, setOrg] = useState<OrgForm>(SAMPLE_ORG);
  const [savedMe, setSavedMe] = useState<MeForm>({ firstName: "", lastName: "", email: "", phone: "" });
  const [me, setMe] = useState<MeForm>(savedMe);
  const [logo, setLogo] = useState<string | null>(null);
  const [mfaLabel, setMfaLabel] = useState<{ on: boolean; text: string } | null>(null);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(org) !== JSON.stringify(savedOrg) || JSON.stringify(me) !== JSON.stringify(savedMe);

  function toast(message: string, type: Toast["type"] = "success") {
    const id = Date.now();
    setToasts((list) => [...list, { id, type, message }]);
    window.setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), 3500);
  }

  // Load the organisation name and the signed-in admin's profile.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const headers = await authHeaders();
      if (!headers) return;
      const [orgRes, meRes] = await Promise.allSettled([
        fetch("/api/users/me/organization", { headers }).then((res) => (res.ok ? res.json() : null)),
        fetch("/api/users/me", { headers }).then((res) => (res.ok ? res.json() : null)),
      ]);
      if (cancelled) return;
      const orgName = orgRes.status === "fulfilled" ? orgRes.value?.organization?.name : "";
      if (orgName) {
        const next = { ...SAMPLE_ORG, legalName: orgName };
        setSavedOrg(next);
        setOrg(next);
      }
      const profile = meRes.status === "fulfilled" ? meRes.value : null;
      if (profile) {
        const next = {
          ...splitName(String(profile.fullName || "")),
          email: String(profile.email || ""),
          phone: String(profile.phoneNumber || ""),
        };
        setSavedMe(next);
        setMe(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // MFA status for the badge next to "Manage MFA".
  useEffect(() => {
    if (mfaOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const user = await getAuthenticatedUser();
        const totp = await getMfaStatus(user);
        const email = await getEmailMfaStatus().catch(() => ({ enabled: false }));
        if (cancelled) return;
        if (totp.enabled) setMfaLabel({ on: true, text: "MFA on · authenticator app" });
        else if (email.enabled) setMfaLabel({ on: true, text: "MFA on · email code" });
        else setMfaLabel({ on: false, text: "MFA off" });
      } catch {
        if (!cancelled) setMfaLabel(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mfaOpen]);

  function onLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogo((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });
    event.target.value = "";
  }

  async function save() {
    setSaving(true);
    try {
      const meChanged = JSON.stringify(me) !== JSON.stringify(savedMe);
      if (meChanged) {
        const headers = await authHeaders();
        if (!headers) throw new Error("Your session has expired. Please sign in again.");
        const res = await fetch("/api/users/me", {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ fullName: `${me.firstName} ${me.lastName}`.trim(), phoneNumber: me.phone }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Your profile couldn't be saved.");
        }
        setSavedMe(me);
      }
      // Organisation fields have no update endpoint yet: keep them for this session.
      setSavedOrg(org);
      toast("Changes saved");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Changes couldn't be saved.", "info");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-8 pb-12 w-full font-sans relative">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Organisation profile</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            You administer one organisation. It was created by the platform&apos;s Super Admin, who controls the locked fields.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => {
              setOrg(savedOrg);
              setMe(savedMe);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Discard
          </button>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={save}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {/* Organisation details */}
      <section className={`${cardClass} flex flex-col gap-5`}>
        <div className="flex justify-between items-center flex-wrap gap-3">
          <h2 className="text-lg font-bold text-slate-900">Organisation details</h2>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
            Created by Super Admin · {SAMPLE_CREATED}
          </span>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Organisation logo" className="w-16 h-16 rounded-[14px] object-cover border border-slate-200" />
          ) : (
            <span className="w-16 h-16 rounded-[14px] bg-gradient-to-b from-[#fbb228] to-[#f4a117] text-[#24316e] font-bold text-xl flex items-center justify-center shadow-sm">
              {initialsOf(org.legalName)}
            </span>
          )}
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/png,image/svg+xml,image/jpeg" className="hidden" onChange={onLogo} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Upload logo
            </button>
            <button
              type="button"
              disabled={!logo}
              onClick={() => setLogo(null)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Remove
            </button>
          </div>
          <span className="text-xs text-slate-500">PNG or SVG, at least 256 px. Shown on invites and exported reports.</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Legal name · locked</span>
            <input className={`${inputClass} !bg-slate-100 text-slate-500 cursor-not-allowed`} value={org.legalName} disabled />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Contact email</span>
            <input
              className={inputClass}
              type="email"
              value={org.contactEmail}
              onChange={(event) => setOrg({ ...org, contactEmail: event.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Phone</span>
            <input className={inputClass} type="tel" value={org.phone} onChange={(event) => setOrg({ ...org, phone: event.target.value })} />
          </label>
          <label className="flex flex-col gap-1.5 md:col-span-2 xl:col-span-3">
            <span className={labelClass}>Address</span>
            <input className={inputClass} value={org.address} onChange={(event) => setOrg({ ...org, address: event.target.value })} />
          </label>
        </div>
      </section>

      {/* My profile */}
      <section className={`${cardClass} flex flex-col gap-5`}>
        <h2 className="text-lg font-bold text-slate-900">My profile</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>First name</span>
            <input className={inputClass} value={me.firstName} onChange={(event) => setMe({ ...me, firstName: event.target.value })} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Last name</span>
            <input className={inputClass} value={me.lastName} onChange={(event) => setMe({ ...me, lastName: event.target.value })} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Email</span>
            <input className={`${inputClass} !bg-slate-100 text-slate-500 cursor-not-allowed`} type="email" value={me.email} disabled title="Your sign-in email can't be changed here" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Phone</span>
            <input className={inputClass} type="tel" placeholder="+61 4XX XXX XXX" value={me.phone} onChange={(event) => setMe({ ...me, phone: event.target.value })} />
          </label>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setMfaOpen(true)}
            className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Manage MFA
          </button>
          {mfaLabel ? (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                mfaLabel.on ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${mfaLabel.on ? "bg-emerald-500" : "bg-orange-500"}`} />
              {mfaLabel.text}
            </span>
          ) : null}
        </div>
      </section>

      {/* Manage MFA */}
      {mfaOpen ? (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center p-6 overflow-y-auto"
          onMouseDown={(event) => event.target === event.currentTarget && setMfaOpen(false)}
        >
          <div role="dialog" aria-modal="true" aria-label="Manage MFA" className="bg-white rounded-2xl shadow-xl w-full max-w-[560px] mt-16">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Manage MFA</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setMfaOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <MfaSettings email={me.email} />
            </div>
          </div>
        </div>
      ) : null}

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 bg-slate-900 text-white px-4 py-3.5 rounded-xl shadow-xl min-w-[280px] border border-slate-800 text-sm font-medium"
          >
            <span className={`w-2 h-2 rounded-full ${item.type === "success" ? "bg-emerald-400" : "bg-blue-400"}`} />
            {item.message}
          </div>
        ))}
      </div>
    </div>
  );
}
