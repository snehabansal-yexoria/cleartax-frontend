"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Skeleton } from "boneyard-js/react";
import { ClientEntitiesSkeleton } from "@/app/components/PortalSkeletons";
import ClientTransactionsSkeleton from "@/app/components/clients/ClientTransactionsSkeleton";
import { AllTransactionsView } from "@/app/components/TransactionsFeature";
import { getSession } from "@/src/lib/session";
import { formatClientCurrency } from "@/app/components/clients/CurrencyFormatter";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

export default function ClientTransactionsPage() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<'all' | 'income' | 'expense' | 'month'>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);

  // Filter bottom sheet state variables
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | '3days' | 'week' | '30days' | 'quarter'>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');

  // Temp selection draft variables
  const [tempType, setTempType] = useState<'all' | 'income' | 'expense'>('all');
  const [tempDateRange, setTempDateRange] = useState<'all' | '3days' | 'week' | '30days' | 'quarter'>('all');
  const [tempEntity, setTempEntity] = useState<string>('all');
  const [tempProperty, setTempProperty] = useState<string>('all');

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

        const res = await fetch("/api/transactions", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (cancelled) return;

        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setTransactions(data.items || []);
        }
      } catch (err) {
        console.error("Failed to fetch transactions:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const listData = transactions.map(tx => ({
    id: tx.id,
    description: tx.description || `${tx.type === "revenue" ? "Income" : "Expense"} - ${tx.categoryName}`,
    categoryName: tx.categoryName,
    subcategoryName: tx.subcategoryName || "",
    meta: tx.propertyName || tx.propertyNames?.[0] || "",
    type: tx.type,
    amount: Math.abs(tx.netAmount || tx.grossAmount || 0),
    gstAmount: tx.gstAmount || 0,
    invoiceDate: tx.invoiceDate ? tx.invoiceDate.split('T')[0] : "",
    entityName: tx.entityName || "Individual",
    entityId: tx.entityId || "",
    documentId: tx.documentId || tx.metadata?.document_id || null,
    documentFileName: tx.documentFileName || tx.metadata?.invoice_name || tx.metadata?.document_name || null,
  }));

  // Unique entities list for bottom sheet filters
  const uniqueEntitiesList = Array.from(new Set(listData.map(tx => tx.entityName).filter(Boolean)));

  // Unique properties list for bottom sheet filters
  const uniquePropertiesList = Array.from(new Set(listData.map(tx => tx.meta).filter(Boolean)));

  // MTD calculations based on active calendar month
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const currentMonthTxs = listData.filter(tx => {
    if (!tx.invoiceDate) return false;
    const d = new Date(tx.invoiceDate);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const incomeMtd = currentMonthTxs
    .filter(tx => tx.type === "revenue")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const expenseMtd = currentMonthTxs
    .filter(tx => tx.type === "expense")
    .reduce((sum, tx) => sum + tx.amount, 0);

  // Fallbacks if no data exists
  const displayIncomeMtd = incomeMtd;
  const displayExpenseMtd = expenseMtd;

  // Filter listData based on all active filters
  let filtered = listData;

  // 1. Search Query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(tx =>
      tx.description.toLowerCase().includes(q) ||
      tx.categoryName.toLowerCase().includes(q) ||
      tx.meta.toLowerCase().includes(q)
    );
  }

  // 2. Main Page Pills Quick Filters
  if (activeFilter === 'income') {
    filtered = filtered.filter(tx => tx.type === 'revenue');
  } else if (activeFilter === 'expense') {
    filtered = filtered.filter(tx => tx.type === 'expense');
  } else if (activeFilter === 'month') {
    filtered = filtered.filter(tx => {
      if (!tx.invoiceDate) return false;
      const d = new Date(tx.invoiceDate);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }

  // 3. Sheet Type Filter
  if (typeFilter !== 'all') {
    filtered = filtered.filter(tx => {
      if (typeFilter === 'income') return tx.type === 'revenue';
      if (typeFilter === 'expense') return tx.type === 'expense';
      return true;
    });
  }

  // 4. Sheet Date Range Filter
  if (dateRangeFilter !== 'all') {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    filtered = filtered.filter(tx => {
      if (!tx.invoiceDate) return false;
      const txDate = new Date(tx.invoiceDate);
      const diffTime = todayMidnight.getTime() - txDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      if (dateRangeFilter === '3days') {
        return diffDays <= 3;
      }
      if (dateRangeFilter === 'week') {
        return diffDays <= 7;
      }
      if (dateRangeFilter === '30days') {
        return diffDays <= 30;
      }
      if (dateRangeFilter === 'quarter') {
        const currentQuarter = Math.floor(currentMonth / 3);
        const txQuarter = Math.floor(txDate.getMonth() / 3);
        return txQuarter === currentQuarter && txDate.getFullYear() === currentYear;
      }
      return true;
    });
  }

  // 5. Sheet Entity Filter
  if (entityFilter !== 'all') {
    filtered = filtered.filter(tx => tx.entityName === entityFilter || tx.entityId === entityFilter);
  }

  // 6. Sheet Property Filter
  if (propertyFilter !== 'all') {
    filtered = filtered.filter(tx => tx.meta === propertyFilter);
  }

  // Group transactions by date
  const groupTransactionsByDate = (itemsList: any[]) => {
    const groups: { [key: string]: any[] } = {};
    const sorted = [...itemsList].sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));

    sorted.forEach(item => {
      if (!item.invoiceDate) return;
      const dateLabel = formatDateGroupHeader(item.invoiceDate);
      if (!groups[dateLabel]) {
        groups[dateLabel] = [];
      }
      groups[dateLabel].push(item);
    });
    return groups;
  };

  const formatDateGroupHeader = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const formattedDate = date.toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      if (dateStr === todayStr) {
        return `Today - ${formattedDate}`;
      } else if (dateStr === yesterdayStr) {
        return `Yesterday - ${formattedDate}`;
      }
      return formattedDate;
    } catch (e) {
      return dateStr;
    }
  };

  const groupedTransactions = groupTransactionsByDate(filtered);

  // Bottom sheet actions
  const openFilterSheet = () => {
    setTempType(typeFilter);
    setTempDateRange(dateRangeFilter);
    setTempEntity(entityFilter);
    setTempProperty(propertyFilter);
    setIsFilterSheetOpen(true);
  };

  const handleApplyFilters = () => {
    setTypeFilter(tempType);
    setDateRangeFilter(tempDateRange);
    setEntityFilter(tempEntity);
    setPropertyFilter(tempProperty);

    // Sync main page pills
    if (tempType === 'income') {
      setActiveFilter('income');
    } else if (tempType === 'expense') {
      setActiveFilter('expense');
    } else {
      setActiveFilter('all');
    }

    setIsFilterSheetOpen(false);
  };

  const handleCancelFilters = () => {
    setIsFilterSheetOpen(false);
  };

  const handleClearAll = () => {
    setTempType('all');
    setTempDateRange('all');
    setTempEntity('all');
    setTempProperty('all');
  };

  const handleQuickFilterChange = (filter: 'all' | 'income' | 'expense' | 'month') => {
    setActiveFilter(filter);
    if (filter === 'income') {
      setTypeFilter('income');
    } else if (filter === 'expense') {
      setTypeFilter('expense');
    } else if (filter === 'all') {
      setTypeFilter('all');
      setDateRangeFilter('all');
      setEntityFilter('all');
      setPropertyFilter('all');
    }
  };

  const renderTransactionDetailModal = () => {
    if (!selectedTransaction) return null;

    // Format Date
    let formattedDate = "";
    try {
      const date = new Date(selectedTransaction.invoiceDate);
      formattedDate = date.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch (e) {
      formattedDate = selectedTransaction.invoiceDate;
    }

    // Generate dynamic file name
    const sanitizedDesc = selectedTransaction.description
      ? selectedTransaction.description.toLowerCase().replace(/[^a-z0-9]/g, '_')
      : 'transaction';
    const fileName = selectedTransaction.documentFileName || `${sanitizedDesc}_invoice.pdf`;

    return (
      <div 
        className="m-filter-backdrop" 
        onClick={() => setSelectedTransaction(null)}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '24px'
        }}
      >
        <div 
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: '520px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Title above the card */}
          <div style={{ 
            color: '#ffffff', 
            fontSize: '18px', 
            fontWeight: 600, 
            marginBottom: '16px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '0 4px'
          }}>
            <span>Transaction detail</span>
            <button 
              onClick={() => setSelectedTransaction(null)}
              style={{ 
                border: 'none', 
                background: 'none', 
                color: 'rgba(255, 255, 255, 0.7)', 
                fontSize: '28px', 
                cursor: 'pointer', 
                padding: 0, 
                lineHeight: 1 
              }}
              aria-label="Close modal"
            >
              &times;
            </button>
          </div>

          {/* Card Body */}
          <div style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: '24px',
            padding: isMobile ? '24px 20px' : '32px 28px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            {/* Badge & Amount */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
              <span style={{
                padding: '6px 12px',
                borderRadius: '100px',
                fontSize: '12px',
                fontWeight: '600',
                textTransform: 'capitalize',
                background: selectedTransaction.type === 'revenue' ? 'rgba(93, 202, 165, 0.15)' : 'rgba(240, 149, 149, 0.15)',
                color: selectedTransaction.type === 'revenue' ? 'var(--success)' : 'var(--danger)'
              }}>
                {selectedTransaction.type === 'revenue' ? 'Income' : 'Expense'}
              </span>
              <div style={{ fontSize: '34px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.5px', marginTop: '4px' }}>
                {formatClientCurrency(selectedTransaction.type === 'revenue' ? selectedTransaction.amount : -selectedTransaction.amount, { decimals: 2, showPlus: true })}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {formattedDate} · {selectedTransaction.description}
              </div>
            </div>

            <div style={{ height: '1px', background: 'var(--border)' }} />

            {/* Details Table Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { label: 'Entity', value: selectedTransaction.entityName },
                { label: 'Property', value: selectedTransaction.meta || 'N/A' },
                { label: 'Category', value: selectedTransaction.categoryName },
                { label: 'Subcategory', value: selectedTransaction.subcategoryName || 'N/A' },
                { 
                  label: 'GST', 
                  value: selectedTransaction.gstAmount !== undefined && selectedTransaction.gstAmount > 0
                    ? `10% (${formatClientCurrency(selectedTransaction.gstAmount, { decimals: 2 })})`
                    : `10% (${formatClientCurrency(selectedTransaction.amount * 0.1, { decimals: 2 })})`
                },
                { label: 'Description', value: selectedTransaction.description }
              ].map((row, index, arr) => (
                <div 
                  key={row.label} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    paddingBottom: index < arr.length - 1 ? '14px' : '0',
                    borderBottom: index < arr.length - 1 ? '1px solid var(--border)' : 'none'
                  }}
                >
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>{row.label}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600', textAlign: 'right', maxWidth: '70%', wordBreak: 'break-word' }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Attached Document Section */}
            {selectedTransaction.documentId && (
              <div style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '6px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    background: '#F0ECE4',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#D0A860" strokeWidth="2" style={{ width: '18px', height: '18px' }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fileName}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      356 KB · {formattedDate}
                    </span>
                  </div>
                </div>
                <a 
                  href="#" 
                  onClick={async (e) => {
                    e.preventDefault();
                    const docId = selectedTransaction.documentId;
                    if (!docId) return;
                    try {
                      const session = (await getSession()) as SessionWithIdToken | null;
                      if (!session) {
                        alert("You're signed out.");
                        return;
                      }
                      const token = session.getIdToken().getJwtToken();
                      const res = await fetch(`/api/documents/${encodeURIComponent(docId)}/download`, {
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      if (!res.ok) throw new Error("Failed to get download URL");
                      const data = await res.json();
                      window.open(data.download_url, "_blank", "noopener,noreferrer");
                    } catch (err) {
                      console.error("Failed to open invoice:", err);
                      alert("Failed to open the attached invoice. Please try again.");
                    }
                  }}
                  style={{ fontSize: '13px', fontWeight: '600', color: 'var(--brand)', textDecoration: 'none', marginLeft: '12px' }}
                >
                  View
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (isMobile) {
    return (
      <Skeleton
        name="client-transactions-page-skeleton"
        loading={isLoading}
        fallback={<ClientTransactionsSkeleton />}
      >
        <div className="mobile-client-dashboard" style={{ background: 'var(--surface-0)', minHeight: '100vh', paddingBottom: '90px', fontFamily: "'Inter', -apple-system, sans-serif" }}>

          {/* Keyframe Animations */}
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { transform: translateY(100%); }
              to { transform: translateY(0); }
            }
            .m-filter-backdrop {
              animation: fadeIn 0.2s ease-out forwards;
            }
            .m-filter-sheet {
              animation: slideUp 0.25s cubic-bezier(0.1, 0.76, 0.55, 0.94) forwards;
            }
            .no-scrollbar::-webkit-scrollbar {
              display: none;
            }
            .no-scrollbar {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
          `}</style>

          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 16px',
            background: 'var(--surface-1)',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            zIndex: 50
          }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Transactions</h1>
            <Link
              href="/dashboard/client/transactions/new"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'var(--brand)',
                color: '#ffffff',
                textDecoration: 'none',
                fontSize: '22px',
                fontWeight: 400,
                boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)'
              }}
            >
              +
            </Link>
          </div>

          {/* Search Box */}
          <div style={{ padding: '16px 16px 8px 16px' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px', color: 'var(--text-muted)' }}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search Transactions"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 42px 12px 42px',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  fontSize: '15px',
                  background: 'var(--surface-1)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                }}
              />
              <button
                type="button"
                onClick={openFilterSheet}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  outline: 'none'
                }}
                aria-label="Filter transactions"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px', color: 'var(--text-secondary)' }}>
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
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div 
            className="no-scrollbar"
            style={{ 
              display: 'flex', 
              gap: '8px', 
              overflowX: 'auto', 
              padding: '4px 16px 16px 16px', 
              WebkitOverflowScrolling: 'touch' 
            }}
          >
            {[
              { id: 'all', label: 'All' },
              { id: 'income', label: 'Income' },
              { id: 'expense', label: 'Expense' },
              { id: 'month', label: 'This Month' }
            ].map((pill) => {
              const isActive = activeFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => handleQuickFilterChange(pill.id as any)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    fontWeight: '600',
                    border: isActive ? '1px solid var(--brand)' : '1px solid var(--border)',
                    background: isActive ? 'var(--brand)' : 'var(--surface-1)',
                    color: isActive ? '#ffffff' : 'var(--brand)',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          {/* MTD Card */}
          <div style={{ padding: '0 16px 16px 16px' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              padding: '18px 16px', 
              borderRadius: '16px', 
              background: 'var(--surface-1)', 
              border: '1px solid var(--border)', 
              boxShadow: '0 4px 12px rgba(16, 24, 40, 0.01)' 
            }}>
              <div style={{ paddingRight: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>Income (MTD)</span>
                <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--success)', marginTop: '4px' }}>
                  {formatClientCurrency(displayIncomeMtd, { showPlus: true })}
                </div>
              </div>
              <div style={{ paddingLeft: '20px', borderLeft: '1px solid var(--border)' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>Expense (MTD)</span>
                <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--danger)', marginTop: '4px' }}>
                  {formatClientCurrency(-displayExpenseMtd, { showPlus: true })}
                </div>
              </div>
            </div>
          </div>

          {/* Grouped Transactions List */}
          {Object.keys(groupedTransactions).length === 0 ? (
            <div style={{ margin: '0 16px', textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '16px' }}>
              No transactions found matching search or filter criteria.
            </div>
          ) : (
            Object.entries(groupedTransactions).map(([dateLabel, items]) => (
              <div key={dateLabel} style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)', margin: '0 16px 8px 16px' }}>
                  {dateLabel}
                </h4>

                <div style={{
                  margin: '0 16px',
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 4px 12px rgba(16, 24, 40, 0.01)'
                }}>
                  {items.map((tx, idx) => (
                    <div 
                      key={tx.id} 
                      onClick={() => setSelectedTransaction(tx)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '16px',
                        borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                        <div 
                          className={`m-db-activity-icon-box ${tx.type === 'revenue' ? 'income' : 'expense'}`}
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          {tx.type === 'revenue' ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '18px', height: '18px' }}>
                              <line x1="7" y1="17" x2="17" y2="7" />
                              <polyline points="7 7 17 7 17 17" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '18px', height: '18px' }}>
                              <line x1="17" y1="7" x2="7" y2="17" />
                              <polyline points="17 17 7 17 7 7" />
                            </svg>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                          <strong style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tx.description}
                          </strong>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', display: 'block', wordBreak: 'break-word' }}>
                            {tx.categoryName} {tx.meta ? `- ${tx.meta}` : ''}
                          </span>
                        </div>
                      </div>
                      <span 
                        style={{ 
                          fontSize: '15px', 
                          fontWeight: '700', 
                          textAlign: 'right', 
                          flexShrink: 0, 
                          marginLeft: '12px',
                          color: tx.type === 'revenue' ? 'var(--success)' : 'var(--danger)'
                        }}
                      >
                        {formatClientCurrency(tx.type === 'revenue' ? tx.amount : -tx.amount, { showPlus: true })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Filters Bottom Sheet Drawer */}
          {isFilterSheetOpen && (
            <>
              {/* Backdrop */}
              <div
                className="m-filter-backdrop"
                onClick={handleCancelFilters}
                style={{
                  position: 'fixed',
                  left: 0,
                  top: 0,
                  width: '100vw',
                  height: '100vh',
                  background: 'rgba(0, 0, 0, 0.4)',
                  zIndex: 1000
                }}
              />

              {/* Sheet Drawer */}
              <div
                className="m-filter-sheet"
                style={{
                  position: 'fixed',
                  left: 0,
                  bottom: 0,
                  width: '100%',
                  maxHeight: '88vh',
                  background: 'var(--surface-1)',
                  borderTop: '1px solid var(--border)',
                  borderTopLeftRadius: '24px',
                  borderTopRightRadius: '24px',
                  boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.25)',
                  padding: '8px 16px 24px 16px',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  zIndex: 1001,
                  fontFamily: 'Inter, -apple-system, sans-serif'
                }}
              >
                {/* Drag Handle */}
                <div style={{ width: '40px', height: '4px', background: 'var(--border)', borderRadius: '2px', margin: '0 auto 16px auto' }} />

                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Filters</h2>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    style={{ border: 'none', background: 'none', color: 'var(--brand)', fontSize: '15px', fontWeight: 600, padding: 0, cursor: 'pointer', outline: 'none' }}
                  >
                    Clear all
                  </button>
                </div>

                {/* Scrollable Filters Content */}
                <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
                  {/* Type Filter */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>Type</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {['all', 'income', 'expense'].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTempType(t as any)}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '20px',
                            fontSize: '14px',
                            fontWeight: 600,
                            border: `1px solid ${tempType === t ? 'var(--brand)' : 'var(--border)'}`,
                            background: tempType === t ? 'var(--brand)' : 'var(--surface-2)',
                            color: tempType === t ? '#ffffff' : 'var(--text-primary)',
                            textTransform: 'capitalize',
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ height: '1px', background: 'var(--border)', margin: '12px 0' }} />

                  {/* Date Range Filter */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>Date Range</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {[
                        { label: 'All', value: 'all' },
                        { label: 'Past 3 days', value: '3days' },
                        { label: 'Past week', value: 'week' },
                        { label: 'Last 30 days', value: '30days' },
                        { label: 'This quarter', value: 'quarter' }
                      ].map((d) => (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => setTempDateRange(d.value as any)}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '20px',
                            fontSize: '14px',
                            fontWeight: 600,
                            border: `1px solid ${tempDateRange === d.value ? 'var(--brand)' : 'var(--border)'}`,
                            background: tempDateRange === d.value ? 'var(--brand)' : 'var(--surface-2)',
                            color: tempDateRange === d.value ? '#ffffff' : 'var(--text-primary)',
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ height: '1px', background: 'var(--border)', margin: '12px 0' }} />

                  {/* Entity Filter */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>Entity</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setTempEntity('all')}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '20px',
                          fontSize: '14px',
                          fontWeight: 600,
                          border: `1px solid ${tempEntity === 'all' ? 'var(--brand)' : 'var(--border)'}`,
                          background: tempEntity === 'all' ? 'var(--brand)' : 'var(--surface-2)',
                          color: tempEntity === 'all' ? '#ffffff' : 'var(--text-primary)',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      >
                        All
                      </button>
                      {uniqueEntitiesList.map((ent) => (
                        <button
                          key={ent}
                          type="button"
                          onClick={() => setTempEntity(ent)}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '20px',
                            fontSize: '14px',
                            fontWeight: 600,
                            border: `1px solid ${tempEntity === ent ? 'var(--brand)' : 'var(--border)'}`,
                            background: tempEntity === ent ? 'var(--brand)' : 'var(--surface-2)',
                            color: tempEntity === ent ? '#ffffff' : 'var(--text-primary)',
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          {ent}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ height: '1px', background: 'var(--border)', margin: '12px 0' }} />

                  {/* Properties Filter */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>Properties</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setTempProperty('all')}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '20px',
                          fontSize: '14px',
                          fontWeight: 600,
                          border: `1px solid ${tempProperty === 'all' ? 'var(--brand)' : 'var(--border)'}`,
                          background: tempProperty === 'all' ? 'var(--brand)' : 'var(--surface-2)',
                          color: tempProperty === 'all' ? '#ffffff' : 'var(--text-primary)',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      >
                        All
                      </button>
                      {uniquePropertiesList.map((prop) => (
                        <button
                          key={prop}
                          type="button"
                          onClick={() => setTempProperty(prop)}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '20px',
                            fontSize: '14px',
                            fontWeight: 600,
                            border: `1px solid ${tempProperty === prop ? 'var(--brand)' : 'var(--border)'}`,
                            background: tempProperty === prop ? 'var(--brand)' : 'var(--surface-2)',
                            color: tempProperty === prop ? '#ffffff' : 'var(--text-primary)',
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          {prop}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ height: '1px', background: 'var(--border)', margin: '16px 0' }} />

                {/* Footer buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={handleCancelFilters}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '16px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-2)',
                      color: 'var(--text-secondary)',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyFilters}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '16px',
                      border: 'none',
                      background: 'var(--brand)',
                      color: '#ffffff',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </>
          )}
          {renderTransactionDetailModal()}
        </div>
      </Skeleton>
    );
  }

  // Desktop / Tablet Responsive View
  return (
    <Skeleton
      name="client-transactions-page-skeleton-desktop"
      loading={isLoading}
      fallback={<ClientTransactionsSkeleton />}
    >
      <div className="desktop-client-dashboard">

        {/* Scoped CSS Styles */}
        <style>{`
          .d-tx-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: transparent;
            margin-bottom: 24px;
            padding: 0;
          }
          .d-tx-content-area {
            padding: 0;
          }
          .d-tx-add-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            border-radius: 20px;
            background: var(--brand);
            color: #ffffff;
            text-decoration: none;
            font-size: 24px;
            font-weight: 400;
            transition: all 0.2s ease;
          }
          .d-tx-add-btn:hover {
            background: var(--brand);
            filter: brightness(1.15);
            transform: scale(1.05);
          }
          .d-tx-search-container {
            display: flex;
            gap: 16px;
            margin-bottom: 24px;
            width: 100%;
          }
          .d-tx-search-wrapper {
            position: relative;
            flex: 1;
          }
          .d-tx-search-input {
            width: 100%;
            padding: 12px 16px 12px 44px;
            border-radius: 12px;
            border: 1px solid var(--border);
            font-size: 15px;
            background: var(--surface-1);
            color: var(--text-primary);
            outline: none;
            box-shadow: 0 4px 12px rgba(16, 24, 40, 0.01);
            transition: all 0.2s ease;
          }
          .d-tx-search-input:focus {
            border-color: var(--brand);
            box-shadow: 0 4px 12px var(--border);
          }
          .d-tx-search-icon-box {
            position: absolute;
            left: 16px;
            top: 50%;
            transform: translateY(-50%);
            display: flex;
            align-items: center;
            pointer-events: none;
          }
          .d-tx-filter-btn {
            width: 46px;
            height: 46px;
            border-radius: 12px;
            border: 1px solid var(--border);
            background: var(--surface-1);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            outline: none;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(16, 24, 40, 0.01);
            color: var(--brand);
          }
          .d-tx-filter-btn:hover {
            border-color: var(--brand);
            background: var(--surface-2);
            transform: scale(1.02);
          }
          .d-tx-pills-row {
            display: flex;
            gap: 12px;
            margin-bottom: 24px;
            flex-wrap: wrap;
          }
          .d-tx-pill {
            padding: 8px 20px;
            border-radius: 24px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            outline: none;
            transition: all 0.2s ease;
            border: 1px solid var(--border);
          }
          .d-tx-pill.active {
            background: var(--brand);
            color: #ffffff;
            border-color: var(--brand);
          }
          .d-tx-pill.inactive {
            background: var(--surface-1);
            color: var(--text-secondary);
            border-color: var(--border);
          }
          .d-tx-pill.inactive:hover {
            border-color: var(--brand);
            color: var(--brand);
            background: var(--surface-2);
          }
          .d-tx-mtd-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
            margin-bottom: 28px;
          }
          .d-tx-mtd-card {
            background: var(--surface-1);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 4px 12px rgba(16, 24, 40, 0.01);
            display: flex;
            flex-direction: column;
            gap: 8px;
            transition: all 0.25s ease;
          }
          .d-tx-mtd-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
          }
          .d-tx-mtd-label {
            font-size: 13px;
            color: var(--text-secondary);
            font-weight: 600;
          }
          .d-tx-mtd-value {
            font-size: 28px;
            font-weight: 800;
            margin-top: 4px;
            color: var(--text-primary);
          }
          .d-tx-mtd-value.income {
            color: var(--success);
          }
          .d-tx-mtd-value.expense {
            color: var(--danger);
          }
          .d-tx-group-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-secondary);
            margin: 0 0 12px 0;
          }
          .d-tx-list-card {
            background: var(--surface-1);
            border: 1px solid var(--border);
            border-radius: 16px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 4px 12px rgba(16, 24, 40, 0.01);
            margin-bottom: 24px;
          }
          .d-tx-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 24px;
            border-bottom: 1px solid var(--border);
            transition: background-color 0.2s ease;
          }
          .d-tx-row:last-child {
            border-bottom: none;
          }
          .d-tx-row:hover {
            background-color: var(--surface-2);
          }
          .d-tx-left {
            display: flex;
            align-items: center;
            gap: 16px;
            flex: 1;
            min-width: 0;
          }
          .d-tx-icon-box {
            width: 42px;
            height: 42px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: transform 0.2s ease;
          }
          .d-tx-row:hover .d-tx-icon-box {
            transform: scale(1.05);
          }
          .d-tx-icon-box.income {
            background: rgba(93, 202, 165, 0.15);
            color: var(--success);
          }
          .d-tx-icon-box.expense {
            background: rgba(240, 149, 149, 0.15);
            color: var(--danger);
          }
          .d-tx-info {
            display: flex;
            flex-direction: column;
            min-width: 0;
          }
          .d-tx-desc {
            font-size: 15px;
            font-weight: 700;
            color: var(--text-primary);
            margin: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .d-tx-meta {
            font-size: 13px;
            color: var(--text-secondary);
            margin: 4px 0 0 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .d-tx-amount {
            font-size: 16px;
            font-weight: 700;
            text-align: right;
            flex-shrink: 0;
          }
          .d-tx-amount.income {
            color: var(--success);
          }
          .d-tx-amount.expense {
            color: var(--danger);
          }
          .d-filter-modal-overlay {
            position: fixed;
            left: 0;
            top: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            animation: fadeIn 0.2s ease-out forwards;
          }
          .d-filter-modal-card {
            width: 480px;
            max-width: 90vw;
            background: var(--surface-1);
            border: 1px solid var(--border);
            border-radius: 20px;
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
            padding: 28px;
            display: flex;
            flex-direction: column;
            z-index: 1001;
            font-family: 'Inter', -apple-system, sans-serif;
            animation: scaleIn 0.2s cubic-bezier(0.1, 0.76, 0.55, 0.94) forwards;
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes scaleIn {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        `}</style>

        {/* Header */}
        <div className="d-tx-header">
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Transactions</h1>
          <Link href="/dashboard/client/transactions/new" className="d-tx-add-btn">
            +
          </Link>
        </div>

        {/* Content Area */}
        <div className="d-tx-content-area">
          {/* Search Box & Filters Button */}
          <div className="d-tx-search-container">
            <div className="d-tx-search-wrapper">
              <div className="d-tx-search-icon-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px', color: '#98a2b3' }}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search transactions"
                value={searchQuery}
                className="d-tx-search-input"
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={openFilterSheet}
              className="d-tx-filter-btn"
              aria-label="Filter transactions"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '20px', height: '20px' }}>
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
            </button>
          </div>

          {/* Filter Pills */}
          <div className="d-tx-pills-row">
            <button
              type="button"
              onClick={() => handleQuickFilterChange('all')}
              className={`d-tx-pill ${activeFilter === 'all' ? 'active' : 'inactive'}`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => handleQuickFilterChange('income')}
              className={`d-tx-pill ${activeFilter === 'income' ? 'active' : 'inactive'}`}
            >
              Income
            </button>
            <button
              type="button"
              onClick={() => handleQuickFilterChange('expense')}
              className={`d-tx-pill ${activeFilter === 'expense' ? 'active' : 'inactive'}`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => handleQuickFilterChange('month')}
              className={`d-tx-pill ${activeFilter === 'month' ? 'active' : 'inactive'}`}
            >
              This Month
            </button>
          </div>

          {/* MTD Cards Grid */}
          <div className="d-tx-mtd-grid">
            <div className="d-tx-mtd-card">
              <span className="d-tx-mtd-label">Income (MTD)</span>
              <div className="d-tx-mtd-value income">
                {formatClientCurrency(displayIncomeMtd)}
              </div>
            </div>
            <div className="d-tx-mtd-card">
              <span className="d-tx-mtd-label">Expense (MTD)</span>
              <div className="d-tx-mtd-value expense">
                {formatClientCurrency(-displayExpenseMtd)}
              </div>
            </div>
          </div>

          {/* Grouped Transactions List */}
          {Object.keys(groupedTransactions).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary)', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '16px', fontSize: '15px' }}>
              No transactions found matching search or filter criteria.
            </div>
          ) : (
            Object.entries(groupedTransactions).map(([dateLabel, items]) => (
              <div key={dateLabel} style={{ marginBottom: '24px' }}>
                <h4 className="d-tx-group-title">
                  {dateLabel}
                </h4>

                <div className="d-tx-list-card">
                  {items.map((tx, idx) => (
                    <div key={tx.id} className="d-tx-row" onClick={() => setSelectedTransaction(tx)} style={{ cursor: 'pointer' }}>
                      <div className="d-tx-left">
                        <div className={`d-tx-icon-box ${tx.type === 'revenue' ? 'income' : 'expense'}`}>
                          {tx.type === 'revenue' ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '18px', height: '18px' }}>
                              <line x1="7" y1="17" x2="17" y2="7" />
                              <polyline points="7 7 17 7 17 17" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '18px', height: '18px' }}>
                              <line x1="17" y1="7" x2="7" y2="17" />
                              <polyline points="17 17 7 17 7 7" />
                            </svg>
                          )}
                        </div>
                        <div className="d-tx-info">
                          <strong className="d-tx-desc">{tx.description}</strong>
                          <span className="d-tx-meta">
                            {tx.categoryName} {tx.meta ? `— ${tx.meta}` : ''}
                          </span>
                        </div>
                      </div>
                      <span className={`d-tx-amount ${tx.type === 'revenue' ? 'income' : 'expense'}`}>
                        {formatClientCurrency(tx.type === 'revenue' ? tx.amount : -tx.amount, { showPlus: true })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Filters Modal */}
        {isFilterSheetOpen && (
          <div className="d-filter-modal-overlay" onClick={handleCancelFilters}>
            <div className="d-filter-modal-card" onClick={(e) => e.stopPropagation()}>

              {/* Header Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Filters</h2>
                <button
                  type="button"
                  onClick={handleClearAll}
                  style={{ border: 'none', background: 'none', color: 'var(--brand)', fontSize: '15px', fontWeight: 600, padding: 0, cursor: 'pointer', outline: 'none' }}
                >
                  Clear all
                </button>
              </div>

              {/* Scrollable Filters Content */}
              <div style={{ overflowY: 'auto', maxHeight: '55vh', paddingRight: '4px' }}>
                {/* Type Filter */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>Type</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {['all', 'income', 'expense'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTempType(t as any)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '20px',
                          fontSize: '14px',
                          fontWeight: 600,
                          border: `1px solid ${tempType === t ? 'var(--brand)' : 'var(--border)'}`,
                          background: tempType === t ? 'var(--brand)' : 'var(--surface-2)',
                          color: tempType === t ? '#ffffff' : 'var(--text-primary)',
                          textTransform: 'capitalize',
                          cursor: 'pointer',
                          outline: 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ height: '1px', background: 'var(--border)', margin: '14px 0' }} />

                {/* Date Range Filter */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>Date Range</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {[
                      { label: 'All', value: 'all' },
                      { label: 'Past 3 days', value: '3days' },
                      { label: 'Past week', value: 'week' },
                      { label: 'Last 30 days', value: '30days' },
                      { label: 'This quarter', value: 'quarter' }
                    ].map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setTempDateRange(d.value as any)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '20px',
                          fontSize: '14px',
                          fontWeight: 600,
                          border: `1px solid ${tempDateRange === d.value ? 'var(--brand)' : 'var(--border)'}`,
                          background: tempDateRange === d.value ? 'var(--brand)' : 'var(--surface-2)',
                          color: tempDateRange === d.value ? '#ffffff' : 'var(--text-primary)',
                          cursor: 'pointer',
                          outline: 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ height: '1px', background: 'var(--border)', margin: '14px 0' }} />

                {/* Entity Filter */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>Entity</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setTempEntity('all')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontWeight: 600,
                        border: `1px solid ${tempEntity === 'all' ? 'var(--brand)' : 'var(--border)'}`,
                        background: tempEntity === 'all' ? 'var(--brand)' : 'var(--surface-2)',
                        color: tempEntity === 'all' ? '#ffffff' : 'var(--text-primary)',
                        cursor: 'pointer',
                        outline: 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      All
                    </button>
                    {uniqueEntitiesList.map((ent) => (
                      <button
                        key={ent}
                        type="button"
                        onClick={() => setTempEntity(ent)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '20px',
                          fontSize: '14px',
                          fontWeight: 600,
                          border: `1px solid ${tempEntity === ent ? 'var(--brand)' : 'var(--border)'}`,
                          background: tempEntity === ent ? 'var(--brand)' : 'var(--surface-2)',
                          color: tempEntity === ent ? '#ffffff' : 'var(--text-primary)',
                          cursor: 'pointer',
                          outline: 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {ent}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ height: '1px', background: 'var(--border)', margin: '14px 0' }} />

                {/* Properties Filter */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>Properties</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setTempProperty('all')}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontWeight: 600,
                        border: `1px solid ${tempProperty === 'all' ? 'var(--brand)' : 'var(--border)'}`,
                        background: tempProperty === 'all' ? 'var(--brand)' : 'var(--surface-2)',
                        color: tempProperty === 'all' ? '#ffffff' : 'var(--text-primary)',
                        cursor: 'pointer',
                        outline: 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      All
                    </button>
                    {uniquePropertiesList.map((prop) => (
                      <button
                        key={prop}
                        type="button"
                        onClick={() => setTempProperty(prop)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '20px',
                          fontSize: '14px',
                          fontWeight: 600,
                          border: `1px solid ${tempProperty === prop ? 'var(--brand)' : 'var(--border)'}`,
                          background: tempProperty === prop ? 'var(--brand)' : 'var(--surface-2)',
                          color: tempProperty === prop ? '#ffffff' : 'var(--text-primary)',
                          cursor: 'pointer',
                          outline: 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {prop}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ height: '1px', background: 'var(--border)', margin: '16px 0' }} />

              {/* Footer buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  type="button"
                  onClick={handleCancelFilters}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                    color: 'var(--text-secondary)',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyFilters}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'var(--brand)',
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}
        {renderTransactionDetailModal()}
      </div>
    </Skeleton>
  );
}
