"use client";

import React, { useState } from "react";
import Link from "next/link";

// ============================================================================
// Types & Interfaces
// ============================================================================

interface EntityRow {
  name: string;
  type: string;
  typeClass: string;
  client: string;
  accountant: string;
  propertiesLinked: number;
  ownership: string;
  transactions: number;
}

// ============================================================================
// Baseline Mock Data Matching the Image
// ============================================================================

const DEFAULT_ENTITIES: EntityRow[] = [
  {
    name: "Sneha Trust",
    type: "Disc. trust",
    typeClass: "bg-[#e0e7ff] text-[#4f46e5]",
    client: "Sneha Bansal",
    accountant: "Akash Sharma",
    propertiesLinked: 4,
    ownership: "50%",
    transactions: 142,
  },
  {
    name: "Patel SMSF",
    type: "SMSF",
    typeClass: "bg-[#e0f2fe] text-[#0369a1]",
    client: "Raj Patel",
    accountant: "Satnam Singh",
    propertiesLinked: 3,
    ownership: "100%",
    transactions: 98,
  },
  {
    name: "Li Chen Holdings Pty Ltd",
    type: "Company",
    typeClass: "bg-[#fff3e0] text-[#ef6c00]",
    client: "Li Chen",
    accountant: "Priya Rajan",
    propertiesLinked: 5,
    ownership: "75%",
    transactions: 187,
  },
  {
    name: "Williams Family Trust",
    type: "Unit trust",
    typeClass: "bg-[#faf5ff] text-[#6b21a8]",
    client: "Mark Williams",
    accountant: "Akash Sharma",
    propertiesLinked: 2,
    ownership: "100%",
    transactions: 64,
  },
];

// ============================================================================
// Main Component
// ============================================================================

export default function EntitiesReportPage() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dynamic State Hooks
  const [summary, setSummary] = useState({
    totalEntities: "143",
    discretionaryTrusts: "54",
    smsfs: "28",
    companies: "22",
  });
  const [entitiesList, setEntitiesList] = useState<EntityRow[]>(DEFAULT_ENTITIES);

  // Trigger Toast Notification Helper
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };



  // CSV Export Trigger
  const handleExportCSV = () => {
    showToast("Generating entities report spreadsheet...");

    setTimeout(() => {
      const csvRows = [
        ["ClearPortfolio - Entities Report Summary", "Period: FY 2025-26"],
        ["Total Entities", summary.totalEntities],
        ["Discretionary Trusts", summary.discretionaryTrusts],
        ["SMSFs", summary.smsfs],
        ["Companies (Pty Ltd)", summary.companies],
        [],
        ["ENTITIES TABLE"],
        ["Entity Name", "Type", "Client", "Accountant", "Properties Linked", "Ownership %", "Transactions"],
        ...entitiesList.map((item) => [
          item.name,
          item.type,
          item.client,
          item.accountant,
          item.propertiesLinked,
          item.ownership,
          item.transactions,
        ]),
      ];

      const csvContent =
        "data:text/csv;charset=utf-8," +
        csvRows.map((e) => e.map((val) => `"${val}"`).join(",")).join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "ClearPortfolio_Entities_Report_FY25-26.csv");
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 select-none">
        <div>
          <h2 className="text-[20px] text-[#0f172a] tracking-tight mb-0.5 font-medium">Entity report</h2>
          <p className="text-[12.5px] text-[#64748b] font-normal leading-normal">
            {summary.totalEntities} entities across 84 clients
          </p>
        </div>

        <div className="flex items-center gap-3">
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

      {/* Summary Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6 select-none">

        {/* Card 1: Total Entities */}
        <div className="bg-white border border-[#eaecf0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-medium text-[#64748b] tracking-wider uppercase block mb-3">Total entities</span>
            <h3 className="text-[34px] font-medium text-[#0f172a] leading-none mb-2 tracking-tight">{summary.totalEntities}</h3>
          </div>
          <div className="h-4" />
        </div>

        {/* Card 2: Discretionary trusts */}
        <div className="bg-white border border-[#eaecf0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-medium text-[#64748b] tracking-wider uppercase block mb-3">Discretionary trusts</span>
            <h3 className="text-[34px] font-medium text-[#0f172a] leading-none mb-2 tracking-tight">{summary.discretionaryTrusts}</h3>
          </div>
          <div className="h-4" />
        </div>

        {/* Card 3: SMSFs */}
        <div className="bg-white border border-[#eaecf0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-medium text-[#64748b] tracking-wider uppercase block mb-3">SMSFs</span>
            <h3 className="text-[34px] font-medium text-[#0f172a] leading-none mb-2 tracking-tight">{summary.smsfs}</h3>
          </div>
          <div className="h-4" />
        </div>

        {/* Card 4: Companies (Pty Ltd) */}
        <div className="bg-white border border-[#eaecf0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-medium text-[#64748b] tracking-wider uppercase block mb-3">Companies (Pty Ltd)</span>
            <h3 className="text-[34px] font-medium text-[#0f172a] leading-none mb-2 tracking-tight">{summary.companies}</h3>
          </div>
          <div className="h-4" />
        </div>

      </div>

      {/* Entities Table Container */}
      <div className="w-full">
        {/* Table Card */}
        <div className="bg-white border border-[#eaecf0] rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#eaecf0] bg-white select-none">
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">ENTITY NAME</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">TYPE</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">CLIENT</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">ACCOUNTANT</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">PROPERTIES LINKED</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">OWNERSHIP %</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">TRANSACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {entitiesList.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition">

                    {/* Entity Name cell */}
                    <td className="py-3.5 px-6 text-[13.5px] font-medium text-[#0f172a] whitespace-nowrap">
                      {item.name}
                    </td>

                    {/* Type badge cell */}
                    <td className="py-3.5 px-6 whitespace-nowrap select-none">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${item.typeClass}`}>
                        {item.type}
                      </span>
                    </td>

                    {/* Client cell */}
                    <td className="py-3.5 px-6 text-[13px] text-[#475569] whitespace-nowrap">
                      {item.client}
                    </td>

                    {/* Accountant cell */}
                    <td className="py-3.5 px-6 text-[13px] text-[#475569] whitespace-nowrap">
                      {item.accountant}
                    </td>

                    {/* Properties Linked cell */}
                    <td className="py-3.5 px-6 text-[13px] text-[#475569] font-normal whitespace-nowrap">
                      {item.propertiesLinked}
                    </td>

                    {/* Ownership % cell */}
                    <td className="py-3.5 px-6 text-[13px] text-[#0f172a] font-semibold whitespace-nowrap">
                      {item.ownership}
                    </td>

                    {/* Transactions count cell */}
                    <td className="py-3.5 px-6 text-[13px] text-[#475569] font-normal whitespace-nowrap">
                      {item.transactions}
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
