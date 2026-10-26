"use client";

import React, { useState } from "react";
import Link from "next/link";

// ============================================================================
// Types & Interfaces
// ============================================================================

interface CategoryBreakdownItem {
  category: string;
  amount: string;
  countText: string;
  isUnclassified?: boolean;
}

interface AccountantReconciliationItem {
  name: string;
  rate: number;
  colorClass: string;
  textClass: string;
}

interface RecentTransactionRow {
  date: string;
  client: string;
  property: string;
  type: string;
  typeClass: string;
  category: string;
  amount: string;
  amountClass: string;
  addedBy: string;
  status: string;
  statusClass: string;
}

// ============================================================================
// Baseline Mock Data Matching the Image
// ============================================================================

const DEFAULT_CATEGORY_BREAKDOWN: CategoryBreakdownItem[] = [
  { category: "Rental income", amount: "$5.9M", countText: "1,842 txns" },
  { category: "Other income", amount: "$0.9M", countText: "214 txns" },
  { category: "Maintenance", amount: "$1.4M", countText: "684 txns" },
  { category: "Interest / loan", amount: "$1.8M", countText: "512 txns" },
  { category: "Management fees", amount: "$0.7M", countText: "312 txns" },
  { category: "Other expenses", amount: "$0.2M", countText: "187 txns" },
  { category: "Unclassified", amount: "", countText: "1,717 txns", isUnclassified: true },
];

const DEFAULT_ACCOUNTANT_RECONCILIATION: AccountantReconciliationItem[] = [
  { name: "Priya Rajan", rate: 82, colorClass: "bg-[#0f766e]", textClass: "text-[#0f766e]" },
  { name: "Akash Sharma", rate: 78, colorClass: "bg-[#0f766e]", textClass: "text-[#0f766e]" },
  { name: "Jessica Tran", rate: 69, colorClass: "bg-[#d97706]", textClass: "text-[#d97706]" },
  { name: "Satnam Singh", rate: 55, colorClass: "bg-[#d97706]", textClass: "text-[#d97706]" },
  { name: "Michael Chen", rate: 31, colorClass: "bg-[#b91c1c]", textClass: "text-[#b91c1c]" },
];

const DEFAULT_RECENT_TRANSACTIONS: RecentTransactionRow[] = [
  {
    date: "Jun 10, 2026",
    client: "Sneha Bansal",
    property: "12 Maple St, Sydney",
    type: "Revenue",
    typeClass: "bg-[#e2f0d9] text-[#385723]",
    category: "Rental income",
    amount: "+$3,200",
    amountClass: "text-[#15803d]",
    addedBy: "Akash Sharma",
    status: "Classified",
    statusClass: "bg-[#e2f0d9] text-[#385723]",
  },
  {
    date: "Jun 10, 2026",
    client: "Raj Patel",
    property: "4 Park Ave, Melbourne",
    type: "Expense",
    typeClass: "bg-[#fce4d6] text-[#c65911]",
    category: "Maintenance",
    amount: "-$850",
    amountClass: "text-[#b91c1c]",
    addedBy: "Satnam Singh",
    status: "Classified",
    statusClass: "bg-[#e2f0d9] text-[#385723]",
  },
  {
    date: "Jun 9, 2026",
    client: "Li Chen",
    property: "8 River Rd, Brisbane",
    type: "Expense",
    typeClass: "bg-[#fce4d6] text-[#c65911]",
    category: "Interest",
    amount: "-$4,100",
    amountClass: "text-[#b91c1c]",
    addedBy: "Priya Rajan",
    status: "Classified",
    statusClass: "bg-[#e2f0d9] text-[#385723]",
  },
  {
    date: "Jun 9, 2026",
    client: "Mark Williams",
    property: "22 Coast Dr, Perth",
    type: "Unknown",
    typeClass: "bg-[#f2f2f2] text-[#595959]",
    category: "—",
    amount: "$1,400",
    amountClass: "text-[#333333]",
    addedBy: "Michael Chen",
    status: "Unclassified",
    statusClass: "bg-[#fce4d6] text-[#c65911]",
  },
  {
    date: "Jun 8, 2026",
    client: "Sneha Bansal",
    property: "6 Hill Ct, Sydney",
    type: "Expense",
    typeClass: "bg-[#fce4d6] text-[#c65911]",
    category: "Mgmt fee",
    amount: "-$420",
    amountClass: "text-[#b91c1c]",
    addedBy: "Akash Sharma",
    status: "Classified",
    statusClass: "bg-[#e2f0d9] text-[#385723]",
  },
];

// ============================================================================
// Main Component
// ============================================================================

export default function TransactionsReportPage() {
  const [filterActive, setFilterActive] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dynamic State Hooks
  const [summary, setSummary] = useState({
    totalTransactions: "4,821",
    classifiedCount: "3,104",
    classifiedPercentText: "64% of total",
    unclassifiedCount: "1,717",
    unclassifiedStatusText: "Needs review",
    activeRulesCount: "142",
    activeRulesLabelText: "Auto-classification",
  });
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdownItem[]>(DEFAULT_CATEGORY_BREAKDOWN);
  const [reconciliationList, setReconciliationList] = useState<AccountantReconciliationItem[]>(DEFAULT_ACCOUNTANT_RECONCILIATION);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransactionRow[]>(DEFAULT_RECENT_TRANSACTIONS);

  // Trigger Toast Notification Helper
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };



  // CSV Export Trigger
  const handleExportCSV = () => {
    showToast("Generating transactions report spreadsheet...");

    setTimeout(() => {
      const csvRows = [
        ["ClearPortfolio - Transactions Report Summary", "Period: FY 2025-26"],
        ["Total Transactions", summary.totalTransactions],
        ["Classified", `${summary.classifiedCount} (${summary.classifiedPercentText})`],
        ["Unclassified", `${summary.unclassifiedCount} (${summary.unclassifiedStatusText})`],
        ["Active Rules", `${summary.activeRulesCount} (${summary.activeRulesLabelText})`],
        [],
        ["CATEGORY BREAKDOWN"],
        ["Category", "Amount", "Volume"],
        ...categoryBreakdown.map((item) => [item.category, item.amount || "—", item.countText]),
        [],
        ["RECONCILIATION BY ACCOUNTANT"],
        ["Accountant", "Reconciliation Rate"],
        ...reconciliationList.map((acc) => [acc.name, `${acc.rate}%`]),
        [],
        ["RECENT TRANSACTIONS"],
        ["Date", "Client", "Property", "Type", "Category", "Amount", "Added By", "Status"],
        ...recentTransactions.map((tx) => [
          tx.date,
          tx.client,
          tx.property,
          tx.type,
          tx.category,
          tx.amount,
          tx.addedBy,
          tx.status,
        ]),
      ];

      const csvContent =
        "data:text/csv;charset=utf-8," +
        csvRows.map((e) => e.map((val) => `"${val}"`).join(",")).join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "ClearPortfolio_Transactions_Report_FY25-26.csv");
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
          <h2 className="text-[20px] text-[#0f172a] tracking-tight mb-0.5 font-medium">Transactions</h2>
          <p className="text-[12.5px] text-[#64748b] font-normal leading-normal">
            {summary.totalTransactions} total · FY 2025–26
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
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Filter Options Drawer */}
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
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</span>
            <select className="h-9 px-3 border border-slate-200 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500">
              <option>All Statuses</option>
              <option>Classified</option>
              <option>Unclassified</option>
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

        {/* Card 1: Total Transactions */}
        <div className="bg-white border border-[#eaecf0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-medium text-[#64748b] tracking-wider uppercase block mb-3">Total transactions</span>
            <h3 className="text-[34px] font-medium text-[#0f172a] leading-none mb-2 tracking-tight">{summary.totalTransactions}</h3>
          </div>
          <div className="h-4" /> {/* Empty spacing to balance baseline alignment */}
        </div>

        {/* Card 2: Classified */}
        <div className="bg-white border border-[#eaecf0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-medium text-[#64748b] tracking-wider uppercase block mb-3">Classified</span>
            <h3 className="text-[34px] font-medium text-[#15803d] leading-none mb-2 tracking-tight">{summary.classifiedCount}</h3>
          </div>
          <span className="text-[12.5px] text-[#64748b]">{summary.classifiedPercentText}</span>
        </div>

        {/* Card 3: Unclassified */}
        <div className="bg-white border border-[#eaecf0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-medium text-[#64748b] tracking-wider uppercase block mb-3">Unclassified</span>
            <h3 className="text-[34px] font-medium text-[#b91c1c] leading-none mb-2 tracking-tight">{summary.unclassifiedCount}</h3>
          </div>
          <span className="text-[12.5px] text-[#b91c1c] font-semibold">{summary.unclassifiedStatusText}</span>
        </div>

        {/* Card 4: Active Rules */}
        <div className="bg-white border border-[#eaecf0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-medium text-[#64748b] tracking-wider uppercase block mb-3">Active rules</span>
            <h3 className="text-[34px] font-medium text-[#0f172a] leading-none mb-2 tracking-tight">{summary.activeRulesCount}</h3>
          </div>
          <span className="text-[12.5px] text-[#64748b]">{summary.activeRulesLabelText}</span>
        </div>

      </div>

      {/* Main Charts & Breakdown Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

        {/* Left Side: Category Breakdown Card */}
        <div className="bg-white border border-[#eaecf0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div className="w-full">
            <h3 className="text-[15px] font-semibold text-[#0f172a] mb-6 select-none">Category breakdown</h3>

            <div className="space-y-4">
              {categoryBreakdown.map((item) => (
                <div key={item.category} className="flex justify-between items-center py-1">
                  <span className={`text-[13.5px] font-normal ${item.isUnclassified ? "text-[#b91c1c]" : "text-[#475569]"}`}>
                    {item.category}
                  </span>
                  <div className="flex items-center gap-2">
                    {item.amount && (
                      <span className="text-[13.5px] text-[#0f172a] font-semibold">
                        {item.amount}
                      </span>
                    )}
                    <span className={`text-[12.5px] font-normal ${item.isUnclassified ? "text-[#b91c1c] font-semibold" : "text-[#94a3b8]"}`}>
                      {item.countText}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Reconciliation by Accountant Card */}
        <div className="bg-white border border-[#eaecf0] rounded-xl p-6 shadow-sm flex flex-col justify-between select-none">
          <div className="w-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[15px] font-semibold text-[#0f172a]">Reconciliation by accountant</h3>
              <span className="text-xs text-[#64748b] font-medium">Target 80%</span>
            </div>

            <div className="space-y-5">
              {reconciliationList.map((acc) => (
                <div key={acc.name} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[13.5px] text-[#0f172a] font-semibold">{acc.name}</span>
                    <span className={`text-[12.5px] font-semibold ${acc.textClass}`}>{acc.rate}%</span>
                  </div>
                  {/* Progress bar container */}
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${acc.colorClass}`}
                      style={{ width: `${acc.rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Recent Transactions Table Container */}
      <div className="w-full">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-3 select-none">
          RECENT TRANSACTIONS
        </h4>

        {/* Transactions Table Card */}
        <div className="bg-white border border-[#eaecf0] rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#eaecf0] bg-white select-none">
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">DATE</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">CLIENT</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">PROPERTY</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">TYPE</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">CATEGORY</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">AMOUNT</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">ADDED BY</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {recentTransactions.map((tx, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition">

                    {/* Date cell */}
                    <td className="py-3.5 px-6 text-[13px] text-[#475569] whitespace-nowrap">
                      {tx.date}
                    </td>

                    {/* Client cell */}
                    <td className="py-3.5 px-6 text-[13.5px] font-semibold text-[#0f172a] whitespace-nowrap">
                      {tx.client}
                    </td>

                    {/* Property cell */}
                    <td className="py-3.5 px-6 text-[13px] text-[#475569] whitespace-nowrap">
                      {tx.property}
                    </td>

                    {/* Type cell with badge */}
                    <td className="py-3.5 px-6 whitespace-nowrap select-none">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${tx.typeClass}`}>
                        {tx.type}
                      </span>
                    </td>

                    {/* Category cell */}
                    <td className="py-3.5 px-6 text-[13px] text-[#475569] whitespace-nowrap">
                      {tx.category}
                    </td>

                    {/* Amount cell */}
                    <td className={`py-3.5 px-6 text-[13px] font-semibold whitespace-nowrap ${tx.amountClass}`}>
                      {tx.amount}
                    </td>

                    {/* Added By cell */}
                    <td className="py-3.5 px-6 text-[13px] text-[#475569] whitespace-nowrap">
                      {tx.addedBy}
                    </td>

                    {/* Status cell with badge */}
                    <td className="py-3.5 px-6 whitespace-nowrap select-none">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${tx.statusClass}`}>
                        {tx.status}
                      </span>
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
