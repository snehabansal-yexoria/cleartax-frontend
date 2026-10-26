"use client";

import React, { useState } from "react";
import Link from "next/link";

// ============================================================================
// Types & Interfaces
// ============================================================================

interface ClientRow {
  initials: string;
  avatarBg: string;
  avatarText: string;
  name: string;
  accountant: string;
  entityType: string;
  entityBadgeBg: string;
  entityBadgeText: string;
  properties: number;
  marketValue: string;
  revenue: string;
  expenses: string;
  netProfit: string;
}

interface ExpenseBreakdownItem {
  category: string;
  amount: string;
}

// ============================================================================
// Mock Data Matching the Image
// ============================================================================

const CLIENTS_DATA: ClientRow[] = [
  {
    initials: "SB",
    avatarBg: "bg-[#eef2ff] text-[#4f46e5]",
    avatarText: "SB",
    name: "Sneha Bansal",
    accountant: "Akash Sharma",
    entityType: "Disc. trust",
    entityBadgeBg: "bg-[#e0e7ff] text-[#4f46e5]",
    entityBadgeText: "text-[#4338ca]",
    properties: 8,
    marketValue: "$7.2M",
    revenue: "$486K",
    expenses: "$312K",
    netProfit: "$174K",
  },
  {
    initials: "RP",
    avatarBg: "bg-[#f0f9ff] text-[#0284c7]",
    avatarText: "RP",
    name: "Raj Patel",
    accountant: "Satnam Singh",
    entityType: "SMSF",
    entityBadgeBg: "bg-[#e0f2fe] text-[#0369a1]",
    entityBadgeText: "text-[#0284c7]",
    properties: 6,
    marketValue: "$5.8M",
    revenue: "$412K",
    expenses: "$241K",
    netProfit: "$171K",
  },
  {
    initials: "LC",
    avatarBg: "bg-[#e8f5e9] text-[#2e7d32]",
    avatarText: "LC",
    name: "Li Chen",
    accountant: "Priya Rajan",
    entityType: "Unit trust",
    entityBadgeBg: "bg-[#faf5ff] text-[#6b21a8]", // Light purple matching unit trust
    entityBadgeText: "text-[#6b21a8]",
    properties: 5,
    marketValue: "$4.9M",
    revenue: "$388K",
    expenses: "$198K",
    netProfit: "$182K",
  },
  {
    initials: "MW",
    avatarBg: "bg-[#fff3e0] text-[#ef6c00]",
    avatarText: "MW",
    name: "Mark Williams",
    accountant: "Akash Sharma",
    entityType: "Individual",
    entityBadgeBg: "bg-[#f1f5f9] text-[#475569]",
    entityBadgeText: "text-[#475569]",
    properties: 4,
    marketValue: "$3.6M",
    revenue: "$246K",
    expenses: "$180K",
    netProfit: "$60K",
  },
];

const EXPENSE_BREAKDOWN: ExpenseBreakdownItem[] = [
  { category: "Maintenance", amount: "$1.4M" },
  { category: "Interest / loan repayments", amount: "$1.8M" },
  { category: "Management fees", amount: "$0.7M" },
  { category: "Other expenses", amount: "$0.2M" },
];

const CHART_MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];

// Chart Data (approximate height match to image values)
// Revenue (green) vs Expenses (red)
const CHART_DATA = [
  { month: "Jul", revenue: 410, expenses: 270 },
  { month: "Aug", revenue: 380, expenses: 250 },
  { month: "Sep", revenue: 510, expenses: 210 },
  { month: "Oct", revenue: 480, expenses: 310 },
  { month: "Nov", revenue: 540, expenses: 330 },
  { month: "Dec", revenue: 440, expenses: 280 },
  { month: "Jan", revenue: 385, expenses: 220 },
  { month: "Feb", revenue: 480, expenses: 290 },
  { month: "Mar", revenue: 610, expenses: 385 },
  { month: "Apr", revenue: 580, expenses: 370 },
  { month: "May", revenue: 640, expenses: 395 },
  { month: "Jun", revenue: 670, expenses: 415 },
];

// ============================================================================
// Main Component
// ============================================================================

export default function PortfolioReportPage() {
  const [filterActive, setFilterActive] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dynamic state hooks initialized to static design defaults
  const [summary, setSummary] = useState({
    totalPortfolioValue: "$94.2M",
    totalPortfolioValueQuarterTrend: "$2.8M",
    revenueFY: "$6.8M",
    expensesFY: "$4.1M",
    netProfitFY: "$2.7M",
    netProfitFYTrend: "12.4%",
  });
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseBreakdownItem[]>(EXPENSE_BREAKDOWN);
  const [chartData, setChartData] = useState(CHART_DATA);
  const [clientsData, setClientsData] = useState<ClientRow[]>(CLIENTS_DATA);

  // Trigger Toast Notification Helper
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };



  // CSV Export Trigger
  const handleExportCSV = () => {
    showToast("Generating portfolio report spreadsheet...");

    setTimeout(() => {
      const csvRows = [
        ["ClearPortfolio - Portfolio Report Summary", "Period: FY 2025-26"],
        ["Total Portfolio Value", summary.totalPortfolioValue],
        ["Revenue (FY)", summary.revenueFY],
        ["Expenses (FY)", summary.expensesFY],
        ["Net Profit (FY)", summary.netProfitFY],
        [],
        ["EXPENSE BREAKDOWN"],
        ["Category", "Amount"],
        ...expenseBreakdown.map((item) => [item.category, item.amount]),
        ["Total", summary.expensesFY],
        [],
        ["TOP CLIENTS BY PORTFOLIO VALUE"],
        ["Client", "Accountant", "Entity Type", "Properties", "Market Value", "Revenue (FY)", "Expenses (FY)", "Net Profit"],
        ...clientsData.map((c) => [
          c.name,
          c.accountant,
          c.entityType,
          c.properties,
          c.marketValue,
          c.revenue,
          c.expenses,
          c.netProfit,
        ]),
      ];

      const csvContent =
        "data:text/csv;charset=utf-8," +
        csvRows.map((e) => e.map((val) => `"${val}"`).join(",")).join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "ClearPortfolio_Report_FY25-26.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Spreadsheet downloaded successfully!");
    }, 1000);
  };

  return (
    <div className="w-full max-w-[1280px] mx-auto px-6 py-6 transition-all duration-300 ease-in-out">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#0f172a] text-white text-xs font-medium px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 animate-fadeIn">
          <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}



      {/* Section Header with Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-[20px] text-[#0f172a] tracking-tight mb-0.5 font-medium">Portfolio report</h2>
          <p className="text-[12.5px] text-[#64748b] font-normal leading-normal">
            Organisation-wide · FY 2025–26
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setFilterActive(!filterActive)}
            className={`inline-flex items-center gap-2 h-9 px-4 rounded-lg border text-[13px] font-medium transition cursor-pointer select-none ${filterActive
              ? "border-blue-600 bg-blue-50 text-blue-700"
              : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
              }`}
          >
            <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2.586a1 1 0 0 1-.293.707l-6.414 6.414a1 1 0 0 0-.293.707V17l-4 4v-6.586a1 1 0 0 0-.293-.707L3.293 7.293A1 1 0 0 1 3 6.586V4z" />
            </svg>
            <span>Filter</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 h-9 px-4 bg-white border border-slate-200 rounded-lg text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer select-none"
          >
            <svg className="w-4 h-4 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Options Drawer / Section */}
      {filterActive && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm flex flex-wrap gap-4 items-center animate-fadeIn select-none">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Date range</span>
            <select className="h-9 px-3 border border-slate-200 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500">
              <option>FY 2025–26</option>
              <option>FY 2024–25</option>
              <option>FY 2023–24</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Accountant</span>
            <select className="h-9 px-3 border border-slate-200 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500">
              <option>All Accountants</option>
              <option>Akash Sharma</option>
              <option>Satnam Singh</option>
              <option>Priya Rajan</option>
            </select>
          </div>
          <button
            onClick={() => {
              setFilterActive(false);
              showToast("Filters applied successfully.");
            }}
            className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-[13px] rounded-lg mt-5 transition cursor-pointer"
          >
            Apply Filters
          </button>
        </div>
      )}

      {/* Summary Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">

        {/* Card 1: Total Portfolio Value */}
        <div className="bg-white border border-[#eaecf0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-medium text-[#64748b] tracking-wider uppercase block mb-3">TOTAL PORTFOLIO VALUE</span>
            <h3 className="text-[34px] font-medium text-[#0f172a] leading-none mb-2 tracking-tight">{summary.totalPortfolioValue}</h3>
          </div>
          <div className="flex items-center gap-1 text-[12.5px]">
            <span className="text-[#15803d] font-medium">{summary.totalPortfolioValueQuarterTrend}</span>
            <span className="text-[#64748b]">this quarter</span>
          </div>
        </div>

        {/* Card 2: Revenue */}
        <div className="bg-white border border-[#eaecf0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-medium text-[#64748b] tracking-wider uppercase block mb-3">REVENUE (FY)</span>
            <h3 className="text-[34px] font-medium text-[#0f172a] leading-none mb-2 tracking-tight">{summary.revenueFY}</h3>
          </div>
          <span className="text-[12.5px] text-[#64748b]">Rental + other income</span>
        </div>

        {/* Card 3: Expenses */}
        <div className="bg-white border border-[#eaecf0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-medium text-[#64748b] tracking-wider uppercase block mb-3">EXPENSES (FY)</span>
            <h3 className="text-[34px] font-medium text-[#0f172a] leading-none mb-2 tracking-tight">{summary.expensesFY}</h3>
          </div>
          <span className="text-[12.5px] text-[#64748b]">All categories</span>
        </div>

        {/* Card 4: Net Profit */}
        <div className="bg-white border border-[#eaecf0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-medium text-[#64748b] tracking-wider uppercase block mb-3">NET PROFIT (FY)</span>
            <h3 className="text-[34px] font-medium text-[#0f172a] leading-none mb-2 tracking-tight">{summary.netProfitFY}</h3>
          </div>
          <div className="flex items-center gap-1 text-[12.5px]">
            <span className="text-[#15803d] font-medium">{summary.netProfitFYTrend}</span>
            <span className="text-[#64748b]">vs FY 24–25</span>
          </div>
        </div>

      </div>

      {/* Main Charts & Breakdown Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

        {/* Left Side: Profit & Loss Trend Chart Card (2/3 width) */}
        <div className="lg:col-span-2 bg-white border border-[#eaecf0] rounded-xl p-6 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6 select-none">
            <div>
              <h3 className="text-[15px] font-semibold text-[#0f172a] mb-0.5">Monthly profit & loss</h3>
              <div className="flex items-center gap-4 mt-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-[#64748b]">
                  <span className="w-2.5 h-2.5 rounded-[2px] bg-[#0f766e]" />
                  <span>Revenue</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-[#64748b]">
                  <span className="w-2.5 h-2.5 rounded-[2px] bg-[#b91c1c]" />
                  <span>Expenses</span>
                </span>
              </div>
            </div>
            <span className="text-xs text-[#64748b] font-normal">FY 2025–26</span>
          </div>

          {/* SVG Chart Graphic */}
          <div className="flex-1 w-full relative min-h-[220px] select-none">
            <svg className="w-full h-full" viewBox="0 0 740 220" preserveAspectRatio="none">

              {/* Horizontal gridlines and left labels */}
              {[700, 600, 500, 400, 300, 200, 100, 0].map((val, idx) => {
                const yPos = 10 + (idx * 25); // 0 corresponds to 700K, 7 to 0K
                return (
                  <g key={val}>
                    <line x1="50" y1={yPos} x2="740" y2={yPos} stroke="#f1f5f9" strokeWidth="1" />
                    <text x="40" y={yPos + 4} textAnchor="end" fill="#94a3b8" className="text-[11px] font-normal font-sans">
                      ${val}K
                    </text>
                  </g>
                );
              })}

              {/* Chart Columns */}
              {chartData.map((item, idx) => {
                const barSpacing = 57.5; // X-axis spacing
                const xCenter = 78 + (idx * barSpacing); // Center of month columns

                // Scale heights to fit inside the graph area
                const maxVal = 700;
                const totalHeight = 175; // 700K mapped to 175px (approx)

                const revHeight = (item.revenue / maxVal) * totalHeight;
                const expHeight = (item.expenses / maxVal) * totalHeight;

                // Y-coordinate starts from top (0) to bottom (185)
                const revY = 185 - revHeight;
                const expY = 185 - expHeight;

                const barWidth = 9;

                return (
                  <g key={item.month}>
                    {/* Revenue Bar (Left) */}
                    <rect
                      x={xCenter - barWidth - 1}
                      y={revY}
                      width={barWidth}
                      height={revHeight}
                      fill="#0f766e" // Pine green / teal
                      rx="1"
                    />

                    {/* Expenses Bar (Right) */}
                    <rect
                      x={xCenter + 1}
                      y={expY}
                      width={barWidth}
                      height={expHeight}
                      fill="#b91c1c" // Crimson red
                      rx="1"
                    />

                    {/* Month Label Text */}
                    <text
                      x={xCenter}
                      y="208"
                      textAnchor="middle"
                      fill="#94a3b8"
                      className="text-[11px] font-sans font-normal"
                    >
                      {item.month}
                    </text>
                  </g>
                );
              })}

            </svg>
          </div>
        </div>

        {/* Right Side: Expense Breakdown Card (1/3 width) */}
        <div className="bg-white border border-[#eaecf0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div className="w-full">
            <h3 className="text-[15px] font-semibold text-[#0f172a] mb-6 select-none">Expense breakdown</h3>

            <div className="space-y-4">
              {expenseBreakdown.map((item) => (
                <div key={item.category} className="flex justify-between items-center py-1">
                  <span className="text-[13.5px] text-[#475569] font-normal">{item.category}</span>
                  <span className="text-[13.5px] text-[#0f172a] font-semibold">{item.amount}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full">
            <div className="border-t border-slate-200 my-4" />

            <div className="flex justify-between items-center py-1 select-none">
              <span className="text-[14px] text-[#0f172a] font-semibold">Total</span>
              <span className="text-[14px] text-[#0f172a] font-extrabold">{summary.expensesFY}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Top Clients Table Container */}
      <div className="w-full">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-3 select-none">
          TOP CLIENTS BY PORTFOLIO VALUE
        </h4>

        {/* Clients Table Card */}
        <div className="bg-white border border-[#eaecf0] rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#eaecf0] bg-white select-none">
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">CLIENT</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">ACCOUNTANT</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">ENTITY TYPE</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">PROPERTIES</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">MARKET VALUE</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">REVENUE (FY)</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">EXPENSES (FY)</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">NET PROFIT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {clientsData.map((client) => (
                  <tr key={client.name} className="hover:bg-slate-50/50 transition">

                    {/* Client cell with initials avatar */}
                    <td className="py-3.5 px-6 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs ${client.avatarBg} select-none`}>
                          {client.avatarText}
                        </div>
                        <span className="text-[13.5px] font-medium text-[#0f172a]">{client.name}</span>
                      </div>
                    </td>

                    {/* Accountant cell */}
                    <td className="py-3.5 px-6 text-[13px] text-[#475569] whitespace-nowrap">
                      {client.accountant}
                    </td>

                    {/* Entity Type cell with badge */}
                    <td className="py-3.5 px-6 whitespace-nowrap select-none">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${client.entityBadgeBg} ${client.entityBadgeText}`}>
                        {client.entityType}
                      </span>
                    </td>

                    {/* Properties count cell */}
                    <td className="py-3.5 px-6 text-[13px] text-[#475569] font-normal whitespace-nowrap">
                      {client.properties}
                    </td>

                    {/* Market Value cell */}
                    <td className="py-3.5 px-6 text-[13px] text-[#0f172a] font-semibold whitespace-nowrap">
                      {client.marketValue}
                    </td>

                    {/* Revenue cell */}
                    <td className="py-3.5 px-6 text-[13px] text-[#475569] font-medium whitespace-nowrap">
                      {client.revenue}
                    </td>

                    {/* Expenses cell */}
                    <td className="py-3.5 px-6 text-[13px] text-[#475569] font-medium whitespace-nowrap">
                      {client.expenses}
                    </td>

                    {/* Net Profit cell */}
                    <td className="py-3.5 px-6 text-[13px] text-[#15803d] font-semibold whitespace-nowrap">
                      {client.netProfit}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
