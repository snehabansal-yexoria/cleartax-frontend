import React from "react";

interface ClientTransactionsSkeletonProps {
  isMobile?: boolean;
}

export default function ClientTransactionsSkeleton({ isMobile = false }: ClientTransactionsSkeletonProps) {
  if (isMobile) {
    return (
      <div
        className="mobile-client-dashboard boneyard-fallback"
        style={{
          background: 'var(--surface-0)',
          minHeight: '100vh',
          paddingBottom: '90px',
          fontFamily: "'Inter', -apple-system, sans-serif"
        }}
        aria-busy="true"
        aria-label="Loading transactions"
      >
        {/* Mobile Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 16px',
            background: 'var(--surface-1)',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            zIndex: 50
          }}
        >
          <div className="skeleton-line" style={{ width: '140px', height: '22px', borderRadius: '4px' }} />
          <div className="skeleton-circle" style={{ width: '40px', height: '40px', borderRadius: '20px' }} />
        </div>

        {/* Mobile Search Box */}
        <div style={{ padding: '16px 16px 8px 16px' }}>
          <div
            className="skeleton-input"
            style={{ width: '100%', height: '46px', borderRadius: '12px', border: '1px solid var(--border)' }}
          />
        </div>

        {/* Mobile MTD Summary Card */}
        <div style={{ padding: '0 16px 16px 16px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              padding: '18px 16px',
              borderRadius: '16px',
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              boxShadow: '0 4px 12px rgba(16, 24, 40, 0.01)'
            }}
          >
            <div style={{ paddingRight: '12px' }}>
              <div className="skeleton-line skeleton-line-sm" style={{ width: '80px', height: '13px', marginBottom: '8px' }} />
              <div className="skeleton-line" style={{ width: '100px', height: '22px', borderRadius: '6px' }} />
            </div>
            <div style={{ paddingLeft: '20px', borderLeft: '1px solid var(--border)' }}>
              <div className="skeleton-line skeleton-line-sm" style={{ width: '80px', height: '13px', marginBottom: '8px' }} />
              <div className="skeleton-line" style={{ width: '100px', height: '22px', borderRadius: '6px' }} />
            </div>
          </div>
        </div>

        {/* Mobile Tabs Control */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '4px 16px 8px 16px',
            alignItems: 'center'
          }}
        >
          <div className="skeleton-pill" style={{ width: '110px', height: '36px', borderRadius: '12px' }} />
          <div className="skeleton-pill" style={{ width: '150px', height: '36px', borderRadius: '12px' }} />
        </div>

        {/* Mobile Filter Pills */}
        <div
          className="no-scrollbar"
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            padding: '4px 16px 16px 16px'
          }}
        >
          <div className="skeleton-pill" style={{ width: '50px', height: '34px', borderRadius: '24px', flexShrink: 0 }} />
          <div className="skeleton-pill" style={{ width: '75px', height: '34px', borderRadius: '24px', flexShrink: 0 }} />
          <div className="skeleton-pill" style={{ width: '80px', height: '34px', borderRadius: '24px', flexShrink: 0 }} />
          <div className="skeleton-pill" style={{ width: '95px', height: '34px', borderRadius: '24px', flexShrink: 0 }} />
        </div>

        {/* Mobile Grouped Transactions List */}
        <div style={{ marginBottom: '20px' }}>
          <div className="skeleton-line skeleton-line-sm" style={{ width: '90px', height: '14px', margin: '0 16px 8px 16px' }} />
          <div
            style={{
              margin: '0 16px',
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 12px rgba(16, 24, 40, 0.01)'
            }}
          >
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  borderBottom: idx < 3 ? '1px solid var(--border)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                  <div className="skeleton-circle" style={{ width: '40px', height: '40px', borderRadius: '8px', flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: 0 }}>
                    <div className="skeleton-line skeleton-line-md" style={{ width: '65%', height: '14px' }} />
                    <div className="skeleton-line skeleton-line-sm" style={{ width: '45%', height: '11px' }} />
                  </div>
                </div>
                <div className="skeleton-line skeleton-line-sm" style={{ width: '60px', height: '16px', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Desktop / Tablet View
  return (
    <div
      className="desktop-client-dashboard boneyard-fallback"
      style={{ background: 'var(--surface-0)', minHeight: '100vh', paddingBottom: '40px' }}
      aria-busy="true"
      aria-label="Loading transactions"
    >
      {/* Desktop Header */}
      <div className="d-tx-header">
        <div className="skeleton-line skeleton-line-md" style={{ width: '180px', height: '28px' }} />
        <div className="skeleton-circle" style={{ width: '40px', height: '40px', borderRadius: '20px' }} />
      </div>

      {/* Desktop Content Area */}
      <div className="d-tx-content-area">
        {/* Search row skeleton */}
        <div className="d-tx-search-container">
          <div className="d-tx-search-wrapper">
            <div className="skeleton-input" style={{ width: '100%', height: '46px', borderRadius: '12px' }} />
          </div>
          <div className="skeleton-panel" style={{ width: '46px', height: '46px', borderRadius: '12px', flexShrink: 0 }} />
        </div>

        {/* Cards row skeleton */}
        <div className="d-tx-mtd-grid">
          <div className="d-tx-mtd-card">
            <div className="skeleton-line skeleton-line-sm" style={{ width: '90px', height: '13px' }} />
            <div className="skeleton-line skeleton-line-lg" style={{ width: '130px', height: '28px', marginTop: '4px' }} />
          </div>
          <div className="d-tx-mtd-card">
            <div className="skeleton-line skeleton-line-sm" style={{ width: '90px', height: '13px' }} />
            <div className="skeleton-line skeleton-line-lg" style={{ width: '130px', height: '28px', marginTop: '4px' }} />
          </div>
        </div>

        {/* Tabs row skeleton */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', alignItems: 'center' }}>
          <div className="skeleton-pill" style={{ width: '110px', height: '36px', borderRadius: '12px' }} />
          <div className="skeleton-pill" style={{ width: '150px', height: '36px', borderRadius: '12px' }} />
        </div>

        {/* Pills row skeleton */}
        <div className="d-tx-pills-row">
          <div className="skeleton-pill" style={{ width: '60px', height: '38px', borderRadius: '24px' }} />
          <div className="skeleton-pill" style={{ width: '80px', height: '38px', borderRadius: '24px' }} />
          <div className="skeleton-pill" style={{ width: '85px', height: '38px', borderRadius: '24px' }} />
          <div className="skeleton-pill" style={{ width: '105px', height: '38px', borderRadius: '24px' }} />
        </div>

        {/* Group title skeleton */}
        <div style={{ marginBottom: '24px' }}>
          <div className="skeleton-line skeleton-line-sm" style={{ width: '100px', height: '14px', marginBottom: '12px' }} />

          {/* List card rows skeleton */}
          <div className="d-tx-list-card">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="d-tx-row">
                <div className="d-tx-left">
                  <div className="skeleton-circle" style={{ width: '42px', height: '42px', borderRadius: '12px', flexShrink: 0 }} />
                  <div className="d-tx-info" style={{ gap: '6px', flex: 1 }}>
                    <div className="skeleton-line skeleton-line-md" style={{ width: '220px', height: '15px' }} />
                    <div className="skeleton-line skeleton-line-sm" style={{ width: '140px', height: '11px' }} />
                  </div>
                </div>
                <div className="skeleton-line skeleton-line-sm" style={{ width: '80px', height: '16px', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
