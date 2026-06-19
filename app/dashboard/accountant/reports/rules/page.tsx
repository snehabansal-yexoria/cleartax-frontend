"use client";

import React, { useEffect, useState } from "react";
import { fetchReportRules, type ReportRule } from "../reportsApi";
import ReportPageShell from "@/app/components/ReportPageShell";

export default function RulesReport() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("Today");
  const [filteredRules, setFilteredRules] = useState<ReportRule[]>([]);

  useEffect(() => {
    let active = true;
    fetchReportRules(selectedPeriod)
      .then((data) => {
        if (active) setFilteredRules(data);
      })
      .catch(() => {
        if (active) setFilteredRules([]);
      });
    return () => {
      active = false;
    };
  }, [selectedPeriod]);

  // Counter calculations
  const addedCount = filteredRules.filter((r) => r.action === "Added").length;
  const editedCount = filteredRules.filter((r) => r.action === "Edited").length;
  const deletedCount = filteredRules.filter((r) => r.action === "Deleted").length;

  return (
    <ReportPageShell
      title="Rules"
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      }
      iconBgClass="bg-slate-100 text-slate-600 border-slate-200/50"
      totalRecords={filteredRules.length}
      selectedPeriod={selectedPeriod}
      setSelectedPeriod={setSelectedPeriod}
      addedCount={addedCount}
      editedCount={editedCount}
      deletedCount={deletedCount}
    >
      {/* All Rules Table */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm overflow-hidden">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-slate-900">All Rules</h2>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            {filteredRules.length} records
          </span>
        </div>

        <div className="overflow-x-auto -mx-6">
          <table className="w-full border-collapse text-left text-xs text-slate-500">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider w-32">Action</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider">Client</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider">Rule</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider">Change</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-medium">
              {filteredRules.map((rule, idx) => (
                <tr key={idx} className="hover:bg-slate-50/20">
                  {/* Action Badge */}
                  <td className="py-3.5 px-6">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                        rule.action === "Added"
                          ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                          : rule.action === "Edited"
                          ? "bg-blue-50 text-blue-600 border-blue-100"
                          : "bg-rose-50 text-rose-600 border-rose-100"
                      }`}
                    >
                      {rule.action === "Added" ? "+ Added" : rule.action === "Edited" ? "✎ Edited" : "🗑 Deleted"}
                    </span>
                  </td>

                  {/* Client Initials & Name */}
                  <td className="py-3.5 px-6 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center border border-slate-200">
                      {rule.clientInitials}
                    </div>
                    <span className="font-bold text-slate-700">{rule.clientName}</span>
                  </td>

                  {/* Rule Title and ID */}
                  <td className="py-3.5 px-6 font-bold text-slate-800">
                    {rule.ruleName}{" "}
                    <span className="text-[10px] text-slate-400 font-bold ml-1">#{rule.id}</span>
                  </td>

                  {/* Change details */}
                  <td className="py-3.5 px-6 font-semibold text-slate-600">
                    {rule.change.includes("→") ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-rose-500 font-bold line-through">Matches "AGL"</span>
                        <span className="text-slate-400">→</span>
                        <span className="text-emerald-600 font-extrabold bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-lg">
                          Matches "AGL" or "Origin Energy"
                        </span>
                      </div>
                    ) : (
                      <span>{rule.change}</span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-6 text-right text-slate-400">{rule.date}</td>
                </tr>
              ))}
              {filteredRules.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-semibold">
                    No rules recorded in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ReportPageShell>
  );
}
