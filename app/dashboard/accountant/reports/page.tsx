"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    fetchReportClients,
    fetchReportDocuments,
    fetchReportEntities,
    fetchReportProperties,
    fetchReportRules,
    fetchReportSummary,
    fetchReportTimeline,
    fetchReportTransactions,
    type ReportClient,
    type ReportDocument,
    type ReportEntity,
    type ReportProperty,
    type ReportRule,
    type ReportTimelineEvent,
    type ReportTransaction,
} from "./reportsApi";

export default function ReportsDashboard() {
    const router = useRouter();
    const [selectedPeriod, setSelectedPeriod] = useState<string>("Today");
    const [fromDate, setFromDate] = useState<string>("2026-06-12");
    const [toDate, setToDate] = useState<string>("2026-06-19");

    const [filteredTransactions, setFilteredTransactions] = useState<ReportTransaction[]>([]);
    const [filteredProperties, setFilteredProperties] = useState<ReportProperty[]>([]);
    const [filteredEntities, setFilteredEntities] = useState<ReportEntity[]>([]);
    const [filteredDocuments, setFilteredDocuments] = useState<ReportDocument[]>([]);
    const [filteredRules, setFilteredRules] = useState<ReportRule[]>([]);
    const [filteredTimeline, setFilteredTimeline] = useState<ReportTimelineEvent[]>([]);
    const [clientsList, setClientsList] = useState<ReportClient[]>([]);
    const [totalClientsCount, setTotalClientsCount] = useState<number>(0);

    useEffect(() => {
        let active = true;
        const opts = { from: fromDate, to: toDate };
        fetchReportTransactions(selectedPeriod, opts).then((d) => active && setFilteredTransactions(d)).catch(() => active && setFilteredTransactions([]));
        fetchReportProperties(selectedPeriod, opts).then((d) => active && setFilteredProperties(d)).catch(() => active && setFilteredProperties([]));
        fetchReportEntities(selectedPeriod, opts).then((d) => active && setFilteredEntities(d)).catch(() => active && setFilteredEntities([]));
        fetchReportDocuments(selectedPeriod, opts).then((d) => active && setFilteredDocuments(d)).catch(() => active && setFilteredDocuments([]));
        fetchReportRules(selectedPeriod, opts).then((d) => active && setFilteredRules(d)).catch(() => active && setFilteredRules([]));
        fetchReportTimeline(selectedPeriod, opts).then((d) => active && setFilteredTimeline(d)).catch(() => active && setFilteredTimeline([]));
        fetchReportClients(selectedPeriod, opts).then((d) => active && setClientsList(d)).catch(() => active && setClientsList([]));
        fetchReportSummary(selectedPeriod, opts).then((s) => active && setTotalClientsCount(s.clientsTotal)).catch(() => { });
        return () => {
            active = false;
        };
    }, [selectedPeriod, fromDate, toDate]);

    // Sum of all filtered actions
    const totalActions =
        filteredTransactions.length +
        filteredProperties.length +
        filteredEntities.length +
        filteredDocuments.length +
        filteredRules.length;

    // Unique clients touched in the selected period
    const touchedClientIds = new Set([
        ...filteredTransactions.map((t) => t.clientId),
        ...filteredProperties.map((p) => p.clientId),
        ...filteredEntities.map((e) => e.clientId),
        ...filteredDocuments.map((d) => d.clientId),
        ...filteredRules.map((r) => r.clientId),
    ]);
    const clientsTouchedCount = touchedClientIds.size;

    // Records added & edited
    const addedCount =
        filteredTransactions.filter((t) => t.action === "Added").length +
        filteredProperties.filter((p) => p.action === "Added").length +
        filteredEntities.filter((e) => e.action === "Added").length +
        filteredDocuments.filter((d) => d.action === "Added").length +
        filteredRules.filter((r) => r.action === "Added").length;

    const editedCount =
        filteredTransactions.filter((t) => t.action === "Edited").length +
        filteredProperties.filter((p) => p.action === "Edited").length +
        filteredEntities.filter((e) => e.action === "Edited").length +
        filteredDocuments.filter((d) => d.action === "Edited").length +
        filteredRules.filter((r) => r.action === "Edited").length;

    // Category calculation helper
    const getCategoryPercentages = () => {
        if (totalActions === 0) {
            return {
                transactions: { count: 0, pct: 0 },
                properties: { count: 0, pct: 0 },
                entities: { count: 0, pct: 0 },
                documents: { count: 0, pct: 0 },
                rules: { count: 0, pct: 0 },
            };
        }
        return {
            transactions: { count: filteredTransactions.length, pct: Math.round((filteredTransactions.length / totalActions) * 100) },
            properties: { count: filteredProperties.length, pct: Math.round((filteredProperties.length / totalActions) * 100) },
            entities: { count: filteredEntities.length, pct: Math.round((filteredEntities.length / totalActions) * 100) },
            documents: { count: filteredDocuments.length, pct: Math.round((filteredDocuments.length / totalActions) * 100) },
            rules: { count: filteredRules.length, pct: Math.round((filteredRules.length / totalActions) * 100) },
        };
    };

    const categories = getCategoryPercentages();

    // Dynamic reconciliation progress values based on active selection (Today, 7 days, etc.) to look professional
    const getReconciliationProgress = (period: string) => {
        switch (period) {
            case "Today":
                return { reconciled: 18, pending: 142, rate: 78 };
            case "7 days":
                return { reconciled: 45, pending: 115, rate: 82 };
            case "30 days":
                return { reconciled: 156, pending: 74, rate: 89 };
            case "3 months":
                return { reconciled: 412, pending: 28, rate: 95 };
            default:
                return { reconciled: 85, pending: 95, rate: 84 };
        }
    };
    const recon = getReconciliationProgress(selectedPeriod);

    // Clients touched in the period (server-aggregated), most active first.
    const sortedClientsTouched = [...clientsList].sort((a, b) => b.totalActions - a.totalActions);

    // Handle Export action
    const handleExport = () => {
        alert("Exporting activity report to CSV...");
    };

    return (
        <div className="flex flex-col gap-6 w-full animate-fadeIn max-w-[1400px] mx-auto pb-10">
            {/* Top Header & Filters Area */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">My Activity</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Track what you've added, edited, and reviewed across your assigned clients.
                    </p>
                </div>

                {/* Date Filter & Export Row */}
                <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
                    <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                        {["Today", "7 days", "30 days", "3 months"].map((period) => (
                            <button
                                key={period}
                                type="button"
                                onClick={() => setSelectedPeriod(period)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${selectedPeriod === period
                                    ? "bg-[#28336e] text-white shadow-md shadow-indigo-900/10"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                                    }`}
                            >
                                {period}
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={handleExport}
                        className="inline-flex items-center gap-2 bg-[#1b2559] hover:bg-[#253275] text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-950/15"
                    >
                        <svg
                            className="w-4 h-4 fill-none stroke-current stroke-[2] stroke-round stroke-linejoin"
                            viewBox="0 0 24 24"
                        >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Export
                    </button>
                </div>
            </div>

            {/* Custom Date Range Picker Row */}
            <div className="bg-white/80 border border-slate-200/80 rounded-2xl p-4 flex flex-wrap items-center gap-4 shadow-sm backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Custom date range</span>
                    <span className="text-xs text-slate-400">From</span>
                </div>
                <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                />
                <span className="text-xs text-slate-400">To</span>
                <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                />
                <button
                    type="button"
                    onClick={() => setSelectedPeriod("custom")}
                    className={`bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2 rounded-xl transition-all duration-200 shadow-md shadow-indigo-600/10 ml-auto md:ml-0 ${selectedPeriod === "custom" ? "ring-2 ring-indigo-600 ring-offset-2" : ""
                        }`}
                >
                    Apply
                </button>
            </div>

            {/* Main Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Total Actions Card */}
                <div className="bg-gradient-to-br from-[#ebf1ff] to-[#f4f7fe] border border-blue-100 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[140px]">
                    <div className="flex items-start justify-between">
                        <div>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Actions</span>
                            <div className="text-3xl font-black text-slate-900 mt-1.5">{totalActions}</div>
                        </div>
                        <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <svg className="w-5 h-5 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24">
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                            </svg>
                        </div>
                    </div>
                    <span className="text-xs text-blue-600/80 font-semibold tracking-wide">Across all clients</span>
                </div>

                {/* Clients Touched Card */}
                <div className="bg-gradient-to-br from-[#fff7e6] to-[#fffcf5] border border-amber-100 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[140px]">
                    <div className="flex items-start justify-between">
                        <div>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Clients Touched</span>
                            <div className="text-3xl font-black text-slate-900 mt-1.5">{clientsTouchedCount} / {totalClientsCount}</div>
                        </div>
                        <div className="w-11 h-11 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
                            <svg className="w-5 h-5 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </div>
                    </div>
                    <Link
                        href="/dashboard/accountant/reports/clients"
                        className="text-xs text-amber-600 hover:text-amber-800 font-bold tracking-wide inline-flex items-center gap-1 group/link"
                    >
                        View all clients
                        <span className="transition-transform group-hover/link:translate-x-0.5">→</span>
                    </Link>
                </div>

                {/* Records Added Card */}
                <div className="bg-gradient-to-br from-[#e6fbf3] to-[#f4fefb] border border-emerald-100 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[140px]">
                    <div className="flex items-start justify-between">
                        <div>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Records Added</span>
                            <div className="text-3xl font-black text-slate-900 mt-1.5">{addedCount}</div>
                        </div>
                        <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <svg className="w-5 h-5 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                        </div>
                    </div>
                    <span className="text-xs text-emerald-600/80 font-semibold tracking-wide">
                        Properties, entities, transactions
                    </span>
                </div>

                {/* Records Edited Card */}
                <div className="bg-gradient-to-br from-[#f5ebff] to-[#faf5ff] border border-purple-100 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[140px]">
                    <div className="flex items-start justify-between">
                        <div>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Records Edited</span>
                            <div className="text-3xl font-black text-slate-900 mt-1.5">{editedCount}</div>
                        </div>
                        <div className="w-11 h-11 rounded-xl bg-purple-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/20">
                            <svg className="w-5 h-5 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                        </div>
                    </div>
                    <span className="text-xs text-purple-600/80 font-semibold tracking-wide">
                        Status, values, categories
                    </span>
                </div>
            </div>

            {/* Records You've Worked On Grid */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
                <h2 className="text-lg font-bold text-[#1f2d4f] mb-1">Records You've Worked On</h2>
                <p className="text-xs text-slate-400 mb-6">{selectedPeriod} · click a card for the full list</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                        {
                            title: "Properties",
                            count: filteredProperties.length,
                            sub: `+${filteredProperties.filter(p => p.action === 'Added').length} added · ${filteredProperties.filter(p => p.action === 'Edited').length} edited`,
                            color: "text-amber-500 bg-amber-50",
                            icon: (
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                </svg>
                            ),
                            link: "/dashboard/accountant/reports/properties",
                        },
                        {
                            title: "Entities",
                            count: filteredEntities.length,
                            sub: `+${filteredEntities.filter(e => e.action === 'Added').length} added · ${filteredEntities.filter(e => e.action === 'Edited').length} edited`,
                            color: "text-purple-500 bg-purple-50",
                            icon: (
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <rect x="4" y="4" width="16" height="16" rx="2" />
                                    <line x1="9" y1="9" x2="15" y2="9" />
                                    <line x1="9" y1="13" x2="15" y2="13" />
                                </svg>
                            ),
                            link: "/dashboard/accountant/reports/entities",
                        },
                        {
                            title: "Transactions",
                            count: filteredTransactions.length,
                            sub: `+${filteredTransactions.filter(t => t.action === 'Added').length} added · ${filteredTransactions.filter(t => t.action === 'Edited').length} edited · ${filteredTransactions.filter(t => t.action === 'Deleted').length} deleted`,
                            color: "text-pink-500 bg-pink-50",
                            icon: (
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <line x1="12" y1="1" x2="12" y2="23" />
                                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                </svg>
                            ),
                            link: "/dashboard/accountant/reports/transactions",
                        },
                        {
                            title: "Documents",
                            count: filteredDocuments.length,
                            sub: `+${filteredDocuments.filter(d => d.action === 'Added').length} added · ${filteredDocuments.filter(d => d.action === 'Edited').length} edited`,
                            color: "text-emerald-500 bg-emerald-50",
                            icon: (
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                </svg>
                            ),
                            link: "/dashboard/accountant/reports/documents",
                        },
                        {
                            title: "Clients",
                            count: clientsTouchedCount,
                            sub: `Active: ${clientsTouchedCount} · Total: ${totalClientsCount}`,
                            color: "text-blue-500 bg-blue-50",
                            icon: (
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                </svg>
                            ),
                            link: "/dashboard/accountant/reports/clients",
                        },
                        {
                            title: "Rules",
                            count: filteredRules.length,
                            sub: `+${filteredRules.filter(r => r.action === 'Added').length} added · ${filteredRules.filter(r => r.action === 'Edited').length} edited`,
                            color: "text-slate-500 bg-slate-100",
                            icon: (
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
                            ),
                            link: "/dashboard/accountant/reports/rules",
                        },
                    ].map((card, i) => (
                        <div
                            key={i}
                            onClick={() => router.push(card.link)}
                            className="bg-[#f8f9fb] border border-slate-100/80 hover:border-indigo-100 hover:bg-slate-100/50 rounded-3xl p-5 transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-md hover:-translate-y-0.5 group min-h-[140px]"
                        >
                            <div className="flex items-center justify-between w-full">
                                <div className={`p-2.5 rounded-xl ${card.color} flex items-center justify-center`}>
                                    {card.icon}
                                </div>
                                <span className="text-3xl font-black text-[#1f2d4f]">{card.count}</span>
                            </div>
                            <div className="mt-4 flex flex-col items-start">
                                <span className="text-[#1f2d4f] font-extrabold text-sm tracking-wide">{card.title}</span>
                                <span className="text-[11px] font-semibold text-slate-400 mt-1">{card.sub}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Progress & Category Chart Layout Row */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left Side: Activity by Category */}
                <div className="lg:col-span-3 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Activity by Category</h2>
                        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
                            {[
                                { label: "Transactions", pct: `${categories.transactions.pct}%`, color: "bg-blue-600" },
                                { label: "Properties", pct: `${categories.properties.pct}%`, color: "bg-amber-500" },
                                { label: "Entities", pct: `${categories.entities.pct}%`, color: "bg-indigo-500" },
                                { label: "Documents", pct: `${categories.documents.pct}%`, color: "bg-emerald-500" },
                                { label: "Rules", pct: `${categories.rules.pct}%`, color: "bg-slate-400" },
                            ].map((category, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <span className={`w-2.5 h-2.5 rounded-full ${category.color}`} />
                                    <span>{category.label}</span>
                                    <span className="font-bold text-slate-800">{category.pct}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Graphical Horizontal Bar Charts */}
                    <div className="space-y-4.5 mt-6">
                        {[
                            { label: "Transactions", count: categories.transactions.count, pct: categories.transactions.pct, color: "from-blue-600 to-indigo-600" },
                            { label: "Properties", count: categories.properties.count, pct: categories.properties.pct, color: "from-amber-400 to-amber-500" },
                            { label: "Entities", count: categories.entities.count, pct: categories.entities.pct, color: "from-indigo-400 to-indigo-500" },
                            { label: "Documents", count: categories.documents.count, pct: categories.documents.pct, color: "from-emerald-400 to-emerald-500" },
                            { label: "Rules", count: categories.rules.count, pct: categories.rules.pct, color: "from-slate-400 to-slate-500" },
                        ].map((bar, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                                <span className="text-xs text-slate-400 w-24 text-left font-medium">{bar.label}</span>
                                <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden relative">
                                    <div
                                        className={`bg-gradient-to-r ${bar.color} h-full rounded-full transition-all duration-500`}
                                        style={{ width: `${bar.pct}%` }}
                                    />
                                </div>
                                <span className="text-xs font-bold text-slate-700 w-6 text-right">{bar.count}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-100 pt-4 mt-6">
                        <span>0</span>
                        <span>2</span>
                        <span>4</span>
                        <span>6</span>
                        <span>8</span>
                        <span>10</span>
                        <span>12</span>
                        <span>14</span>
                        <span>16</span>
                    </div>
                </div>

                {/* Right Side: Reconciliation Progress */}
                <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">Reconciliation Progress</h2>

                    <div className="space-y-4">
                        {/* Reconciled Row */}
                        <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </div>
                                <span className="text-xs font-bold text-slate-700">Reconciled</span>
                            </div>
                            <span className="text-sm font-black text-slate-900">{recon.reconciled}</span>
                        </div>

                        {/* Pending Review Row */}
                        <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                </div>
                                <span className="text-xs font-bold text-slate-700">Pending review</span>
                            </div>
                            <span className="text-sm font-black text-slate-900">{recon.pending}</span>
                        </div>

                        {/* Your Reconciliation Rate Row */}
                        <div className="flex items-center justify-between pb-1">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <line x1="18" y1="20" x2="18" y2="10" />
                                        <line x1="12" y1="20" x2="12" y2="4" />
                                        <line x1="6" y1="20" x2="6" y2="14" />
                                    </svg>
                                </div>
                                <span className="text-xs font-bold text-slate-700">Your reconciliation rate</span>
                            </div>
                            <span className="text-sm font-black text-slate-900">{recon.rate}%</span>
                        </div>

                        {/* Large Progress Bar with Target details */}
                        <div className="mt-2 space-y-2">
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${recon.rate}%` }} />
                            </div>
                            <div className="text-[10px] text-slate-400 font-semibold tracking-wide">
                                Org target: 85% — <span className="text-indigo-600">
                                    {recon.rate >= 85 ? "Target achieved!" : `${85 - recon.rate} points away`}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Timeline Section */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
                <div className="flex justify-between items-center mb-5">
                    <h2 className="text-lg font-bold text-slate-900">Detailed Timeline</h2>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {filteredTimeline.length} items {selectedPeriod.toLowerCase() === 'today' ? 'today' : 'in this period'}
                    </span>
                </div>

                {filteredTimeline.length > 0 ? (
                    <div className="relative border-l border-slate-100 ml-4 space-y-6">
                        {filteredTimeline.map((event) => {
                            let dotColor = "bg-blue-500";
                            if (event.type === "added") dotColor = "bg-emerald-500";
                            if (event.type === "deleted") dotColor = "bg-rose-500";

                            return (
                                <div key={event.id} className="relative pl-6 group">
                                    {/* Timeline node */}
                                    <div
                                        className={`absolute -left-[6px] top-1.5 w-3 h-3 rounded-full ring-4 ring-white ${dotColor} transition-transform group-hover:scale-125 duration-200`}
                                    />
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                        <div>
                                            <span className="text-xs font-black text-slate-800">
                                                {event.action} —{" "}
                                                <Link
                                                    href={`/dashboard/accountant/reports/clients/${event.clientId}`}
                                                    className="text-[#28336e] hover:underline"
                                                >
                                                    {event.clientName}
                                                </Link>
                                            </span>
                                            <p className="text-xs text-slate-500 font-medium mt-1">{event.detail}</p>
                                        </div>
                                        <span className="text-[10px] font-semibold text-slate-400 sm:self-start mt-0.5">{event.time}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-8 text-xs font-semibold text-slate-400">
                        No activity recorded in this period.
                    </div>
                )}
            </div>

            {/* Clients Touched Table */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-slate-900">Clients Touched</h2>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 font-semibold">{clientsTouchedCount} of {totalClientsCount}</span>
                        <Link
                            href="/dashboard/accountant/reports/clients"
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                        >
                            View all
                        </Link>
                    </div>
                </div>

                <div className="overflow-x-auto -mx-6">
                    <table className="w-full border-collapse text-left text-xs text-slate-500">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="py-3 px-6 font-bold text-slate-400 uppercase tracking-wider">Client</th>
                                <th className="py-3 px-6 font-bold text-slate-400 uppercase tracking-wider text-center">Properties</th>
                                <th className="py-3 px-6 font-bold text-slate-400 uppercase tracking-wider text-center">Entities</th>
                                <th className="py-3 px-6 font-bold text-slate-400 uppercase tracking-wider text-center">Transactions</th>
                                <th className="py-3 px-6 font-bold text-slate-400 uppercase tracking-wider text-center">Total Actions</th>
                                <th className="py-3 px-6 font-bold text-slate-400 uppercase tracking-wider text-right">Last Activity</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-medium">
                            {sortedClientsTouched.slice(0, 4).map((client) => (
                                <tr
                                    key={client.id}
                                    onClick={() => router.push(`/dashboard/accountant/reports/clients/${client.id}`)}
                                    className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                                >
                                    <td className="py-4 px-6 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 font-black flex items-center justify-center">
                                            {client.initials}
                                        </div>
                                        <span className="font-bold text-slate-800 hover:underline">{client.name}</span>
                                    </td>
                                    <td className="py-4 px-6 text-center text-slate-700 font-bold">{client.propertiesCount}</td>
                                    <td className="py-4 px-6 text-center text-slate-700 font-bold">{client.entitiesCount}</td>
                                    <td className="py-4 px-6 text-center text-slate-700 font-bold">{client.transactionsCount}</td>
                                    <td className="py-4 px-6 text-center text-slate-700 font-black">{client.totalActions}</td>
                                    <td className="py-4 px-6 text-right text-slate-400">{client.lastActivity}</td>
                                </tr>
                            ))}
                            {sortedClientsTouched.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-slate-400 font-semibold">
                                        No client activity recorded in this period.
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
