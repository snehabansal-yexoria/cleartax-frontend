"use client";

import React, { useEffect, useState } from "react";
import { fetchReportProperties, type ReportProperty } from "../reportsApi";
import ReportPageShell from "@/app/components/ReportPageShell";

export default function PropertiesReport() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("Today");
  const [filteredProperties, setFilteredProperties] = useState<ReportProperty[]>([]);

  useEffect(() => {
    let active = true;
    fetchReportProperties(selectedPeriod)
      .then((data) => {
        if (active) setFilteredProperties(data);
      })
      .catch(() => {
        if (active) setFilteredProperties([]);
      });
    return () => {
      active = false;
    };
  }, [selectedPeriod]);

  // Counter calculations for cards
  const addedCount = filteredProperties.filter((p) => p.action === "Added").length;
  const editedCount = filteredProperties.filter((p) => p.action === "Edited").length;
  const deletedCount = filteredProperties.filter((p) => p.action === "Deleted").length;

  return (
    <ReportPageShell
      title="Properties"
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      }
      iconBgClass="bg-amber-50 text-amber-500 border-amber-100/50"
      totalRecords={filteredProperties.length}
      selectedPeriod={selectedPeriod}
      setSelectedPeriod={setSelectedPeriod}
      addedCount={addedCount}
      editedCount={editedCount}
      deletedCount={deletedCount}
    >
      {/* All Properties Table */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm overflow-hidden">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-slate-900">All Properties</h2>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            {filteredProperties.length} records
          </span>
        </div>

        <div className="overflow-x-auto -mx-6">
          <table className="w-full border-collapse text-left text-xs text-slate-500">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider w-32">Action</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider">Client</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider">Property</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider">Type</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider">Change</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-medium">
              {filteredProperties.map((prop, idx) => (
                <tr key={idx} className="hover:bg-slate-50/20">
                  {/* Action Badge */}
                  <td className="py-3.5 px-6">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                        prop.action === "Added"
                          ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                          : prop.action === "Edited"
                          ? "bg-blue-50 text-blue-600 border-blue-100"
                          : "bg-rose-50 text-rose-600 border-rose-100"
                      }`}
                    >
                      {prop.action === "Added" ? "+ Added" : prop.action === "Edited" ? "✎ Edited" : "🗑 Deleted"}
                    </span>
                  </td>

                  {/* Client Initials & Name */}
                  <td className="py-3.5 px-6 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center border border-slate-200">
                      {prop.clientInitials}
                    </div>
                    <span className="font-bold text-slate-700">{prop.clientName}</span>
                  </td>

                  {/* Property Name and ID */}
                  <td className="py-3.5 px-6 font-bold text-slate-800">
                    {prop.property}{" "}
                    <span className="text-[10px] text-slate-400 font-bold ml-1">#{prop.id}</span>
                  </td>

                  {/* Property Type Badge */}
                  <td className="py-3.5 px-6">
                    <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] border border-slate-200 font-semibold">
                      {prop.type}
                    </span>
                  </td>

                  {/* Change details */}
                  <td className="py-3.5 px-6 font-semibold text-slate-600">
                    {prop.change.includes("→") ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {prop.change.includes("Vacant") ? (
                          <>
                            <span className="line-through text-rose-400">Vacant ~ $820K</span>
                            <span className="text-slate-400">→</span>
                            <span className="text-emerald-500 font-bold bg-emerald-50/50 border border-emerald-100/50 px-1.5 py-0.5 rounded-lg">
                              Rented · $850K
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="line-through text-rose-400">$1.35M</span>
                            <span className="text-slate-400">→</span>
                            <span className="text-emerald-500 font-bold bg-emerald-50/50 border border-emerald-100/50 px-1.5 py-0.5 rounded-lg">
                              $1.40M
                            </span>
                          </>
                        )}
                      </div>
                    ) : (
                      <span>{prop.change}</span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-6 text-right text-slate-400">{prop.date}</td>
                </tr>
              ))}
              {filteredProperties.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-semibold">
                    No properties recorded in this period.
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
