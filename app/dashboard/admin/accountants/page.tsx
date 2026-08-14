"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getSession } from "@/src/lib/session";
import { PortalDashboardSkeleton } from "../../../components/PortalSkeletons";

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
  organizationName: string;
  invitedByEmail: string;
  createdAt: string | null;
}

interface AccountantData {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  clients: number | string;
  properties: number | string;
  entities: number | string;
  transactions: number | string;
  portfolioValue: string;
  reconciliationRate: number | null;
  lastActive: string;
  avatar: string;
  avatarBg: string;
  isMock?: boolean;
}

// Predefined mock accountants matching the Figma designs
const MOCK_ACCOUNTANTS: AccountantData[] = [
  {
    id: "akash-sharma",
    name: "Akash Sharma",
    email: "akash@sunrise.com.au",
    role: "Senior Accountant",
    status: "Active",
    clients: 11,
    properties: 32,
    entities: 24,
    transactions: 842,
    portfolioValue: "$18.4M",
    reconciliationRate: 78,
    lastActive: "Today",
    avatar: "AK",
    avatarBg: "bg-blue-100 text-blue-800",
    isMock: true,
  },
  {
    id: "satnam-singh",
    name: "Satnam Singh",
    email: "satnam@sunrise.com.au",
    role: "Accountant",
    status: "Active",
    clients: 9,
    properties: 27,
    entities: 19,
    transactions: 614,
    portfolioValue: "$13.7M",
    reconciliationRate: 55,
    lastActive: "Yesterday",
    avatar: "SN",
    avatarBg: "bg-teal-100 text-teal-800",
    isMock: true,
  },
  {
    id: "priya-rajan",
    name: "Priya Rajan",
    email: "priya@sunrise.com.au",
    role: "Accountant",
    status: "Active",
    clients: 8,
    properties: 22,
    entities: 15,
    transactions: 498,
    portfolioValue: "$9.8M",
    reconciliationRate: 82,
    lastActive: "Today",
    avatar: "PR",
    avatarBg: "bg-purple-100 text-purple-800",
    isMock: true,
  },
  {
    id: "michael-chen",
    name: "Michael Chen",
    email: "michael@sunrise.com.au",
    role: "Junior Accountant",
    status: "Active",
    clients: 5,
    properties: 12,
    entities: 8,
    transactions: 213,
    portfolioValue: "$4.1M",
    reconciliationRate: 31,
    lastActive: "3 days ago",
    avatar: "MC",
    avatarBg: "bg-amber-100 text-amber-800",
    isMock: true,
  },
  {
    id: "jessica-tran",
    name: "Jessica Tran",
    email: "jessica@sunrise.com.au",
    role: "Accountant",
    status: "Active",
    clients: 7,
    properties: 18,
    entities: 12,
    transactions: 381,
    portfolioValue: "$7.6M",
    reconciliationRate: 69,
    lastActive: "Today",
    avatar: "JT",
    avatarBg: "bg-indigo-100 text-indigo-800",
    isMock: true,
  },
  {
    id: "nina-wong",
    name: "Nina Wong",
    email: "nina@sunrise.com.au",
    role: "Accountant",
    status: "Pending setup",
    clients: "--",
    properties: "--",
    entities: "--",
    transactions: "--",
    portfolioValue: "--",
    reconciliationRate: null,
    lastActive: "Invite sent",
    avatar: "NW",
    avatarBg: "bg-rose-100 text-rose-800",
    isMock: true,
  },
];

export default function AccountantsPage() {
  const [accountants, setAccountants] = useState<AccountantData[]>(MOCK_ACCOUNTANTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Pending setup">("All");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAccountants() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;
        if (!session) {
          setIsLoading(false);
          return;
        }

        const token = session.getIdToken().getJwtToken();
        const res = await fetch("/api/users/me/invited", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          const invitedUsers: InvitedUser[] = data.users || [];

          // Filter for accountants
          const dbAccountants = invitedUsers.filter(
            (user) => user.role.toLowerCase() === "accountant"
          );

          // Merge db accountants with the mock ones by email
          setAccountants((prev) => {
            const currentMockList = [...MOCK_ACCOUNTANTS];
            dbAccountants.forEach((dbAcc) => {
              // Check if already in mocks
              const alreadyExists = currentMockList.some(
                (mock) => mock.email.toLowerCase() === dbAcc.email.toLowerCase()
              );

              if (!alreadyExists) {
                // Determine a nice mock avatar
                const initials = dbAcc.name
                  ? dbAcc.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                  : dbAcc.email.slice(0, 2).toUpperCase();

                // Compute deterministic mock stats based on email length
                const seed = dbAcc.email.length;
                const status = dbAcc.status === "ACCEPTED" ? "Active" : "Pending setup";
                const isPending = status === "Pending setup";

                currentMockList.push({
                  id: dbAcc.id,
                  name: dbAcc.name || "Invite Pending",
                  email: dbAcc.email,
                  role: "Accountant",
                  status: status,
                  clients: isPending ? "--" : (seed % 6) + 4,
                  properties: isPending ? "--" : (seed % 15) + 10,
                  entities: isPending ? "--" : (seed % 8) + 5,
                  transactions: isPending ? "--" : (seed % 300) + 150,
                  portfolioValue: isPending ? "--" : `$${((seed % 12) + 2).toFixed(1)}M`,
                  reconciliationRate: isPending ? null : (seed % 40) + 50,
                  lastActive: isPending ? "Invite sent" : "Today",
                  avatar: initials,
                  avatarBg: "bg-emerald-100 text-emerald-800",
                });
              }
            });
            return currentMockList;
          });
        }
      } catch (err) {
        console.error("Failed to load dynamic accountants:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadAccountants();
  }, []);

  // Filter accountants based on search query and status filter
  const filteredAccountants = useMemo(() => {
    return accountants.filter((acc) => {
      const matchesSearch = searchQuery.trim() === "" ||
        acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.role.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "All" || acc.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [accountants, searchQuery, statusFilter]);

  // Aggregate values
  const stats = useMemo(() => {
    const total = accountants.length;
    const active = accountants.filter((a) => a.status === "Active").length;
    const pending = total - active;

    const rates = accountants
      .map((a) => a.reconciliationRate)
      .filter((r): r is number => r !== null);
    const avgRate = rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 63;

    return {
      total,
      active,
      pending,
      avgRate,
    };
  }, [accountants]);

  if (isLoading) {
    return <PortalDashboardSkeleton />;
  }

  return (
    <div className="flex flex-col gap-8 pb-12 w-full animate-fade-in font-sans">
      {/* Header bar */}
      <div className="flex justify-between items-center flex-wrap gap-4 border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Accountants</h1>
          <p className="text-sm text-slate-500 mt-1">
            {stats.total} total · {stats.active} active · {stats.pending} pending account setup
          </p>
        </div>
        <div className="flex items-center gap-3 relative">
          <div className="relative">
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm cursor-pointer"
              type="button"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-1.2 0-2.4 0-3.6.1C5.7 3.4 3 6.2 3 9.6v4.8c0 3.4 2.7 6.2 5.4 6.5 2.4.2 4.8.2 7.2 0 2.7-.3 5.4-3.1 5.4-6.5V9.6c0-3.4-2.7-6.2-5.4-6.5-1.2-.1-2.4-.1-3.6-.1z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9h8M8 13h5" />
              </svg>
              Filter{statusFilter !== "All" ? `: ${statusFilter}` : ""}
            </button>

            {isFilterDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-1.5 flex flex-col gap-0.5">
                {[
                  { value: "All", label: "All Statuses" },
                  { value: "Active", label: "Active" },
                  { value: "Pending setup", label: "Pending setup" }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setStatusFilter(option.value as any);
                      setIsFilterDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${statusFilter === option.value
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Link href="/dashboard/admin/invite" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Invite accountant
          </Link>
        </div>
      </div>

      {/* Aggregate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition hover:shadow-md hover:translate-y-[-2px] duration-200">
          <p className="!text-[11.5px] font-medium text-slate-custom uppercase tracking-wider">Total accountants</p>
          <span className="!text-[28px] font-semibold mt-1.5 block">{stats.total}</span>
          <p className="!text-[12px] text-slate-custom mt-1">
            {stats.active} active · {stats.pending} pending
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition hover:shadow-md hover:translate-y-[-2px] duration-200">
          <p className="!text-[11.5px] font-medium text-slate-custom uppercase tracking-wider">Avg clients / accountant</p>
          <span className="!text-[28px] font-semibold mt-1.5 block">7.0</span>
          <p className="!text-[12px] text-slate-custom mt-1">Range 3–11</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition hover:shadow-md hover:translate-y-[-2px] duration-200">
          <p className="!text-[11.5px] font-medium text-slate-custom uppercase tracking-wider">Avg reconciliation rate</p>
          <span className="!text-[28px] font-semibold mt-1.5 block">{stats.avgRate}%</span>
          <p className="!text-[12px] text-slate-custom mt-1">
            Org target: 80%
          </p>
        </div>
      </div>

      {/* Table Container Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
        {/* Table Header Controls */}
        <div className="flex justify-between items-center flex-wrap gap-4 p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">All accountants</h2>
            <span className="px-2 py-0.5 text-xs font-bold bg-slate-100 text-slate-600 rounded-full">
              {filteredAccountants.length}
            </span>
          </div>
          <div className="relative min-w-[280px]">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <circle cx="11" cy="11" r="6" />
                <path d="m20 20-4.2-4.2" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Responsive Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-100">
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Accountant</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Clients</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Properties</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Entities</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Transactions</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Portfolio Value</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Reconciled</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAccountants.map((acc) => {
                const linkId = acc.id;
                return (
                  <tr
                    key={acc.id}
                    className="hover:bg-slate-50/80 transition-colors duration-150 group cursor-pointer"
                  >
                    <td className="p-4">
                      <Link href={`/dashboard/admin/accountants/${linkId}`} className="flex items-center gap-3 block h-full">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${acc.avatarBg} shrink-0`}>
                          {acc.avatar}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 block group-hover:text-blue-600 transition">
                            {acc.name}
                          </span>
                          <span className="text-xs text-slate-400">{acc.email}</span>
                        </div>
                      </Link>
                    </td>
                    <td className="p-4">
                      <Link href={`/dashboard/admin/accountants/${linkId}`} className="block h-full">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${acc.status === "Active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                            }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${acc.status === "Active" ? "bg-emerald-500" : "bg-amber-500"
                              }`}
                          />
                          {acc.status}
                        </span>
                      </Link>
                    </td>
                    <td className="p-4 text-center">
                      <Link href={`/dashboard/admin/accountants/${linkId}`} className="font-semibold text-slate-700 block h-full">
                        {acc.clients}
                      </Link>
                    </td>
                    <td className="p-4 text-center">
                      <Link href={`/dashboard/admin/accountants/${linkId}`} className="text-slate-500 block h-full">
                        {acc.properties}
                      </Link>
                    </td>
                    <td className="p-4 text-center">
                      <Link href={`/dashboard/admin/accountants/${linkId}`} className="text-slate-500 block h-full">
                        {acc.entities}
                      </Link>
                    </td>
                    <td className="p-4 text-center">
                      <Link href={`/dashboard/admin/accountants/${linkId}`} className="text-slate-500 block h-full">
                        {acc.transactions}
                      </Link>
                    </td>
                    <td className="p-4">
                      <Link href={`/dashboard/admin/accountants/${linkId}`} className="font-semibold text-slate-700 block h-full">
                        {acc.portfolioValue}
                      </Link>
                    </td>
                    <td className="p-4">
                      <Link href={`/dashboard/admin/accountants/${linkId}`} className="block h-full">
                        {acc.reconciliationRate !== null ? (
                          <div className="flex items-center gap-3 min-w-[120px]">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${acc.reconciliationRate >= 75
                                  ? "bg-emerald-500"
                                  : acc.reconciliationRate >= 50
                                    ? "bg-amber-500"
                                    : "bg-rose-500"
                                  }`}
                                style={{ width: `${acc.reconciliationRate}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-700 w-8 text-right">
                              {acc.reconciliationRate}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-medium">--</span>
                        )}
                      </Link>
                    </td>
                    <td className="p-4">
                      <div className="block h-full">
                        {acc.status === "Pending setup" ? (
                          <span className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1 rounded inline-block">
                            Invite sent
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${acc.lastActive === "Today"
                              ? "bg-emerald-50 text-emerald-700"
                              : acc.lastActive === "Yesterday"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-amber-50 text-amber-700"
                              }`}
                          >
                            {acc.lastActive}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
