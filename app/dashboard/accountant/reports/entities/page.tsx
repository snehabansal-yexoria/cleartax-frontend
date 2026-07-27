"use client";

import React, { useEffect, useState } from "react";
import { fetchReportEntities, type ReportEntity } from "../reportsApi";
import ReportPageShell from "@/app/components/ReportPageShell";
import { useReportPeriod } from "../useReportPeriod";

export default function EntitiesReport() {
  const {
    selectedPeriod,
    setSelectedPeriod,
    fromDate,
    toDate,
    setCustomRange,
    isLoaded,
  } = useReportPeriod();
  const [filteredEntities, setFilteredEntities] = useState<ReportEntity[]>([]);

  useEffect(() => {
    if (!isLoaded) return;
    let active = true;
    const opts = { from: fromDate, to: toDate };
    fetchReportEntities(selectedPeriod, opts)
      .then((data) => {
        if (active) setFilteredEntities(data);
      })
      .catch(() => {
        if (active) setFilteredEntities([]);
      });
    return () => {
      active = false;
    };
  }, [selectedPeriod, fromDate, toDate, isLoaded]);

  // Counter calculations
  const addedCount = filteredEntities.filter((e) => e.action === "Added").length;
  const editedCount = filteredEntities.filter((e) => e.action === "Edited").length;
  const deletedCount = filteredEntities.filter((e) => e.action === "Deleted").length;

  return (
    <ReportPageShell
      title="Entities"
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <line x1="9" y1="9" x2="15" y2="9" />
          <line x1="9" y1="13" x2="15" y2="13" />
        </svg>
      }
      iconBgClass="bg-indigo-50 text-indigo-600 border-indigo-100/50"
      totalRecords={filteredEntities.length}
      selectedPeriod={selectedPeriod}
      setSelectedPeriod={setSelectedPeriod}
      addedCount={addedCount}
      editedCount={editedCount}
      deletedCount={deletedCount}
      fromDate={fromDate}
      toDate={toDate}
      onCustomRangeChange={setCustomRange}
    >
      {/* All Entities Table */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm overflow-hidden">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-slate-900">All Entities</h2>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            {filteredEntities.length} records
          </span>
        </div>

        <div className="overflow-x-auto -mx-6">
          <table className="w-full border-collapse text-left text-xs text-slate-500">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider w-32">Action</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider">Client</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider">Entity</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider">Type</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider">Change</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-medium">
              {filteredEntities.map((ent, idx) => (
                <tr key={idx} className="hover:bg-slate-50/20">
                  {/* Action Badge */}
                  <td className="py-3.5 px-6">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                        ent.action === "Added"
                          ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                          : ent.action === "Edited"
                          ? "bg-blue-50 text-blue-600 border-blue-100"
                          : "bg-rose-50 text-rose-600 border-rose-100"
                      }`}
                    >
                      {ent.action === "Added" ? "+ Added" : ent.action === "Edited" ? "✎ Edited" : "🗑 Deleted"}
                    </span>
                  </td>

                  {/* Client Initials & Name */}
                  <td className="py-3.5 px-6 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center border border-slate-200">
                      {ent.clientInitials}
                    </div>
                    <span className="font-bold text-slate-700">{ent.clientName}</span>
                  </td>

                  {/* Entity Name and ID */}
                  <td className="py-3.5 px-6 font-bold text-slate-800">
                    {ent.entityName}{" "}
                    <span className="text-[10px] text-slate-400 font-bold ml-1">#{ent.id}</span>
                  </td>

                  {/* Entity Type Badge */}
                  <td className="py-3.5 px-6">
                    <span className="inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold border bg-purple-50 text-purple-600 border-purple-100">
                      {ent.type}
                    </span>
                  </td>

                  {/* Change details */}
                  <td className="py-3.5 px-6 font-semibold text-slate-600">
                    {ent.change.includes("→") ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="line-through text-rose-400 font-bold">90%</span>
                        <span className="text-slate-400 font-bold">→</span>
                        <span className="text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-lg font-black">
                          100%
                        </span>
                      </div>
                    ) : (
                      <span>{ent.change}</span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-6 text-right text-slate-400">{ent.date}</td>
                </tr>
              ))}
              {filteredEntities.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-semibold">
                    No entities recorded in this period.
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
