"use client";

import React, { useState } from "react";
import Link from "next/link";

// ============================================================================
// Types & Interfaces
// ============================================================================

interface ChangeToken {
  type: string;
  text: string;
}

interface ActivityRow {
  timestamp: string;
  action: string;
  actionClass: string;
  doneByInitials: string;
  doneByAvatarBg: string;
  doneByName: string;
  client: string;
  record: string;
  changes: ChangeToken[];
}

// ============================================================================
// Baseline Mock Data Matching the Image
// ============================================================================

const DEFAULT_ACTIVITIES: ActivityRow[] = [
  {
    timestamp: "Jun 10, 11:47",
    action: "Edited property",
    actionClass: "bg-[#e0f2fe] text-[#0369a1]",
    doneByInitials: "SN",
    doneByAvatarBg: "bg-[#e8f5e9] text-[#2e7d32]",
    doneByName: "Satnam Singh",
    client: "Sneha Bansal",
    record: "12 Maple St · #PROP-0091",
    changes: [
      { type: "label", text: "Status: " },
      { type: "old", text: "Vacant" },
      { type: "arrow", text: " → " },
      { type: "new", text: "Rented" },
      { type: "separator", text: " · " },
      { type: "label", text: "Value: " },
      { type: "old", text: "$820K" },
      { type: "arrow", text: " → " },
      { type: "new", text: "$850K" },
    ],
  },
  {
    timestamp: "Jun 10, 09:14",
    action: "Added property",
    actionClass: "bg-[#e2f0d9] text-[#385723]",
    doneByInitials: "AK",
    doneByAvatarBg: "bg-[#e0f7fa] text-[#006064]",
    doneByName: "Akash Sharma",
    client: "Sneha Bansal",
    record: "12 Maple St · #PROP-0091",
    changes: [
      { type: "plain", text: "New: Residential · Vacant · $820K · Depreciation: Yes" },
    ],
  },
  {
    timestamp: "Jun 9, 15:22",
    action: "Added transaction",
    actionClass: "bg-[#e2f0d9] text-[#385723]",
    doneByInitials: "SN",
    doneByAvatarBg: "bg-[#e8f5e9] text-[#2e7d32]",
    doneByName: "Satnam Singh",
    client: "Raj Patel",
    record: "4 Park Ave · #TXN-1842",
    changes: [
      { type: "plain", text: "New: Expense · Maintenance · $850" },
    ],
  },
  {
    timestamp: "Jun 9, 14:08",
    action: "Edited transaction",
    actionClass: "bg-[#e0f2fe] text-[#0369a1]",
    doneByInitials: "PR",
    doneByAvatarBg: "bg-[#faf5ff] text-[#6b21a8]",
    doneByName: "Priya Rajan",
    client: "Li Chen",
    record: "#TXN-1801",
    changes: [
      { type: "label", text: "Category: " },
      { type: "old", text: "Unclassified" },
      { type: "arrow", text: " → " },
      { type: "new-highlight", text: "Rental income" },
    ],
  },
  {
    timestamp: "Jun 8, 10:31",
    action: "Deleted entity",
    actionClass: "bg-[#fce4d6] text-[#c65911]",
    doneByInitials: "AK",
    doneByAvatarBg: "bg-[#e0f7fa] text-[#006064]",
    doneByName: "Akash Sharma",
    client: "Mark Williams",
    record: "Old Partnership · #ENT-0014",
    changes: [
      { type: "plain", text: "Deleted partnership entity — full snapshot retained" },
    ],
  },
  {
    timestamp: "Jun 8, 09:02",
    action: "Ownership updated",
    actionClass: "bg-[#e0f2fe] text-[#0369a1]",
    doneByInitials: "SN",
    doneByAvatarBg: "bg-[#e8f5e9] text-[#2e7d32]",
    doneByName: "Satnam Singh",
    client: "Raj Patel",
    record: "Patel SMSF · #ENT-0007",
    changes: [
      { type: "label", text: "Ownership: " },
      { type: "old", text: "60%" },
      { type: "arrow", text: " → " },
      { type: "new", text: "100%" },
    ],
  },
  {
    timestamp: "Jun 7, 16:45",
    action: "Category added",
    actionClass: "bg-[#faf5ff] text-[#6b21a8]",
    doneByInitials: "AD",
    doneByAvatarBg: "bg-[#eef2ff] text-[#4f46e5]",
    doneByName: "Admin User",
    client: "Org-wide",
    record: "Transaction category",
    changes: [
      { type: "plain", text: "Added new category: \"Land tax\"" },
    ],
  },
];

// ============================================================================
// Helper Functions & Dropdown Component
// ============================================================================

const parseActivityDate = (timestampStr: string): Date | null => {
  try {
    const parts = timestampStr.split(",");
    if (parts.length < 2) return null;
    const dateParts = parts[0].trim().split(" ");
    const monthStr = dateParts[0];
    const day = parseInt(dateParts[1], 10);
    
    const months: { [key: string]: number } = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };
    const month = months[monthStr];
    if (month === undefined || isNaN(day)) return null;
    
    const timeParts = parts[1].trim().split(":");
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    
    return new Date(2026, month, day, hours, minutes);
  } catch (e) {
    return null;
  }
};

function CustomDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string;
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100 focus:border-slate-400 flex items-center gap-2.5 transition cursor-pointer select-none"
      >
        <span className="truncate">{selected}</span>
        <svg
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 z-30 mt-1 min-w-full w-max max-w-[280px] bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto py-1 animate-in fade-in slide-in-from-top-1 duration-100">
          {options.map((option) => {
            const isSelected = option === selected;
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-[13px] hover:bg-slate-50 flex items-center justify-between transition cursor-pointer ${
                  isSelected ? "text-slate-900 font-semibold bg-slate-50/70" : "text-slate-600"
                }`}
              >
                <span className="truncate">{option}</span>
                {isSelected && (
                  <svg className="w-3.5 h-3.5 text-slate-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AuditTrailReportPage() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Draft Filter States (modified by dropdowns/inputs)
  const [draftAccountant, setDraftAccountant] = useState("All accountants");
  const [draftClient, setDraftClient] = useState("All clients");
  const [draftAction, setDraftAction] = useState("All actions");
  const [draftStartDate, setDraftStartDate] = useState("");
  const [draftEndDate, setDraftEndDate] = useState("");

  // Applied Filter States (actually filters the table)
  const [appliedAccountant, setAppliedAccountant] = useState("All accountants");
  const [appliedClient, setAppliedClient] = useState("All clients");
  const [appliedAction, setAppliedAction] = useState("All actions");
  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState("");

  // Trigger Toast Notification Helper
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Derive unique drop down options dynamically from data
  const accountants = ["All accountants", ...Array.from(new Set(DEFAULT_ACTIVITIES.map(a => a.doneByName)))];
  const clients = ["All clients", ...Array.from(new Set(DEFAULT_ACTIVITIES.map(a => a.client)))];
  const actions = ["All actions", ...Array.from(new Set(DEFAULT_ACTIVITIES.map(a => a.action)))];

  // Dynamic filter application based on APPLIED states
  const filteredActivities = DEFAULT_ACTIVITIES.filter((activity) => {
    if (appliedAccountant !== "All accountants" && activity.doneByName !== appliedAccountant) {
      return false;
    }
    if (appliedClient !== "All clients" && activity.client !== appliedClient) {
      return false;
    }
    if (appliedAction !== "All actions" && activity.action !== appliedAction) {
      return false;
    }
    
    if (appliedStartDate) {
      const actDate = parseActivityDate(activity.timestamp);
      if (actDate) {
        const start = new Date(appliedStartDate);
        start.setHours(0, 0, 0, 0);
        if (actDate < start) return false;
      }
    }
    
    if (appliedEndDate) {
      const actDate = parseActivityDate(activity.timestamp);
      if (actDate) {
        const end = new Date(appliedEndDate);
        end.setHours(23, 59, 59, 999);
        if (actDate > end) return false;
      }
    }
    
    return true;
  });

  const hasActiveFilters =
    appliedAccountant !== "All accountants" ||
    appliedClient !== "All clients" ||
    appliedAction !== "All actions" ||
    appliedStartDate !== "" ||
    appliedEndDate !== "";

  const hasChanges =
    draftAccountant !== appliedAccountant ||
    draftClient !== appliedClient ||
    draftAction !== appliedAction ||
    draftStartDate !== appliedStartDate ||
    draftEndDate !== appliedEndDate;

  const handleApplyFilters = () => {
    setAppliedAccountant(draftAccountant);
    setAppliedClient(draftClient);
    setAppliedAction(draftAction);
    setAppliedStartDate(draftStartDate);
    setAppliedEndDate(draftEndDate);
    showToast("Filters applied successfully.");
  };

  const handleResetFilters = () => {
    setDraftAccountant("All accountants");
    setDraftClient("All clients");
    setDraftAction("All actions");
    setDraftStartDate("");
    setDraftEndDate("");
    
    setAppliedAccountant("All accountants");
    setAppliedClient("All clients");
    setAppliedAction("All actions");
    setAppliedStartDate("");
    setAppliedEndDate("");
    
    showToast("Cleared all active activity log filters.");
  };

  // CSV Export Trigger
  const handleExportCSV = () => {
    showToast("Generating audit trail spreadsheet...");

    setTimeout(() => {
      const csvRows = [
        ["ClearPortfolio - Audit Trail Activity Log", "Period: Full log"],
        [],
        ["AUDIT LOGS"],
        ["Timestamp", "Action", "Done By", "Client", "Record", "Changes Details"],
        ...filteredActivities.map((item) => [
          item.timestamp,
          item.action,
          item.doneByName,
          item.client,
          item.record,
          item.changes.map((c) => c.text).join(""),
        ]),
      ];

      const csvContent =
        "data:text/csv;charset=utf-8," +
        csvRows.map((e) => e.map((val) => `"${val}"`).join(",")).join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "ClearPortfolio_AuditTrail_Report.csv");
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
          <h2 className="text-[20px] text-[#0f172a] tracking-tight mb-0.5 font-medium">Audit trail</h2>
          <p className="text-[12.5px] text-[#64748b] font-normal leading-normal">
            Full activity log across the organisation
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

      {/* Inline Filters Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm flex flex-wrap gap-4 items-center select-none">
        <CustomDropdown
          label="Accountants"
          options={accountants}
          selected={draftAccountant}
          onChange={setDraftAccountant}
        />
        <CustomDropdown
          label="Clients"
          options={clients}
          selected={draftClient}
          onChange={setDraftClient}
        />
        <CustomDropdown
          label="Actions"
          options={actions}
          selected={draftAction}
          onChange={setDraftAction}
        />
        
        {/* Date Inputs */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg h-9 px-3 hover:border-slate-300 transition-colors">
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <input
            type="date"
            placeholder="From Date"
            className="bg-transparent border-none p-0 text-[13px] text-slate-700 focus:ring-0 focus:outline-none w-[115px] text-center cursor-pointer"
            value={draftStartDate}
            onChange={(e) => setDraftStartDate(e.target.value)}
          />
          <span className="text-[12px] text-slate-400 font-medium px-1">to</span>
          <input
            type="date"
            placeholder="To Date"
            className="bg-transparent border-none p-0 text-[13px] text-slate-700 focus:ring-0 focus:outline-none w-[115px] text-center cursor-pointer"
            value={draftEndDate}
            onChange={(e) => setDraftEndDate(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="h-9 px-3 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg text-[13px] font-medium transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear filters
            </button>
          )}
          <button
            onClick={handleApplyFilters}
            disabled={!hasChanges}
            className="h-9 px-4 bg-[#0f172a] hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-medium text-[13px] rounded-lg transition-colors cursor-pointer"
          >
            Apply filters
          </button>
        </div>
      </div>

      {/* Activities Table Container */}
      <div className="w-full">
        {/* Table Card */}
        <div className="bg-white border border-[#eaecf0] rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#eaecf0] bg-white select-none">
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">TIMESTAMP</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">ACTION</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">DONE BY</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">ON CLIENT</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">RECORD</th>
                  <th className="py-4 px-6 text-[10.5px] font-semibold text-[#64748b] tracking-wider uppercase">CHANGES (BEFORE → AFTER)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {filteredActivities.length > 0 ? (
                  filteredActivities.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition">
                      
                      {/* Timestamp cell */}
                      <td className="py-3.5 px-6 text-[13px] text-[#475569] whitespace-nowrap">
                        {item.timestamp}
                      </td>

                      {/* Action badge cell */}
                      <td className="py-3.5 px-6 whitespace-nowrap select-none">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${item.actionClass}`}>
                          {item.action}
                        </span>
                      </td>

                      {/* Done by avatar + name cell */}
                      <td className="py-3.5 px-6 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-semibold text-[10px] select-none ${item.doneByAvatarBg}`}>
                            {item.doneByInitials}
                          </div>
                          <span className="text-[13px] font-normal text-[#0f172a]">{item.doneByName}</span>
                        </div>
                      </td>

                      {/* Client cell */}
                      <td className="py-3.5 px-6 text-[13px] text-[#475569] whitespace-nowrap">
                        {item.client}
                      </td>

                      {/* Record cell */}
                      <td className="py-3.5 px-6 text-[13px] text-[#475569] whitespace-nowrap">
                        {item.record}
                      </td>

                      {/* Changes detailed cell */}
                      <td className="py-3.5 px-6 text-[13px] text-[#475569] whitespace-normal max-w-sm">
                        <div className="flex flex-wrap items-center">
                          {item.changes.map((token, tIdx) => {
                            if (token.type === "old") {
                              return <span key={tIdx} className="font-medium text-slate-600 line-through decoration-slate-300">{token.text}</span>;
                            }
                            if (token.type === "new") {
                              return <span key={tIdx} className="font-semibold text-slate-800">{token.text}</span>;
                            }
                            if (token.type === "new-highlight") {
                              return <span key={tIdx} className="font-semibold text-slate-900 underline decoration-indigo-400">{token.text}</span>;
                            }
                            if (token.type === "label") {
                              return <span key={tIdx} className="text-slate-400 mr-0.5">{token.text}</span>;
                            }
                            if (token.type === "arrow") {
                              return <span key={tIdx} className="text-slate-300 px-1 font-bold">{token.text}</span>;
                            }
                            if (token.type === "separator") {
                              return <span key={tIdx} className="text-slate-300 px-1.5">{token.text}</span>;
                            }
                            return <span key={tIdx} className="text-slate-600">{token.text}</span>;
                          })}
                        </div>
                      </td>

                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 text-[13px]">
                      No activities match the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
