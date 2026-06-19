"use client";

import React, { useState } from "react";
import Link from "next/link";
import { mockDocuments, filterDataByPeriod } from "../mockData";
import ReportPageShell from "@/app/components/ReportPageShell";

export default function DocumentsReport() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("Today");

  // Dynamic filtering of documents based on selected period
  const filteredDocuments = filterDataByPeriod(mockDocuments, selectedPeriod);

  // Counter calculations
  const addedCount = filteredDocuments.filter((d) => d.action === "Added").length;
  const editedCount = filteredDocuments.filter((d) => d.action === "Edited").length;
  const deletedCount = filteredDocuments.filter((d) => d.action === "Deleted").length;

  return (
    <ReportPageShell
      title="Documents"
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      }
      iconBgClass="bg-emerald-50 text-emerald-600 border-emerald-100/50"
      totalRecords={filteredDocuments.length}
      selectedPeriod={selectedPeriod}
      setSelectedPeriod={setSelectedPeriod}
      addedCount={addedCount}
      editedCount={editedCount}
      deletedCount={deletedCount}
    >
      {/* All Documents Table */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm overflow-hidden">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-slate-900">All Documents</h2>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            {filteredDocuments.length} records
          </span>
        </div>

        <div className="overflow-x-auto -mx-6">
          <table className="w-full border-collapse text-left text-xs text-slate-500">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider w-32">Action</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider">Client</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider">Document</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider">Type</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider">Size</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-medium">
              {filteredDocuments.map((doc, idx) => (
                <tr key={idx} className="hover:bg-slate-50/20">
                  {/* Action Badge */}
                  <td className="py-3.5 px-6">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                        doc.action === "Added"
                          ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                          : doc.action === "Edited"
                          ? "bg-blue-50 text-blue-600 border-blue-100"
                          : "bg-rose-50 text-rose-600 border-rose-100"
                      }`}
                    >
                      {doc.action === "Added" ? "+ Added" : doc.action === "Edited" ? "✎ Edited" : "🗑 Deleted"}
                    </span>
                  </td>

                  {/* Client Initials & Name */}
                  <td className="py-3.5 px-6 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center border border-slate-200">
                      {doc.clientInitials}
                    </div>
                    <span className="font-bold text-slate-700">{doc.clientName}</span>
                  </td>

                  {/* Document Title */}
                  <td className="py-3.5 px-6 font-bold text-slate-800">
                    {doc.documentName}{" "}
                    <span className="text-[10px] text-slate-400 font-bold ml-1">#{doc.id}</span>
                  </td>

                  {/* Document Type Badge */}
                  <td className="py-3.5 px-6">
                    <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] border border-slate-200 font-semibold">
                      {doc.type}
                    </span>
                  </td>

                  {/* Size details */}
                  <td className="py-3.5 px-6 font-semibold text-slate-600">
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded px-1.5 py-0.5">
                      {doc.size}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-6 text-right text-slate-400">{doc.date}</td>
                </tr>
              ))}
              {filteredDocuments.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-semibold">
                    No documents recorded in this period.
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
