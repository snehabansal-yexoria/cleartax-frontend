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

interface ClientData {
  id: string;
  name: string;
  email: string;
  status: "Registered" | "Pending";
  accountant: string;
  accountantAvatar?: string;
  accountantBg?: string;
  properties: number | string;
  entities: number | string;
  transactions: number | string;
  portfolioValue: string;
  unclassified: number | string;
  documents: number | string;
  avatarBg: string;
  avatar: string;
}

const FIRST_NAMES = [
  "Emily", "James", "Sophia", "Michael", "Jessica", "David", "Sarah", "Thomas", "John", "Olivia",
  "Robert", "Maria", "William", "Linda", "Richard", "Barbara", "Joseph", "Susan", "Charles", "Margaret",
  "Daniel", "Patricia", "Matthew", "Jennifer", "Anthony", "Elizabeth", "Mark", "Dorothy", "Donald", "Lisa",
  "Steven", "Nancy", "Paul", "Karen", "Andrew", "Betty", "Joshua", "Helen", "Kenneth", "Sandra"
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
  "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
  "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
  "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores"
];

const ACCOUNTANTS = [
  { name: "Akash Sharma", avatar: "AK", bg: "bg-blue-100 text-blue-800" },
  { name: "Satnam Singh", avatar: "SN", bg: "bg-teal-100 text-teal-800" },
  { name: "Priya Rajan", avatar: "PR", bg: "bg-purple-100 text-purple-800" },
  { name: "Jessica Tran", avatar: "JT", bg: "bg-indigo-100 text-indigo-800" },
  { name: "Michael Chen", avatar: "MC", bg: "bg-amber-100 text-amber-800" }
];

const AVATAR_BGS = [
  "bg-purple-100 text-purple-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
  "bg-pink-100 text-pink-700"
];

// Generates exactly 84 mock clients (71 Registered, 13 Pending)
const generateMockClients = (): ClientData[] => {
  const list: ClientData[] = [
    {
      id: "sneha-bansal",
      name: "Sneha Bansal",
      email: "sneha@email.com",
      status: "Registered",
      accountant: "Akash Sharma",
      accountantAvatar: "AK",
      accountantBg: "bg-blue-100 text-blue-800",
      properties: 8,
      entities: 4,
      transactions: 312,
      portfolioValue: "$7.2M",
      unclassified: 24,
      documents: 18,
      avatarBg: "bg-purple-100 text-purple-700",
      avatar: "SB"
    },
    {
      id: "raj-patel",
      name: "Raj Patel",
      email: "raj@email.com",
      status: "Registered",
      accountant: "Satnam Singh",
      accountantAvatar: "SN",
      accountantBg: "bg-teal-100 text-teal-800",
      properties: 6,
      entities: 3,
      transactions: 248,
      portfolioValue: "$5.8M",
      unclassified: 11,
      documents: 14,
      avatarBg: "bg-blue-100 text-blue-700",
      avatar: "RP"
    },
    {
      id: "li-chen",
      name: "Li Chen",
      email: "li@email.com",
      status: "Registered",
      accountant: "Priya Rajan",
      accountantAvatar: "PR",
      accountantBg: "bg-purple-100 text-purple-800",
      properties: 5,
      entities: 5,
      transactions: 196,
      portfolioValue: "$4.9M",
      unclassified: 0,
      documents: 22,
      avatarBg: "bg-emerald-100 text-emerald-700",
      avatar: "LC"
    },
    {
      id: "mark-williams",
      name: "Mark Williams",
      email: "mark@email.com",
      status: "Registered",
      accountant: "Akash Sharma",
      accountantAvatar: "AK",
      accountantBg: "bg-blue-100 text-blue-800",
      properties: 4,
      entities: 2,
      transactions: 144,
      portfolioValue: "$3.6M",
      unclassified: 7,
      documents: 9,
      avatarBg: "bg-amber-100 text-amber-700",
      avatar: "MW"
    },
    {
      id: "david-kim",
      name: "David Kim",
      email: "david@email.com",
      status: "Pending",
      accountant: "—",
      properties: "—",
      entities: "—",
      transactions: "—",
      portfolioValue: "—",
      unclassified: "—",
      documents: "—",
      avatarBg: "bg-rose-100 text-rose-700",
      avatar: "DK"
    }
  ];

  let pendingCreated = 1;
  let registeredCreated = 4;

  for (let i = 5; i < 84; i++) {
    let status: "Registered" | "Pending" = "Registered";
    if (pendingCreated < 13 && (i % 6 === 0 || registeredCreated >= 71)) {
      status = "Pending";
      pendingCreated++;
    } else {
      registeredCreated++;
    }

    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 3) % LAST_NAMES.length];
    const name = `${first} ${last}`;
    const email = `${first.toLowerCase()}.${last.toLowerCase()}@email.com`;
    const id = `${first.toLowerCase()}-${last.toLowerCase()}-${i}`;
    const avatar = `${first[0]}${last[0]}`;
    const avatarBg = AVATAR_BGS[i % AVATAR_BGS.length];

    if (status === "Pending") {
      list.push({
        id,
        name,
        email,
        status,
        accountant: "—",
        properties: "—",
        entities: "—",
        transactions: "—",
        portfolioValue: "—",
        unclassified: "—",
        documents: "—",
        avatarBg,
        avatar
      });
    } else {
      const acc = ACCOUNTANTS[i % ACCOUNTANTS.length];
      const properties = (i % 4) + 1; // avg around 2.5 properties/client
      const entities = (i % 3) + 1;
      const transactions = (i % 120) + 40;
      const valueVal = ((i % 8) + 0.6).toFixed(1);
      const portfolioValue = `$${valueVal}M`;
      const unclassifiedOptions = [0, 0, 1, 2, 4, 6, 8, 12, 18, 25];
      const unclassified = unclassifiedOptions[i % unclassifiedOptions.length];
      const documents = (i % 12) + 4;

      list.push({
        id,
        name,
        email,
        status,
        accountant: acc.name,
        accountantAvatar: acc.avatar,
        accountantBg: acc.bg,
        properties,
        entities,
        transactions,
        portfolioValue,
        unclassified,
        documents,
        avatarBg,
        avatar
      });
    }
  }

  return list;
};

interface Toast {
  id: string;
  message: string;
  type: "success" | "info" | "error";
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Registered" | "Pending">("All");
  const [activeTab, setActiveTab] = useState<"all" | "pending">("all");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Drawer details state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);

  // Toast notifications state
  const [toasts, setToasts] = useState<Toast[]>([]);

  const triggerToast = (message: string, type: "success" | "info" | "error" = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  useEffect(() => {
    async function loadClients() {
      try {
        const initialMockList = generateMockClients();
        const session = (await getSession()) as SessionWithIdToken | null;
        if (!session) {
          setClients(initialMockList);
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

          // Filter out users with role 'client'
          const dbClients = invitedUsers.filter(
            (user) => user.role.toLowerCase() === "client"
          );

          // Merge dynamic database clients with mock clients
          const currentMockList = [...initialMockList];
          dbClients.forEach((dbCli) => {
            const alreadyExists = currentMockList.some(
              (mock) => mock.email.toLowerCase() === dbCli.email.toLowerCase()
            );

            if (!alreadyExists) {
              const initials = dbCli.name
                ? dbCli.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                : dbCli.email.slice(0, 2).toUpperCase();

              const seed = dbCli.email.length;
              const status = dbCli.status === "ACCEPTED" ? "Registered" : "Pending";
              const isPending = status === "Pending";

              const acc = ACCOUNTANTS[seed % ACCOUNTANTS.length];
              const avatarBg = AVATAR_BGS[seed % AVATAR_BGS.length];

              currentMockList.unshift({
                id: dbCli.id,
                name: dbCli.name || "Onboarding Client",
                email: dbCli.email,
                status: status,
                accountant: isPending ? "—" : acc.name,
                accountantAvatar: isPending ? "" : acc.avatar,
                accountantBg: isPending ? "" : acc.bg,
                properties: isPending ? "—" : (seed % 5) + 1,
                entities: isPending ? "—" : (seed % 3) + 1,
                transactions: isPending ? "—" : (seed % 100) + 40,
                portfolioValue: isPending ? "—" : `$${((seed % 6) + 1.5).toFixed(1)}M`,
                unclassified: isPending ? "—" : seed % 12,
                documents: isPending ? "—" : (seed % 10) + 4,
                avatarBg: avatarBg,
                avatar: initials,
              });
            }
          });
          setClients(currentMockList);
        } else {
          setClients(initialMockList);
        }
      } catch (err) {
        console.error("Failed to load clients:", err);
        setClients(generateMockClients());
      } finally {
        setIsLoading(false);
      }
    }

    loadClients();
  }, []);

  // Compute stats metrics
  const stats = useMemo(() => {
    const total = clients.length;
    const registered = clients.filter((c) => c.status === "Registered").length;
    const pending = total - registered;

    // Filter properties count and parse float value of portfolio
    const registeredClients = clients.filter((c) => c.status === "Registered");
    const totalProps = registeredClients.reduce((acc, c) => acc + (typeof c.properties === "number" ? c.properties : 0), 0);
    const avgProps = registered ? (totalProps / registered).toFixed(1) : "0.0";

    // Extract millions value e.g. "$7.2M" -> 7.2
    const totalPortfolio = clients.reduce((acc, c) => {
      if (c.portfolioValue && c.portfolioValue !== "—") {
        const val = parseFloat(c.portfolioValue.replace(/[^0-9.]/g, ""));
        return acc + (isNaN(val) ? 0 : val);
      }
      return acc;
    }, 0);
    const avgPortfolio = total ? (totalPortfolio / total).toFixed(1) : "0.0";

    return {
      total,
      registered,
      pending,
      avgProps,
      avgPortfolio,
    };
  }, [clients]);

  // Handle client record click to open details drawer
  const handleClientClick = (client: ClientData) => {
    setSelectedClient(client);
    setIsDrawerOpen(true);
  };

  // Filter list based on active view tab, search input, and filter status dropdown
  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      // 1. Tab filtering: 'all' vs 'pending'
      if (activeTab === "pending" && client.status !== "Pending") {
        return false;
      }

      // 2. Dropdown status filtering
      if (statusFilter !== "All" && client.status !== statusFilter) {
        return false;
      }

      // 3. Search query filtering
      const query = searchQuery.trim().toLowerCase();
      if (query !== "") {
        const matchesName = client.name.toLowerCase().includes(query);
        const matchesEmail = client.email.toLowerCase().includes(query);
        const matchesAccountant = client.accountant.toLowerCase().includes(query);
        return matchesName || matchesEmail || matchesAccountant;
      }

      return true;
    });
  }, [clients, activeTab, statusFilter, searchQuery]);

  // Count tab metrics dynamically
  const pendingTabCount = useMemo(() => {
    return clients.filter((c) => c.status === "Pending").length;
  }, [clients]);

  if (isLoading) {
    return <PortalDashboardSkeleton />;
  }

  return (
    <div className="flex flex-col gap-8 pb-12 w-full animate-fade-in font-sans relative">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes toastFadeInUp {
          from { transform: translateY(20px) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .animate-toast {
          animation: toastFadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />

      {/* Header section */}
      <div className="flex justify-between items-center flex-wrap gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Clients</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            {stats.total} total · {stats.registered} registered · {stats.pending} pending
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
                  { value: "Registered", label: "Registered" },
                  { value: "Pending", label: "Pending" }
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

          <Link href="/dashboard/admin/invite?role=client" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold text-white transition shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
            Invite client
          </Link>
        </div>
      </div>

      {/* Aggregate metrics grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition hover:shadow-md hover:translate-y-[-2px] duration-200">
          <p className="!text-[11.5px] font-bold text-slate-400 uppercase tracking-wider font-sans">Registered</p>
          <span className="!text-[28px] font-semibold mt-1.5 block text-slate-900">{stats.registered}</span>
          <p className="!text-[12px] text-slate-500 mt-1">Active on platform</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition hover:shadow-md hover:translate-y-[-2px] duration-200">
          <p className="!text-[11.5px] font-bold text-slate-400 uppercase tracking-wider font-sans">Pending</p>
          <span className="!text-[28px] font-semibold mt-1.5 block text-orange-600">{stats.pending}</span>
          <p className="!text-[12px] text-slate-500 mt-1">Invite sent, not activated</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition hover:shadow-md hover:translate-y-[-2px] duration-200">
          <p className="!text-[11.5px] font-bold text-slate-400 uppercase tracking-wider font-sans">Avg properties / client</p>
          <span className="!text-[28px] font-semibold mt-1.5 block text-slate-900">{stats.avgProps}</span>
          <p className="!text-[12px] text-slate-500 mt-1">Across {stats.registered} registered</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition hover:shadow-md hover:translate-y-[-2px] duration-200">
          <p className="!text-[11.5px] font-bold text-slate-400 uppercase tracking-wider font-sans">Avg portfolio / client</p>
          <span className="!text-[28px] font-semibold mt-1.5 block text-slate-900">${stats.avgPortfolio}M</span>
          <p className="!text-[12px] text-slate-500 mt-1">Across all clients</p>
        </div>
      </div>

      {/* Main clients panel */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
        {/* Tab switcher controls */}
        <div className="flex justify-between items-center flex-wrap gap-4 px-6 pt-5 border-b border-slate-100">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab("all")}
              className={`pb-4 text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                activeTab === "all"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              All clients
              <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                activeTab === "all" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"
              }`}>
                {stats.total}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("pending")}
              className={`pb-4 text-sm font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                activeTab === "pending"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              Pending
              <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                activeTab === "pending" ? "bg-orange-50 text-orange-700" : "bg-slate-100 text-slate-600"
              }`}>
                {pendingTabCount}
              </span>
            </button>
          </div>

          <div className="relative min-w-[280px] mb-4">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <circle cx="11" cy="11" r="6" />
                <path d="m20 20-4.2-4.2" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search by client, email, or accountant..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-sans"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Responsive Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Client</th>
                <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Status</th>
                <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Accountant</th>
                <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center font-sans">Properties</th>
                <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center font-sans">Entities</th>
                <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center font-sans">Transactions</th>
                <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right font-sans">Portfolio Value</th>
                <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center font-sans">Unclassified</th>
                <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center font-sans">Documents</th>
                <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[120px] font-sans"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-sm font-medium text-slate-400 font-sans">
                    No clients found matching the search.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr
                    key={client.id}
                    className="hover:bg-slate-50/80 transition-colors duration-150 group cursor-pointer"
                    onClick={() => handleClientClick(client)}
                  >
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-[13px] shrink-0 ${client.avatarBg} font-sans`}>
                          {client.avatar}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block group-hover:text-blue-600 transition text-[13.5px] leading-tight font-sans">
                            {client.name}
                          </span>
                          <span className="text-xs text-slate-400 font-normal font-sans">{client.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold font-sans ${
                        client.status === "Registered"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-orange-50 text-orange-700"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          client.status === "Registered" ? "bg-emerald-500" : "bg-orange-500"
                        }`} />
                        {client.status}
                      </span>
                    </td>
                    <td className="py-3 px-6">
                      {client.status === "Pending" ? (
                        <span className="text-slate-400 font-sans">—</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${client.accountantBg || "bg-slate-100 text-slate-600"} font-sans`}>
                            {client.accountantAvatar || "—"}
                          </div>
                          <span className="text-[13px] font-semibold text-slate-700 font-sans">{client.accountant}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-6 text-center text-sm font-semibold text-slate-700 font-sans">{client.properties}</td>
                    <td className="py-3 px-6 text-center text-sm font-semibold text-slate-700 font-sans">{client.entities}</td>
                    <td className="py-3 px-6 text-center text-sm font-semibold text-slate-700 font-sans">{client.transactions}</td>
                    <td className="py-3 px-6 text-right text-sm font-bold text-slate-900 font-sans">{client.portfolioValue}</td>
                    <td className="py-3 px-6 text-center">
                      {client.status === "Pending" ? (
                        <span className="text-slate-400 font-sans">—</span>
                      ) : (
                        <span className={`inline-flex items-center justify-center w-7 h-5 rounded font-bold text-xs font-sans ${
                          (client.unclassified as number) > 15
                            ? "bg-rose-50 text-rose-600 border border-rose-100"
                            : (client.unclassified as number) > 0
                              ? "bg-amber-50 text-amber-600 border border-amber-100"
                              : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                        }`}>
                          {client.unclassified}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-6 text-center text-sm font-semibold text-slate-500 font-sans">{client.documents}</td>
                    <td className="py-3 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                      {client.status === "Pending" ? (
                        <button
                          onClick={() => triggerToast(`Invitation link resent to ${client.email}`)}
                          className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-700 transition cursor-pointer font-sans"
                        >
                          Resend invite
                        </button>
                      ) : (
                        <button
                          onClick={() => handleClientClick(client)}
                          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-800 transition cursor-pointer font-sans"
                        >
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-out details drawer */}
      {isDrawerOpen && selectedClient && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsDrawerOpen(false)}
          />
          {/* Drawer content panel */}
          <div className="relative w-full max-w-xl h-full bg-white shadow-2xl flex flex-col z-10 animate-slide-in-right font-sans overflow-y-auto">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${selectedClient.avatarBg}`}>
                  {selectedClient.avatar}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedClient.name}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedClient.email}</p>
                </div>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 flex flex-col gap-6 flex-1">
              {/* Account details section */}
              <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-100 flex flex-col gap-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Account Overview</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 block">Status</span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold mt-1 ${
                      selectedClient.status === "Registered"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-orange-50 text-orange-700"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        selectedClient.status === "Registered" ? "bg-emerald-500" : "bg-orange-500"
                      }`} />
                      {selectedClient.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 block">Assigned Accountant</span>
                    {selectedClient.status === "Pending" ? (
                      <span className="text-xs font-semibold text-slate-500 block mt-1.5">—</span>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] ${selectedClient.accountantBg}`}>
                          {selectedClient.accountantAvatar}
                        </div>
                        <span className="text-xs font-bold text-slate-800">{selectedClient.accountant}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Onboarding info / statistics section */}
              {selectedClient.status === "Pending" ? (
                <div className="border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Onboarding Progress</h3>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Invitation Link</span>
                      <span className="text-blue-600 font-semibold cursor-pointer hover:underline" onClick={() => {
                        navigator.clipboard.writeText(`https://clearportfolio.com/invite/client?id=${selectedClient.id}`);
                        triggerToast("Invitation link copied to clipboard");
                      }}>
                        Copy invitation link
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Invited By</span>
                      <span className="font-semibold text-slate-800">Sunrise Admin</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Status</span>
                      <span className="font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">Awaiting signup</span>
                    </div>
                    <div className="mt-4">
                      <button
                        onClick={() => {
                          triggerToast(`Resending invitation email to ${selectedClient.email}`);
                        }}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition"
                      >
                        Resend Invitation Email
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Summary Metrics Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-slate-100 rounded-xl p-4 flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Portfolio Value</span>
                      <span className="text-xl font-bold text-slate-900">{selectedClient.portfolioValue}</span>
                    </div>
                    <div className="border border-slate-100 rounded-xl p-4 flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Properties</span>
                      <span className="text-xl font-bold text-slate-900">{selectedClient.properties} Properties</span>
                    </div>
                    <div className="border border-slate-100 rounded-xl p-4 flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Entities</span>
                      <span className="text-xl font-bold text-slate-900">{selectedClient.entities} Entities</span>
                    </div>
                    <div className="border border-slate-100 rounded-xl p-4 flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Documents Vault</span>
                      <span className="text-xl font-bold text-slate-900">{selectedClient.documents} Uploaded</span>
                    </div>
                  </div>

                  {/* Recent Transactions List */}
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">Recent Transactions</h3>
                      <span className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer">View All</span>
                    </div>
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold font-sans">
                            <th className="py-2.5 px-4">Date</th>
                            <th className="py-2.5 px-4">Description</th>
                            <th className="py-2.5 px-4 font-sans">Category</th>
                            <th className="py-2.5 px-4 text-right font-sans">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {[
                            { date: "12 Jun 2026", desc: "Rental income — Unit 4B", cat: "Rental Income", amt: "+$2,450.00", pos: true },
                            { date: "10 Jun 2026", desc: "Plumbing repair invoice", cat: "Maintenance", amt: "-$320.00", pos: false },
                            { date: "08 Jun 2026", desc: "Council rates Q4", cat: "Rates & Taxes", amt: "-$840.00", pos: false }
                          ].map((tx, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-4 font-medium text-slate-400 font-sans">{tx.date}</td>
                              <td className="py-2.5 px-4 font-semibold text-slate-800 font-sans">{tx.desc}</td>
                              <td className="py-2.5 px-4 font-sans"><span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{tx.cat}</span></td>
                              <td className={`py-2.5 px-4 text-right font-bold font-sans ${tx.pos ? "text-emerald-600" : "text-slate-800"}`}>{tx.amt}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {/* Drawer Footer */}
            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-lg transition"
              >
                Close Drawer
              </button>
              {selectedClient.status === "Registered" && (
                <button
                  onClick={() => triggerToast(`Simulating detailed report generation for ${selectedClient.name}...`, "info")}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition"
                >
                  Generate Report
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification Containers */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none font-sans">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex items-center gap-3 bg-slate-900 text-white px-4 py-3.5 rounded-xl shadow-xl animate-toast min-w-[280px] pointer-events-auto border border-slate-800"
          >
            {toast.type === "success" ? (
              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 111.063.852l-.708 2.836a.75.75 0 001.063.852l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
              </div>
            )}
            <span className="text-xs font-bold flex-1">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
