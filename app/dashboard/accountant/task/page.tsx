"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

interface Person {
    id: string;
    name: string;
}

interface Task {
    id: number;
    name: string;
    description: string;
    assignedBy?: Person;
    assignedTo?: Person;
    deadline: string;
    status: "Pending" | "Completed";
    actionFeedback?: string;
    type: "my" | "assigned";
}

const TEAM_MEMBERS: Person[] = [
    { id: "sarah-johnson", name: "Sarah Johnson (Me)" },
    { id: "emily-torres", name: "Emily Torres" },
    { id: "michael-chen", name: "Michael Chen" },
    { id: "david-okafor", name: "David Okafor" },
    { id: "priya-sharma", name: "Priya Sharma" },
];

const INITIAL_TASKS: Task[] = [
    {
        id: 1,
        name: "Q2 Tax Filing Review",
        description: "Review all documents submitted for Q2 tax filing and flag discrepancies.",
        assignedBy: { id: "michael-chen", name: "Michael Chen" },
        deadline: "15 Jul 2024",
        status: "Pending",
        type: "my",
    },
    {
        id: 2,
        name: "Client Ledger Reconciliation",
        description: "Reconcile the ledger entries for Smith Family Trust for FY 2023–24.",
        assignedBy: { id: "priya-sharma", name: "Priya Sharma" },
        deadline: "20 Jul 2024",
        status: "Pending",
        type: "my",
    },
    {
        id: 3,
        name: "GST Return Submission",
        description: "Prepare and submit the monthly GST return for ABC Properties LLC.",
        assignedBy: { id: "david-okafor", name: "David Okafor" },
        deadline: "10 Jul 2024",
        status: "Completed",
        actionFeedback: "Submitted successfully via portal.",
        type: "my",
    },
    {
        id: 4,
        name: "Audit Trail Documentation",
        description: "Compile audit trail documents for the last 3 quarters for partner review.",
        assignedTo: { id: "emily-torres", name: "Emily Torres" },
        deadline: "18 Jul 2024",
        status: "Pending",
        type: "assigned",
    },
    {
        id: 5,
        name: "Payroll Verification",
        description: "Verify June payroll disbursements match approved salary structures.",
        assignedTo: { id: "michael-chen", name: "Michael Chen" },
        deadline: "12 Jul 2024",
        status: "Completed",
        type: "assigned",
    },
    {
        id: 6,
        name: "Depreciation Schedule Update",
        description: "Update asset depreciation schedule for new acquisitions this quarter.",
        assignedTo: { id: "david-okafor", name: "David Okafor" },
        deadline: "22 Jul 2024",
        status: "Pending",
        type: "assigned",
    },
];

const getInitials = (nameStr: string) => {
    const cleanName = nameStr.replace(/\(Me\)/i, "").trim();
    const parts = cleanName.split(" ").filter(Boolean);
    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return cleanName.slice(0, 2).toUpperCase();
};

const getAvatarColorClass = (id: string) => {
    const colors = [
        "bg-blue-50 text-blue-600 border border-blue-100",
        "bg-purple-50 text-purple-600 border border-purple-100",
        "bg-indigo-50 text-indigo-600 border border-indigo-100",
        "bg-emerald-50 text-emerald-600 border border-emerald-100",
        "bg-rose-50 text-rose-600 border border-rose-100",
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
};

export default function TaskManagementPage() {
    const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
    const [activeTab, setActiveTab] = useState<"my" | "assigned">("my");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    const [newTaskName, setNewTaskName] = useState("");
    const [newTaskDesc, setNewTaskDesc] = useState("");
    const [newTaskAssignee, setNewTaskAssignee] = useState<Person>(TEAM_MEMBERS[0]);
    const [newTaskDeadline, setNewTaskDeadline] = useState("");

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const totalTasksCount = tasks.length;
    const pendingTasksCount = tasks.filter((t) => t.status === "Pending").length;
    const completedTasksCount = tasks.filter((t) => t.status === "Completed").length;

    const filteredTasks = tasks.filter((t) => t.type === activeTab);
    const myTasksCount = tasks.filter((t) => t.type === "my").length;
    const assignedTasksCount = tasks.filter((t) => t.type === "assigned").length;

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (!isDropdownOpen) return;
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isDropdownOpen]);

    const handleMarkComplete = (taskId: number) => {
        setTasks((prevTasks) =>
            prevTasks.map((task) => {
                if (task.id === taskId) {
                    return {
                        ...task,
                        status: "Completed",
                        actionFeedback: task.name.includes("GST")
                            ? "Submitted successfully via portal."
                            : "Completed successfully.",
                    };
                }
                return task;
            })
        );
    };

    const handleCreateTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskName.trim() || !newTaskDesc.trim() || !newTaskDeadline) {
            alert("Please fill in all required fields.");
            return;
        }

        const isSelf = newTaskAssignee.name.includes("Sarah Johnson");

        const mockManager: Person = {
            id: "michael-chen",
            name: "Michael Chen"
        };

        const newTask: Task = {
            id: Date.now(),
            name: newTaskName,
            description: newTaskDesc,
            deadline: formatDate(newTaskDeadline),
            status: "Pending",
            type: isSelf ? "my" : "assigned",
            ...(isSelf
                ? { assignedBy: mockManager }
                : { assignedTo: newTaskAssignee, assignedBy: { id: "sarah-johnson", name: "Sarah Johnson" } }
            ),
        };

        setTasks((prev) => [...prev, newTask]);
        setIsModalOpen(false);

        setNewTaskName("");
        setNewTaskDesc("");
        setNewTaskAssignee(TEAM_MEMBERS[0]);
        setNewTaskDeadline("");
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return "";
        const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
        return new Date(dateString).toLocaleDateString("en-GB", options);
    };

    return (
        <div className="flex flex-col gap-6 w-full animate-fadeIn max-w-[1400px] mx-auto pb-10">

            <div className="flex items-center">
                <Link
                    href="/dashboard/accountant/transactions"
                    className="group flex items-center gap-2 text-slate-500 font-medium text-sm transition-colors duration-200 hover:text-[#28336e]"
                >
                    <svg
                        className="w-4 h-4 transform transition-transform duration-200 group-hover:-translate-x-1"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                    Back to transactions
                </Link>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-[#1f2d4f] tracking-tight">
                        Task Management
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium text-[0.98rem]">
                        Track, manage, and delegate accounting tasks across your team.
                    </p>
                </div>
                <div>
                    <button
                        onClick={() => {
                            setIsModalOpen(true);
                        }}
                        className="inline-flex items-center gap-2 bg-[#28336e] hover:bg-[#1f2756] text-white font-semibold px-5 py-2.5 rounded-xl shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#28336e] focus:ring-offset-2"
                    >
                        <svg
                            className="w-4 h-4 stroke-2"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Create Task
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                <div className="bg-white border border-[#e2e8f5] rounded-2xl p-6 shadow-sm flex items-center gap-5 transition-all duration-200 hover:shadow-md">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <span className="text-xl font-extrabold text-indigo-700">{totalTasksCount}</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-700">Total Tasks</h3>
                    </div>
                </div>

                <div className="bg-white border border-[#e2e8f5] rounded-2xl p-6 shadow-sm flex items-center gap-5 transition-all duration-200 hover:shadow-md">
                    <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <span className="text-xl font-extrabold text-amber-600">{pendingTasksCount}</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-700">Pending</h3>
                    </div>
                </div>

                <div className="bg-white border border-[#e2e8f5] rounded-2xl p-6 shadow-sm flex items-center gap-5 transition-all duration-200 hover:shadow-md">
                    <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <span className="text-xl font-extrabold text-emerald-600">{completedTasksCount}</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-700">Completed</h3>
                    </div>
                </div>

            </div>

            <div className="bg-white border border-[#e2e8f5] rounded-2xl shadow-sm overflow-hidden p-6 transition-all duration-200">

                <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-slate-200 pb-0 mb-6 gap-4">
                    <div className="flex items-center gap-8 -mb-[1.5px] z-10">

                        <button
                            onClick={() => setActiveTab("my")}
                            className={`flex items-center gap-2 pb-3 transition-all duration-200 focus:outline-none border-b-2 ${activeTab === "my"
                                    ? "border-[#28336e] text-[#28336e] font-extrabold"
                                    : "border-transparent text-slate-400 hover:text-slate-600 font-semibold"
                                }`}
                        >
                            <span>My Tasks</span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold text-xs ml-1">
                                {myTasksCount}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveTab("assigned")}
                            className={`flex items-center gap-2 pb-3 transition-all duration-200 focus:outline-none border-b-2 ${activeTab === "assigned"
                                    ? "border-[#28336e] text-[#28336e] font-extrabold"
                                    : "border-transparent text-slate-400 hover:text-slate-600 font-semibold"
                                }`}
                        >
                            <span>Assigned Tasks</span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold text-xs ml-1">
                                {assignedTasksCount}
                            </span>
                        </button>

                    </div>

                    <div className="text-slate-400 text-xs font-medium pb-3 sm:text-right">
                        {activeTab === "my"
                            ? "Tasks assigned to you by others or yourself"
                            : "Tasks you have assigned to fellow accountants"
                        }
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-[#f0f4fa] text-[0.82rem] font-bold text-slate-400 uppercase tracking-wider">
                                <th className="pb-4 pt-1 w-12 text-center">S.No</th>
                                <th className="pb-4 pt-1 px-4 min-w-[200px]">Task Name</th>
                                <th className="pb-4 pt-1 px-4 min-w-[340px]">Description</th>
                                <th className="pb-4 pt-1 px-4 min-w-[180px]">
                                    {activeTab === "my" ? "Assigned By" : "Assigned To"}
                                </th>
                                <th className="pb-4 pt-1 px-4 min-w-[130px]">Deadline</th>
                                <th className="pb-4 pt-1 px-4 min-w-[120px]">Status</th>
                                {activeTab === "my" && (
                                    <th className="pb-4 pt-1 px-4 text-center min-w-[160px]">Action</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTasks.length === 0 ? (
                                <tr>
                                    <td colSpan={activeTab === "my" ? 7 : 6} className="text-center py-10 text-slate-400 font-medium">
                                        No tasks found in this tab. Click "+ Create Task" to add one.
                                    </td>
                                </tr>
                            ) : (
                                filteredTasks.map((task, index) => {
                                    const person = activeTab === "my" ? task.assignedBy : task.assignedTo;

                                    return (
                                        <tr
                                            key={task.id}
                                            className="border-b border-[#f5f8fd] last:border-0 hover:bg-slate-50/50 transition-colors duration-150"
                                        >
                                            <td className="py-4 text-center text-slate-400 text-sm font-semibold">
                                                {index + 1}
                                            </td>

                                            <td className="py-4 px-4 text-[#1f2d4f] font-bold text-sm">
                                                {task.name}
                                            </td>

                                            <td className="py-4 px-4 text-slate-500 text-sm leading-relaxed max-w-sm">
                                                {task.description}
                                            </td>

                                            <td className="py-4 px-4">
                                                {person && (
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[0.78rem] font-bold shadow-sm ${getAvatarColorClass(person.id)}`}>
                                                            {getInitials(person.name)}
                                                        </div>
                                                        <span className="text-slate-700 font-semibold text-sm">
                                                            {person.name}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>

                                            <td className="py-4 px-4 text-slate-600 font-semibold text-sm">
                                                {task.deadline}
                                            </td>

                                            <td className="py-4 px-4">
                                                {task.status === "Pending" ? (
                                                    <span className="inline-flex items-center gap-1.5 bg-[#fff3e6] text-[#b25e00] px-3 py-1 rounded-full text-xs font-bold">
                                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                            <circle cx="12" cy="12" r="10"></circle>
                                                            <polyline points="12 6 12 12 16 14"></polyline>
                                                        </svg>
                                                        Pending
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 bg-[#eafaf1] text-[#1e7e4c] px-3 py-1 rounded-full text-xs font-bold">
                                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                                        </svg>
                                                        Completed
                                                    </span>
                                                )}
                                            </td>

                                            {activeTab === "my" && (
                                                <td className="py-4 px-4 text-center">
                                                    {task.status === "Pending" ? (
                                                        <button
                                                            onClick={() => handleMarkComplete(task.id)}
                                                            className="inline-flex items-center justify-center gap-1.5 bg-[#28336e] hover:bg-[#1f2756] text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                                                        >
                                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                <polyline points="20 6 9 17 4 12"></polyline>
                                                            </svg>
                                                            Mark Complete
                                                        </button>
                                                    ) : (
                                                        <span className="text-slate-400 text-[0.8rem] font-medium italic block py-2">
                                                            &ldquo;{task.actionFeedback || "Completed successfully"}&rdquo;
                                                        </span>
                                                    )}
                                                </td>
                                            )}

                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

            </div>

            {isModalOpen && mounted && createPortal(
                <div className="fixed inset-0 flex items-center justify-center p-4 animate-fadeIn" style={{ zIndex: 100000 }}>
                    <div
                        className="absolute inset-0 bg-[#0b122e]/45 backdrop-blur-sm transition-opacity duration-300"
                        onClick={() => setIsModalOpen(false)}
                    />

                    <div className="relative bg-white w-full max-w-[500px] rounded-3xl shadow-2xl border border-slate-100 overflow-visible transform scale-100 transition-all duration-300 animate-slideUp p-8 flex flex-col gap-6">

                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-[1.5rem] font-bold text-[#1f2d4f] tracking-tight">
                                    Create New Task
                                </h2>
                                <p className="text-slate-400 text-sm mt-1">
                                    Assign a task to yourself or a fellow accountant
                                </p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="w-8 h-8 text-slate-400 flex items-center justify-center hover:text-slate-600 transition focus:outline-none"
                                aria-label="Close dialog"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleCreateTask} className="flex flex-col gap-5">

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-bold text-[#1f2d4f] flex items-center">
                                    Task Name <span className="text-red-500 ml-1">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g., Q2 Tax Filing Review"
                                    value={newTaskName}
                                    onChange={(e) => setNewTaskName(e.target.value)}
                                    className="w-full h-[50px] px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#28336e]/10 focus:border-[#28336e] text-slate-800 text-sm placeholder-slate-300 font-medium transition"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-bold text-[#1f2d4f] flex items-center">
                                    Description <span className="text-red-500 ml-1">*</span>
                                </label>
                                <textarea
                                    required
                                    rows={3}
                                    placeholder="Describe the task clearly..."
                                    value={newTaskDesc}
                                    onChange={(e) => setNewTaskDesc(e.target.value)}
                                    className="w-full p-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#28336e]/10 focus:border-[#28336e] text-slate-800 text-sm placeholder-slate-300 font-medium transition resize-none h-[110px]"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5" ref={dropdownRef}>
                                <label className="text-sm font-bold text-[#1f2d4f] flex items-center">
                                    Assign To <span className="text-red-500 ml-1">*</span>
                                </label>

                                <div className={`property-status-select transaction-select relative${isDropdownOpen ? " is-open" : ""}`}>
                                    <button
                                        type="button"
                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                        className="property-status-trigger"
                                    >
                                        <span className="flex items-center gap-2.5 font-semibold text-slate-700">
                                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[0.78rem] font-bold shadow-sm ${getAvatarColorClass(newTaskAssignee.id)}`}>
                                                {getInitials(newTaskAssignee.name)}
                                            </span>
                                            <span>{newTaskAssignee.name}</span>
                                        </span>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </button>

                                    {isDropdownOpen && (
                                        <div className="property-status-menu" role="listbox">
                                            {TEAM_MEMBERS.map((member) => {
                                                const isSelected = member.name === newTaskAssignee.name;
                                                return (
                                                    <button
                                                        key={member.name}
                                                        type="button"
                                                        role="option"
                                                        aria-selected={isSelected}
                                                        className={isSelected ? "is-selected" : ""}
                                                        onClick={() => {
                                                            setNewTaskAssignee(member);
                                                            setIsDropdownOpen(false);
                                                        }}
                                                    >
                                                        <span className="flex items-center gap-2.5 font-semibold text-slate-700">
                                                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[0.7rem] font-bold ${getAvatarColorClass(member.id)}`}>
                                                                {getInitials(member.name)}
                                                            </span>
                                                            <span>{member.name}</span>
                                                        </span>
                                                        {isSelected && (
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="20 6 9 17 4 12"></polyline>
                                                            </svg>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-bold text-[#1f2d4f] flex items-center">
                                    Deadline <span className="text-red-500 ml-1">*</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={newTaskDeadline}
                                    onChange={(e) => setNewTaskDeadline(e.target.value)}
                                    className="w-full h-[50px] px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#28336e]/10 focus:border-[#28336e] text-slate-800 text-sm transition font-medium"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-6 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="text-slate-400 hover:text-slate-600 font-bold text-sm bg-transparent border-0 cursor-pointer transition mr-2 focus:outline-none"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className={`font-bold text-sm px-6 py-3 rounded-xl shadow-sm transition hover:-translate-y-0.5 cursor-pointer text-white ${newTaskName && newTaskDesc && newTaskDeadline
                                            ? "bg-[#28336e] hover:bg-[#1f2756] shadow-md"
                                            : "bg-[#a5aec9]"
                                        }`}
                                >
                                    + Create Task
                                </button>
                            </div>

                        </form>

                    </div>
                </div>,
                document.body
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-slideUp {
          animation: slideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />

        </div>
    );
}
