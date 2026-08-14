"use client";

import React, { useState } from "react";
import Link from "next/link";

// ============================================================================
// Types & Interfaces
// ============================================================================

interface PropertyTypeItem {
  type: string;
  amount: string;
  countText: string;
}

interface OwnershipStructureItem {
  label: string;
  countText: string;
  percentText: string;
  isAverage?: boolean;
}

// ============================================================================
// Baseline Mock Data Matching the Image
// ============================================================================

const DEFAULT_PROPERTY_TYPES: PropertyTypeItem[] = [
  { type: "Residential", amount: "$61.4M", countText: "142 properties" },
  { type: "Commercial", amount: "$22.8M", countText: "38 properties" },
  { type: "Vacant land", amount: "$6.1M", countText: "24 properties" },
  { type: "Under construction", amount: "$3.9M", countText: "14 properties" },
];

const DEFAULT_OWNERSHIP_STRUCTURE: OwnershipStructureItem[] = [
  { label: "Sole ownership", countText: "88 properties", percentText: "" },
  { label: "Linked to trust", countText: "94", percentText: "43%" },
  { label: "Linked to SMSF", countText: "42", percentText: "19%" },
  { label: "Avg owners per property", countText: "1.8", percentText: "", isAverage: true },
];

// ============================================================================
// Main Component
// ============================================================================

export default function PropertiesReportPage() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dynamic State Hooks
  const [summary, setSummary] = useState({
    totalProperties: "218",
    totalMarketValue: "$94.2M",
    withDepreciationCount: "134",
    withDepreciationPercentText: "61% of all",
    coOwnedCount: "130",
    coOwnedText: "Multiple owners",
  });
  const [byPropertyType, setByPropertyType] = useState<PropertyTypeItem[]>(DEFAULT_PROPERTY_TYPES);
  const [ownershipStructure, setOwnershipStructure] = useState<OwnershipStructureItem[]>(DEFAULT_OWNERSHIP_STRUCTURE);

  // Trigger Toast Notification Helper
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };



  // CSV Export Trigger
  const handleExportCSV = () => {
    showToast("Generating properties report spreadsheet...");

    setTimeout(() => {
      const csvRows = [
        ["ClearPortfolio - Properties Report Summary", "Period: FY 2025-26"],
        ["Total Properties", summary.totalProperties],
        ["Total Market Value", summary.totalMarketValue],
        ["With Depreciation", `${summary.withDepreciationCount} (${summary.withDepreciationPercentText})`],
        ["Co-owned", `${summary.coOwnedCount} (${summary.coOwnedText})`],
        [],
        ["BY PROPERTY TYPE"],
        ["Property Type", "Market Value", "Volume"],
        ...byPropertyType.map((item) => [item.type, item.amount, item.countText]),
        [],
        ["OWNERSHIP STRUCTURE"],
        ["Ownership Category", "Value/Count", "Percentage"],
        ...ownershipStructure.map((item) => [item.label, item.countText, item.percentText || "—"]),
      ];

      const csvContent =
        "data:text/csv;charset=utf-8," +
        csvRows.map((e) => e.map((val) => `"${val}"`).join(",")).join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "ClearPortfolio_Properties_Report_FY25-26.csv");
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
          <h2 className="text-[20px] text-[#0f172a] tracking-tight mb-0.5 font-medium">Property report</h2>
          <p className="text-[12.5px] text-[#64748b] font-normal leading-normal">
            {summary.totalProperties} properties across 84 clients
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

        {/* Card 1: Total Properties */}
        <div className="bg-white border border-[#eaecf0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-medium text-[#64748b] tracking-wider uppercase block mb-3">Total properties</span>
            <h3 className="text-[34px] font-medium text-[#0f172a] leading-none mb-2 tracking-tight">{summary.totalProperties}</h3>
          </div>
          <div className="h-4" />
        </div>

        {/* Card 2: Total Market Value */}
        <div className="bg-white border border-[#eaecf0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-medium text-[#64748b] tracking-wider uppercase block mb-3">Total market value</span>
            <h3 className="text-[34px] font-medium text-[#0f172a] leading-none mb-2 tracking-tight">{summary.totalMarketValue}</h3>
          </div>
          <div className="h-4" />
        </div>

        {/* Card 3: With Depreciation */}
        <div className="bg-white border border-[#eaecf0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-medium text-[#64748b] tracking-wider uppercase block mb-3">With depreciation</span>
            <h3 className="text-[34px] font-medium text-[#0f172a] leading-none mb-2 tracking-tight">{summary.withDepreciationCount}</h3>
          </div>
          <span className="text-[12.5px] text-[#64748b] font-normal">{summary.withDepreciationPercentText}</span>
        </div>

        {/* Card 4: Co-owned */}
        <div className="bg-white border border-[#eaecf0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-medium text-[#64748b] tracking-wider uppercase block mb-3">Co-owned</span>
            <h3 className="text-[34px] font-medium text-[#0f172a] leading-none mb-2 tracking-tight">{summary.coOwnedCount}</h3>
          </div>
          <span className="text-[12.5px] text-[#64748b] font-normal">{summary.coOwnedText}</span>
        </div>

      </div>

      {/* Main Breakdown Cards Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 select-none">

        {/* Left Side: By Property Type Card */}
        <div className="bg-white border border-[#eaecf0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div className="w-full">
            <h3 className="text-[15px] font-semibold text-[#0f172a] mb-6">By property type</h3>

            <div className="space-y-4">
              {byPropertyType.map((item) => (
                <div key={item.type} className="flex justify-between items-center py-1">
                  <span className="text-[13.5px] text-[#475569] font-normal">{item.type}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] text-[#0f172a] font-semibold">{item.amount}</span>
                    <span className="text-[12.5px] text-[#94a3b8] font-normal">{item.countText}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Ownership Structure Card */}
        <div className="bg-white border border-[#eaecf0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div className="w-full">
            <h3 className="text-[15px] font-semibold text-[#0f172a] mb-6">Ownership structure</h3>

            <div className="space-y-4">
              {ownershipStructure.map((item) => (
                <div key={item.label} className="flex justify-between items-center py-1">
                  <span className="text-[13.5px] text-[#475569] font-normal">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] text-[#0f172a] font-semibold">{item.countText}</span>
                    {item.percentText && (
                      <span className="text-[12.5px] text-[#94a3b8] font-normal">{item.percentText}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
