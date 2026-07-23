import React from "react";

export default function ClientTransactionsSkeleton() {
  return (
    <div className="desktop-client-dashboard" style={{ background: 'var(--surface-0)', minHeight: '100vh', paddingBottom: '40px' }}>
      <div className="d-tx-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', padding: '24px 24px 0 24px' }}>
        <div className="skeleton-line skeleton-line-md" style={{ width: '180px', height: '24px' }} />
        <div className="skeleton-circle" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
      </div>

      <div className="d-tx-content-area" style={{ padding: '0 24px' }}>
        {/* Search row skeleton */}
        <div className="d-tx-search-container" style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <div className="skeleton-input" style={{ flex: 1, height: '46px', borderRadius: '12px' }} />
          <div className="skeleton-panel" style={{ width: '46px', height: '46px', borderRadius: '12px' }} />
        </div>

        {/* Pills row skeleton */}
        <div className="d-tx-pills-row" style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <div className="skeleton-pill" style={{ width: '80px', height: '38px', borderRadius: '24px' }} />
          <div className="skeleton-pill" style={{ width: '100px', height: '38px', borderRadius: '24px' }} />
          <div className="skeleton-pill" style={{ width: '90px', height: '38px', borderRadius: '24px' }} />
        </div>

        {/* Cards row skeleton */}
        <div className="d-tx-mtd-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '28px' }}>
          <div className="skeleton-panel" style={{ height: '110px', borderRadius: '16px' }} />
          <div className="skeleton-panel" style={{ height: '110px', borderRadius: '16px' }} />
        </div>

        {/* Group title skeleton */}
        <div className="skeleton-line skeleton-line-sm" style={{ width: '120px', height: '16px', marginBottom: '12px' }} />

        {/* List card rows skeleton */}
        <div className="d-tx-list-card" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', marginBottom: '24px' }}>
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="d-tx-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
              <div className="d-tx-left" style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                <div className="skeleton-circle" style={{ width: '42px', height: '42px', borderRadius: '12px' }} />
                <div className="skeleton-stack" style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <div className="skeleton-line skeleton-line-md" style={{ width: '220px', height: '14px' }} />
                  <div className="skeleton-line skeleton-line-sm" style={{ width: '140px', height: '10px' }} />
                </div>
              </div>
              <div className="skeleton-line skeleton-line-sm" style={{ width: '80px', height: '16px' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
