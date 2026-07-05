"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { getSession } from "../../../../src/lib/session";

interface SessionWithIdToken {
    getIdToken(): {
        getJwtToken(): string;
    };
}

interface Person {
    id: string;
    name: string;
}

interface Task {
    id: string;
    name: string;
    description: string;
    assignedBy?: Person;
    assignedTo?: Person;
    deadline: string;
    status: "Pending" | "Completed";
    actionFeedback?: string;
    type: "my" | "assigned";
}

// Shape returned by /api/tasks (normalized CoreTask).
interface ApiTaskPerson {
    id: string;
    name: string;
}
interface ApiTask {
    id: string;
    name: string;
    description: string;
    assignedBy: ApiTaskPerson;
    assignedTo: ApiTaskPerson;
    deadline: string;
    status: string;
    actionFeedback: string | null;
    type: "my" | "assigned";
}

const formatDeadline = (dateString: string) => {
    if (!dateString) return "";
    const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
    return new Date(dateString).toLocaleDateString("en-GB", options);
};

const personOrUndefined = (p: ApiTaskPerson): Person | undefined =>
    p && p.id ? { id: p.id, name: p.name || p.id } : undefined;

const toUiTask = (t: ApiTask): Task => ({
    id: t.id,
    name: t.name,
    description: t.description,
    assignedBy: personOrUndefined(t.assignedBy),
    assignedTo: personOrUndefined(t.assignedTo),
    deadline: formatDeadline(t.deadline),
    status: t.status === "completed" ? "Completed" : "Pending",
    actionFeedback: t.actionFeedback ?? undefined,
    type: t.type,
});

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

const getCleanedDate = (dateVal: string): string => {
    if (!dateVal) return "";
    const parts = dateVal.split("-");
    if (parts.length === 3) {
        let [year, month, day] = parts;
        if (year.length > 4) {
            year = year.substring(0, 4);
        }
        return `${year}-${month}-${day}`;
    }
    return dateVal;
};

const validateDeadline = (dateVal: string): string => {
    if (!dateVal) return "";
    const cleaned = getCleanedDate(dateVal);
    const parts = cleaned.split("-");
    if (parts.length !== 3) return "Please enter a valid date.";
    const [year, month, day] = parts;
    if (year.length !== 4 || month.length !== 2 || day.length !== 2) {
        return "Please enter a valid date (YYYY-MM-DD).";
    }
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 6);
    const maxStr = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, "0")}-${String(maxDate.getDate()).padStart(2, "0")}`;
    if (cleaned < todayStr) {
        return "Deadline cannot be in the past.";
    }
    if (cleaned > maxStr) {
        return "Deadline cannot be more than 6 months in the future.";
    }
    return "";
};

export default function TaskManagementPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [teamMembers, setTeamMembers] = useState<Person[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"my" | "assigned">("my");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [newTaskName, setNewTaskName] = useState("");
    const [newTaskDesc, setNewTaskDesc] = useState("");
    const [newTaskAssignee, setNewTaskAssignee] = useState<Person | null>(null);
    const [newTaskDeadline, setNewTaskDeadline] = useState("");
    const [newTaskDeadlineError, setNewTaskDeadlineError] = useState("");
    const [editTaskDeadlineError, setEditTaskDeadlineError] = useState("");

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [editTaskName, setEditTaskName] = useState("");
    const [editTaskDesc, setEditTaskDesc] = useState("");
    const [editTaskAssignee, setEditTaskAssignee] = useState<Person | null>(null);
    const [editTaskDeadline, setEditTaskDeadline] = useState("");
    const [isEditDropdownOpen, setIsEditDropdownOpen] = useState(false);
    const editDropdownRef = useRef<HTMLDivElement>(null);

    const totalTasksCount = tasks.length;
    const pendingTasksCount = tasks.filter((t) => t.status === "Pending").length;
    const completedTasksCount = tasks.filter((t) => t.status === "Completed").length;

    const filteredTasks = tasks.filter((t) => t.type === activeTab);
    const myTasksCount = tasks.filter((t) => t.type === "my").length;
    const assignedTasksCount = tasks.filter((t) => t.type === "assigned").length;

    const getToken = useCallback(async () => {
        const session = (await getSession()) as SessionWithIdToken | null;
        if (!session) return null;
        return session.getIdToken().getJwtToken();
    }, []);

    const loadTasks = useCallback(async () => {
        const token = await getToken();
        if (!token) return;
        const res = await fetch("/api/tasks", {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { items?: ApiTask[] };
        setTasks((data.items ?? []).map(toUiTask));
    }, [getToken]);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // Load tasks, the org's accountants (assignee options) and the current user.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const token = await getToken();
            if (!token) return;
            const headers = { Authorization: `Bearer ${token}` };

            void loadTasks();

            const meRes = await fetch("/api/users/me", { headers });
            const me = meRes.ok ? await meRes.json() : null;
            const meId: string = me?.id ?? "";
            if (!cancelled && meId) setCurrentUserId(meId);

            const accRes = await fetch("/api/users/me/accountants", { headers });
            const accData = accRes.ok
                ? ((await accRes.json()) as { accountants?: { id: string; name: string }[] })
                : { accountants: [] };
            if (cancelled) return;
            const members: Person[] = (accData.accountants ?? []).map((a) => ({
                id: a.id,
                name: a.id === meId ? `${a.name || "You"} (Me)` : a.name || a.id,
            }));
            if (meId && !members.some((m) => m.id === meId)) {
                members.unshift({
                    id: meId,
                    name: `${me?.full_name || me?.name || "You"} (Me)`
                });
            }
            setTeamMembers(members);
            const self = members.find((m) => m.id === meId);
            setNewTaskAssignee(self ?? members[0] ?? null);
        })();
        return () => {
            cancelled = true;
        };
    }, [getToken, loadTasks]);

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

    useEffect(() => {
        if (!isEditDropdownOpen) return;
        function handleClickOutside(event: MouseEvent) {
            if (editDropdownRef.current && !editDropdownRef.current.contains(event.target as Node)) {
                setIsEditDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isEditDropdownOpen]);

    const handleMarkComplete = async (taskId: string) => {
        const task = tasks.find((t) => t.id === taskId);
        const token = await getToken();
        if (!token) return;
        const res = await fetch(`/api/tasks/${taskId}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                status: "completed",
                action_feedback: task?.name.includes("GST")
                    ? "Submitted successfully via portal."
                    : "Completed successfully.",
            }),
        });
        if (res.ok) {
            await loadTasks();
        } else {
            alert("Failed to mark task complete.");
        }
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskName.trim() || !newTaskDesc.trim() || !newTaskDeadline || !newTaskAssignee) {
            alert("Please fill in all required fields.");
            return;
        }

        const error = validateDeadline(newTaskDeadline);
        if (error) {
            setNewTaskDeadlineError(error);
            return;
        }

        const cleanedDeadline = getCleanedDate(newTaskDeadline);
        const token = await getToken();
        if (!token) return;

        setSubmitting(true);
        try {
            const res = await fetch("/api/tasks", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newTaskName.trim(),
                    description: newTaskDesc.trim(),
                    assigned_to: newTaskAssignee.id,
                    deadline: new Date(cleanedDeadline).toISOString(),
                }),
            });
            if (!res.ok) {
                alert("Failed to create task.");
                return;
            }

            await loadTasks();
            setIsModalOpen(false);
            setNewTaskName("");
            setNewTaskDesc("");
            setNewTaskAssignee(teamMembers.find((m) => m.id === currentUserId) ?? teamMembers[0] ?? null);
            setNewTaskDeadline("");
            setNewTaskDeadlineError("");
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenEditModal = (task: Task) => {
        setEditingTask(task);
        setEditTaskName(task.name);
        setEditTaskDesc(task.description);
        
        const assignee = teamMembers.find((m) => m.id === task.assignedTo?.id) || null;
        setEditTaskAssignee(assignee);

        let dateVal = "";
        if (task.deadline) {
            const dateObj = new Date(task.deadline);
            if (!isNaN(dateObj.getTime())) {
                const yyyy = dateObj.getFullYear();
                const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
                const dd = String(dateObj.getDate()).padStart(2, "0");
                dateVal = `${yyyy}-${mm}-${dd}`;
            }
        }
        setEditTaskDeadline(dateVal);
        setEditTaskDeadlineError("");
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTask) return;
        if (!editTaskName.trim() || !editTaskDesc.trim() || !editTaskDeadline || !editTaskAssignee) {
            alert("Please fill in all required fields.");
            return;
        }

        const error = validateDeadline(editTaskDeadline);
        if (error) {
            setEditTaskDeadlineError(error);
            return;
        }

        const cleanedDeadline = getCleanedDate(editTaskDeadline);
        const token = await getToken();
        if (!token) return;

        setSubmitting(true);
        try {
            const res = await fetch(`/api/tasks/${editingTask.id}`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: editTaskName.trim(),
                    description: editTaskDesc.trim(),
                    assigned_to: editTaskAssignee.id,
                    deadline: new Date(cleanedDeadline).toISOString(),
                }),
            });
            if (!res.ok) {
                alert("Failed to update task.");
                return;
            }

            await loadTasks();
            setIsEditModalOpen(false);
            setEditingTask(null);
            setEditTaskName("");
            setEditTaskDesc("");
            setEditTaskAssignee(null);
            setEditTaskDeadline("");
            setEditTaskDeadlineError("");
        } catch (err) {
            console.error("Failed to save edit:", err);
            alert("An error occurred while updating the task.");
        } finally {
            setSubmitting(false);
        }
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
                            setNewTaskDeadlineError("");
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
                                <th className="pb-4 pt-1 px-4 text-center min-w-[160px]">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTasks.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-10 text-slate-400 font-medium">
                                        No tasks found in this tab. Click &ldquo;+ Create Task&rdquo; to add one.
                                    </td>
                                </tr>
                            ) : (
                                filteredTasks.map((task, index) => {
                                    const person = activeTab === "my" ? task.assignedBy : task.assignedTo;

                                    return (
                                        <tr
                                            key={task.id}
                                            className="task-row border-b border-[#f5f8fd] last:border-0"
                                        >
                                            <td className="py-4 text-center text-slate-400 text-sm font-semibold">
                                                {index + 1}
                                            </td>

                                            <td className="py-4 px-4 text-[#1f2d4f] font-bold text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span>{task.name}</span>
                                                    {task.assignedBy?.id === currentUserId && (
                                                        <span className="inline-flex items-center bg-[#eef2ff] text-[#4f46e5] text-[0.65rem] px-2 py-0.5 rounded-full font-bold border border-[#e0e7ff] tracking-wide uppercase select-none">
                                                            Owner
                                                        </span>
                                                    )}
                                                </div>
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

                                            <td className="py-4 px-4 text-center">
                                                <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                                                    {activeTab === "my" && (
                                                        task.status === "Pending" ? (
                                                            <button
                                                                onClick={() => handleMarkComplete(task.id)}
                                                                className="inline-flex items-center justify-center gap-1.5 h-9 bg-[#28336e] hover:bg-[#1f2756] text-white px-3.5 rounded-xl text-xs font-bold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                                                            >
                                                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                                </svg>
                                                                Mark Complete
                                                            </button>
                                                        ) : (
                                                            <span className="text-slate-400 text-[0.8rem] font-semibold italic block py-2">
                                                                &ldquo;{task.actionFeedback || "Completed successfully"}&rdquo;
                                                            </span>
                                                        )
                                                    )}
                                                    {task.assignedBy?.id === currentUserId && task.status !== "Completed" && (
                                                        <button
                                                            onClick={() => handleOpenEditModal(task)}
                                                            className="inline-flex items-center justify-center gap-1.5 h-9 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 px-3.5 rounded-xl text-xs font-bold border border-indigo-100/50 shadow-sm transition-all duration-200 hover:-translate-y-0.5"
                                                            title="You created this task"
                                                        >
                                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M12 20h9"></path>
                                                                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
                                                            </svg>
                                                            Edit
                                                        </button>
                                                    )}
                                                </div>
                                            </td>

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
                        onClick={() => {
                            setIsModalOpen(false);
                            setNewTaskDeadlineError("");
                        }}
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
                                onClick={() => {
                                    setIsModalOpen(false);
                                    setNewTaskDeadlineError("");
                                }}
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
                                <div className="relative flex items-center">
                                  
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g., Q2 Tax Filing Review"
                                        value={newTaskName}
                                        onChange={(e) => setNewTaskName(e.target.value)}
                                        className="w-full h-[50px] pl-3 pr-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#28336e]/10 focus:border-[#28336e] text-slate-800 text-sm placeholder-slate-300 font-semibold transition bg-slate-50/30 hover:bg-slate-50/80"
                                    />
                                </div>
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
                                    className="w-full p-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#28336e]/10 focus:border-[#28336e] text-slate-800 text-sm placeholder-slate-300 font-semibold transition bg-slate-50/30 hover:bg-slate-50/80 resize-none h-[110px]"
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
                                        className="property-status-trigger !bg-slate-50/30 hover:!bg-slate-50/80 !border-slate-200 focus:!ring-2 focus:!ring-[#28336e]/10 focus:!border-[#28336e] !rounded-xl !h-[50px] !px-4"
                                    >
                                        <span className="flex items-center gap-2.5 font-semibold text-slate-700">
                                            {newTaskAssignee ? (
                                                <>
                                                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[0.78rem] font-bold shadow-sm ${getAvatarColorClass(newTaskAssignee.id)}`}>
                                                        {getInitials(newTaskAssignee.name)}
                                                    </span>
                                                    <span>{newTaskAssignee.name}</span>
                                                </>
                                            ) : (
                                                <span className="text-slate-400">Select team member</span>
                                            )}
                                        </span>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </button>

                                    {isDropdownOpen && (
                                        <div className="property-status-menu" role="listbox">
                                            {teamMembers.map((member) => {
                                                const isSelected = member.id === newTaskAssignee?.id;
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
                                <div className="relative flex items-center">
                                    <span className="absolute left-4 text-slate-400 pointer-events-none">
                                        <svg className="w-4.5 h-4.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                            <line x1="16" y1="2" x2="16" y2="6"></line>
                                            <line x1="8" y1="2" x2="8" y2="6"></line>
                                            <line x1="3" y1="10" x2="21" y2="10"></line>
                                        </svg>
                                    </span>
                                    <input
                                        type="date"
                                        required
                                        min={(() => {
                                            const d = new Date();
                                            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                                        })()}
                                        max={(() => {
                                            const d = new Date();
                                            d.setMonth(d.getMonth() + 6);
                                            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                                        })()}
                                        value={newTaskDeadline}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (!val) {
                                                setNewTaskDeadline("");
                                                setNewTaskDeadlineError("");
                                                return;
                                            }
                                            const parts = val.split("-");
                                            let newVal = val;
                                            if (parts.length === 3) {
                                                let [year, month, day] = parts;
                                                if (year.length > 4) {
                                                    year = year.substring(0, 4);
                                                }
                                                newVal = `${year}-${month}-${day}`;
                                            }
                                            setNewTaskDeadline(newVal);
                                            const err = validateDeadline(newVal);
                                            if (err && err !== "Please enter a valid date." && err !== "Please enter a valid date (YYYY-MM-DD).") {
                                                setNewTaskDeadlineError(err);
                                            } else {
                                                setNewTaskDeadlineError("");
                                            }
                                        }}
                                        onBlur={() => {
                                            if (!newTaskDeadline) {
                                                setNewTaskDeadlineError("");
                                                return;
                                            }
                                            setNewTaskDeadlineError(validateDeadline(newTaskDeadline));
                                        }}
                                        className={`w-full h-[50px] pl-11 pr-4 rounded-xl border focus:outline-none focus:ring-2 text-slate-800 text-sm transition font-semibold bg-slate-50/30 hover:bg-slate-50/80 ${
                                            newTaskDeadlineError
                                                ? "border-rose-400 focus:ring-rose-500/10 focus:border-rose-500"
                                                : "border-slate-200 focus:ring-[#28336e]/10 focus:border-[#28336e]"
                                        }`}
                                    />
                                </div>
                                {newTaskDeadlineError && (
                                    <div className="flex items-center gap-1.5 text-rose-600 mt-1 ml-1 animate-fadeIn">
                                        <svg className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-[0.78rem] font-medium tracking-tight">{newTaskDeadlineError}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-6 mt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsModalOpen(false);
                                        setNewTaskDeadlineError("");
                                    }}
                                    className="text-slate-400 hover:text-slate-600 font-bold text-sm bg-transparent border-0 cursor-pointer transition mr-2 focus:outline-none"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting || !!newTaskDeadlineError}
                                    className={`inline-flex items-center justify-center gap-2 font-bold text-sm px-6 py-3 rounded-xl shadow-sm transition hover:-translate-y-0.5 cursor-pointer text-white ${newTaskName && newTaskDesc && newTaskDeadline && newTaskAssignee && !newTaskDeadlineError && !submitting
                                            ? "bg-[#28336e] hover:bg-[#1f2756] shadow-md"
                                            : "bg-[#a5aec9] cursor-not-allowed"
                                        }`}
                                >
                                    {submitting ? (
                                        "Creating…"
                                    ) : (
                                        <>
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
                                        </>
                                    )}
                                </button>
                            </div>

                        </form>

                    </div>
                </div>,
                document.body
            )}

            {isEditModalOpen && mounted && createPortal(
                <div className="fixed inset-0 flex items-center justify-center p-4 animate-fadeIn" style={{ zIndex: 100000 }}>
                    <div
                        className="absolute inset-0 bg-[#0b122e]/45 backdrop-blur-sm transition-opacity duration-300"
                        onClick={() => {
                            setIsEditModalOpen(false);
                            setEditingTask(null);
                            setEditTaskDeadlineError("");
                        }}
                    />

                    <div className="relative bg-white w-full max-w-[500px] rounded-3xl shadow-2xl border border-slate-100 overflow-visible transform scale-100 transition-all duration-300 animate-slideUp p-8 flex flex-col gap-6">

                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-[1.5rem] font-bold text-[#1f2d4f] tracking-tight">
                                    Edit Task
                                </h2>
                                <p className="text-slate-400 text-sm mt-1">
                                    Modify task details or assignee
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setIsEditModalOpen(false);
                                    setEditingTask(null);
                                    setEditTaskDeadlineError("");
                                }}
                                className="w-8 h-8 text-slate-400 flex items-center justify-center hover:text-slate-600 transition focus:outline-none"
                                aria-label="Close dialog"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSaveEdit} className="flex flex-col gap-5">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-bold text-[#1f2d4f] flex items-center">
                                    Task Name <span className="text-red-500 ml-1">*</span>
                                </label>
                                <div className="relative flex items-center">
                                  
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g., Q2 Tax Filing Review"
                                        value={editTaskName}
                                        onChange={(e) => setEditTaskName(e.target.value)}
                                        className="w-full h-[50px] pl-3 pr-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#28336e]/10 focus:border-[#28336e] text-slate-800 text-sm placeholder-slate-300 font-semibold transition bg-slate-50/30 hover:bg-slate-50/80"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-bold text-[#1f2d4f] flex items-center">
                                    Description <span className="text-red-500 ml-1">*</span>
                                </label>
                                <textarea
                                    required
                                    rows={3}
                                    placeholder="Describe the task clearly..."
                                    value={editTaskDesc}
                                    onChange={(e) => setEditTaskDesc(e.target.value)}
                                    className="w-full p-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#28336e]/10 focus:border-[#28336e] text-slate-800 text-sm placeholder-slate-300 font-semibold transition bg-slate-50/30 hover:bg-slate-50/80 resize-none h-[110px]"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5" ref={editDropdownRef}>
                                <label className="text-sm font-bold text-[#1f2d4f] flex items-center">
                                    Assign To <span className="text-red-500 ml-1">*</span>
                                </label>

                                <div className={`property-status-select transaction-select relative${isEditDropdownOpen ? " is-open" : ""}`}>
                                    <button
                                        type="button"
                                        onClick={() => setIsEditDropdownOpen(!isEditDropdownOpen)}
                                        className="property-status-trigger !bg-slate-50/30 hover:!bg-slate-50/80 !border-slate-200 focus:!ring-2 focus:!ring-[#28336e]/10 focus:!border-[#28336e] !rounded-xl !h-[50px] !px-4"
                                    >
                                        <span className="flex items-center gap-2.5 font-semibold text-slate-700">
                                            {editTaskAssignee ? (
                                                <>
                                                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[0.78rem] font-bold shadow-sm ${getAvatarColorClass(editTaskAssignee.id)}`}>
                                                        {getInitials(editTaskAssignee.name)}
                                                    </span>
                                                    <span>{editTaskAssignee.name}</span>
                                                </>
                                            ) : (
                                                <span className="text-slate-400">Select team member</span>
                                            )}
                                        </span>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="6 9 12 15 18 9"></polyline>
                                        </svg>
                                    </button>

                                    {isEditDropdownOpen && (
                                        <div className="property-status-menu" role="listbox">
                                            {teamMembers.map((member) => {
                                                const isSelected = member.id === editTaskAssignee?.id;
                                                return (
                                                    <button
                                                        key={member.name}
                                                        type="button"
                                                        role="option"
                                                        aria-selected={isSelected}
                                                        className={isSelected ? "is-selected" : ""}
                                                        onClick={() => {
                                                            setEditTaskAssignee(member);
                                                            setIsEditDropdownOpen(false);
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
                                <div className="relative flex items-center">
                                    <span className="absolute left-4 text-slate-400 pointer-events-none">
                                        <svg className="w-4.5 h-4.5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                            <line x1="16" y1="2" x2="16" y2="6"></line>
                                            <line x1="8" y1="2" x2="8" y2="6"></line>
                                            <line x1="3" y1="10" x2="21" y2="10"></line>
                                        </svg>
                                    </span>
                                    <input
                                        type="date"
                                        required
                                        min={(() => {
                                            const d = new Date();
                                            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                                        })()}
                                        max={(() => {
                                            const d = new Date();
                                            d.setMonth(d.getMonth() + 6);
                                            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                                        })()}
                                        value={editTaskDeadline}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (!val) {
                                                setEditTaskDeadline("");
                                                setEditTaskDeadlineError("");
                                                return;
                                            }
                                            const parts = val.split("-");
                                            let newVal = val;
                                            if (parts.length === 3) {
                                                let [year, month, day] = parts;
                                                if (year.length > 4) {
                                                    year = year.substring(0, 4);
                                                }
                                                newVal = `${year}-${month}-${day}`;
                                            }
                                            setEditTaskDeadline(newVal);
                                            const err = validateDeadline(newVal);
                                            if (err && err !== "Please enter a valid date." && err !== "Please enter a valid date (YYYY-MM-DD).") {
                                                setEditTaskDeadlineError(err);
                                            } else {
                                                setEditTaskDeadlineError("");
                                            }
                                        }}
                                        onBlur={() => {
                                            if (!editTaskDeadline) {
                                                setEditTaskDeadlineError("");
                                                return;
                                            }
                                            setEditTaskDeadlineError(validateDeadline(editTaskDeadline));
                                        }}
                                        className={`w-full h-[50px] pl-11 pr-4 rounded-xl border focus:outline-none focus:ring-2 text-slate-800 text-sm transition font-semibold bg-slate-50/30 hover:bg-slate-50/80 ${
                                            editTaskDeadlineError
                                                ? "border-rose-400 focus:ring-rose-500/10 focus:border-rose-500"
                                                : "border-slate-200 focus:ring-[#28336e]/10 focus:border-[#28336e]"
                                        }`}
                                    />
                                </div>
                                {editTaskDeadlineError && (
                                    <div className="flex items-center gap-1.5 text-rose-600 mt-1 ml-1 animate-fadeIn">
                                        <svg className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-[0.78rem] font-medium tracking-tight">{editTaskDeadlineError}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-6 mt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEditModalOpen(false);
                                        setEditingTask(null);
                                        setEditTaskDeadlineError("");
                                    }}
                                    className="text-slate-400 hover:text-slate-600 font-bold text-sm bg-transparent border-0 cursor-pointer transition mr-2 focus:outline-none"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting || !!editTaskDeadlineError}
                                    className={`font-bold text-sm px-6 py-3 rounded-xl shadow-sm transition hover:-translate-y-0.5 cursor-pointer text-white ${editTaskName && editTaskDesc && editTaskDeadline && editTaskAssignee && !editTaskDeadlineError && !submitting
                                            ? "bg-[#28336e] hover:bg-[#1f2756] shadow-md"
                                            : "bg-[#a5aec9] cursor-not-allowed"
                                        }`}
                                >
                                    {submitting ? "Saving…" : "Save Changes"}
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
        .task-row {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .task-row:hover {
          background-color: #f8fafc !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 20px -2px rgba(30, 41, 59, 0.05);
        }
      `}} />

        </div>
    );
}
