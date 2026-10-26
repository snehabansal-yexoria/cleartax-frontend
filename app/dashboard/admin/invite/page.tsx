"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { getSession } from "@/src/lib/session";
import { SHOW_INVITE_CREDENTIALS } from "@/src/lib/appConfig";

// ============================================================================
// Types & Interfaces
// ============================================================================

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

interface InvitedUser {
  id: string;
  email: string;
  role: string;
  status: string;
  name: string;
  organizationName: string;
  invitedByEmail: string;
  createdAt: string | null;
}

interface AccountantData {
  id: string;
  name: string;
  email: string;
}

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  role: "client" | "accountant" | "regional_manager";
  assignedAccountantId: string;
  personalMessage: string;
}

interface SuccessInfo {
  inviteLink: string;
  tempPassword: string;
  role: string;
  email: string;
}

interface BulkSuccess {
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    row: number;
    email: string;
    role: string;
    success: boolean;
    temporaryPassword?: string;
    error?: string;
  }>;
}

// ============================================================================
// Constants & Helper Mappings
// ============================================================================

const INITIAL_FORM_STATE: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  role: "client",
  assignedAccountantId: "",
  personalMessage: "",
};

const ROLE_LABELS: Record<string, string> = {
  client: "Client",
  accountant: "Accountant",
  regional_manager: "Relationship manager",
  relationship_manager: "Relationship manager",
};

/**
 * Builds the URL link that the user will follow to accept their invitation.
 */
function buildInviteLink(params: {
  origin: string;
  token: string;
  email: string;
  role: string;
  temporaryPassword: string;
}) {
  const url = new URL("/invite", params.origin);
  url.searchParams.set("token", params.token);
  url.searchParams.set("email", params.email);
  url.searchParams.set("role", params.role);

  return `${url.toString()}#temporary_password=${encodeURIComponent(
    params.temporaryPassword
  )}`;
}

// ============================================================================
// Main Component
// ============================================================================

export default function InviteUserByAdmin() {
  // Navigation active tab State
  const [activeTab, setActiveTab] = useState<"individual" | "bulk" | "pending">("individual");

  // Tab 1: Individual form state
  const [form, setForm] = useState<FormState>(INITIAL_FORM_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<SuccessInfo | null>(null);

  // Copy badges feedback state
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Core API resources state
  const [accountants, setAccountants] = useState<AccountantData[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([]);
  const [pendingCount, setPendingCount] = useState(16);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Tab 2: Bulk upload state
  const [csvText, setCsvText] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSuccess, setBulkSuccess] = useState<BulkSuccess | null>(null);

  // Tab 3: Search filter state
  const [pendingSearch, setPendingSearch] = useState("");

  // Accountant custom dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close custom dropdown
  useEffect(() => {
    if (!isDropdownOpen) return;
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isDropdownOpen]);

  // ============================================================================
  // API Operations
  // ============================================================================

  const loadInitialData = useCallback(async () => {
    try {
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) return;
      const token = session.getIdToken().getJwtToken();

      const [accRes, invitedRes] = await Promise.all([
        fetch("/api/users/me/accountants", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/users/me/invited", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (accRes.ok) {
        const data = await accRes.json();
        setAccountants(data.accountants || []);
      }

      if (invitedRes.ok) {
        const data = await invitedRes.json();
        const usersList: InvitedUser[] = data.users || [];
        setInvitedUsers(usersList);
        const pCount =
          data.summary?.pending ??
          usersList.filter((u) => ["INVITED", "PENDING"].includes(u.status)).length;
        setPendingCount(pCount);
      }
    } catch (err) {
      console.error("Failed to retrieve organization context:", err);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleFormChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleClearForm = () => {
    setForm(INITIAL_FORM_STATE);
    setError(null);
    setSuccessInfo(null);
    setIsDropdownOpen(false);
  };

  const handleCopyClipboard = (text: string, setFeedback: (v: boolean) => void) => {
    void navigator.clipboard.writeText(text);
    setFeedback(true);
    setTimeout(() => setFeedback(false), 2000);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessInfo(null);

    const { firstName, lastName, email, role, assignedAccountantId } = form;

    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required parameters.");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setError("Please input a valid recipient email address.");
      return;
    }

    try {
      setLoading(true);
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) {
        setError("Your session has expired. Please log in again.");
        return;
      }
      const token = session.getIdToken().getJwtToken();

      // 1. Send the invitation payload
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const inviteRes = await fetch("/api/invite-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: email.trim(),
          role,
          full_name: fullName,
        }),
      });

      const inviteData = await inviteRes.json();

      if (!inviteRes.ok) {
        setError(inviteData.error || "Failed to provision user profile.");
        return;
      }

      // 2. Perform accountant assignment if client and selected
      if (role === "client" && assignedAccountantId) {
        try {
          await fetch("/api/users/me/clients/transfer", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              clientId: inviteData.userId,
              toAccountantId: assignedAccountantId,
              reason: "Assigned dynamically during setup flow.",
            }),
          });
        } catch (assignErr) {
          console.warn("Accountant linkage failed (non-fatal):", assignErr);
        }
      }

      // Setup success credentials view
      const tPassword = inviteData.temporaryPassword || "";
      const generatedLink = buildInviteLink({
        origin: window.location.origin,
        token: String(inviteData.invitationToken || ""),
        email: String(inviteData.email || email),
        role: String(inviteData.role || role),
        temporaryPassword: tPassword,
      });

      setSuccessInfo({
        inviteLink: generatedLink,
        tempPassword: tPassword,
        role: inviteData.role || role,
        email: inviteData.email || email,
      });

      // Reset form variables
      setForm(INITIAL_FORM_STATE);

      // Async update data
      void loadInitialData();
    } catch (err) {
      console.error("Invite handler failure:", err);
      setError("An unexpected system exception occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkError(null);
    setBulkSuccess(null);

    if (!csvText.trim()) {
      setBulkError("CSV content payload cannot be empty.");
      return;
    }

    try {
      setBulkLoading(true);
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) {
        setBulkError("Your session has expired. Please log in again.");
        return;
      }
      const token = session.getIdToken().getJwtToken();

      const lines = csvText.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        setBulkError("CSV input must contain a header row and at least one record.");
        return;
      }

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const emailIdx = headers.indexOf("email");
      const roleIdx = headers.indexOf("role");
      const nameIdx = headers.indexOf("full_name");

      if (emailIdx === -1 || roleIdx === -1) {
        setBulkError("CSV must contain 'email' and 'role' header columns.");
        return;
      }

      const rows = lines.slice(1).map((line) => {
        const parts = line.split(",").map((p) => p.trim());
        const rawRole = (parts[roleIdx] || "").toLowerCase().replace(/[\s-]+/g, "_");
        const formattedRole =
          rawRole === "relationship_manager" || rawRole === "relationship manager"
            ? "regional_manager"
            : rawRole;

        return {
          email: parts[emailIdx] || "",
          role: formattedRole,
          full_name: nameIdx !== -1 ? parts[nameIdx] || "" : "",
        };
      });

      const res = await fetch("/api/invite-user/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rows }),
      });

      const data = await res.json();

      if (!res.ok) {
        setBulkError(data.error || "Failed to parse CSV upload batch.");
        return;
      }

      setBulkSuccess(data);
      setCsvText("");
      void loadInitialData();
    } catch (err) {
      console.error("Bulk process exception:", err);
      setBulkError("An error occurred while uploading batch invitation records.");
    } finally {
      setBulkLoading(false);
    }
  };

  // ============================================================================
  // Memoized Filters
  // ============================================================================

  const filteredPendingInvites = useMemo(() => {
    return invitedUsers
      .filter((user) => ["INVITED", "PENDING"].includes(user.status))
      .filter((user) => {
        if (!pendingSearch) return true;
        const q = pendingSearch.toLowerCase();
        return (
          user.email.toLowerCase().includes(q) ||
          user.name.toLowerCase().includes(q) ||
          user.role.toLowerCase().includes(q)
        );
      });
  }, [invitedUsers, pendingSearch]);

  const displayRoleText = useCallback((roleKey: string) => {
    return ROLE_LABELS[roleKey] || roleKey.charAt(0).toUpperCase() + roleKey.slice(1);
  }, []);

  const selectedAccountantLabel = useMemo(() => {
    const selected = accountants.find((acc) => acc.id === form.assignedAccountantId);
    return selected ? selected.name : "Select accountant...";
  }, [accountants, form.assignedAccountantId]);

  return (
    <div className="w-full max-w-[1240px] mx-auto px-4 py-4 transition-all duration-300 ease-in-out">
      {/* Title Header */}
      <div className="mb-6">
        <h1 className="text-[25px] font-semibold text-[#0f172a] tracking-tight mb-1 select-none">Invite users</h1>
        <p className="text-[12.5px] text-[#64748b] font-normal leading-normal">
          Add clients, accountants, and relationship managers to ClearPortfolio
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 pb-0 mb-6 select-none">
        {(["individual", "bulk", "pending"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 px-1 text-[13.5px] font-semibold transition-all duration-200 mr-8 border-b-2 outline-none cursor-pointer -mb-[1.5px] capitalize ${
              activeTab === tab
                ? "border-blue-600 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-700"
            }`}
          >
            {tab === "individual" ? "Invite individually" : tab === "bulk" ? "Bulk upload" : "Pending invites"}
            {tab === "pending" && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1.5 transition-colors duration-200 ${
                  activeTab === "pending"
                    ? "bg-[#fef3c7] text-[#d97706]"
                    : "bg-[#fef3c7]/65 text-[#d97706]/90"
                }`}
              >
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Contents Grid */}
      <div className="w-full">
        
        {/* TAB 1: INDIVIDUAL INVITE */}
        {activeTab === "individual" && (
          <div className="space-y-6">
            
            {/* SELECT ROLE SECTION */}
            <div>
              <span className="text-[10.5px] font-extrabold text-[#64748b]/90 uppercase tracking-wider block mb-3.5 select-none">
                Select Role
              </span>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Role Card 1: Client */}
                <div
                  onClick={() => handleFormChange("role", "client")}
                  className={`rounded-xl p-5 border-2 text-left cursor-pointer transition-all duration-300 ease-in-out flex flex-col justify-between min-h-[135px] hover:shadow-sm hover:-translate-y-0.5 ${
                    form.role === "client"
                      ? "border-blue-500 bg-[#f4f7ff]"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div>
                    {/* Perfect circle badge */}
                    <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3 bg-[#e6f4ea] text-[#137333]">
                      <svg className="w-5 h-5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <h3 className="text-[13.5px] font-bold text-[#0f172a] mb-1">Client</h3>
                    <p className="text-[11.5px] text-[#64748b] font-normal leading-[1.5]">
                      Access to their own portfolio, properties, transactions, and documents.
                    </p>
                  </div>
                </div>

                {/* Role Card 2: Accountant */}
                <div
                  onClick={() => handleFormChange("role", "accountant")}
                  className={`rounded-xl p-5 border-2 text-left cursor-pointer transition-all duration-300 ease-in-out flex flex-col justify-between min-h-[135px] hover:shadow-sm hover:-translate-y-0.5 ${
                    form.role === "accountant"
                      ? "border-blue-500 bg-[#f4f7ff]"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div>
                    {/* Perfect circle badge & calculator SVG */}
                    <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3 bg-[#e8f0fe] text-[#1a73e8]">
                      <svg className="w-5 h-5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                        <line x1="8" y1="6" x2="16" y2="6" />
                        <line x1="16" y1="14" x2="16" y2="18" />
                        <path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01" />
                      </svg>
                    </div>
                    <h3 className="text-[13.5px] font-bold text-[#0f172a] mb-1">Accountant</h3>
                    <p className="text-[11.5px] text-[#64748b] font-normal leading-[1.5]">
                      Manages assigned client portfolios — transactions, properties, and reports.
                    </p>
                  </div>
                </div>

                {/* Role Card 3: Relationship Manager */}
                <div
                  onClick={() => handleFormChange("role", "regional_manager")}
                  className={`rounded-xl p-5 border-2 text-left cursor-pointer transition-all duration-300 ease-in-out flex flex-col justify-between min-h-[135px] hover:shadow-sm hover:-translate-y-0.5 ${
                    form.role === "regional_manager"
                      ? "border-blue-500 bg-[#f4f7ff]"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div>
                    {/* Perfect circle badge & briefcase SVG */}
                    <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3 bg-[#f3e8ff] text-[#a855f7]">
                      <svg className="w-5 h-5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                      </svg>
                    </div>
                    <h3 className="text-[13.5px] font-bold text-[#0f172a] mb-1">Relationship manager</h3>
                    <p className="text-[11.5px] text-[#64748b] font-normal leading-[1.5]">
                      Read-only oversight of assigned client portfolios and reports.
                    </p>
                  </div>
                </div>

              </div>
            </div>

            {/* Form details section aligned in columns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start mt-6">
              
              {/* Column 1: Invite Details Card */}
              <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-sm">
                <h3 className="text-[14.5px] font-bold text-[#0f172a] mb-4">Invite details</h3>
                
                <form onSubmit={handleSendInvite} className="space-y-4">
                  {error && (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-[13px] flex gap-3 items-start animate-shake">
                      <svg className="w-4.5 h-4.5 shrink-0 mt-0.5 text-red-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <div>
                        <span className="font-bold block mb-0.5">Error sending invitation</span>
                        <span className="text-[12px] text-red-600/90">{error}</span>
                      </div>
                    </div>
                  )}

                  {/* Row: First & Last Name */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                        First name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Sneha"
                        value={form.firstName}
                        onChange={(e) => handleFormChange("firstName", e.target.value)}
                        className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition duration-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                        Last name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Bansal"
                        value={form.lastName}
                        onChange={(e) => handleFormChange("lastName", e.target.value)}
                        className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition duration-200"
                      />
                    </div>
                  </div>

                  {/* Email field */}
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                      Email address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. sneha@email.com"
                      value={form.email}
                      onChange={(e) => handleFormChange("email", e.target.value)}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition duration-200"
                    />
                  </div>

                  {/* Assign accountant (Only for Client) */}
                  {form.role === "client" && (
                    <div>
                      <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Assign accountant</label>
                      {isLoadingData ? (
                        <div className="w-full h-10 bg-slate-100 animate-pulse rounded-lg" />
                      ) : (
                        <div className={`property-status-select${isDropdownOpen ? " is-open" : ""}`} ref={dropdownRef}>
                          <button
                            type="button"
                            className="property-status-trigger"
                            style={{
                              minHeight: "40px",
                              padding: "0 12px",
                              fontSize: "13px",
                              fontWeight: "normal",
                              borderRadius: "8px",
                              borderColor: "#e2e8f0",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              width: "100%",
                              color: form.assignedAccountantId ? "#0f172a" : "#94a3b8",
                              background: "#ffffff"
                            }}
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          >
                            <span>{selectedAccountantLabel}</span>
                            <svg
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                              style={{
                                width: "14px",
                                height: "14px",
                                fill: "none",
                                stroke: "currentColor",
                                strokeWidth: 2.5,
                                transform: isDropdownOpen ? "rotate(180deg)" : "none",
                                transition: "transform 140ms ease",
                              }}
                            >
                              <path d="m6 9 6 6 6-6" />
                            </svg>
                          </button>
                          {isDropdownOpen && (
                            <div
                              className="property-status-menu"
                              style={{
                                zIndex: 50,
                                position: "absolute",
                                left: 0,
                                right: 0,
                                boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                                maxHeight: "200px",
                                overflowY: "auto",
                                background: "#ffffff",
                                border: "1px solid #e2e8f0",
                                borderRadius: "8px",
                                padding: "4px"
                              }}
                              role="listbox"
                            >
                              <button
                                type="button"
                                role="option"
                                aria-selected={form.assignedAccountantId === ""}
                                className={form.assignedAccountantId === "" ? "is-selected" : ""}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  handleFormChange("assignedAccountantId", "");
                                  setIsDropdownOpen(false);
                                }}
                                style={{
                                  fontSize: "13px",
                                  padding: "8px 12px",
                                  minHeight: "36px",
                                  borderRadius: "6px",
                                  borderBottom: "none",
                                  width: "100%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between"
                                }}
                              >
                                <span style={{ color: "#94a3b8" }}>Select accountant...</span>
                                {form.assignedAccountantId === "" && (
                                  <svg
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                    style={{ width: "14px", height: "14px", fill: "none", stroke: "currentColor", strokeWidth: 2.5, color: "#2563eb" }}
                                  >
                                    <path d="M5 12l4 4 10-10" />
                                  </svg>
                                )}
                              </button>
                              {accountants.map((acc) => (
                                <button
                                  key={acc.id}
                                  type="button"
                                  role="option"
                                  aria-selected={form.assignedAccountantId === acc.id}
                                  className={form.assignedAccountantId === acc.id ? "is-selected" : ""}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    handleFormChange("assignedAccountantId", acc.id);
                                    setIsDropdownOpen(false);
                                  }}
                                  style={{
                                    fontSize: "13px",
                                    padding: "8px 12px",
                                    minHeight: "36px",
                                    borderRadius: "6px",
                                    borderBottom: "none",
                                    width: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between"
                                  }}
                                >
                                  <span style={{ color: form.assignedAccountantId === acc.id ? "#2563eb" : "#0f172a" }}>{acc.name}</span>
                                  {form.assignedAccountantId === acc.id && (
                                    <svg
                                      viewBox="0 0 24 24"
                                      aria-hidden="true"
                                      style={{ width: "14px", height: "14px", fill: "none", stroke: "currentColor", strokeWidth: 2.5, color: "#2563eb" }}
                                    >
                                      <path d="M5 12l4 4 10-10" />
                                    </svg>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <p className="text-[11px] text-[#64748b] font-normal mt-1.5 leading-normal select-none">
                        You can assign or change this later from the client profile.
                      </p>
                    </div>
                  )}

                  {/* Personal message */}
                  <div>
                    <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Personal message (optional)</label>
                    <textarea
                      rows={4}
                      placeholder="Add a personal note to the invite email..."
                      value={form.personalMessage}
                      onChange={(e) => handleFormChange("personalMessage", e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition duration-200 resize-none"
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[13px] rounded-lg transition disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 active:scale-[0.98]"
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Sending...</span>
                        </>
                      ) : (
                        "Send invite"
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleClearForm}
                      className="px-5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-[13px] rounded-lg transition cursor-pointer active:scale-[0.98]"
                    >
                      Clear
                    </button>
                  </div>
                </form>
              </div>

              {/* Column 2: Email Preview card */}
              <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-sm">
                <h3 className="text-[14.5px] font-bold text-[#0f172a] mb-4">Email preview</h3>
                
                {/* Mock email template envelope */}
                <div className="border border-slate-200/70 rounded-xl bg-[#f8f9fa] p-5 space-y-4">
                  <div className="border-b border-slate-200/40 pb-3">
                    <span className="text-[15px] font-bold text-slate-900 block">Welcome to ClearPortfolio</span>
                  </div>
                  
                  <div className="space-y-3.5 text-[13px] text-slate-600 font-normal leading-relaxed">
                    <p>
                      Hello <strong className="text-slate-800 font-bold">{form.firstName.trim() || "[First name]"}</strong>,
                    </p>
                    <p>
                      {"You've"} been invited to join ClearPortfolio as a{" "}
                      <strong className="text-[#1a73e8] font-bold">
                        {displayRoleText(form.role)}
                      </strong>.
                    </p>
                    
                    {form.personalMessage.trim() && (
                      <div className="p-3 bg-white border-l-4 border-blue-500 rounded text-slate-600 text-[12px] italic my-2 animate-fade-in break-words">
                        &quot;{form.personalMessage}&quot;
                      </div>
                    )}

                    <p>Click the button below to set your password and access your account.</p>
                    
                    <div className="pt-2">
                      <button
                        type="button"
                        className="px-4.5 py-2.5 bg-[#0f172a] text-white font-semibold text-[12px] rounded-lg shadow cursor-default flex items-center gap-1.5 transition hover:bg-[#1e293b]"
                      >
                        Set up your account
                        <span className="text-[11px] font-bold">→</span>
                      </button>
                    </div>
                    
                    <p className="text-[11px] text-slate-400 mt-4 select-none">This link expires in 24 hours.</p>
                  </div>
                </div>

                <p className="text-[11.5px] text-[#64748b] font-normal mt-4 leading-relaxed select-none">
                  The invite link expires after 24 hours. If a link expires before activation, resend it from Pending invites.
                </p>
              </div>

              {/* Column 3: Empty space */}
              <div className="hidden lg:block lg:col-span-1" />

            </div>

            {/* Success details block */}
            {successInfo && (
              <div className="mt-8 p-6 bg-emerald-50 border border-emerald-200 rounded-xl max-w-[800px] animate-slide-down">
                <div className="flex gap-3.5 items-start">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div>
                      <h4 className="text-[14.5px] font-bold text-slate-900 mb-1">Invitation Sent Successfully</h4>
                      <p className="text-[13px] text-slate-600 font-normal leading-relaxed">
                        An invitation email has been sent to <strong className="text-slate-800">{successInfo.email}</strong>.
                      </p>
                    </div>

                    {SHOW_INVITE_CREDENTIALS && (
                      <div className="space-y-4 pt-1 max-w-[600px]">
                        <div>
                          <span className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider select-none">Secure Invite Link</span>
                          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2 pl-3">
                            <span className="text-[12.5px] text-slate-600 font-medium truncate flex-1">{successInfo.inviteLink}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyClipboard(successInfo.inviteLink, setCopiedLink)}
                              className={`px-3 py-1.5 rounded-md font-bold text-[11.5px] transition flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-[0.97] ${
                                copiedLink ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                              }`}
                            >
                              {copiedLink ? "Copied" : "Copy Link"}
                            </button>
                          </div>
                        </div>

                        <div>
                          <span className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider select-none">Backup Temporary Password</span>
                          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2 pl-3">
                            <span className="text-[12.5px] text-slate-800 font-mono font-bold flex-1">{successInfo.tempPassword}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyClipboard(successInfo.tempPassword, setCopiedPassword)}
                              className={`px-3 py-1.5 rounded-md font-bold text-[11.5px] transition flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-[0.97] ${
                                copiedPassword ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                              }`}
                            >
                              {copiedPassword ? "Copied" : "Copy Password"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* TAB 2: BULK UPLOAD */}
        {activeTab === "bulk" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start mt-6">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-[15px] font-bold text-slate-900 mb-1">Bulk invite members</h3>
                <p className="text-[12.5px] text-slate-500 font-normal leading-relaxed">
                  Enter comma-separated values to invite multiple accountants, clients, or relationship managers at once.
                </p>
              </div>

              <form onSubmit={handleBulkUpload} className="space-y-4">
                {bulkError && (
                  <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                    {bulkError}
                  </div>
                )}

                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                    CSV Rows (headers: <code>role,email,full_name</code>)
                  </label>
                  <textarea
                    rows={8}
                    placeholder="role,email,full_name&#10;accountant,akash.sharma@example.com,Akash Sharma&#10;client,priya.patel@example.com,Priya Patel&#10;relationship_manager,ross.geller@example.com,Ross Geller"
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition leading-relaxed resize-y"
                  />
                </div>

                <div className="bg-[#fafbfc] rounded-lg p-4 text-[12.5px] text-[#64748b] border border-slate-200/60 space-y-1 select-none">
                  <span className="font-bold text-slate-700 block mb-1">Supported roles:</span>
                  <p>• <code>client</code></p>
                  <p>• <code>accountant</code></p>
                  <p>• <code>relationship_manager</code> or <code>relationship manager</code></p>
                </div>

                <button
                  type="submit"
                  disabled={bulkLoading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[13px] rounded-lg transition disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2 active:scale-[0.98]"
                >
                  {bulkLoading ? "Processing Bulk Invites..." : "Submit Bulk Invites"}
                </button>
              </form>

              {bulkSuccess && (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-4 animate-slide-down">
                  <div>
                    <h4 className="text-[13.5px] font-bold text-slate-900 mb-1">Bulk Process Results</h4>
                    <p className="text-[12px] text-slate-500 font-normal">
                      Invited {bulkSuccess.successful} of {bulkSuccess.total} rows successfully.
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-[12.5px] text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 select-none">
                          <th className="py-2 px-3 font-bold text-slate-600">Row</th>
                          <th className="py-2 px-3 font-bold text-slate-600">Email</th>
                          <th className="py-2 px-3 font-bold text-slate-600">Role</th>
                          <th className="py-2 px-3 font-bold text-slate-600">Status</th>
                          <th className="py-2 px-3 font-bold text-slate-600">Temp Password</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkSuccess.results.map((res, idx) => (
                          <tr key={idx} className="border-b border-slate-100 hover:bg-white transition duration-150">
                            <td className="py-2.5 px-3 text-slate-500">{res.row}</td>
                            <td className="py-2.5 px-3 text-slate-900 font-medium">{res.email}</td>
                            <td className="py-2.5 px-3 text-slate-500">{displayRoleText(res.role)}</td>
                            <td className="py-2.5 px-3">
                              {res.success ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                  Success
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800" title={res.error}>
                                  Failed
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                              {res.temporaryPassword || "--"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="hidden lg:block lg:col-span-1" />
          </div>
        )}

        {/* TAB 3: PENDING INVITES */}
        {activeTab === "pending" && (
          <div className="grid grid-cols-1 gap-6 items-start mt-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
              
              {/* Search bar */}
              <div className="flex gap-4 items-center max-w-[480px]">
                <div className="relative flex-1">
                  <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search pending invites..."
                    value={pendingSearch}
                    onChange={(e) => setPendingSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-[13.5px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition shadow-sm bg-white"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#fafbfc] border-b border-slate-200/80 text-[11px] font-extrabold text-[#64748b]/90 uppercase tracking-widest select-none">
                        <th className="py-4 px-6">Name</th>
                        <th className="py-4 px-6">Email</th>
                        <th className="py-4 px-6">Role</th>
                        <th className="py-4 px-6">Invited By</th>
                        <th className="py-4 px-6">Created At</th>
                        <th className="py-4 px-6">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingData ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center">
                            <div className="flex flex-col items-center justify-center gap-3">
                              <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-blue-500 animate-spin" />
                              <span className="text-slate-400 text-sm font-medium">Retrieving active invitations...</span>
                            </div>
                          </td>
                        </tr>
                      ) : filteredPendingInvites.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-slate-500 font-medium text-[13px] select-none">
                            No pending invites found.
                          </td>
                        </tr>
                      ) : (
                        filteredPendingInvites.map((invite) => (
                          <tr key={invite.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition duration-150">
                            <td className="py-4 px-6 text-[13.5px] font-bold text-slate-900">
                              {invite.name || "--"}
                            </td>
                            <td className="py-4 px-6 text-[13.5px] font-medium text-slate-600">
                              {invite.email}
                            </td>
                            <td className="py-4 px-6 text-[13.5px] text-slate-500">
                              {displayRoleText(invite.role)}
                            </td>
                            <td className="py-4 px-6 text-[13.5px] text-slate-500">
                              {invite.invitedByEmail || "System"}
                            </td>
                            <td className="py-4 px-6 text-[13.5px] text-slate-500">
                              {invite.createdAt ? new Date(invite.createdAt).toLocaleDateString() : "--"}
                            </td>
                            <td className="py-4 px-6">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#fef3c7] text-[#d97706] border border-amber-200/50 select-none">
                                Pending
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
