"use client";

import React from "react";
import Link from "next/link";

interface ReportPageShellProps {
  title: string;
  icon: React.ReactNode;
  iconBgClass: string;
  totalRecords: number;
  selectedPeriod: string;
  setSelectedPeriod: (period: string) => void;
  addedCount: number;
  editedCount: number;
  deletedCount: number;
  children: React.ReactNode;
}

export default function ReportPageShell({
  title,
  icon,
  iconBgClass,
  totalRecords,
  selectedPeriod,
  setSelectedPeriod,
  addedCount,
  editedCount,
  deletedCount,
  children,
}: ReportPageShellProps) {
  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn max-w-[1400px] mx-auto pb-10">
      {/* Breadcrumb */}
      <div>
        <Link
          href="/dashboard/accountant/reports"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to My Activity
        </Link>
      </div>

      {/* Header and Filter */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm ${iconBgClass}`}>
            {icon}
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {totalRecords} records · {selectedPeriod}
            </p>
          </div>
        </div>

        {/* Date Filter Tabs */}
        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 self-start md:self-auto shadow-sm">
          {["Today", "7 days", "30 days", "3 months"].map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                selectedPeriod === period
                  ? "bg-[#28336e] text-white shadow-md shadow-indigo-900/10"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Counter Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Added Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[100px]">
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Added
          </div>
          <div className="text-3xl font-black text-slate-800 mt-2">{addedCount}</div>
        </div>

        {/* Edited Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[100px]">
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Edited
          </div>
          <div className="text-3xl font-black text-slate-800 mt-2">{editedCount}</div>
        </div>

        {/* Deleted Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[100px]">
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-rose-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            Deleted
          </div>
          <div className="text-3xl font-black text-slate-800 mt-2">{deletedCount}</div>
        </div>
      </div>

      {/* Children Content */}
      {children}
    </div>
  );
}
