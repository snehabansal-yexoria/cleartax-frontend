"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CoreEntity, CoreProperty } from "@/src/lib/coreApi";

interface ClientRecord {
  id: string;
  name: string;
  email: string;
}

interface AddJournalEntryViewProps {
  clientId: string;
  entityId: string;
  client: ClientRecord;
  entity: CoreEntity;
  properties: CoreProperty[];
  backHref: string;
  backLabel: string;
}

interface JournalRow {
  id: string;
  date: string;
  propertyId: string;
  accountCode: string;
  accountName: string;
  debit: string;
  credit: string;
  description: string;
  name: string;
  gstCode: string;
}

const ACCOUNT_MAP: Record<string, string> = {
  "310": "Rental Income",
  "610": "Interest Expenses",
  "620": "Council Rates",
  "630": "Advertising for Tenants",
  "680": "Repairs and Maintenance",
  "710": "Body Corporate Fees",
  "110": "Cash at Bank",
  "800": "Owner's Capital",
};

const GST_CODES = [
  "Select GST code",
  "GST on purchases (10%)",
  "GST on sales (10%)",
  "GST-free purchases (0%)",
  "GST-free sales (0%)",
  "Input taxed (0%)",
  "Out of scope (0%)",
];

// SVG Icons
const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

const UploadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const InfoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const GridIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#3b82f6" }}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const AlertIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export default function AddJournalEntryView({
  clientId,
  entityId,
  client,
  entity,
  properties,
  backHref,
  backLabel,
}: AddJournalEntryViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"manual" | "bulk">("manual");
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  
  // Format today's date in YYYY-MM-DD
  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const defaultPropertyId = properties[0]?.id || "";
  const defaultPropertyName = properties[0]?.name || entity.name || "Heaven Villa";

  const createEmptyRow = (index: number): JournalRow => ({
    id: `row-${Date.now()}-${index}-${Math.random()}`,
    date: getTodayDateString(),
    propertyId: defaultPropertyId,
    accountCode: "",
    accountName: "",
    debit: "",
    credit: "",
    description: "",
    name: "",
    gstCode: "",
  });

  const [rows, setRows] = useState<JournalRow[]>([]);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize with 2 empty rows as shown in mockup
  useEffect(() => {
    setRows([createEmptyRow(0), createEmptyRow(1)]);
  }, [defaultPropertyId]);

  // Handle row changes
  const handleCellChange = (rowId: string, field: keyof JournalRow, value: string) => {
    setRows((prevRows) =>
      prevRows.map((row) => {
        if (row.id !== rowId) return row;

        const updatedRow = { ...row, [field]: value };

        // Auto-fill account name if account code changes
        if (field === "accountCode") {
          const code = value.trim();
          updatedRow.accountName = ACCOUNT_MAP[code] || (code ? "Custom Account" : "");
        }

        // Clean debit/credit values to allow only numbers
        if (field === "debit" || field === "credit") {
          const cleaned = value.replace(/[^0-9.]/g, "");
          // Ensure we don't have multiple decimals
          const parts = cleaned.split(".");
          updatedRow[field] = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
        }

        return updatedRow;
      })
    );
  };

  // Add row
  const addRow = () => {
    setRows((prev) => [...prev, createEmptyRow(prev.length)]);
  };

  // Sum Debits and Credits
  const totals = useMemo(() => {
    let debitSum = 0;
    let creditSum = 0;
    rows.forEach((row) => {
      const d = parseFloat(row.debit) || 0;
      const c = parseFloat(row.credit) || 0;
      debitSum += d;
      creditSum += c;
    });
    const diff = Math.abs(debitSum - creditSum);
    const isBalanced = diff < 0.001 && (debitSum > 0 || creditSum > 0);
    return {
      debit: debitSum,
      credit: creditSum,
      diff,
      isBalanced,
    };
  }, [rows]);

  // Save handling
  const handleSave = async () => {
    setSaveStatus(null);

    // Validate rows
    const validRows = rows.filter(
      (r) => r.accountCode.trim() || r.debit || r.credit || r.description
    );

    if (validRows.length === 0) {
      setSaveStatus({ type: "error", message: "Please fill in at least one row." });
      return;
    }

    // Check account codes
    const missingCodes = validRows.some((r) => !r.accountCode.trim());
    if (missingCodes) {
      setSaveStatus({ type: "error", message: "All active rows must have an Account Code." });
      return;
    }

    // Check that each row has either debit or credit, not both or neither
    const invalidAmounts = validRows.some((r) => {
      const d = parseFloat(r.debit) || 0;
      const c = parseFloat(r.credit) || 0;
      return (d === 0 && c === 0) || (d > 0 && c > 0);
    });

    if (invalidAmounts) {
      setSaveStatus({
        type: "error",
        message: "Each row must have either a Debit or a Credit amount (not both).",
      });
      return;
    }

    // Check balance
    if (Math.abs(totals.debit - totals.credit) > 0.01) {
      setSaveStatus({
        type: "error",
        message: `Journal entry is out of balance by A$ ${totals.diff.toFixed(2)}. Debits must equal Credits.`,
      });
      return;
    }

    setIsSaving(true);
    try {
      // Simulate API call to save journal entries
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSaveStatus({ type: "success", message: "Journal Entry saved successfully!" });
      setTimeout(() => {
        router.push(backHref);
      }, 1500);
    } catch (err) {
      setSaveStatus({ type: "error", message: "Failed to save journal entry. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1280px", margin: "0 auto", fontFamily: "Inter, sans-serif" }}>
      
      {/* Custom Confirmation Modal (UI Level) */}
      {showConfirmClear && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(15, 23, 42, 0.4)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
        }}>
          <div style={{
            backgroundColor: "#ffffff",
            padding: "24px",
            borderRadius: "12px",
            maxWidth: "400px",
            width: "100%",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            border: "1px solid #e2e8f0",
          }}>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px 0" }}>
              Clear All Rows?
            </h3>
            <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 20px 0", lineHeight: 1.5 }}>
              Are you sure you want to clear all rows? Any unsaved changes will be permanently lost.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                onClick={() => setShowConfirmClear(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid #d0d5dd",
                  backgroundColor: "#ffffff",
                  color: "#344054",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setRows([createEmptyRow(0), createEmptyRow(1)]);
                  setSaveStatus(null);
                  setShowConfirmClear(false);
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#f43f5e",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Banner Status */}
      {saveStatus && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "6px",
            marginBottom: "16px",
            fontWeight: 500,
            fontSize: "14px",
            backgroundColor: saveStatus.type === "success" ? "#ecfdf5" : "#fdf2f2",
            color: saveStatus.type === "success" ? "#065f46" : "#9b1c1c",
            border: `1px solid ${saveStatus.type === "success" ? "#a7f3d0" : "#f8b4b4"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{saveStatus.message}</span>
          <button
            onClick={() => setSaveStatus(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: "bold" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Header section matching mockup */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          {/* Dynamic back link */}
          <Link
            href={backHref}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: "#475467",
              fontSize: "14px",
              fontWeight: 500,
              textDecoration: "none",
              marginBottom: "8px",
            }}
          >
            <span style={{ fontSize: "18px", fontWeight: "normal", lineHeight: 1 }}>‹</span> Back to {backLabel}
          </Link>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#0f172a", margin: "0 0 4px 0" }}>
            Add Journal Entry
          </h1>
          <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
            {client.name} · {entity.name}
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => router.push(backHref)}
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              border: "1px solid #d0d5dd",
              backgroundColor: "#ffffff",
              color: "#344054",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background-color 0.15s ease",
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#f9fafb")}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              border: "none",
              background: "linear-gradient(180deg, #ffb834 0%, #ff9e1b 100%)",
              color: "#0d2b60",
              fontSize: "14px",
              fontWeight: 600,
              cursor: isSaving ? "not-allowed" : "pointer",
              boxShadow: "0 4px 14px rgba(255, 158, 27, 0.3)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "transform 0.15s ease",
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseOut={(e) => (e.currentTarget.style.transform = "translateY(0)")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            {isSaving ? "Saving..." : "Save Journal Entry"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button
          onClick={() => setActiveTab("manual")}
          style={{
            padding: "8px 16px",
            borderRadius: "20px",
            border: "1px solid #d0d5dd",
            backgroundColor: activeTab === "manual" ? "#ffffff" : "#f1f5f9",
            color: activeTab === "manual" ? "#0f172a" : "#475467",
            fontSize: "14px",
            fontWeight: activeTab === "manual" ? 600 : 500,
            cursor: "pointer",
            boxShadow: activeTab === "manual" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <EditIcon /> Manual Entry
        </button>
        <button
          onClick={() => setActiveTab("bulk")}
          style={{
            padding: "8px 16px",
            borderRadius: "20px",
            border: "1px solid transparent",
            backgroundColor: activeTab === "bulk" ? "#ffffff" : "#f1f5f9",
            color: activeTab === "bulk" ? "#0f172a" : "#475467",
            fontSize: "14px",
            fontWeight: activeTab === "bulk" ? 600 : 500,
            cursor: "pointer",
            boxShadow: activeTab === "bulk" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <UploadIcon /> Bulk Upload (CSV)
        </button>
      </div>

      {activeTab === "bulk" ? (
        <div
          style={{
            padding: "40px",
            border: "2px dashed #cbd5e1",
            borderRadius: "12px",
            backgroundColor: "#f8fafc",
            textAlign: "center",
            marginBottom: "24px",
          }}
        >
          <div style={{ fontSize: "40px", marginBottom: "16px" }}>📤</div>
          <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1e293b", margin: "0 0 8px 0" }}>
            Upload your CSV file
          </h3>
          <p style={{ fontSize: "14px", color: "#64748b", maxWidth: "420px", margin: "0 auto 16px auto" }}>
            Drag and drop your journal entries CSV here, or click to browse files from your computer.
          </p>
          <button
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "1px solid #d0d5dd",
              backgroundColor: "#ffffff",
              color: "#344054",
              fontWeight: 600,
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Browse Files
          </button>
        </div>
      ) : (
        <>
          {/* Information & Helper Panels */}
          <div
            style={{
              backgroundColor: "#eff6ff",
              border: "1px solid #dbeafe",
              borderRadius: "10px",
              padding: "16px",
              marginBottom: "16px",
              display: "flex",
              gap: "12px",
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                color: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: "2px",
              }}
            >
              <InfoIcon />
            </div>
            <p style={{ fontSize: "13px", color: "#1e40af", margin: 0, lineHeight: 1.5 }}>
              <strong>Debit and Credit amounts must be GST-exclusive.</strong> Remove GST before entering the value, then select the applicable GST Code separately. e.g. Invoice total $1,100 (incl. $100 GST) → enter <strong>$1,000</strong> and choose <strong>GST on purchases (10% purchases)</strong>.
            </p>
          </div>

          <div
            style={{
              border: "1.5px dashed #bfdbfe",
              borderRadius: "10px",
              padding: "16px",
              marginBottom: "24px",
              display: "flex",
              gap: "12px",
              alignItems: "center",
              backgroundColor: "#fafbfc",
            }}
          >
            <div style={{ display: "flex", flexShrink: 0 }}>
              <GridIcon />
            </div>
            <p style={{ fontSize: "13px", color: "#334155", margin: 0, lineHeight: 1.5 }}>
              Works just like Excel — click a cell and type, use{" "}
              <kbd style={{ backgroundColor: "#e2e8f0", border: "1px solid #cbd5e1", borderRadius: "4px", padding: "2px 6px", fontSize: "11px", fontWeight: 600 }}>Tab</kbd> /{" "}
              <kbd style={{ backgroundColor: "#e2e8f0", border: "1px solid #cbd5e1", borderRadius: "4px", padding: "2px 6px", fontSize: "11px", fontWeight: 600 }}>Enter</kbd> / arrow keys to move between cells, or copy rows from a spreadsheet and{" "}
              <kbd style={{ backgroundColor: "#e2e8f0", border: "1px solid #cbd5e1", borderRadius: "4px", padding: "2px 6px", fontSize: "11px", fontWeight: 600 }}>Ctrl</kbd> +{" "}
              <kbd style={{ backgroundColor: "#e2e8f0", border: "1px solid #cbd5e1", borderRadius: "4px", padding: "2px 6px", fontSize: "11px", fontWeight: 600 }}>V</kbd> paste them straight in.
            </p>
          </div>

          {/* Action Row above table */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={addRow}
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  border: "1.5px solid #0d2b60",
                  backgroundColor: "#ffffff",
                  color: "#0d2b60",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <PlusIcon /> Add Row
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmClear(true)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "6px",
                  border: "1.5px solid #f43f5e",
                  backgroundColor: "#ffffff",
                  color: "#f43f5e",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <TrashIcon /> Clear All
              </button>
            </div>
            <span style={{ fontSize: "13px", color: "#64748b" }}>{rows.length} rows</span>
          </div>

          {/* Spreadsheet Table */}
          <div style={{ overflowX: "auto", border: "1px solid #cbd5e1", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.02)", marginBottom: "20px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1200px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1.5px solid #cbd5e1" }}>
                  <th style={{ padding: "12px 8px", width: "40px", fontSize: "11px", fontWeight: 700, color: "#475467", textAlign: "center" }}>#</th>
                  <th style={{ padding: "12px 12px", width: "135px", fontSize: "11px", fontWeight: 700, color: "#475467", textAlign: "left" }}>JOURNAL DATE</th>
                  <th style={{ padding: "12px 12px", width: "165px", fontSize: "11px", fontWeight: 700, color: "#475467", textAlign: "left" }}>PROPERTY</th>
                  <th style={{ padding: "12px 12px", width: "110px", fontSize: "11px", fontWeight: 700, color: "#475467", textAlign: "left" }}>ACCOUNT CODE</th>
                  <th style={{ padding: "12px 12px", width: "180px", fontSize: "11px", fontWeight: 700, color: "#475467", textAlign: "left" }}>ACCOUNT NAME</th>
                  <th style={{ padding: "12px 12px", width: "125px", fontSize: "11px", fontWeight: 700, color: "#475467", textAlign: "left" }}>DEBIT (EXCL. GST)</th>
                  <th style={{ padding: "12px 12px", width: "125px", fontSize: "11px", fontWeight: 700, color: "#475467", textAlign: "left" }}>CREDIT (EXCL. GST)</th>
                  <th style={{ padding: "12px 12px", width: "180px", fontSize: "11px", fontWeight: 700, color: "#475467", textAlign: "left" }}>DESCRIPTION</th>
                  <th style={{ padding: "12px 12px", width: "120px", fontSize: "11px", fontWeight: 700, color: "#475467", textAlign: "left" }}>NAME</th>
                  <th style={{ padding: "12px 12px", width: "160px", fontSize: "11px", fontWeight: 700, color: "#475467", textAlign: "left" }}>GST CODE</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: "#ffffff" }}>
                    {/* Row Index */}
                    <td style={{ padding: "10px 8px", fontSize: "13px", color: "#64748b", textAlign: "center", fontWeight: 500, backgroundColor: "#f8fafc", borderRight: "1px solid #cbd5e1" }}>
                      {idx + 1}
                    </td>

                    {/* Journal Date */}
                    <td style={{ padding: "4px", borderRight: "1px solid #e2e8f0" }}>
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) => handleCellChange(row.id, "date", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          borderRadius: "4px",
                          border: "1px solid transparent",
                          fontSize: "13px",
                          outline: "none",
                          fontFamily: "inherit",
                          backgroundColor: "transparent",
                          transition: "border-color 0.15s, background-color 0.15s",
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = "#3b82f6";
                          e.target.style.backgroundColor = "#ffffff";
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = "transparent";
                          e.target.style.backgroundColor = "transparent";
                        }}
                      />
                    </td>

                    {/* Property */}
                    <td style={{ padding: "4px", borderRight: "1px solid #e2e8f0" }}>
                      <select
                        value={row.propertyId}
                        onChange={(e) => handleCellChange(row.id, "propertyId", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          borderRadius: "4px",
                          border: "1px solid transparent",
                          fontSize: "13px",
                          outline: "none",
                          backgroundColor: "transparent",
                          fontFamily: "inherit",
                          transition: "border-color 0.15s, background-color 0.15s",
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = "#3b82f6";
                          e.target.style.backgroundColor = "#ffffff";
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = "transparent";
                          e.target.style.backgroundColor = "transparent";
                        }}
                      >
                        {properties.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                        {properties.length === 0 && (
                          <option value="">{defaultPropertyName}</option>
                        )}
                      </select>
                    </td>

                    {/* Account Code */}
                    <td style={{ padding: "4px", borderRight: "1px solid #e2e8f0" }}>
                      <input
                        type="text"
                        placeholder="e.g. 310"
                        value={row.accountCode}
                        onChange={(e) => handleCellChange(row.id, "accountCode", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          borderRadius: "4px",
                          border: "1px solid transparent",
                          fontSize: "13px",
                          outline: "none",
                          fontFamily: "inherit",
                          backgroundColor: "transparent",
                          transition: "border-color 0.15s, background-color 0.15s",
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = "#3b82f6";
                          e.target.style.backgroundColor = "#ffffff";
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = "transparent";
                          e.target.style.backgroundColor = "transparent";
                        }}
                      />
                    </td>

                    {/* Account Name (Auto-filled) */}
                    <td style={{ padding: "10px 12px", fontSize: "13px", color: row.accountName ? "#1e293b" : "#94a3b8", fontWeight: 500, borderRight: "1px solid #e2e8f0" }}>
                      <span style={{ fontStyle: row.accountName ? "normal" : "italic" }}>
                        {row.accountName || "Auto-filled"}
                      </span>
                    </td>

                    {/* Debit */}
                    <td style={{ padding: "4px", borderRight: "1px solid #e2e8f0" }}>
                      <input
                        type="text"
                        placeholder="0.00"
                        value={row.debit}
                        onChange={(e) => handleCellChange(row.id, "debit", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          borderRadius: "4px",
                          border: "1px solid transparent",
                          fontSize: "13px",
                          outline: "none",
                          fontFamily: "inherit",
                          backgroundColor: "transparent",
                          transition: "border-color 0.15s, background-color 0.15s",
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = "#3b82f6";
                          e.target.style.backgroundColor = "#ffffff";
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = "transparent";
                          e.target.style.backgroundColor = "transparent";
                        }}
                      />
                    </td>

                    {/* Credit */}
                    <td style={{ padding: "4px", borderRight: "1px solid #e2e8f0" }}>
                      <input
                        type="text"
                        placeholder="0.00"
                        value={row.credit}
                        onChange={(e) => handleCellChange(row.id, "credit", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          borderRadius: "4px",
                          border: "1px solid transparent",
                          fontSize: "13px",
                          outline: "none",
                          fontFamily: "inherit",
                          backgroundColor: "transparent",
                          transition: "border-color 0.15s, background-color 0.15s",
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = "#3b82f6";
                          e.target.style.backgroundColor = "#ffffff";
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = "transparent";
                          e.target.style.backgroundColor = "transparent";
                        }}
                      />
                    </td>

                    {/* Description */}
                    <td style={{ padding: "4px", borderRight: "1px solid #e2e8f0" }}>
                      <input
                        type="text"
                        placeholder="Description"
                        value={row.description}
                        onChange={(e) => handleCellChange(row.id, "description", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          borderRadius: "4px",
                          border: "1px solid transparent",
                          fontSize: "13px",
                          outline: "none",
                          fontFamily: "inherit",
                          backgroundColor: "transparent",
                          transition: "border-color 0.15s, background-color 0.15s",
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = "#3b82f6";
                          e.target.style.backgroundColor = "#ffffff";
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = "transparent";
                          e.target.style.backgroundColor = "transparent";
                        }}
                      />
                    </td>

                    {/* Name */}
                    <td style={{ padding: "4px", borderRight: "1px solid #e2e8f0" }}>
                      <input
                        type="text"
                        placeholder="Name"
                        value={row.name}
                        onChange={(e) => handleCellChange(row.id, "name", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          borderRadius: "4px",
                          border: "1px solid transparent",
                          fontSize: "13px",
                          outline: "none",
                          fontFamily: "inherit",
                          backgroundColor: "transparent",
                          transition: "border-color 0.15s, background-color 0.15s",
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = "#3b82f6";
                          e.target.style.backgroundColor = "#ffffff";
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = "transparent";
                          e.target.style.backgroundColor = "transparent";
                        }}
                      />
                    </td>

                    {/* GST Code */}
                    <td style={{ padding: "4px" }}>
                      <select
                        value={row.gstCode}
                        onChange={(e) => handleCellChange(row.id, "gstCode", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          borderRadius: "4px",
                          border: "1px solid transparent",
                          fontSize: "13px",
                          outline: "none",
                          backgroundColor: "transparent",
                          fontFamily: "inherit",
                          color: row.gstCode ? "#1e293b" : "#94a3b8",
                          transition: "border-color 0.15s, background-color 0.15s",
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = "#3b82f6";
                          e.target.style.backgroundColor = "#ffffff";
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = "transparent";
                          e.target.style.backgroundColor = "transparent";
                        }}
                      >
                        {GST_CODES.map((gstOpt, gIdx) => (
                          <option key={gstOpt} value={gIdx === 0 ? "" : gstOpt}>
                            {gstOpt}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Summary Panel */}
          <div
            style={{
              padding: "16px 24px",
              backgroundColor: "#f8fafc",
              border: "1px solid #cbd5e1",
              borderRadius: "12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.01)",
            }}
          >
            <div style={{ display: "flex", gap: "32px" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                  TOTAL DEBIT
                </span>
                <span style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>
                  A$ {totals.debit.toFixed(2)}
                </span>
              </div>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                  TOTAL CREDIT
                </span>
                <span style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>
                  A$ {totals.credit.toFixed(2)}
                </span>
              </div>
            </div>

            <div>
              {totals.isBalanced ? (
                <div
                  style={{
                    backgroundColor: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    color: "#047857",
                    padding: "8px 16px",
                    borderRadius: "20px",
                    fontWeight: 600,
                    fontSize: "14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <CheckIcon /> Balanced
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: "#fff1f2",
                    border: "1px solid #fecdd3",
                    color: "#e11d48",
                    padding: "8px 16px",
                    borderRadius: "20px",
                    fontWeight: 600,
                    fontSize: "14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <AlertIcon /> Out of balance by A$ {totals.diff.toFixed(2)}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
