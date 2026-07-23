"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useRef } from "react";
import { Skeleton } from "boneyard-js/react";
import { getSession } from "@/src/lib/session";
import type { CoreEntity, CoreProperty, CoreTransactionListItem } from "@/src/lib/coreApi";
import CashFlowChart from "@/app/components/clients/CashFlowChart";
import { formatClientCurrency, formatCurrencyShort } from "@/app/components/clients/CurrencyFormatter";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

type DocumentListItem = {
  id: string;
  file_name: string;
  original_file_name: string;
  document_type: string;
  processing_status: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  source: "transaction" | "reconciliation" | "direct";
};

type UploadingFile = {
  id: string;
  name: string;
  progress: number;
};

interface ClientEntityDetailViewProps {
  entityId: string;
  backHref: string;
  backLabel: string;
  addPropertyHref: string;
  addTransactionHref?: string;
  editEntityHref: string;
  propertyDetailHrefBase: string;
}

function titleCase(value: string) {
  if (!value) return "";
  return value
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatDocDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function monthKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  if (Number.isNaN(date.getTime())) return key;
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
}

// Clean custom USD formatter to match Figma ($1.24M, -$1.61M, +$12,280, etc.)
function formatUSD(val: number, showPlus = false) {
  const isNegative = val < 0;
  const abs = Math.abs(val);
  let str = "";
  if (abs >= 1000000) {
    str = `$${(abs / 1000000).toFixed(2)}M`;
  } else if (abs >= 1000) {
    str = `$${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  } else {
    str = `$${abs.toFixed(0)}`;
  }
  if (isNegative) return `-${str}`;
  if (showPlus && val > 0) return `+${str}`;
  return str;
}

export default function ClientEntityDetailView({
  entityId,
  backHref,
  backLabel,
  addPropertyHref,
  addTransactionHref,
  editEntityHref,
  propertyDetailHrefBase,
}: ClientEntityDetailViewProps) {
  const router = useRouter();

  // State Management
  const [entity, setEntity] = useState<CoreEntity | null>(null);
  const [properties, setProperties] = useState<CoreProperty[]>([]);
  const [transactions, setTransactions] = useState<CoreTransactionListItem[]>([]);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [sessionToken, setSessionToken] = useState("");

  // Chart View State (Graph vs Table View)
  const [chartView, setChartView] = useState<'graph' | 'table'>('graph');

  // Modal Upload Dialog State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [docName, setDocName] = useState("");
  const [selectedDocType, setSelectedDocType] = useState("Tax Return");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Document types match Figma tag pills
  const docTypes = [
    "Tax Return",
    "Lease Agreement",
    "Invoice",
    "Bank Statement",
    "Council Rates",
    "Insurance",
    "Contract",
    "Trust Deed",
    "Other"
  ];

  // Track window resizing
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch initial data
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;
        if (!session) {
          router.replace("/login/user");
          return;
        }
        const token = session.getIdToken().getJwtToken();
        if (!cancelled) setSessionToken(token);

        const headers = { Authorization: `Bearer ${token}` };

        // Fetch Entity Details
        const entityRes = await fetch(`/api/entities/${encodeURIComponent(entityId)}`, { headers });
        if (entityRes.ok) {
          const entityData = await entityRes.json();
          if (!cancelled) setEntity(entityData);
        }

        // Fetch Properties
        const propertiesRes = await fetch(`/api/entities/${encodeURIComponent(entityId)}/properties`, { headers });
        if (propertiesRes.ok) {
          const propertiesData = await propertiesRes.json();
          if (!cancelled) setProperties(propertiesData.items || []);
        }

        // Fetch Transactions
        const txsRes = await fetch(`/api/entities/${encodeURIComponent(entityId)}/transactions`, { headers });
        if (txsRes.ok) {
          const txsData = await txsRes.json();
          if (!cancelled) setTransactions(txsData.items || []);
        }

        // Fetch Documents
        const docsRes = await fetch(`/api/documents/list?entity_id=${encodeURIComponent(entityId)}`, { headers });
        if (docsRes.ok) {
          const docsData = await docsRes.json();
          if (!cancelled) setDocuments(docsData.items || []);
        }
      } catch (err) {
        console.error("Error loading entity details:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (entityId) {
      load();
    }

    return () => {
      cancelled = true;
    };
  }, [entityId, router]);

  // Document reload utility
  const fetchDocumentsOnly = async () => {
    if (!sessionToken || !entityId) return;
    try {
      const docsRes = await fetch(`/api/documents/list?entity_id=${encodeURIComponent(entityId)}`, {
        headers: { Authorization: `Bearer ${sessionToken}` }
      });
      if (docsRes.ok) {
        const docsData = await docsRes.json();
        setDocuments(docsData.items || []);
      }
    } catch (err) {
      console.error("Failed to load documents list:", err);
    }
  };

  // Metrics Calculations
  const marketValue = useMemo(() => {
    return properties.reduce((sum, prop) => sum + (prop.estimatedMarketValue || 0), 0);
  }, [properties]);

  const outstandingLoans = useMemo(() => {
    return properties.reduce((sum, prop) => {
      if (!prop.loanDetails) return sum;
      const loanAmt = prop.loanDetails.loan_amount ?? prop.loanDetails.loanAmount ?? prop.loanDetails.amount ?? 0;
      return sum + Number(loanAmt);
    }, 0);
  }, [properties]);

  const netEquity = marketValue - outstandingLoans;

  // Monthly cash flow calculations for this month
  const cashFlowThisMonth = useMemo(() => {
    const currentMonthDate = new Date();
    const currentMonth = currentMonthDate.getMonth();
    const currentYear = currentMonthDate.getFullYear();

    const currentMonthTx = transactions.filter((tx) => {
      if (!tx.invoiceDate) return false;
      const d = new Date(tx.invoiceDate);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const income = currentMonthTx
      .filter((tx) => tx.type === "revenue")
      .reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);

    const expense = currentMonthTx
      .filter((tx) => tx.type === "expense")
      .reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);

    return income - expense;
  }, [transactions]);

  // Aggregated monthly trend rows for the bar chart
  const trendData = useMemo(() => {
    const byMonth = new Map<string, { month: string; expenses: number; income: number }>();
    for (const row of transactions) {
      const key = monthKey(row.invoiceDate);
      if (!key) continue;
      const current = byMonth.get(key) || {
        month: key,
        expenses: 0,
        income: 0,
      };
      const amount = Math.abs(row.grossAmount || 0);
      if (row.type === "revenue") current.income += amount;
      else current.expenses += amount;
      byMonth.set(key, current);
    }
    return Array.from(byMonth.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-7); // last 7 months to match desktop Figma layout
  }, [transactions]);

  const trendMonths = useMemo(() => trendData.map((row) => monthLabel(row.month)), [trendData]);
  const trendIncome = useMemo(() => trendData.map((row) => row.income), [trendData]);
  const trendExpenses = useMemo(() => trendData.map((row) => row.expenses), [trendData]);

  // Beneficiaries data mapping
  const beneficiariesList = useMemo(() => {
    if (!entity?.beneficiaries || entity.beneficiaries.length === 0) {
      // Mock defaults matching the Sneha and Mike design in Figma if none are in the DB
      return [
        { name: "Sneha Johnson", role: "Primary beneficiary", percentage: 50 },
        { name: "Mike Johnson", role: "Beneficiary", percentage: 50 },
      ];
    }
    return entity.beneficiaries.map((b, idx) => ({
      name: b.name,
      role: idx === 0 ? "Primary beneficiary" : "Beneficiary",
      percentage: b.ownershipPercentage || 50,
    }));
  }, [entity]);

  const totalOwnership = useMemo(() => {
    return beneficiariesList.reduce((sum, b) => sum + b.percentage, 0);
  }, [beneficiariesList]);

  // Property items mapping
  const mappedProperties = useMemo(() => {
    return properties.map((prop) => {
      const propTxs = transactions.filter((tx) => {
        return tx.propertyIds?.includes(prop.id) || tx.propertyNames?.includes(prop.name);
      });

      const inc = propTxs
        .filter((tx) => tx.type === "revenue")
        .reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);

      const exp = propTxs
        .filter((tx) => tx.type === "expense")
        .reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);

      return {
        id: prop.id,
        name: prop.name,
        entityName: entity?.name || "Johnson Family Trust",
        marketValue: prop.estimatedMarketValue || 0,
        outstandingLoans: prop.loanDetails
          ? Number(prop.loanDetails.loan_amount ?? prop.loanDetails.loanAmount ?? prop.loanDetails.amount ?? 0)
          : 0,
        income: inc,
        expense: exp,
        net: inc - exp,
        status: prop.status || "Rented",
        imageUrl: prop.imageUrl || null,
      };
    });
  }, [properties, transactions, entity]);

  // Recent transactions list
  const recentTransactions = useMemo(() => {
    return transactions.slice(0, 5).map((tx) => ({
      id: tx.id,
      description: tx.description || `${tx.type === "revenue" ? "Income" : "Expense"} - ${tx.categoryName}`,
      meta: tx.propertyNames?.[0] || "General",
      type: tx.type,
      amount: Math.abs(tx.netAmount || tx.grossAmount || 0),
      dateText: tx.invoiceDate ? formatDateLabel(tx.invoiceDate) : "today",
    }));
  }, [transactions]);

  function formatDateLabel(dateString: string) {
    try {
      const today = new Date();
      const d = new Date(dateString);
      const diffTime = Math.abs(today.getTime() - d.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 1) return "today";
      if (diffDays <= 2) return "yesterday";
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return "today";
    }
  }

  // Handle document file drop / selection
  const handleFileChange = (file: File) => {
    setUploadFile(file);
    // Autofill doc name with clean basename (removing extension)
    const cleanName = file.name.replace(/\.[^/.]+$/, "");
    setDocName(cleanName);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Upload Document flow integration with API
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !sessionToken || !entityId) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // 1. Fetch Presigned S3 url
      const presignParams = new URLSearchParams({
        filename: uploadFile.name,
        document_type: selectedDocType.toLowerCase().replace(/\s+/g, "_"),
      });
      presignParams.set("entity_id", entityId);
      if (selectedPropertyId) {
        presignParams.set("property_id", selectedPropertyId);
      }

      const presignRes = await fetch(`/api/documents/presign?${presignParams.toString()}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (!presignRes.ok) {
        throw new Error("Failed to retrieve presigned URL");
      }

      const { upload_url } = await presignRes.json();

      // 2. Upload file content to presigned URL
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", upload_url);
        xhr.setRequestHeader("Content-Type", uploadFile.type || "application/octet-stream");

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentage = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percentage);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error("S3 upload failed"));
          }
        };

        xhr.onerror = () => reject(new Error("Network upload error"));
        xhr.send(uploadFile);
      });

      // Settle upload state
      setTimeout(() => {
        setUploadFile(null);
        setDocName("");
        setIsUploadOpen(false);
        setUploading(false);
        fetchDocumentsOnly();
      }, 500);

    } catch (err) {
      console.error("Document upload failed:", err);
      alert("Failed to upload document. Please try again.");
      setUploading(false);
    }
  };

  // Helper icons
  const BackIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "16px", height: "16px", fill: "none", stroke: "currentColor", strokeWidth: 2.5 }}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );

  const EditIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "14px", height: "14px", fill: "none", stroke: "currentColor", strokeWidth: 2 }}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );

  const UpRightIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "18px", height: "18px", fill: "none", stroke: "currentColor", strokeWidth: 2.5 }}>
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );

  const DownLeftIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "18px", height: "18px", fill: "none", stroke: "currentColor", strokeWidth: 2.5 }}>
      <line x1="17" y1="7" x2="7" y2="17" />
      <polyline points="17 17 7 17 7 7" />
    </svg>
  );

  const DocFileIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "18px", height: "18px", fill: "none", stroke: "currentColor", strokeWidth: 2 }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );

  const PlusIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "16px", height: "16px", fill: "none", stroke: "currentColor", strokeWidth: 2.5 }}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );

  // Return loader skeleton if loading
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 w-full py-6 px-4">
        <div className="h-48 w-full bg-slate-200 animate-pulse rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-64 md:col-span-2 bg-slate-200 animate-pulse rounded-2xl" />
          <div className="h-64 bg-slate-200 animate-pulse rounded-2xl" />
        </div>
      </div>
    );
  } return (
    <div className="w-full py-6 px-4 md:px-6 flex flex-col gap-6" style={{ maxWidth: "1280px", margin: "0 auto" }}>

      {/* MOBILE DEVICE HEADER */}
      {isMobile && (
        <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-slate-800">
          <Link href={backHref} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-bold" style={{ textDecoration: 'none' }}>
            <BackIcon />
            <span>Back</span>
          </Link>
          <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100">Entity Detail</h2>
          <Link href={editEntityHref} className="text-[#28336e] dark:text-[#f4a117] font-bold text-sm bg-gray-100 dark:bg-slate-800 px-3.5 py-1.5 rounded-lg" style={{ textDecoration: 'none' }}>
            Edit
          </Link>
        </div>
      )}

      {/* 1. TOP HEADER STATS CARD */}
      <div className="client-entity-header-card">
        <span className="client-entity-kicker">
          {entity?.entityType === "trust" ? "Trust - Discretionary" : entity?.entityType === "company" ? "Company - Pty Ltd" : "SMSF"}
        </span>

        <div className="client-entity-title-row">
          <div className="flex flex-col gap-1">
            <h1 className="client-entity-title">{entity?.name || "Johnson Family Trust"}</h1>
            <span className="text-white/60 text-xs font-semibold">
              {properties.length} propert{properties.length === 1 ? "y" : "ies"}
            </span>
          </div>
          {!isMobile && (
            <Link href={editEntityHref} className="client-entity-edit-btn" style={{ textDecoration: 'none' }}>
              <EditIcon />
              <span>Edit</span>
            </Link>
          )}
        </div>

        <div className="client-entity-stats-grid">
          <div className="client-entity-stat-col">
            <span className="client-entity-stat-label">Net Equity</span>
            <span className="client-entity-stat-val text-white">{formatUSD(netEquity)}</span>
          </div>
          <div className="client-entity-stat-col">
            <span className="client-entity-stat-label">Market Value</span>
            <span className="client-entity-stat-val text-white">{formatUSD(marketValue)}</span>
          </div>
          <div className="client-entity-stat-col">
            <span className="client-entity-stat-label">Outstanding Loan</span>
            <span className="client-entity-stat-val text-white">-{formatUSD(outstandingLoans)}</span>
          </div>
          <div className="client-entity-stat-col">
            <span className="client-entity-stat-label">Cash Flow (this month)</span>
            <span className="client-entity-stat-val text-[#5dcaa5]">{formatUSD(cashFlowThisMonth, true)}</span>
          </div>
        </div>
      </div>

      {/* DESKTOP LAYOUT  */}
      {!isMobile ? (
        <>
          {/* 2. DESKTOP QUICK ACTIONS ROWS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {addTransactionHref && (
              <Link href={addTransactionHref} className="client-quick-action-btn">
                <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '18px', height: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5 }}>
                  <path d="m17 1 4 4-4 4" />
                  <path d="M3 5h18" />
                  <path d="m7 23-4-4 4-4" />
                  <path d="M21 19H3" />
                </svg>
                <span>Add transaction</span>
              </Link>
            )}

            <Link href={addPropertyHref} className="client-quick-action-btn">
              <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '18px', height: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5 }}>
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>Add property</span>
            </Link>

            <Link href="/dashboard/client/entities/new" className="client-quick-action-btn">
              <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '18px', height: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5 }}>
                <path d="M3 21h18" />
                <path d="M3 10h18" />
                <path d="M5 6h14" />
                <path d="M4 10v11" />
                <path d="M20 10v11" />
              </svg>
              <span>Create entity</span>
            </Link>
          </div>

          {/* 3. ROW 3: CHART & BENEFICIARIES */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cash Flow Chart (2/3 width) */}
            <div className="lg:col-span-2 client-entity-chart-card flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h3 className="client-entity-chart-title">Cash Flow <span className="text-xs font-medium text-slate-400">income vs expense</span></h3>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                  <button
                    type="button"
                    className={`flex items-center text-xs font-bold px-3 py-1.5 rounded-md transition-all ${chartView === 'graph' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    onClick={() => setChartView('graph')}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 mr-1.5">
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                    <span>Graph View</span>
                  </button>
                  <button
                    type="button"
                    className={`flex items-center text-xs font-bold px-3 py-1.5 rounded-md transition-all ${chartView === 'table' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    onClick={() => setChartView('table')}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 mr-1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <line x1="9" y1="3" x2="9" y2="21" />
                      <line x1="3" y1="9" x2="21" y2="9" />
                      <line x1="3" y1="15" x2="21" y2="15" />
                    </svg>
                    <span>Table View</span>
                  </button>
                </div>
              </div>

              <CashFlowChart
                months={trendMonths}
                income={trendIncome}
                expenses={trendExpenses}
                view={chartView}
              />
            </div>

            {/* Beneficiaries (1/3 width) */}
            <div className="client-entity-beneficiaries-card flex flex-col gap-4">
              <h3 className="client-entity-chart-title">Beneficiaries</h3>
              <div className="flex flex-col justify-center gap-1.5">
                {beneficiariesList.map((item, idx) => (
                  <div key={idx} className="client-beneficiary-row" style={{ borderBottom: "none", padding: "12px 0" }}>
                    <div>
                      <p className="client-beneficiary-name">{item.name}</p>
                      <p className="client-beneficiary-role">{item.role}</p>
                    </div>
                    <span className="client-beneficiary-percent">{item.percentage}%</span>
                  </div>
                ))}
                <div className="client-beneficiary-row" style={{ borderTop: "1.5px solid var(--border)", paddingTop: "16px", marginTop: "4px" }}>
                  <span className="font-bold text-slate-800 dark:text-white text-sm">Total ownership</span>
                  <span className="client-beneficiary-percent total">{totalOwnership}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. ROW 4: PROPERTIES & RECENT TRANSACTIONS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Properties Card List (2/3 width) */}
            <div className="lg:col-span-2 client-entity-chart-card flex flex-col gap-4">
              <h3 className="font-extrabold text-lg text-slate-800 dark:text-white">Properties</h3>

              <div className="client-properties-list-container">
                {mappedProperties.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 border border-dashed border-gray-200 dark:border-slate-700 rounded-xl">
                    No properties registered in this entity.
                  </div>
                ) : (
                  mappedProperties.map((prop) => (
                    <div key={prop.id} className="client-property-horizontal-row flex items-start gap-4 p-4 border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 mb-4 last:mb-0">
                      {/* Thumbnail Image */}
                      <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 flex items-center justify-center border border-slate-100">
                        {prop.imageUrl ? (
                          <img src={prop.imageUrl} alt={prop.name} className="w-full h-full object-cover" />
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-slate-400">
                            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                          </svg>
                        )}
                      </div>

                      {/* Main content block */}
                      <div className="flex-1 flex flex-col min-w-0">
                        {/* Line 1: Address Name & Net */}
                        <div className="flex justify-between items-start">
                          <Link href={`${propertyDetailHrefBase}/${prop.id}`} className="font-extrabold text-[#28336e] dark:text-white text-base hover:underline leading-snug">
                            {prop.name}
                          </Link>
                          <div className="flex items-center gap-1 text-xs">
                            <span className="text-slate-400 font-semibold">Net</span>
                            <span className="text-[#12b76a] font-extrabold text-sm">+{formatUSD(prop.net)}</span>
                          </div>
                        </div>

                        {/* Line 2: Entity Name & Badge */}
                        <div className="flex items-center gap-2 mt-1 mb-2">
                          <span className="text-slate-400 text-xs font-semibold">{prop.entityName}</span>
                          <span className="text-slate-300 text-xs font-semibold select-none">·</span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${prop.status.toLowerCase() === 'rented'
                            ? 'bg-[#ecfdf3] text-[#12b76a] dark:bg-green-500/10'
                            : 'bg-[#e0f2fe] text-[#0284c7] dark:bg-blue-500/10'
                            }`}>
                            {titleCase(prop.status)}
                          </span>
                        </div>

                        {/* Line 3: Metrics Row */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 font-semibold">
                          <span>Value <strong className="text-slate-700 dark:text-slate-200 ml-0.5">{formatUSD(prop.marketValue)}</strong></span>
                          <span>Loan <strong className="text-slate-700 dark:text-slate-200 ml-0.5">{formatUSD(prop.outstandingLoans)}</strong></span>
                          <span>Income <strong className="text-[#12b76a] ml-0.5">+{formatUSD(prop.income)}</strong></span>
                          <span>Expenses <strong className="text-[#f04438] ml-0.5">-{formatUSD(prop.expense)}</strong></span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Transactions (1/3 width) */}
            <div className="client-entity-chart-card flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h3 className="client-entity-chart-title">Recent transactions</h3>
                <Link href="/dashboard/client/transactions" className="text-xs font-bold text-slate-500 hover:text-slate-700" style={{ textDecoration: "none" }}>
                  View all
                </Link>
              </div>

              <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col">
                {recentTransactions.length === 0 ? (
                  <div className="p-6 text-center text-slate-400">
                    No recent transactions.
                  </div>
                ) : (
                  recentTransactions.map((tx, idx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      style={{ borderBottom: idx < recentTransactions.length - 1 ? "1px solid var(--border)" : "none" }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center ${tx.type === "revenue"
                            ? "bg-[#ecfdf3] text-[#12b76a] dark:bg-green-500/10"
                            : "bg-[#fef3f2] text-[#f04438] dark:bg-red-500/10"
                            }`}
                        >
                          {tx.type === "revenue" ? <UpRightIcon /> : <DownLeftIcon />}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight">
                            {tx.description}
                          </span>
                          <span className="text-slate-400 text-xs font-semibold mt-1">
                            {tx.meta} • {tx.dateText}
                          </span>
                        </div>
                      </div>

                      <span className={`font-bold text-sm ${tx.type === "revenue" ? "text-[#12b76a]" : "text-slate-700 dark:text-slate-300"}`}>
                        {tx.type === "revenue" ? "+" : "-"}{formatUSD(tx.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 5. ROW 5: DOCUMENTS SECTION (FULL WIDTH) */}
          <div className="client-entity-doc-section-card flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-lg text-slate-800 dark:text-white">Documents</h3>
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#28336e] dark:bg-[#38417f] px-4 py-2.5 rounded-xl hover:opacity-90 cursor-pointer"
                onClick={() => setIsUploadOpen(true)}
              >
                <PlusIcon />
                <span>Upload</span>
              </button>
            </div>

            {documents.length === 0 ? (
              <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                No documents uploaded yet. Click Upload to add a PDF/Image document.
              </div>
            ) : (
              <div className="client-documents-horizontal-list">
                {documents.slice(0, 3).map((doc) => (
                  <div
                    key={doc.id}
                    className="client-entity-doc-card"
                    onClick={() => {
                      fetch(`/api/documents/${encodeURIComponent(doc.id)}/download`, {
                        headers: { Authorization: `Bearer ${sessionToken}` }
                      })
                        .then(res => res.json())
                        .then(data => window.open(data.download_url, "_blank"))
                        .catch(() => { });
                    }}
                  >
                    <div className="client-entity-doc-info">
                      <div className="client-entity-doc-icon-box">
                        <DocFileIcon />
                      </div>
                      <div>
                        <p className="client-entity-doc-name">{doc.original_file_name || doc.file_name}</p>
                        <p className="client-entity-doc-meta">Uploaded {formatDocDate(doc.created_at)}</p>
                      </div>
                    </div>

                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "16px", height: "16px", color: "#98a2b3" }}>
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        /* MOBILE VIEW CONTAINER STACK (UNCHANGED) */
        <div className="flex flex-col gap-6">
          <div className="client-entity-chart-card flex flex-col gap-4">
            <h3 className="client-entity-chart-title">Profit & Loss Trend</h3>

            <CashFlowChart
              months={trendMonths}
              income={trendIncome}
              expenses={trendExpenses}
              view="graph"
            />

            <div className="flex justify-start gap-4 mt-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <div className="w-3 h-3 rounded-full bg-[#1b265c]" />
                <span>Income</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <div className="w-3 h-3 rounded-full bg-[#f4a117]" />
                <span>Expenses</span>
              </div>
            </div>
          </div>

          <div className="client-entity-beneficiaries-card flex flex-col gap-4">
            <h3 className="client-entity-chart-title">Beneficiaries</h3>
            {beneficiariesList.map((item, idx) => (
              <div key={idx} className="client-beneficiary-row">
                <div>
                  <p className="client-beneficiary-name">{item.name}</p>
                  <p className="client-beneficiary-role">{item.role}</p>
                </div>
                <span className="client-beneficiary-percent">{item.percentage}%</span>
              </div>
            ))}
            <div className="client-beneficiary-row" style={{ borderTop: "1.5px solid var(--border)", paddingTop: "12px" }}>
              <span className="font-bold text-slate-800 dark:text-white text-sm">Total ownership</span>
              <span className="client-beneficiary-percent total">{totalOwnership}%</span>
            </div>
          </div>

          {/* Quick Actions for Mobile */}
          <div className="grid grid-cols-2 gap-4">
            {addTransactionHref && (
              <Link href={addTransactionHref} className="client-quick-action-btn">
                <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '18px', height: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                  <path d="m7 15 5 5 5-5" />
                  <path d="m17 9-5-5-5 5" />
                </svg>
                <span>Add Transaction</span>
              </Link>
            )}

            <Link href={addPropertyHref} className="client-quick-action-btn">
              <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '18px', height: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <path d="M12 18v-6" />
                <path d="M9 15h6" />
              </svg>
              <span>Add Property</span>
            </Link>
          </div>

          {/* Mobile Properties Grid */}
          <div className="flex flex-col gap-4">
            <h3 className="font-extrabold text-lg text-slate-800 dark:text-white">Properties</h3>
            <div className="flex flex-col gap-4">
              {mappedProperties.length === 0 ? (
                <div className="p-6 text-center text-slate-400 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
                  No properties registered in this entity.
                </div>
              ) : (
                mappedProperties.map((prop) => (
                  <div key={prop.id} className="client-entity-property-card">
                    <div className="client-entity-property-img-placeholder">
                      {prop.imageUrl ? (
                        <img src={prop.imageUrl} alt={prop.name} className="w-full h-full object-cover" />
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: '48px', height: '48px', color: '#98a2b3' }}>
                          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                          <path d="M9 22V12h6v10" />
                        </svg>
                      )}
                      <span className={`client-entity-property-badge ${prop.status.toLowerCase() === 'rented' ? 'rented' : 'self-occupied'}`}>
                        {titleCase(prop.status)}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 mt-4">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                          <Link href={`${propertyDetailHrefBase}/${prop.id}`} className="font-extrabold text-slate-800 dark:text-white text-base hover:underline" style={{ textDecoration: 'none' }}>
                            {prop.name}
                          </Link>
                          <span className="text-slate-400 text-xs font-semibold">{prop.entityName}</span>
                        </div>
                        <span className="text-[#12b76a] font-bold text-sm">Net +{formatUSD(prop.net)}</span>
                      </div>

                      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold border-t border-slate-50 dark:border-slate-800 pt-3 mt-1">
                        <span>Value <strong>{formatUSD(prop.marketValue)}</strong></span>
                        <span>Loan <strong>{formatUSD(prop.outstandingLoans)}</strong></span>
                      </div>

                      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                        <span>Income <strong className="text-[#12b76a]">{formatUSD(prop.income)}</strong></span>
                        <span>Expenses <strong className="text-red-500">-{formatUSD(prop.expense)}</strong></span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Mobile Recent Transactions */}
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-lg text-slate-800 dark:text-white">Recent transactions</h3>
              <Link href="/dashboard/client/transactions" className="text-xs font-bold text-slate-500 hover:text-slate-700" style={{ textDecoration: 'none' }}>
                View all
              </Link>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl overflow-hidden flex flex-col">
              {recentTransactions.length === 0 ? (
                <div className="p-6 text-center text-slate-400">
                  No recent transactions.
                </div>
              ) : (
                recentTransactions.map((tx, idx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    style={{ borderBottom: idx < recentTransactions.length - 1 ? "1px solid var(--border)" : "none" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center ${tx.type === "revenue"
                          ? "bg-[#ecfdf3] text-[#12b76a] dark:bg-green-500/10"
                          : "bg-[#fef3f2] text-[#f04438] dark:bg-red-500/10"
                          }`}
                      >
                        {tx.type === "revenue" ? <UpRightIcon /> : <DownLeftIcon />}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight">
                          {tx.description}
                        </span>
                        <span className="text-slate-400 text-xs font-semibold mt-1">
                          {tx.meta} • {tx.dateText}
                        </span>
                      </div>
                    </div>

                    <span className={`font-bold text-sm ${tx.type === "revenue" ? "text-[#12b76a]" : "text-slate-700 dark:text-slate-300"}`}>
                      {tx.type === "revenue" ? "+" : "-"}{formatUSD(tx.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Mobile Documents Section */}
          <div className="client-entity-doc-section-card flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-lg text-slate-800 dark:text-white">Documents</h3>
              <div className="flex items-center gap-3">
                <Link href="/dashboard/client/documents" className="text-xs font-bold text-slate-500 hover:text-slate-700" style={{ textDecoration: 'none' }}>
                  View all
                </Link>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs font-bold text-white bg-[#28336e] dark:bg-[#38417f] px-3.5 py-2 rounded-lg cursor-pointer"
                  onClick={() => setIsUploadOpen(true)}
                >
                  Add
                </button>
              </div>
            </div>

            {documents.length === 0 ? (
              <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                No documents uploaded yet.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {documents.slice(0, 2).map((doc) => (
                  <div
                    key={doc.id}
                    className="client-entity-doc-card"
                    onClick={() => {
                      fetch(`/api/documents/${encodeURIComponent(doc.id)}/download`, {
                        headers: { Authorization: `Bearer ${sessionToken}` }
                      })
                        .then(res => res.json())
                        .then(data => window.open(data.download_url, "_blank"))
                        .catch(() => { });
                    }}
                  >
                    <div className="client-entity-doc-info">
                      <div className="client-entity-doc-icon-box">
                        <DocFileIcon />
                      </div>
                      <div>
                        <p className="client-entity-doc-name">{doc.original_file_name || doc.file_name}</p>
                        <p className="client-entity-doc-meta">Uploaded {formatDocDate(doc.created_at)}</p>
                      </div>
                    </div>

                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: "16px", height: "16px", color: "#98a2b3" }}>
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================================================
         UPLOAD DOCUMENT MODAL DIALOG POPUP
         ========================================================================== */}
      {isUploadOpen && (
        <div className="client-upload-modal-backdrop" onClick={() => setIsUploadOpen(false)}>
          <div className="client-upload-modal" onClick={(e) => e.stopPropagation()}>

            <div className="client-upload-modal-header">
              <button type="button" className="client-upload-modal-back-btn" onClick={() => setIsUploadOpen(false)}>
                <BackIcon />
                <span>Back</span>
              </button>
              <h2 className="client-upload-modal-title">Upload Document</h2>
              <div style={{ width: "40px" }} /> {/* spacer */}
            </div>

            <form onSubmit={handleUploadSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="client-upload-modal-body">

                {/* Drag and drop upload target zone */}
                <div
                  className="client-upload-drag-zone"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="client-upload-drag-icon-wrap">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '22px', height: '22px' }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  {uploadFile ? (
                    <>
                      <h4 className="client-upload-drag-title text-[#12b76a]">File selected!</h4>
                      <p className="client-upload-drag-sub">{uploadFile.name}</p>
                    </>
                  ) : (
                    <>
                      <h4 className="client-upload-drag-title">Upload Document</h4>
                      <p className="client-upload-drag-sub">PDF, JPG, PNG max 10 MB</p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileChange(e.target.files[0]);
                      }
                    }}
                    accept=".pdf,.png,.jpg,.jpeg"
                    style={{ display: "none" }}
                  />
                </div>

                {/* Progress Bar (Only visible during upload) */}
                {uploading && (
                  <div className="mb-6">
                    <div className="flex justify-between text-xs font-semibold mb-1 text-slate-500">
                      <span>Uploading to S3...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-[#1b265c] dark:bg-[#f4a117] transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}

                {/* Document Type tag selector pills */}
                <div className="mb-6">
                  <span className="client-upload-tags-label">Document Type *</span>
                  <div className="client-upload-tags-wrap">
                    {docTypes.map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={`client-upload-tag-pill ${selectedDocType === type ? 'is-selected' : ''}`}
                        onClick={() => setSelectedDocType(type)}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Document Name input field */}
                <div className="client-upload-form-group">
                  <label className="client-upload-field-label">Document Name</label>
                  <input
                    type="text"
                    className="client-upload-input"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    placeholder="Enter document name"
                    required
                  />
                </div>

                {/* Link to section */}
                <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-6">
                  <span className="client-upload-tags-label" style={{ marginBottom: "16px" }}>Link To *</span>

                  <div className="client-upload-form-group">
                    <label className="client-upload-field-label">Entity Name <em>*</em></label>
                    <input
                      type="text"
                      className="client-upload-input"
                      value={entity?.name || "Johnson Family Trust"}
                      disabled
                      style={{ opacity: 0.7, cursor: "not-allowed" }}
                    />
                  </div>

                  <div className="client-upload-form-group">
                    <label className="client-upload-field-label">Select Property <em>*</em></label>
                    <select
                      className="client-upload-select"
                      value={selectedPropertyId}
                      onChange={(e) => setSelectedPropertyId(e.target.value)}
                      required
                    >
                      <option value="">Select Property</option>
                      {properties.map((prop) => (
                        <option key={prop.id} value={prop.id}>
                          {prop.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

              </div>

              <div className="client-upload-modal-footer">
                <button
                  type="submit"
                  className="client-upload-submit-btn"
                  disabled={!uploadFile || !docName.trim() || !selectedPropertyId || uploading}
                >
                  {uploading ? "Uploading..." : "Upload Document"}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
