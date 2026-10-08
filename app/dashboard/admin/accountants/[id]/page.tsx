"use client";

import { use, useEffect, useState, useMemo } from "react";

import Link from "next/link";
import { getSession } from "@/src/lib/session";
import { PortalDashboardSkeleton } from "../../../../components/PortalSkeletons";

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

const ACCOUNTANT_DETAILS: Record<string, any> = {
  "akash-sharma": {
    name: "Akash Sharma",
    email: "akash@sunrise.com.au",
    role: "Senior Accountant",
    status: "Active",
    joined: "Mar 2021",
    lastActive: "Today",
    avatar: "AK",
    avatarBg: "bg-blue-100 text-blue-800",
    stats: {
      clients: 11,
      portfolio: "$18.4M",
      transactions: 842,
      reconciliation: 78,
      unclassified: 48,
    },
    performance: {
      properties: 32,
      entities: 24,
      revenue: "$2.1M",
      expenses: "$1.4M",
      netProfit: "$0.7M",
      documents: 94,
    },
    chartData: {
      months: ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      reconciled: [52, 48, 60, 58, 72, 64, 55, 68, 78, 74, 80, 84],
      unclassified: [22, 18, 28, 24, 28, 20, 18, 22, 30, 28, 32, 36]
    }
  },
  "satnam-singh": {
    name: "Satnam Singh",
    email: "satnam@sunrise.com.au",
    role: "Accountant",
    status: "Active",
    joined: "Jan 2022",
    lastActive: "Yesterday",
    avatar: "SN",
    avatarBg: "bg-teal-100 text-teal-800",
    stats: {
      clients: 9,
      portfolio: "$13.7M",
      transactions: 614,
      reconciliation: 55,
      unclassified: 32,
    },
    performance: {
      properties: 27,
      entities: 19,
      revenue: "$1.6M",
      expenses: "$1.0M",
      netProfit: "$0.6M",
      documents: 74,
    },
    chartData: {
      months: ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      reconciled: [42, 38, 48, 45, 52, 44, 38, 55, 56, 54, 58, 60],
      unclassified: [32, 28, 30, 24, 34, 28, 24, 20, 22, 25, 24, 22]
    }
  },
  "priya-rajan": {
    name: "Priya Rajan",
    email: "priya@sunrise.com.au",
    role: "Accountant",
    status: "Active",
    joined: "Jul 2022",
    lastActive: "Today",
    avatar: "PR",
    avatarBg: "bg-purple-100 text-purple-800",
    stats: {
      clients: 8,
      portfolio: "$9.8M",
      transactions: 498,
      reconciliation: 82,
      unclassified: 18,
    },
    performance: {
      properties: 22,
      entities: 15,
      revenue: "$1.2M",
      expenses: "$0.8M",
      netProfit: "$0.4M",
      documents: 61,
    },
    chartData: {
      months: ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      reconciled: [58, 52, 68, 65, 80, 70, 58, 82, 84, 82, 85, 87],
      unclassified: [12, 10, 14, 12, 16, 12, 10, 8, 12, 14, 10, 9]
    }
  },
  "michael-chen": {
    name: "Michael Chen",
    email: "michael@sunrise.com.au",
    role: "Junior Accountant",
    status: "Active",
    joined: "Mar 2023",
    lastActive: "3 days ago",
    avatar: "MC",
    avatarBg: "bg-amber-100 text-amber-800",
    stats: {
      clients: 5,
      portfolio: "$4.1M",
      transactions: 213,
      reconciliation: 31,
      unclassified: 66,
    },
    performance: {
      properties: 12,
      entities: 8,
      revenue: "$0.5M",
      expenses: "$0.3M",
      netProfit: "$0.2M",
      documents: 33,
    },
    chartData: {
      months: ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      reconciled: [22, 18, 25, 22, 30, 24, 20, 28, 31, 29, 32, 34],
      unclassified: [48, 42, 50, 44, 52, 46, 40, 36, 42, 45, 41, 38]
    }
  },
  "jessica-tran": {
    name: "Jessica Tran",
    email: "jessica@sunrise.com.au",
    role: "Accountant",
    status: "Active",
    joined: "Oct 2022",
    lastActive: "Today",
    avatar: "JT",
    avatarBg: "bg-indigo-100 text-indigo-800",
    stats: {
      clients: 7,
      portfolio: "$7.6M",
      transactions: 381,
      reconciliation: 69,
      unclassified: 28,
    },
    performance: {
      properties: 18,
      entities: 12,
      revenue: "$0.9M",
      expenses: "$0.6M",
      netProfit: "$0.3M",
      documents: 52,
    },
    chartData: {
      months: ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      reconciled: [48, 44, 54, 52, 64, 54, 48, 65, 68, 66, 70, 72],
      unclassified: [20, 18, 22, 18, 24, 18, 20, 14, 16, 18, 16, 15]
    }
  },
  "nina-wong": {
    name: "Nina Wong",
    email: "nina@sunrise.com.au",
    role: "Accountant",
    status: "Pending setup",
    joined: "Jul 2026",
    lastActive: "Invite sent",
    avatar: "NW",
    avatarBg: "bg-rose-100 text-rose-800",
    stats: {
      clients: "--",
      portfolio: "--",
      transactions: "--",
      reconciliation: 0,
      unclassified: "--",
    },
    performance: {
      properties: 0,
      entities: 0,
      revenue: "$0.0M",
      expenses: "$0.0M",
      netProfit: "$0.0M",
      documents: 0,
    },
    chartData: {
      months: ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      reconciled: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      unclassified: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    }
  }
};

const MOCK_CLIENTS = [
  { name: "Sneha Bansal", email: "sneha@email.com", avatar: "SB", avatarBg: "bg-indigo-50 text-indigo-600 border border-indigo-100", properties: 8, entities: 4, portfolio: "$7.2M", transactions: 312, unclassified: 24, netProfit: "$174K" },
  { name: "Mark Williams", email: "mark@email.com", avatar: "MW", avatarBg: "bg-amber-50 text-amber-700 border border-amber-100", properties: 4, entities: 2, portfolio: "$3.6M", transactions: 144, unclassified: 7, netProfit: "$98K" },
  { name: "Boris Petrov", email: "boris@email.com", avatar: "BP", avatarBg: "bg-blue-50 text-blue-600 border border-blue-100", properties: 6, entities: 4, portfolio: "$4.8M", transactions: 192, unclassified: 11, netProfit: "$122K" },
  { name: "John Doe", email: "john@email.com", avatar: "JD", avatarBg: "bg-emerald-50 text-emerald-700 border border-emerald-100", properties: 3, entities: 1, portfolio: "$1.2M", transactions: 64, unclassified: 2, netProfit: "$32K" },
  { name: "Sarah Connor", email: "sarah@email.com", avatar: "SC", avatarBg: "bg-rose-50 text-rose-700 border border-rose-100", properties: 5, entities: 3, portfolio: "$2.1M", transactions: 96, unclassified: 0, netProfit: "$58K" },
  { name: "David Miller", email: "david@email.com", avatar: "DM", avatarBg: "bg-purple-50 text-purple-700 border border-purple-100", properties: 2, entities: 2, portfolio: "$0.8M", transactions: 38, unclassified: 3, netProfit: "$15K" },
  { name: "Emily Watson", email: "emily@email.com", avatar: "EW", avatarBg: "bg-teal-50 text-teal-700 border border-teal-100", properties: 4, entities: 2, portfolio: "$1.5M", transactions: 72, unclassified: 4, netProfit: "$42K" },
  { name: "Michael Brown", email: "michael@email.com", avatar: "MB", avatarBg: "bg-indigo-50 text-indigo-700 border border-indigo-100", properties: 3, entities: 2, portfolio: "$1.1M", transactions: 50, unclassified: 1, netProfit: "$25K" },
  { name: "Lisa Ray", email: "lisa@email.com", avatar: "LR", avatarBg: "bg-amber-50 text-amber-700 border border-amber-100", properties: 2, entities: 1, portfolio: "$0.9M", transactions: 44, unclassified: 2, netProfit: "$20K" },
  { name: "Alex Turner", email: "alex@email.com", avatar: "AT", avatarBg: "bg-blue-50 text-blue-700 border border-blue-100", properties: 3, entities: 2, portfolio: "$1.4M", transactions: 58, unclassified: 3, netProfit: "$30K" },
  { name: "Clara Oswald", email: "clara@email.com", avatar: "CO", avatarBg: "bg-pink-50 text-pink-700 border border-pink-100", properties: 2, entities: 1, portfolio: "$0.7M", transactions: 32, unclassified: 2, netProfit: "$18K" }
];

const MOCK_TRANSACTIONS = [
  { date: "Jun 10", client: "Sneha Bansal", property: "12 Maple St", description: "Rental income — June", category: "Rental income", amount: "+$2,400", isPositive: true, status: "Reconciled" },
  { date: "Jun 9", client: "Mark Williams", property: "7 Oak Ave", description: "Council rates Q4", category: "Council rates", amount: "-$840", isPositive: false, status: "Reconciled" },
  { date: "Jun 8", client: "Boris Petrov", property: "22 Beach Rd", description: "Maintenance — plumbing", category: "Maintenance", amount: "-$380", isPositive: false, status: "Unclassified" },
  { date: "Jun 7", client: "Sneha Bansal", property: "4 River Ln", description: "Property management fee", category: "Management fees", amount: "-$310", isPositive: false, status: "Reconciled" },
  { date: "Jun 6", client: "John Doe", property: "8 Pine Rd", description: "Water connection", category: "Utilities", amount: "-$120", isPositive: false, status: "Reconciled" },
  { date: "Jun 5", client: "Sarah Connor", property: "34 View St", description: "Quarterly Rent", category: "Rental income", amount: "+$3,100", isPositive: true, status: "Reconciled" },
  { date: "Jun 4", client: "David Miller", property: "15 Hill Rd", description: "Roof repair", category: "Maintenance", amount: "-$1,200", isPositive: false, status: "Unclassified" },
  { date: "Jun 3", client: "Emily Watson", property: "56 High St", description: "Insurance premium", category: "Insurance", amount: "-$450", isPositive: false, status: "Reconciled" }
];

const MOCK_ACTIVITIES = [
  { timestamp: "Jun 10, 09:14", action: "Added property", actionType: "added", client: "Sneha Bansal", record: "12 Maple St · #PROP-0091", detail: "New: Residential · Vacant · $820K" },
  { timestamp: "Jun 9, 14:32", action: "Edited transaction", actionType: "edited", client: "Mark Williams", record: "#TXN-1820", detail: "Category: Unclassified → Rental income" },
  { timestamp: "Jun 8, 11:05", action: "Deleted entity", actionType: "deleted", client: "Mark Williams", record: "Old Partnership · #ENT-0014", detail: "Deleted — snapshot retained" },
  { timestamp: "Jun 7, 10:20", action: "Added transaction", actionType: "added_tx", client: "Boris Petrov", record: "22 Beach Rd · #TXN-1791", detail: "New: Expense · Maintenance · $380K" },
  { timestamp: "Jun 6, 16:45", action: "Edited transaction", actionType: "edited", client: "John Doe", record: "#TXN-1644", detail: "Amount: -$110 → -$120" },
  { timestamp: "Jun 5, 08:30", action: "Added property", actionType: "added", client: "Sarah Connor", record: "34 View St · #PROP-0084", detail: "New: Residential · Tenanted · $650K" }
];

const getClientsForAccountant = (accountant: any) => {
  if (!accountant || !accountant.stats) return [];
  const countStr = accountant.stats.clients;
  if (countStr === "--") return [];
  const count = typeof countStr === "number" ? countStr : parseInt(countStr) || 0;
  return MOCK_CLIENTS.slice(0, count);
};

const getTransactionsForAccountant = (accountant: any, clients: any[]) => {
  if (!accountant || !accountant.stats || accountant.stats.transactions === "--" || accountant.stats.transactions === 0) {
    return [];
  }
  const clientNames = clients.map(c => c.name);
  if (clientNames.length === 0) return [];
  const filtered = MOCK_TRANSACTIONS.filter(tx => clientNames.includes(tx.client));
  return filtered.length > 0 ? filtered : MOCK_TRANSACTIONS;
};

const getActivityLogForAccountant = (accountant: any, clients: any[]) => {
  if (!accountant || !accountant.stats || accountant.stats.clients === "--" || accountant.stats.clients === 0) {
    return [];
  }
  const clientNames = clients.map(c => c.name);
  if (clientNames.length === 0) return [];
  const filtered = MOCK_ACTIVITIES.filter(act => clientNames.includes(act.client));
  return filtered.length > 0 ? filtered : MOCK_ACTIVITIES;
};

export default function AccountantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [accountant, setAccountant] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);

  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [transactionStatusFilter, setTransactionStatusFilter] = useState("All");

  const clients = useMemo(() => {
    const list = getClientsForAccountant(accountant);
    if (!clientSearchQuery) return list;
    const q = clientSearchQuery.toLowerCase();
    return list.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }, [accountant, clientSearchQuery]);

  const transactions = useMemo(() => {
    const list = getTransactionsForAccountant(accountant, getClientsForAccountant(accountant));
    if (transactionStatusFilter === "All") return list;
    return list.filter(t => t.status.toLowerCase() === transactionStatusFilter.toLowerCase());
  }, [accountant, transactionStatusFilter]);

  const activities = useMemo(() => {
    return getActivityLogForAccountant(accountant, getClientsForAccountant(accountant));
  }, [accountant]);

  const triggerToast = (message: string, type: "success" | "info" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    async function fetchAccountantData() {
      try {
        // First check mock database
        const decodedId = decodeURIComponent(id);
        if (ACCOUNTANT_DETAILS[decodedId]) {
          setAccountant(ACCOUNTANT_DETAILS[decodedId]);
          setIsLoading(false);
          return;
        }

        // If not found in mock, fetch from endpoint
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
          const dbAcc = invitedUsers.find((u) => u.id === decodedId || u.email.toLowerCase() === decodedId.toLowerCase());

          if (dbAcc) {
            const initials = dbAcc.name
              ? dbAcc.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
              : dbAcc.email.slice(0, 2).toUpperCase();

            const seed = dbAcc.email.length;
            const status = dbAcc.status === "ACCEPTED" ? "Active" : "Pending setup";
            const isPending = status === "Pending setup";

            // Generate deterministic mock stats for dynamic database user
            setAccountant({
              name: dbAcc.name || "Invite Pending",
              email: dbAcc.email,
              role: "Accountant",
              status: status,
              joined: dbAcc.createdAt ? new Date(dbAcc.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "Recently",
              lastActive: isPending ? "Invite sent" : "Today",
              avatar: initials,
              avatarBg: "bg-emerald-100 text-emerald-800",
              stats: {
                clients: isPending ? "--" : (seed % 6) + 4,
                portfolio: isPending ? "--" : `$${((seed % 12) + 2).toFixed(1)}M`,
                transactions: isPending ? "--" : (seed % 300) + 150,
                reconciliation: isPending ? 0 : (seed % 40) + 50,
                unclassified: isPending ? "--" : (seed % 20) + 10,
              },
              performance: {
                properties: isPending ? 0 : (seed % 15) + 10,
                entities: isPending ? 0 : (seed % 8) + 5,
                revenue: isPending ? "$0.0M" : `$${((seed % 3) + 0.5).toFixed(1)}M`,
                expenses: isPending ? "$0.0M" : `$${((seed % 2) + 0.2).toFixed(1)}M`,
                netProfit: isPending ? "$0.0M" : `$${((seed % 2) + 0.3).toFixed(1)}M`,
                documents: isPending ? 0 : (seed % 50) + 25,
              },
              chartData: {
                months: ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"],
                reconciled: isPending ? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] : [52, 48, 60, 58, 72, 64, 55, 68, 78, 74, 80, 84],
                unclassified: isPending ? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] : [22, 18, 28, 24, 28, 20, 18, 22, 30, 28, 32, 36]
              }
            });
          } else {
            // Fallback default
            setAccountant(ACCOUNTANT_DETAILS["akash-sharma"]);
          }
        }
      } catch (err) {
        console.error("Failed to load accountant details:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAccountantData();
  }, [id]);

  // Render Stacked column chart using standard SVG
  const renderStackedChart = () => {
    if (!accountant || !accountant.chartData) return null;

    const chartHeight = 160;
    const chartWidth = 540;
    const xStart = 45;
    const yStart = 20;
    const spacing = chartWidth / 12;
    const barWidth = 20;

    const reconciled = accountant.chartData.reconciled;
    const unclassified = accountant.chartData.unclassified;
    const months = accountant.chartData.months;

    const maxVal = 120;

    return (
      <div className="relative w-full">
        <svg viewBox="0 0 600 220" className="w-full h-auto overflow-visible">
          {/* Horizontal grid lines */}
          {[0, 20, 40, 60, 80, 100, 120].map((gridVal) => {
            const y = yStart + chartHeight - (gridVal / maxVal) * chartHeight;
            return (
              <g key={gridVal}>
                <line x1={xStart} y1={y} x2={xStart + chartWidth} y2={y} stroke="#F3F4F6" strokeWidth="1" />
                <text x={xStart - 12} y={y + 4} textAnchor="end" fill="#9CA3AF" className="text-[11px] font-medium font-sans select-none">
                  {gridVal}
                </text>
              </g>
            );
          })}

          {/* Stacked Bars */}
          {months.map((month: string, idx: number) => {
            const x = xStart + idx * spacing + (spacing - barWidth) / 2;
            const recH = (reconciled[idx] / maxVal) * chartHeight;
            const uncH = (unclassified[idx] / maxVal) * chartHeight;

            const recY = yStart + chartHeight - recH;
            const uncY = recY - uncH;

            // Rounded corners logic
            const currentR = Math.min(4, uncH);
            const uncPathD = currentR > 0
              ? `M ${x},${uncY + currentR} a ${currentR},${currentR} 0 0 1 ${currentR},-${currentR} h ${barWidth - 2 * currentR} a ${currentR},${currentR} 0 0 1 ${currentR},${currentR} v ${uncH - currentR} h -${barWidth} Z`
              : `M ${x},${uncY} h ${barWidth} v ${uncH} h -${barWidth} Z`;

            const currentRecR = uncH === 0 ? Math.min(4, recH) : 0;
            const recPathD = currentRecR > 0
              ? `M ${x},${recY + currentRecR} a ${currentRecR},${currentRecR} 0 0 1 ${currentRecR},-${currentRecR} h ${barWidth - 2 * currentRecR} a ${currentRecR},${currentRecR} 0 0 1 ${currentRecR},${currentRecR} v ${recH - currentRecR} h -${barWidth} Z`
              : `M ${x},${recY} h ${barWidth} v ${recH} h -${barWidth} Z`;

            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={month}
                className="group/bar cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Tooltip trigger helper block */}
                <rect x={x - 4} y={yStart} width={barWidth + 8} height={chartHeight} fill="transparent" />

                {/* Reconciled (Blue) */}
                {recH > 0 && (
                  <path
                    d={recPathD}
                    fill={isHovered ? "#1D4ED8" : "#2563EB"}
                    className="transition-all duration-150"
                  />
                )}

                {/* Unclassified (Crimson/Rust Orange Red) */}
                {uncH > 0 && (
                  <path
                    d={uncPathD}
                    fill={isHovered ? "#B43D0A" : "#C2410C"}
                    className="transition-all duration-150"
                  />
                )}

                {/* Month label */}
                <text
                  x={x + barWidth / 2}
                  y={yStart + chartHeight + 20}
                  textAnchor="middle"
                  fill="#9CA3AF"
                  className="text-[11px] font-medium font-sans select-none"
                >
                  {month}
                </text>
              </g>
            );
          })}
        </svg>

        {/* HTML Tooltip Overlay */}
        {hoveredIdx !== null && (
          <div
            className="absolute bg-slate-900/95 text-white rounded-xl p-3 shadow-xl text-xs pointer-events-none transition-all duration-100 z-10 flex flex-col gap-1.5 min-w-[130px] border border-slate-800 backdrop-blur-sm"
            style={{
              left: `${((xStart + hoveredIdx * spacing + (spacing - barWidth) / 2 + barWidth / 2) / 600) * 100}%`,
              top: `${((yStart + chartHeight - ((reconciled[hoveredIdx] + unclassified[hoveredIdx]) / maxVal) * chartHeight) / 220) * 100}%`,
              transform: 'translate(-50%, -115%)',
            }}
          >
            <div className="font-bold text-slate-300 border-b border-slate-800 pb-1 mb-0.5 text-center font-sans">
              {months[hoveredIdx]}
            </div>
            <div className="flex justify-between gap-4 font-sans">
              <span className="text-slate-400">Reconciled</span>
              <span className="font-bold text-blue-400">{reconciled[hoveredIdx]}</span>
            </div>
            <div className="flex justify-between gap-4 font-sans">
              <span className="text-slate-400">Unclassified</span>
              <span className="font-bold text-orange-400">{unclassified[hoveredIdx]}</span>
            </div>
            <div className="flex justify-between gap-4 border-t border-slate-800 pt-1 mt-0.5 font-bold font-sans">
              <span className="text-slate-200 font-semibold">Total</span>
              <span>{reconciled[hoveredIdx] + unclassified[hoveredIdx]}</span>
            </div>
            {/* Tooltip tail pointer */}
            <div className="absolute left-1/2 bottom-0 w-2.5 h-2.5 bg-slate-900 border-r border-b border-slate-800 transform -translate-x-1/2 translate-y-1/2 rotate-45" />
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return <PortalDashboardSkeleton />;
  }

  if (!accountant) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800">Accountant not found</h2>
        <Link href="/dashboard/admin/accountants" className="text-blue-600 font-semibold hover:underline mt-4 inline-block">
          Back to Accountants
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "clients", label: "Clients" },
    { id: "transactions", label: "Transactions" },
    { id: "activity log", label: "Activity log" },
  ];

  return (
    <div className="flex flex-col gap-6 pb-12 w-full animate-fade-in font-sans">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white rounded-xl shadow-lg border border-slate-800 px-4 py-3 flex items-center gap-3 animate-slide-in">
          <div className={`w-2 h-2 rounded-full ${toast.type === "success" ? "bg-emerald-400" : "bg-blue-400"}`} />
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-[13px] font-medium text-slate-500">
        <Link href="/dashboard/admin/accountants" className="hover:text-slate-700 transition">
          Accountants
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-800 font-semibold">{accountant.name}</span>
      </nav>

      {/* Profile Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center font-bold text-xl ${accountant.avatarBg} shrink-0 shadow-sm`}>
              {accountant.avatar}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl text-slate-900 tracking-tight">{accountant.name}</h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${accountant.status === "Active"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${accountant.status === "Active" ? "bg-emerald-500" : "bg-amber-500"}`} />
                  {accountant.status}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                {accountant.role}
              </p>
              <div className="flex items-center gap-6 text-sm text-slate-400 mt-2 ">
                <span>{accountant.email}</span>
                <span>Joined {accountant.joined}</span>
                <span>Last active: {accountant.lastActive}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => triggerToast(`Drafting message thread for ${accountant.name}...`, "info")}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 bg-white rounded-lg text-xs text-slate-700 hover:bg-slate-50 transition shadow-sm cursor-pointer"
              type="button"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              Message
            </button>
            <button
              onClick={() => triggerToast(`Modifying profile rules for ${accountant.name}...`, "info")}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 bg-white rounded-lg text-xs text-slate-700 hover:bg-slate-50 transition shadow-sm cursor-pointer"
              type="button"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.83 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
              </svg>
              Edit
            </button>
            <button
              onClick={() => triggerToast(`Deactivating accountant: ${accountant.name}...`, "error")}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-red-200 bg-red-50 text-red-600 rounded-lg text-xs hover:bg-red-100 hover:border-red-300 transition shadow-sm cursor-pointer"
              type="button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <g clip-path="url(#clip0_1348_9540)">
                  <path d="M9.33203 12.25V11.0833C9.33203 10.4645 9.0862 9.871 8.64861 9.43342C8.21103 8.99583 7.61754 8.75 6.9987 8.75H2.91536C2.29653 8.75 1.70303 8.99583 1.26545 9.43342C0.827864 9.871 0.582031 10.4645 0.582031 11.0833V12.25" stroke="#C03A2B" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M4.95833 6.41667C6.247 6.41667 7.29167 5.372 7.29167 4.08333C7.29167 2.79467 6.247 1.75 4.95833 1.75C3.66967 1.75 2.625 2.79467 2.625 4.08333C2.625 5.372 3.66967 6.41667 4.95833 6.41667Z" stroke="#C03A2B" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M10.5 4.66602L13.4167 7.58268" stroke="#C03A2B" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M13.4167 4.66602L10.5 7.58268" stroke="#C03A2B" stroke-linecap="round" stroke-linejoin="round" />
                </g>
                <defs>
                  <clipPath id="clip0_1348_9540">
                    <rect width="14" height="14" fill="white" />
                  </clipPath>
                </defs>
              </svg>
              Deactivate
            </button>
          </div>
        </div>
      </div>

      {/* 5 Stats Card Row (Combined container matching Figma) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex flex-col lg:flex-row lg:divide-x divide-slate-100 lg:divide-slate-200/80 divide-y lg:divide-y-0">
        <div className="p-6 flex-1">
          <p className="!text-[11.5px] font-medium text-slate-custom uppercase tracking-wider">Clients</p>
          <span className="!text-[28px] font-semibold mt-1.5 block">{accountant.stats.clients}</span>
          <p className="!text-[12px] text-slate-custom mt-1 ">Assigned</p>
        </div>

        <div className="p-6 flex-1">
          <p className="!text-[11.5px] font-medium text-slate-custom uppercase tracking-wider">Portfolio Value</p>
          <span className="!text-[28px] font-semibold mt-1.5 block">{accountant.stats.portfolio}</span>
          <p className="!text-[12px] text-slate-custom mt-1 ">Under management</p>
        </div>

        <div className="p-6 flex-1">
          <p className="!text-[11.5px] font-medium text-slate-custom uppercase tracking-wider">Transactions</p>
          <span className="!text-[28px] font-semibold mt-1.5 block">{accountant.stats.transactions}</span>
          <p className="!text-[12px] text-slate-custom mt-1 ">This FY</p>
        </div>

        <div className="p-6 flex-1">
          <p className="!text-[11.5px] font-medium text-slate-custom uppercase tracking-wider">Reconciliation</p>
          <span className="!text-[28px] font-semibold text-emerald-600 mt-1.5 block">
            {accountant.stats.reconciliation}%
          </span>
          <p className="!text-[12px] text-slate-custom mt-1 ">
            Org target: 80%
          </p>
        </div>

        <div className="p-6 flex-1">
          <p className="!text-[11.5px] font-medium text-slate-custom uppercase tracking-wider">Unclassified</p>
          <span className="!text-[28px] font-semibold text-amber-700 mt-1.5 block">{accountant.stats.unclassified}</span>
          <p className="!text-[12px] text-slate-custom mt-1 ">Open items</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3.5 px-1 border-b-2 text-sm font-semibold transition cursor-pointer select-none ${activeTab === tab.id
                ? "border-blue-600 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300"
                }`}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Two Column Grid widgets for Overview Tab */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stacked Chart Card (Left 2 cols) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-6 lg:col-span-2 relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-slate-900 font-sans">Monthly transaction activity</h3>
              <span className="text-sm text-slate-400 font-normal font-sans">FY 2025–26</span>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 text-[13px] font-normal text-slate-500 mb-6 font-sans">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-[3px] bg-[#2563EB]" />
                Reconciled
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-[3px] bg-[#C2410C]" />
                Unclassified
              </div>
            </div>
            {renderStackedChart()}
          </div>

          {/* Performance Summary Card (Right 1 col) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-5">
            <h3 className="text-base font-bold text-slate-900 mb-4">Performance summary</h3>
            <div className="divide-y divide-slate-100">
              <div className="py-3.5 flex justify-between items-center text-sm font-medium">
                <span className="text-slate-500">Properties managed</span>
                <span className="font-semibold text-slate-800">{accountant.performance.properties}</span>
              </div>
              <div className="py-3.5 flex justify-between items-center text-sm font-medium">
                <span className="text-slate-500">Entities managed</span>
                <span className="font-semibold text-slate-800">{accountant.performance.entities}</span>
              </div>
              <div className="py-3.5 flex justify-between items-center text-sm font-medium">
                <span className="text-slate-500">Revenue (FY)</span>
                <span className="font-bold text-emerald-600">{accountant.performance.revenue}</span>
              </div>
              <div className="py-3.5 flex justify-between items-center text-sm font-medium">
                <span className="text-slate-500">Expenses (FY)</span>
                <span className="font-semibold text-slate-800">{accountant.performance.expenses}</span>
              </div>
              <div className="py-3.5 flex justify-between items-center text-sm font-medium">
                <span className="text-slate-500">Net profit</span>
                <span className="font-bold text-emerald-600">{accountant.performance.netProfit}</span>
              </div>
              <div className="py-3.5 flex justify-between items-center text-sm font-medium">
                <span className="text-slate-500">Documents uploaded</span>
                <span className="font-semibold text-slate-800">{accountant.performance.documents}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clients Tab */}
      {activeTab === "clients" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold text-slate-950 font-sans tracking-tight">Assigned clients</h3>
              <span className="bg-slate-100 text-slate-500 px-2.5 py-0.5 text-xs font-semibold rounded-full select-none">
                {getClientsForAccountant(accountant).length}
              </span>
            </div>
            <div>
              <input
                type="text"
                placeholder="Search clients..."
                value={clientSearchQuery}
                onChange={(e) => setClientSearchQuery(e.target.value)}
                className="w-full sm:w-64 px-3.5 py-1.5 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-normal transition text-slate-900"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            {clients.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-medium">
                No clients found matching the search.
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Client</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Properties</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Entities</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Portfolio Value</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Transactions</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unclassified</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net Profit</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-[100px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clients.map((client, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-[13px] shrink-0 ${client.avatarBg}`}>
                            {client.avatar}
                          </div>
                          <div>
                            <span className="text-[13.5px] font-bold text-slate-900 block leading-tight">{client.name}</span>
                            <span className="text-xs text-slate-400 font-normal">{client.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-6 text-sm font-medium text-slate-700">{client.properties}</td>
                      <td className="py-3 px-6 text-sm font-medium text-slate-700">{client.entities}</td>
                      <td className="py-3 px-6 text-sm font-medium text-slate-900">{client.portfolio}</td>
                      <td className="py-3 px-6 text-sm font-medium text-slate-900">{client.transactions}</td>
                      <td className="py-3 px-6">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold select-none ${client.unclassified > 15
                          ? "bg-[#FEF2F2] text-[#EF4444]"
                          : "bg-[#FFFBEB] text-[#D97706]"
                          }`}>
                          {client.unclassified}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-sm font-bold text-[#10B981]">{client.netProfit}</td>
                      <td className="py-3 px-6 text-right">
                        <button
                          onClick={() => triggerToast(`Navigating to profile for ${client.name}...`, "info")}
                          className="px-3.5 py-1.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] rounded-lg text-xs font-bold text-slate-800 transition duration-150 cursor-pointer"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === "transactions" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold text-slate-950 font-sans tracking-tight">Recent transactions</h3>
              <span className="bg-slate-100 text-slate-500 px-2.5 py-0.5 text-xs font-semibold rounded-full select-none">
                {transactions.length}
              </span>
            </div>
            <div className="relative">
              <select
                value={transactionStatusFilter}
                onChange={(e) => setTransactionStatusFilter(e.target.value)}
                className="appearance-none bg-white border border-slate-200 rounded-lg text-sm pl-4 pr-10 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800 cursor-pointer transition"
              >
                <option value="All">All Statuses</option>
                <option value="Reconciled">Reconciled</option>
                <option value="Unclassified">Unclassified</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-medium">
                No transactions found matching the selected status filter.
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Client</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Property</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 text-sm font-medium text-slate-500 whitespace-nowrap">{tx.date}</td>
                      <td className="py-4 px-6 text-sm font-bold text-slate-900">{tx.client}</td>
                      <td className="py-4 px-6 text-sm font-medium text-slate-500">{tx.property}</td>
                      <td className="py-4 px-6 text-sm font-bold text-slate-800">{tx.description}</td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-[#F3F4F6] text-slate-600 select-none">
                          {tx.category}
                        </span>
                      </td>
                      <td className={`py-4 px-6 text-sm font-bold ${tx.isPositive ? "text-[#10B981]" : "text-slate-950"}`}>
                        {tx.amount}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold select-none ${tx.status === "Reconciled"
                          ? "bg-[#ECFDF5] text-[#047857] border border-[#D1FAE5]"
                          : "bg-[#FFFBEB] text-[#B45309] border border-[#FEF3C7]"
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${tx.status === "Reconciled" ? "bg-[#10B981]" : "bg-[#F59E0B]"}`} />
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Activity Log Tab */}
      {activeTab === "activity log" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="overflow-x-auto">
            {activities.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-medium">
                No activity logged yet.
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Timestamp</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Action</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">On Client</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Record</th>
                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activities.map((act, idx) => {
                    let actionBadgeStyle = "bg-slate-50 text-slate-700 border-slate-200/60";
                    if (act.actionType === "added" || act.actionType === "added_tx") {
                      actionBadgeStyle = "bg-[#ECFDF5] text-[#047857] border border-[#D1FAE5]";
                    } else if (act.actionType === "edited") {
                      actionBadgeStyle = "bg-[#EFF6FF] text-[#1D4ED8] border border-[#DBEAFE]";
                    } else if (act.actionType === "deleted") {
                      actionBadgeStyle = "bg-[#FEF2F2] text-[#B91C1C] border border-[#FEE2E2]";
                    }

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6 text-sm font-medium text-slate-500 whitespace-nowrap">{act.timestamp}</td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold select-none border ${actionBadgeStyle}`}>
                            {act.action}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-sm font-bold text-slate-900">{act.client}</td>
                        <td className="py-4 px-6 text-sm font-medium text-slate-500 whitespace-nowrap">{act.record}</td>
                        <td className="py-4 px-6 text-sm font-bold text-slate-700">{act.detail}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
