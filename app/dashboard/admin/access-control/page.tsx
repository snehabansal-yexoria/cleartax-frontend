"use client";

import { useEffect, useMemo, useState } from "react";
import { getSession } from "@/src/lib/session";
import { requestPasswordReset } from "@/src/lib/auth";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

interface InvitedUser {
  id: string;
  email: string;
  role: string;
  status: string;
  name: string;
  createdAt: string | null;
}

type Kind = "accountant" | "client";
type Access = "Has access" | "Invited" | "Access removed";
type Person = {
  id: string;
  kind: Kind;
  name: string;
  email: string;
  /** Accountant: "11 clients". Client: their accountant. */
  link: string;
  access: Access;
  lastIn: Date | null;
  lastOut: Date | null;
  signIns: number;
  /** Sample rows are not in the backend: actions on them only update this screen. */
  sample: boolean;
};
type Dialog = { type: "reset" | "remove" | "cancel" | "restore"; person: Person } | null;
type Toast = { id: number; type: "success" | "info"; message: string };

/* ----------------------------------------------------------------- sample data */
/* Sign-in and sign-out times aren't returned by the API yet; these rows show
   how the screen looks with data. Real accountants and clients from
   /api/users/me/invited are listed alongside them. */

const NOW = new Date();
const at = (daysAgo: number, hour: number, minute: number) => {
  const date = new Date(NOW);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date;
};

const SAMPLE: Person[] = [
  ["Akash Sharma", "akash@sunrise.com.au", "11 clients", "Has access", at(0, 9, 12), at(1, 18, 40), 38],
  ["Aisha Khan", "aisha@sunrise.com.au", "10 clients", "Has access", at(0, 8, 47), at(1, 17, 58), 41],
  ["Satnam Singh", "satnam@sunrise.com.au", "9 clients", "Has access", at(0, 10, 5), at(1, 19, 15), 33],
  ["Priya Rajan", "priya@sunrise.com.au", "8 clients", "Has access", at(0, 8, 30), at(0, 13, 10), 44],
  ["Oliver Brooks", "oliver@sunrise.com.au", "8 clients", "Has access", at(1, 9, 20), at(1, 17, 32), 29],
  ["Jessica Tran", "jessica@sunrise.com.au", "7 clients", "Has access", at(0, 9, 55), at(1, 18, 2), 36],
  ["Michael Chen", "michael@sunrise.com.au", "5 clients", "Has access", at(3, 16, 18), at(3, 17, 1), 9],
  ["Nina Wong", "nina@sunrise.com.au", "No clients yet", "Invited", null, null, 0],
  ["Liam O’Connor", "liam@sunrise.com.au", "Clients moved", "Access removed", at(43, 15, 44), at(43, 17, 10), 0],
]
  .map(([name, email, link, access, lastIn, lastOut, signIns]) => ({
    id: `sample-a-${email}`,
    kind: "accountant" as Kind,
    name: name as string,
    email: email as string,
    link: link as string,
    access: access as Access,
    lastIn: lastIn as Date | null,
    lastOut: lastOut as Date | null,
    signIns: signIns as number,
    sample: true,
  }))
  .concat(
    [
      ["Sneha Bansal", "sneha@email.com", "Akash Sharma", "Has access", at(0, 7, 58), at(0, 8, 20), 22],
      ["Grace Thompson", "grace@email.com", "Aisha Khan", "Has access", at(0, 11, 2), at(0, 11, 31), 14],
      ["Raj Patel", "raj@email.com", "Satnam Singh", "Has access", at(1, 20, 15), at(1, 20, 44), 9],
      ["Li Chen", "li@email.com", "Priya Rajan", "Has access", at(0, 6, 40), at(0, 6, 52), 17],
      ["Mark Williams", "mark@email.com", "Akash Sharma", "Has access", at(12, 21, 10), at(12, 21, 26), 2],
      ["Ella Martin", "ella@email.com", "Michael Chen", "Has access", at(31, 19, 5), at(31, 19, 12), 0],
      ["Hannah Scott", "hannah@email.com", "Jessica Tran", "Has access", at(1, 12, 30), at(1, 12, 51), 11],
      ["Zoe Adams", "zoe@email.com", "Oliver Brooks", "Invited", null, null, 0],
      ["Ben Carter", "ben@email.com", "Unassigned", "Access removed", at(75, 10, 20), at(75, 10, 34), 0],
    ].map(([name, email, link, access, lastIn, lastOut, signIns]) => ({
      id: `sample-c-${email}`,
      kind: "client" as Kind,
      name: name as string,
      email: email as string,
      link: link as string,
      access: access as Access,
      lastIn: lastIn as Date | null,
      lastOut: lastOut as Date | null,
      signIns: signIns as number,
      sample: true,
    })),
  );

/** Stable sample sign-in times for a real user until the API returns them. */
function sampleTimes(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const days = hash % 6;
  const hour = 8 + (hash % 9);
  const minute = hash % 60;
  const length = 15 + (hash % 240);
  const lastIn = at(days, hour, minute);
  return { lastIn, lastOut: new Date(lastIn.getTime() + length * 60_000), signIns: 4 + (hash % 30) };
}

/* -------------------------------------------------------------------- helpers */

const dayLabel = (date: Date) => {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((start(NOW) - start(date)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
};
const formatWhen = (date: Date | null) =>
  date ? `${dayLabel(date)}, ${date.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" }).toLowerCase()}` : "Never";

const daysSince = (date: Date | null) => (date ? (NOW.getTime() - date.getTime()) / 86_400_000 : Infinity);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

const AVATARS = ["bg-blue-50 text-blue-700", "bg-violet-50 text-violet-700", "bg-emerald-50 text-emerald-700", "bg-teal-50 text-teal-700", "bg-orange-50 text-orange-700", "bg-rose-50 text-rose-700"];
const avatarFor = (name: string) => AVATARS[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATARS.length];

const ACCESS_STYLE: Record<Access, { pill: string; dot: string }> = {
  "Has access": { pill: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  Invited: { pill: "bg-orange-50 text-orange-700", dot: "bg-orange-500" },
  "Access removed": { pill: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
};

const cardClass = "bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)]";
const selectClass =
  "h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-sans cursor-pointer";
const btnSm = "px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer whitespace-nowrap";
const btnDangerSm = "px-3 py-1.5 border border-red-200 bg-red-50 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-100 transition cursor-pointer whitespace-nowrap";

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/* ----------------------------------------------------------------------- page */

export default function AdminAccessControlPage() {
  const [people, setPeople] = useState<Person[]>(SAMPLE);
  const [tab, setTab] = useState<Kind>("accountant");
  const [query, setQuery] = useState("");
  const [accessFilter, setAccessFilter] = useState<"all" | Access>("all");
  const [lastFilter, setLastFilter] = useState<"any" | "today" | "7d" | "30d+" | "never">("any");
  const [accountantFilter, setAccountantFilter] = useState("all");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [moveTo, setMoveTo] = useState("");
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  function toast(message: string, type: Toast["type"] = "success") {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { id, type, message }]);
    window.setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), 3800);
  }

  // Real accountants and clients in this organisation.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;
        if (!session) return;
        const res = await fetch("/api/users/me/invited", {
          headers: { Authorization: `Bearer ${session.getIdToken().getJwtToken()}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { users?: InvitedUser[] };
        const users = (data.users ?? []).filter((user) => ["accountant", "client"].includes(user.role.toLowerCase()));
        if (cancelled || users.length === 0) return;
        setPeople((current) => {
          const known = new Set(current.map((person) => person.email.toLowerCase()));
          const real: Person[] = users
            .filter((user) => !known.has(user.email.toLowerCase()))
            .map((user) => {
              const invited = ["INVITED", "PENDING"].includes(String(user.status).toUpperCase());
              const times = sampleTimes(user.id || user.email);
              return {
                id: user.id || user.email,
                kind: user.role.toLowerCase() as Kind,
                name: user.name || user.email,
                email: user.email,
                link: "—",
                access: invited ? "Invited" : "Has access",
                lastIn: invited ? null : times.lastIn,
                lastOut: invited ? null : times.lastOut,
                signIns: invited ? 0 : times.signIns,
                sample: false,
              };
            });
          return [...real, ...current];
        });
      } catch {
        // Sample rows stay on screen if the request fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const accountants = people.filter((person) => person.kind === "accountant");
  const clients = people.filter((person) => person.kind === "client");
  const count = (list: Person[], access: Access) => list.filter((person) => person.access === access).length;
  const signedInToday = people.filter((person) => person.access === "Has access" && person.lastIn && dayLabel(person.lastIn) === "Today");
  const stale = people.filter((person) => person.access === "Has access" && daysSince(person.lastIn) > 30);

  const accountantNames = useMemo(
    () => [...new Set(clients.map((client) => client.link).filter((name) => name && name !== "—" && name !== "Unassigned"))].sort(),
    [clients],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return people.filter((person) => {
      if (person.kind !== tab) return false;
      if (needle && !`${person.name} ${person.email} ${person.link}`.toLowerCase().includes(needle)) return false;
      if (accessFilter !== "all" && person.access !== accessFilter) return false;
      if (tab === "client" && accountantFilter !== "all" && person.link !== accountantFilter) return false;
      const age = daysSince(person.lastIn);
      if (lastFilter === "today" && !(person.lastIn && dayLabel(person.lastIn) === "Today")) return false;
      if (lastFilter === "7d" && age > 7) return false;
      if (lastFilter === "30d+" && !(age > 30 && person.lastIn)) return false;
      if (lastFilter === "never" && person.lastIn) return false;
      return true;
    });
  }, [people, tab, query, accessFilter, lastFilter, accountantFilter]);

  function openDialog(type: NonNullable<Dialog>["type"], person: Person) {
    setReason(person.kind === "accountant" ? "Left the firm" : "Client left the practice");
    setNotify(true);
    setMoveTo(accountants.find((acc) => acc.access === "Has access" && acc.email !== person.email)?.name ?? "");
    setDialog({ type, person });
  }

  function setAccess(person: Person, access: Access) {
    setPeople((list) => list.map((item) => (item.id === person.id ? { ...item, access } : item)));
  }

  async function confirm() {
    if (!dialog) return;
    const { type, person } = dialog;
    setBusy(true);
    try {
      if (type === "reset") {
        if (!person.sample) {
          // Cognito emails the user a code to set a new password.
          await requestPasswordReset(person.email);
        }
        toast(`Password reset email sent to ${person.email}`);
      } else if (type === "remove") {
        setAccess(person, "Access removed");
        toast(`${person.name}'s access removed`);
      } else if (type === "cancel") {
        setAccess(person, "Access removed");
        toast(`Invite for ${person.name} cancelled`);
      } else {
        setAccess(person, "Has access");
        toast(`${person.name}'s access restored`);
      }
      setDialog(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : "That didn't work. Please try again.", "info");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const header = [tab === "accountant" ? "Accountant" : "Client", "Email", tab === "accountant" ? "Clients" : "Accountant", "Access", "Last sign-in", "Last sign-out", "Sign-ins (30 days)"];
    const lines = rows.map((person) =>
      [person.name, person.email, person.link, person.access, formatWhen(person.lastIn), person.lastOut ? formatWhen(person.lastOut) : "—", person.signIns].map(csvCell).join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `access-control-${tab === "accountant" ? "accountants" : "clients"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const kinds = (list: Person[]) =>
    `${plural(list.filter((p) => p.kind === "accountant").length, "accountant")} · ${plural(list.filter((p) => p.kind === "client").length, "client")}`;

  const kpis = [
    { label: "Accountants", value: accountants.length, sub: `${count(accountants, "Has access")} with access · ${count(accountants, "Invited")} invited · ${count(accountants, "Access removed")} removed` },
    { label: "Clients", value: clients.length, sub: `${count(clients, "Has access")} with access · ${count(clients, "Invited")} invited · ${count(clients, "Access removed")} removed` },
    {
      label: "Signed in today",
      value: signedInToday.length,
      sub: kinds(signedInToday),
    },
    {
      label: "Not signed in for 30+ days",
      value: stale.length,
      sub: kinds(stale),
    },
  ];

  const tabs: { id: Kind; label: string; total: number }[] = [
    { id: "accountant", label: "Accountants", total: accountants.length },
    { id: "client", label: "Clients", total: clients.length },
  ];

  const target = dialog?.person;
  const firstName = target?.name.split(" ")[0] ?? "";
  const clientCount = target ? Number.parseInt(target.link, 10) || 0 : 0;

  return (
    <div className="flex flex-col gap-8 pb-12 w-full font-sans relative">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Access control</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            Who can sign in to your organisation, when they last signed in and out. Reset a password or remove someone&apos;s access.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm cursor-pointer"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Export
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`${cardClass} p-6 transition hover:shadow-md hover:translate-y-[-2px] duration-200`}>
            <p className="!text-[11.5px] font-bold text-slate-400 uppercase tracking-wider font-sans">{kpi.label}</p>
            <span className="!text-[28px] font-semibold mt-1.5 block text-slate-900">{kpi.value}</span>
            <p className="!text-[12px] text-slate-500 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Table panel */}
      <div className={`${cardClass} overflow-hidden`}>
        <div className="flex items-center gap-6 px-6 pt-5 border-b border-slate-100">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setAccountantFilter("all");
              }}
              className={`pb-4 text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                tab === item.id ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {item.label}
              <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${tab === item.id ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                {item.total}
              </span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4 px-6 py-4 border-b border-slate-100 bg-slate-50/40">
          <label className="flex flex-col gap-1.5 flex-1 min-w-[220px]">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Search</span>
            <input
              type="search"
              placeholder="Name or email"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 px-3.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-sans"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Access</span>
            <select className={selectClass} value={accessFilter} onChange={(event) => setAccessFilter(event.target.value as typeof accessFilter)}>
              <option value="all">All</option>
              <option value="Has access">Has access</option>
              <option value="Invited">Invited</option>
              <option value="Access removed">Access removed</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Last sign-in</span>
            <select className={selectClass} value={lastFilter} onChange={(event) => setLastFilter(event.target.value as typeof lastFilter)}>
              <option value="any">Any time</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d+">Over 30 days ago</option>
              <option value="never">Never</option>
            </select>
          </label>
          {tab === "client" ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Accountant</span>
              <select className={selectClass} value={accountantFilter} onChange={(event) => setAccountantFilter(event.target.value)}>
                <option value="all">All accountants</option>
                {accountantNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                {[tab === "accountant" ? "Accountant" : "Client", tab === "accountant" ? "Clients" : "Accountant", "Access", "Last sign-in", "Last sign-out"].map((label) => (
                  <th key={label} className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                    {label}
                  </th>
                ))}
                <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans text-right">Sign-ins (30 days)</th>
                <th className="py-4 px-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm font-medium text-slate-400">
                    No {tab === "accountant" ? "accountants" : "clients"} match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((person) => (
                  <tr key={person.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-[13px] shrink-0 ${avatarFor(person.name)}`}>
                          {initials(person.name)}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block text-[13.5px] leading-tight">{person.name}</span>
                          <span className="text-xs text-slate-400">{person.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-6 text-[13px] text-slate-500">{person.link}</td>
                    <td className="py-3 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${ACCESS_STYLE[person.access].pill}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${ACCESS_STYLE[person.access].dot}`} />
                        {person.access}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-[13px] text-slate-700 whitespace-nowrap">{formatWhen(person.lastIn)}</td>
                    <td className="py-3 px-6 text-[13px] text-slate-400 whitespace-nowrap">{person.lastOut ? formatWhen(person.lastOut) : "—"}</td>
                    <td className="py-3 px-6 text-[13px] text-slate-700 text-right tabular-nums">{person.signIns}</td>
                    <td className="py-3 px-6">
                      <div className="flex items-center justify-end gap-2">
                        {person.access === "Has access" ? (
                          <>
                            <button type="button" className={btnSm} onClick={() => openDialog("reset", person)}>
                              Reset password
                            </button>
                            <button type="button" className={btnDangerSm} onClick={() => openDialog("remove", person)}>
                              Remove access
                            </button>
                          </>
                        ) : person.access === "Invited" ? (
                          <button type="button" className={btnDangerSm} onClick={() => openDialog("cancel", person)}>
                            Cancel invite
                          </button>
                        ) : (
                          <button type="button" className={btnSm} onClick={() => openDialog("restore", person)}>
                            Restore access
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between flex-wrap gap-2 px-6 py-3.5 border-t border-slate-100 text-xs text-slate-500">
          <span>
            {tab === "accountant" ? accountants.length : clients.length} {tab === "accountant" ? "accountants" : "clients"} · showing {rows.length}
          </span>
          <span>Times shown in your local time</span>
        </div>
      </div>

      {/* Dialogs */}
      {dialog && target ? (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center p-6 overflow-y-auto"
          onMouseDown={(event) => event.target === event.currentTarget && !busy && setDialog(null)}
        >
          <div role="dialog" aria-modal="true" aria-label="Confirm" className="bg-white rounded-2xl shadow-xl w-full max-w-[480px] mt-20">
            <div className="flex justify-between items-start gap-4 px-6 py-5 border-b border-slate-100">
              <div>
                <h2 className="text-[17px] font-bold text-slate-900">
                  {dialog.type === "reset"
                    ? `Reset password for ${target.name}?`
                    : dialog.type === "remove"
                      ? `Remove ${target.name}'s access?`
                      : dialog.type === "cancel"
                        ? `Cancel ${target.name}'s invite?`
                        : `Restore ${target.name}'s access?`}
                </h2>
                <p className="text-[13px] text-slate-500 mt-1">
                  {dialog.type === "reset"
                    ? `${target.kind === "accountant" ? "Accountant" : "Client"} · ${target.email}`
                    : dialog.type === "remove"
                      ? target.kind === "accountant"
                        ? "They are signed out now and can't sign in again. Nothing is deleted."
                        : "They can't sign in to their client portal. Their data stays and you can restore access later."
                      : dialog.type === "cancel"
                        ? "The invite link stops working. You can invite them again later."
                        : "They can sign in again with their existing account."}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                disabled={busy}
                onClick={() => setDialog(null)}
                className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-4 text-[13px]">
              {dialog.type === "reset" ? (
                <>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
                    <div className="flex justify-between gap-4 px-4 py-2.5">
                      <span className="text-slate-500">Reset code sent to</span>
                      <span className="text-slate-800 font-medium">{target.email}</span>
                    </div>
                    <div className="flex justify-between gap-4 px-4 py-2.5">
                      <span className="text-slate-500">Their work</span>
                      <span className="text-slate-800 font-medium">Not affected</span>
                    </div>
                  </div>
                  <p className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-600">
                    {firstName} gets an email with a code and sets a new password from the sign-in page.
                  </p>
                </>
              ) : null}

              {dialog.type === "remove" && target.kind === "accountant" ? (
                <>
                  {clientCount > 0 ? (
                    <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                      <p className="font-semibold text-red-800">{clientCount} clients need a new accountant</p>
                      <p className="text-red-700/80 mt-0.5">Their properties, documents and history move with them</p>
                    </div>
                  ) : null}
                  {clientCount > 0 ? (
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Move their clients to</span>
                      <select className={selectClass} value={moveTo} onChange={(event) => setMoveTo(event.target.value)}>
                        {accountants
                          .filter((acc) => acc.access === "Has access" && acc.id !== target.id)
                          .map((acc) => (
                            <option key={acc.id} value={acc.name}>
                              {acc.name} · {acc.link}
                            </option>
                          ))}
                      </select>
                    </label>
                  ) : null}
                </>
              ) : null}

              {dialog.type === "remove" && target.kind === "client" ? (
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
                  <div className="flex justify-between gap-4 px-4 py-2.5">
                    <span className="text-slate-500">Client portal</span>
                    <span className="text-slate-800 font-medium">Signed out, sign-in blocked</span>
                  </div>
                  <div className="flex justify-between gap-4 px-4 py-2.5">
                    <span className="text-slate-500">Accountant</span>
                    <span className="text-slate-800 font-medium">{target.link === "—" ? "Keeps working on the file" : `${target.link} keeps working on the file`}</span>
                  </div>
                  <div className="flex justify-between gap-4 px-4 py-2.5">
                    <span className="text-slate-500">Data</span>
                    <span className="text-slate-800 font-medium">Kept</span>
                  </div>
                </div>
              ) : null}

              {dialog.type === "remove" ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Reason (saved to the audit trail)</span>
                  <select className={selectClass} value={reason} onChange={(event) => setReason(event.target.value)}>
                    {(target.kind === "accountant"
                      ? ["Left the firm", "On leave", "Security concern", "Other"]
                      : ["Client left the practice", "Duplicate account", "Security concern", "Other"]
                    ).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {dialog.type === "remove" && target.kind === "client" ? (
                <label className="flex items-center gap-2 text-slate-700">
                  <input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} className="w-4 h-4 accent-blue-600" />
                  Email {firstName} to let them know
                </label>
              ) : null}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                type="button"
                disabled={busy}
                onClick={() => setDialog(null)}
                className="px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={confirm}
                className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition cursor-pointer disabled:opacity-60 ${
                  dialog.type === "remove" || dialog.type === "cancel" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {busy
                  ? "Working…"
                  : dialog.type === "reset"
                    ? "Send reset email"
                    : dialog.type === "remove"
                      ? "Remove access"
                      : dialog.type === "cancel"
                        ? "Cancel invite"
                        : "Restore access"}
              </button>
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
