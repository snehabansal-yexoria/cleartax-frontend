"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  fetchReportClients,
  fetchReportSummary,
  type ReportClient,
} from "../reportsApi";

export default function ClientsTouched() {
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState<string>("Today");
  const [clients, setClients] = useState<ReportClient[]>([]);
  const [totalClientsCount, setTotalClientsCount] = useState<number>(0);

  useEffect(() => {
    let active = true;
    fetchReportClients(selectedPeriod)
      .then((data) => {
        if (active) setClients(data);
      })
      .catch(() => {
        if (active) setClients([]);
      });
    fetchReportSummary(selectedPeriod)
      .then((s) => {
        if (active) setTotalClientsCount(s.clientsTotal);
      })
      .catch(() => {
        /* leave denominator unchanged on error */
      });
    return () => {
      active = false;
    };
  }, [selectedPeriod]);

  // The backend returns only clients touched in the selected period.
  const touchedClientsCount = clients.length;

  // Sort by total actions descending
  const sortedClientsTouched = [...clients].sort((a, b) => b.totalActions - a.totalActions);

  // Entity Type Badge Styling Map
  const getBadgeClass = (type: string) => {
    switch (type) {
      case "Discretionary trust":
        return "bg-purple-50 text-purple-600 border-purple-100";
      case "SMSF":
        return "bg-indigo-50 text-indigo-600 border-indigo-100";
      case "Individual":
        return "bg-amber-50 text-amber-600 border-amber-100";
      case "Unit trust":
        return "bg-blue-50 text-blue-600 border-blue-100";
      case "Company (Pty Ltd)":
        return "bg-emerald-50 text-emerald-600 border-emerald-100";
      default:
        return "bg-slate-50 text-slate-600 border-slate-100";
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn max-w-[1400px] mx-auto pb-10">
      {/* Breadcrumb Navigation */}
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

      {/* Header and Filter Option Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Clients Touched</h1>
          <p className="text-sm text-slate-500 mt-1">
            All clients with activity in the selected period - click a client for full details.
          </p>
        </div>

        {/* Period selection */}
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

      {/* Main Table: All Clients */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm overflow-hidden">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-slate-900">All Clients</h2>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            {touchedClientsCount} of {totalClientsCount} touched in this period
          </span>
        </div>

        <div className="overflow-x-auto -mx-6">
          <table className="w-full border-collapse text-left text-xs text-slate-500">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider">Client</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider">Entity Type</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider text-center">Properties</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider text-center">Entities</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider text-center">Transactions</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider text-center">Total Actions</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider text-right">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-medium">
              {sortedClientsTouched.map((client) => {
                const hasActivity = client.totalActions > 0;
                return (
                  <tr
                    key={client.id}
                    onClick={() => router.push(`/dashboard/accountant/reports/clients/${client.id}`)}
                    className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                  >
                    {/* Client Name with Initials */}
                    <td className="py-4 px-6 flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full font-black flex items-center justify-center ${
                          hasActivity ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {client.initials}
                      </div>
                      <span className={`font-bold ${hasActivity ? "text-slate-800 hover:underline" : "text-slate-400"}`}>
                        {client.name}
                      </span>
                    </td>

                    {/* Entity Type Badge */}
                    <td className="py-4 px-6">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold border ${getBadgeClass(client.entityType)}`}>
                        {client.entityType}
                      </span>
                    </td>

                    {/* Properties Count */}
                    <td className={`py-4 px-6 text-center ${hasActivity ? "text-slate-700 font-bold" : "text-slate-300"}`}>
                      {client.propertiesCount}
                    </td>

                    {/* Entities Count */}
                    <td className={`py-4 px-6 text-center ${hasActivity ? "text-slate-700 font-bold" : "text-slate-300"}`}>
                      {client.entitiesCount}
                    </td>

                    {/* Transactions Count */}
                    <td className={`py-4 px-6 text-center ${hasActivity ? "text-slate-700 font-bold" : "text-slate-300"}`}>
                      {client.transactionsCount}
                    </td>

                    {/* Total Actions */}
                    <td className={`py-4 px-6 text-center ${hasActivity ? "text-slate-700 font-black" : "text-slate-300"}`}>
                      {client.totalActions}
                    </td>

                    {/* Last Activity Date */}
                    <td className={`py-4 px-6 text-right ${hasActivity ? "text-slate-500" : "text-slate-300 font-normal"}`}>
                      {client.lastActivity}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
