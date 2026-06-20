"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  fetchReportClient,
  fetchReportDocuments,
  fetchReportProperties,
  fetchReportTimeline,
  fetchReportTransactions,
  type ReportClient,
  type ReportDocument,
  type ReportProperty,
  type ReportTimelineEvent,
  type ReportTransaction,
} from "../../reportsApi";

interface PageProps {
  params: Promise<{ clientId: string }>;
}

export default function ClientProfileReport({ params }: PageProps) {
  const router = useRouter();
  const { clientId } = use(params);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("Today");

  const [client, setClient] = useState<ReportClient | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [clientTimeline, setClientTimeline] = useState<ReportTimelineEvent[]>([]);
  const [clientProperties, setClientProperties] = useState<ReportProperty[]>([]);
  const [clientTransactions, setClientTransactions] = useState<ReportTransaction[]>([]);
  const [clientDocuments, setClientDocuments] = useState<ReportDocument[]>([]);

  useEffect(() => {
    let active = true;
    fetchReportClient(clientId, selectedPeriod)
      .then((c) => {
        if (!active) return;
        setClient(c);
        setNotFound(false);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setClient(null);
        setNotFound((e as { status?: number }).status === 404);
      });
    fetchReportTimeline(selectedPeriod, { clientId })
      .then((d) => active && setClientTimeline(d))
      .catch(() => active && setClientTimeline([]));
    fetchReportProperties(selectedPeriod, { clientId })
      .then((d) => active && setClientProperties(d))
      .catch(() => active && setClientProperties([]));
    fetchReportTransactions(selectedPeriod, { clientId })
      .then((d) => active && setClientTransactions(d))
      .catch(() => active && setClientTransactions([]));
    fetchReportDocuments(selectedPeriod, { clientId })
      .then((d) => active && setClientDocuments(d))
      .catch(() => active && setClientDocuments([]));
    return () => {
      active = false;
    };
  }, [clientId, selectedPeriod]);

  if (notFound) {
    return (
      <div className="text-center py-12 max-w-md mx-auto">
        <h2 className="text-xl font-bold text-slate-800">Client Not Found</h2>
        <p className="text-sm text-slate-500 mt-2">
          The requested client record does not exist or has no activity in this workspace.
        </p>
        <Link
          href="/dashboard/accountant/reports/clients"
          className="mt-5 inline-flex items-center justify-center bg-[#28336e] text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md hover:bg-[#1b2559]"
        >
          Back to Clients
        </Link>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12 text-sm font-semibold text-slate-400">
        Loading client activity…
      </div>
    );
  }

  // Dynamic statistics for the selected period.
  const propertiesCount = clientProperties.length;
  const transactionsCount = clientTransactions.length;
  const entitiesCount = client.entitiesCount;
  const clientTotalActions = client.totalActions;

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn max-w-[1400px] mx-auto pb-10">
      {/* Breadcrumb Navigation */}
      <div>
        <Link
          href="/dashboard/accountant/reports/clients"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to clients
        </Link>
      </div>

      {/* Main Profile Header with dynamic info */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-4">
          {/* Client Initials Circle */}
          <div className="w-14 h-14 rounded-full bg-indigo-50 text-indigo-600 font-black text-lg flex items-center justify-center border border-indigo-100/50 shadow-sm">
            {client.initials}
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{client.name}</h1>
            <p className="text-xs font-semibold text-slate-500 mt-1 space-x-1.5">
              <span>{client.entityType}</span>
              <span className="text-slate-300">·</span>
              <span>{client.portfolio}</span>
              <span className="text-slate-300">·</span>
              <span>8 properties</span>
              <span className="text-slate-300">·</span>
              <span>4 entities</span>
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

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Your Actions */}
        <div className="bg-gradient-to-br from-[#ebf1ff] to-[#f4f7fe] border border-blue-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[120px]">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Your Actions</span>
              <div className="text-3xl font-black text-slate-900 mt-1">{clientTotalActions}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <svg className="w-5 h-5 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
          </div>
          <span className="text-[10px] text-blue-600/80 font-bold tracking-wide">{selectedPeriod}</span>
        </div>

        {/* Properties Touched */}
        <div className="bg-gradient-to-br from-[#fff7e6] to-[#fffcf5] border border-amber-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[120px]">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Properties Touched</span>
              <div className="text-3xl font-black text-slate-900 mt-1">{propertiesCount}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
              <svg className="w-5 h-5 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
            </div>
          </div>
          <span className="text-[10px] text-amber-600/80 font-bold tracking-wide">of 8 total</span>
        </div>

        {/* Entities Touched */}
        <div className="bg-gradient-to-br from-[#f5ebff] to-[#faf5ff] border border-purple-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[120px]">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Entities Touched</span>
              <div className="text-3xl font-black text-slate-900 mt-1">{entitiesCount}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/20">
              <svg className="w-5 h-5 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24">
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <line x1="9" y1="9" x2="15" y2="9" />
                <line x1="9" y1="13" x2="15" y2="13" />
              </svg>
            </div>
          </div>
          <span className="text-[10px] text-purple-600/80 font-bold tracking-wide">of 4 total</span>
        </div>

        {/* Transactions Touched */}
        <div className="bg-gradient-to-br from-[#e6fbf3] to-[#f4fefb] border border-emerald-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[120px]">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Transactions Touched</span>
              <div className="text-3xl font-black text-slate-900 mt-1">{transactionsCount}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <svg className="w-5 h-5 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24">
                <path d="M17 1H7a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2z" />
                <polyline points="9 10 12 13 15 10" />
              </svg>
            </div>
          </div>
          <span className="text-[10px] text-emerald-600/80 font-bold tracking-wide">{selectedPeriod}</span>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-slate-900">Activity Timeline for {client.name}</h2>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            {clientTimeline.length} events
          </span>
        </div>

        {clientTimeline.length > 0 ? (
          <div className="relative border-l border-slate-100 ml-4 space-y-6">
            {clientTimeline.map((event) => {
              let dotColor = "bg-blue-500";
              if (event.type === "added") dotColor = "bg-emerald-500";
              if (event.type === "deleted") dotColor = "bg-rose-500";

              return (
                <div key={event.id} className="relative pl-6 group">
                  <div
                    className={`absolute -left-[6px] top-1.5 w-3 h-3 rounded-full ring-4 ring-white ${dotColor} transition-transform group-hover:scale-125 duration-200`}
                  />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div>
                      <span className="text-xs font-black text-slate-800">{event.action}</span>
                      <p className="text-xs text-slate-500 font-medium mt-1">{event.detail}</p>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 sm:self-start mt-0.5">{event.time}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-xs font-semibold text-slate-400">
            No recent activity updates listed for this client.
          </div>
        )}
      </div>

      {/* Properties Section */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 text-amber-500">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-slate-800">Properties</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-semibold">{propertiesCount} changes</span>
            <Link
              href="/dashboard/accountant/reports/properties"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-0.5 group/lnk"
            >
              View all properties
              <span className="transition-transform group-hover/lnk:translate-x-0.5">→</span>
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto -mx-6 border-t border-slate-50">
          <table className="w-full border-collapse text-left text-xs text-slate-500">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/30">
                <th className="py-3 px-6 font-bold text-slate-400 uppercase tracking-wider w-32">Action</th>
                <th className="py-3 px-6 font-bold text-slate-400 uppercase tracking-wider">Record</th>
                <th className="py-3 px-6 font-bold text-slate-400 uppercase tracking-wider">Detail</th>
                <th className="py-3 px-6 font-bold text-slate-400 uppercase tracking-wider text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-medium">
              {clientProperties.length > 0 ? (
                clientProperties.map((prop, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/20">
                    <td className="py-3.5 px-6">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                          prop.action === "Added"
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                            : "bg-blue-50 text-blue-600 border-blue-100"
                        }`}
                      >
                        {prop.action === "Added" ? "+ Added" : "✎ Edited"}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 font-bold text-slate-800">{prop.property}</td>
                    <td className="py-3.5 px-6">
                      {prop.change.includes("Vacant → Rented") ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="line-through text-rose-400 font-semibold">Vacant ~ $820K</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-emerald-500 font-bold bg-emerald-50/50 border border-emerald-100/50 px-1.5 py-0.5 rounded-lg">
                            Rented · $850K
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">{prop.change}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right text-slate-400">{prop.date}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400 font-semibold">
                    No properties modified today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transactions Section */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 text-pink-500">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-slate-800">Transactions</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-semibold">{transactionsCount} changes</span>
            <Link
              href="/dashboard/accountant/reports/transactions"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-0.5 group/lnk"
            >
              View all transactions
              <span className="transition-transform group-hover/lnk:translate-x-0.5">→</span>
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto -mx-6 border-t border-slate-50">
          <table className="w-full border-collapse text-left text-xs text-slate-500">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/30">
                <th className="py-3 px-6 font-bold text-slate-400 uppercase tracking-wider w-32">Action</th>
                <th className="py-3 px-6 font-bold text-slate-400 uppercase tracking-wider">Record</th>
                <th className="py-3 px-6 font-bold text-slate-400 uppercase tracking-wider">Detail</th>
                <th className="py-3 px-6 font-bold text-slate-400 uppercase tracking-wider text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-medium">
              {clientTransactions.length > 0 ? (
                clientTransactions.slice(0, 3).map((tx, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/20">
                    <td className="py-3.5 px-6">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                          tx.action === "Added"
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                            : "bg-blue-50 text-blue-600 border-blue-100"
                        }`}
                      >
                        {tx.action === "Added" ? "+ Added" : "✎ Edited"}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 font-bold text-slate-800">
                      {tx.id} — <span className="font-normal text-slate-500">{tx.transactionName}</span>
                    </td>
                    <td className="py-3.5 px-6">
                      <span className="text-slate-500 font-semibold">{tx.category}</span>
                      <span className="text-slate-400 text-[10px] ml-2">({tx.property})</span>
                      <span
                        className={`ml-3 font-bold ${tx.amount < 0 ? "text-rose-500" : "text-emerald-500"}`}
                      >
                        {tx.amount < 0 ? "-" : "+"}${Math.abs(tx.amount).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right text-slate-400">{tx.date}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400 font-semibold">
                    No transactions modified today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Documents Section */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 text-emerald-500">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-slate-800">Documents</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-semibold">{clientDocuments.length} changes</span>
            <Link
              href="/dashboard/accountant/reports/documents"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-0.5 group/lnk"
            >
              View all documents
              <span className="transition-transform group-hover/lnk:translate-x-0.5">→</span>
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto -mx-6 border-t border-slate-50">
          <table className="w-full border-collapse text-left text-xs text-slate-500">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/30">
                <th className="py-3 px-6 font-bold text-slate-400 uppercase tracking-wider w-32">Action</th>
                <th className="py-3 px-6 font-bold text-slate-400 uppercase tracking-wider">Record</th>
                <th className="py-3 px-6 font-bold text-slate-400 uppercase tracking-wider">Detail</th>
                <th className="py-3 px-6 font-bold text-slate-400 uppercase tracking-wider text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-medium">
              {clientDocuments.length > 0 ? (
                clientDocuments.map((doc, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/20">
                    <td className="py-3.5 px-6">
                      <span className="inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold border bg-emerald-50 text-emerald-600 border-emerald-100">
                        + Added
                      </span>
                    </td>
                    <td className="py-3.5 px-6 font-bold text-slate-800">{doc.documentName}</td>
                    <td className="py-3.5 px-6 text-slate-500 font-semibold">{doc.size}</td>
                    <td className="py-3.5 px-6 text-right text-slate-400">{doc.date}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400 font-semibold">
                    No documents uploaded today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
