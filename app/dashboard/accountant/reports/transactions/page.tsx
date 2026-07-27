"use client";

import React, { useEffect, useState } from "react";
import { fetchReportTransactions, type ReportTransaction } from "../reportsApi";
import ReportPageShell from "@/app/components/ReportPageShell";
import { useReportPeriod } from "../useReportPeriod";

export default function TransactionsReport() {
  const {
    selectedPeriod,
    setSelectedPeriod,
    fromDate,
    toDate,
    setCustomRange,
    isLoaded,
  } = useReportPeriod();
  const [filteredTransactions, setFilteredTransactions] = useState<ReportTransaction[]>([]);

  useEffect(() => {
    if (!isLoaded) return;
    let active = true;
    const opts = { from: fromDate, to: toDate };
    fetchReportTransactions(selectedPeriod, opts)
      .then((data) => {
        if (active) setFilteredTransactions(data);
      })
      .catch(() => {
        if (active) setFilteredTransactions([]);
      });
    return () => {
      active = false;
    };
  }, [selectedPeriod, fromDate, toDate, isLoaded]);

  // Counter calculations for cards
  const addedCount = filteredTransactions.filter((t) => t.action === "Added").length;
  const editedCount = filteredTransactions.filter((t) => t.action === "Edited").length;
  const deletedCount = filteredTransactions.filter((t) => t.action === "Deleted").length;

  return (
    <ReportPageShell
      title="Transactions"
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      }
      iconBgClass="bg-pink-50 text-pink-600 border-pink-100/50"
      totalRecords={filteredTransactions.length}
      selectedPeriod={selectedPeriod}
      setSelectedPeriod={setSelectedPeriod}
      addedCount={addedCount}
      editedCount={editedCount}
      deletedCount={deletedCount}
      fromDate={fromDate}
      toDate={toDate}
      onCustomRangeChange={setCustomRange}
    >
      {/* All Transactions Table */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm overflow-hidden">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-slate-900">All Transactions</h2>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            {filteredTransactions.length} records
          </span>
        </div>

        <div className="overflow-x-auto -mx-6">
          <table className="w-full border-collapse text-left text-xs text-slate-500">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider w-32">Action</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider">Client</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider">Transaction</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider">Category</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider">Property</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider text-right">Amount</th>
                <th className="py-3.5 px-6 font-bold text-slate-400 uppercase tracking-wider text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-medium">
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/20">
                  {/* Action Badge */}
                  <td className="py-3.5 px-6">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                        tx.action === "Added"
                          ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                          : tx.action === "Edited"
                          ? "bg-blue-50 text-blue-600 border-blue-100"
                          : "bg-rose-50 text-rose-600 border-rose-100"
                      }`}
                    >
                      {tx.action === "Added" ? "+ Added" : tx.action === "Edited" ? "✎ Edited" : "🗑 Deleted"}
                    </span>
                  </td>

                  {/* Client Initials & Name */}
                  <td className="py-3.5 px-6 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center border border-slate-200">
                      {tx.clientInitials}
                    </div>
                    <span className="font-bold text-slate-700">{tx.clientName}</span>
                  </td>

                  {/* Transaction Title */}
                  <td className="py-3.5 px-6">
                    <div className="font-bold text-slate-800">
                      {tx.transactionName}{" "}
                      <span className="text-[10px] font-bold text-slate-400 ml-1">#{tx.id}</span>
                    </div>
                  </td>

                  {/* Category Badge */}
                  <td className="py-3.5 px-6">
                    <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] border border-slate-200 font-semibold">
                      {tx.category}
                    </span>
                  </td>

                  {/* Property description */}
                  <td className="py-3.5 px-6 font-semibold text-slate-600">{tx.property}</td>

                  {/* Amount with conditional coloring */}
                  <td
                    className={`py-3.5 px-6 text-right font-black ${
                      tx.amount < 0 ? "text-rose-500" : "text-emerald-500"
                    }`}
                  >
                    {tx.amount < 0 ? "-" : "+"}${Math.abs(tx.amount).toLocaleString()}
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-6 text-right text-slate-400">{tx.date}</td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold">
                    No transactions recorded in this period.
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
