export function AccountantDashboardSkeleton() {
  return (
    <section className="accountant-dashboard boneyard-fallback">
      <div className="accountant-summary-grid">
        <article className="accountant-summary-card accountant-summary-card-blue">
          <div className="skeleton-line skeleton-line-sm" />
          <div className="skeleton-line skeleton-line-xl" />
          <div className="skeleton-line skeleton-line-md" />
        </article>
        <article className="accountant-summary-card accountant-summary-card-gold">
          <div className="skeleton-line skeleton-line-sm" />
          <div className="skeleton-line skeleton-line-xl" />
          <div className="skeleton-circle" />
        </article>
      </div>

      <div className="accountant-content-grid">
        <section className="accountant-clients-panel">
          <div className="skeleton-stack">
            <div className="skeleton-line skeleton-line-lg" />
            <div className="skeleton-line skeleton-line-md" />
          </div>
          <div className="accountant-client-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="skeleton-panel skeleton-panel-tall" />
            ))}
          </div>
        </section>

        <aside className="accountant-activity-panel">
          <div className="skeleton-stack">
            <div className="skeleton-line skeleton-line-lg" />
            <div className="skeleton-line skeleton-line-md" />
          </div>
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="skeleton-row">
              <div className="skeleton-circle skeleton-circle-sm" />
              <div className="skeleton-stack skeleton-grow">
                <div className="skeleton-line skeleton-line-md" />
                <div className="skeleton-line skeleton-line-sm" />
              </div>
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
}

export function AccountantClientsSkeleton() {
  return (
    <section className="accountant-clients-page boneyard-fallback">
      <div className="accountant-clients-topbar">
        <div className="skeleton-stack">
          <div className="skeleton-line skeleton-line-lg" />
          <div className="skeleton-line skeleton-line-md" />
        </div>
        <div className="skeleton-pill skeleton-pill-wide" />
      </div>

      <div className="accountant-client-tabs">
        <div className="skeleton-pill" />
        <div className="skeleton-pill" />
      </div>

      <div className="accountant-clients-toolbar">
        <div className="skeleton-input" />
        <div className="skeleton-pill" />
      </div>

      <div className="accountant-client-table">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="portal-list-row portal-list-row-admin">
            <div className="skeleton-row">
              <div className="skeleton-circle skeleton-circle-sm" />
              <div className="skeleton-stack skeleton-grow">
                <div className="skeleton-line skeleton-line-md" />
                <div className="skeleton-line skeleton-line-sm" />
              </div>
            </div>
            <div className="skeleton-line skeleton-line-md" />
            <div className="skeleton-pill" />
            <div className="skeleton-pill" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function AccountantAccountSkeleton() {
  return (
    <section className="accountant-account-page boneyard-fallback">
      <div className="skeleton-line skeleton-line-sm" />
      <div className="skeleton-stack">
        <div className="skeleton-line skeleton-line-lg" />
        <div className="skeleton-line skeleton-line-md" />
      </div>

      <div className="accountant-account-grid">
        <section className="accountant-account-card">
          <div className="skeleton-row">
            <div className="skeleton-circle skeleton-circle-lg" />
            <div className="skeleton-stack skeleton-grow">
              <div className="skeleton-line skeleton-line-lg" />
              <div className="skeleton-line skeleton-line-md" />
            </div>
          </div>
          <div className="skeleton-form-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="skeleton-stack">
                <div className="skeleton-line skeleton-line-sm" />
                <div className="skeleton-input" />
              </div>
            ))}
          </div>
        </section>

        <aside className="accountant-admin-card">
          <div className="skeleton-stack">
            <div className="skeleton-line skeleton-line-md" />
            <div className="skeleton-line skeleton-line-sm" />
          </div>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="skeleton-stack">
              <div className="skeleton-line skeleton-line-sm" />
              <div className="skeleton-line skeleton-line-md" />
            </div>
          ))}
          <div className="skeleton-input" />
        </aside>
      </div>
    </section>
  );
}

export function PortalDashboardSkeleton() {
  return (
    <section className="portal-page boneyard-fallback">
      <div className="portal-page-header">
        <div className="skeleton-stack">
          <div className="skeleton-line skeleton-line-sm" />
          <div className="skeleton-line skeleton-line-lg" />
          <div className="skeleton-line skeleton-line-md" />
        </div>
        <div className="skeleton-pill skeleton-pill-wide" />
      </div>

      <div className="portal-summary-grid">
        {Array.from({ length: 3 }).map((_, index) => (
          <article key={index} className="portal-summary-card">
            <div className="skeleton-line skeleton-line-sm" />
            <div className="skeleton-line skeleton-line-xl" />
            <div className="skeleton-line skeleton-line-md" />
          </article>
        ))}
      </div>

      <div className="portal-list-card">
        <div className="portal-list-header">
          <div className="skeleton-stack">
            <div className="skeleton-line skeleton-line-md" />
            <div className="skeleton-line skeleton-line-sm" />
          </div>
          <div className="skeleton-pill" />
        </div>

        <div className="portal-list-table">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="portal-list-row portal-list-row-admin">
              <div className="skeleton-line skeleton-line-md" />
              <div className="skeleton-line skeleton-line-md" />
              <div className="skeleton-line skeleton-line-md" />
              <div className="skeleton-pill" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ClientEntitiesSkeleton() {
  return (
    <section className="portal-page boneyard-fallback">
      <div className="portal-page-header">
        <div className="skeleton-stack skeleton-grow">
          <div className="skeleton-line skeleton-line-sm" />
          <div className="skeleton-line skeleton-line-lg" />
          <div className="skeleton-line skeleton-line-md" />
        </div>
        <div className="portal-page-actions">
          <div className="skeleton-pill skeleton-pill-wide" />
          <div className="skeleton-pill" />
        </div>
      </div>

      <div className="client-detail-entity-list">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="client-detail-entity-row">
            <div className="skeleton-stack skeleton-grow">
              <div className="skeleton-line skeleton-line-md" />
              <div className="skeleton-line skeleton-line-sm" />
            </div>
            <div className="skeleton-pill" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function ClientPortfolioSkeleton({
  isMobile = false,
  activeTab = 'summary',
  activeMobileView = 'home'
}: {
  isMobile?: boolean;
  activeTab?: 'summary' | 'detailed';
  activeMobileView?: 'home' | 'activity' | 'property' | 'entity' | 'insights';
} = {}) {
  if (isMobile) {
    return (
      <div className="mobile-client-dashboard boneyard-fallback">
        {/* Header */}
        <div className="m-db-header">
          <div className="m-db-profile-section">
            <div className="m-db-logo-box" />
            <div className="m-db-profile-info">
              <div className="skeleton-line" style={{ width: '70px', height: '11px', marginBottom: '6px' }} />
              <div className="skeleton-line" style={{ width: '100px', height: '18px' }} />
            </div>
          </div>
          <div className="m-db-actions-section">
            <div className="skeleton-circle" style={{ width: '32px', height: '32px' }} />
            <div className="skeleton-circle" style={{ width: '32px', height: '32px' }} />
          </div>
        </div>

        {/* Tab switches */}
        <div className="m-db-toggle-wrap">
          <div className="m-db-toggle">
            <div className={`m-db-toggle-btn${activeTab === 'summary' ? ' is-active' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="skeleton-line" style={{ width: '60px', height: '12px', background: activeTab === 'summary' ? 'rgba(0,0,0,0.05)' : undefined }} />
            </div>
            <div className={`m-db-toggle-btn${activeTab === 'detailed' ? ' is-active' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="skeleton-line" style={{ width: '60px', height: '12px', background: activeTab === 'detailed' ? 'rgba(0,0,0,0.05)' : undefined }} />
            </div>
          </div>
        </div>

        {activeTab === 'summary' && (
          <div className="m-db-content" style={{ marginTop: '16px' }}>
            {/* Net Position Card */}
            <div className="bg-white border border-[#eaeef4] rounded-[18px] p-5 shadow-sm">
              <div className="flex justify-between items-center">
                <div className="skeleton-line" style={{ width: '80px', height: '12px' }} />
                <div className="skeleton-pill" style={{ width: '90px', height: '22px' }} />
              </div>
              <div className="skeleton-line" style={{ width: '160px', height: '34px', marginTop: '12px', marginBottom: '16px' }} />
              <div style={{ height: '1px', background: '#f2f4f7', margin: '16px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, paddingRight: '12px', borderRight: '1px solid #f2f4f7' }}>
                  <div className="skeleton-line" style={{ width: '60px', height: '11px', marginBottom: '6px' }} />
                  <div className="skeleton-line" style={{ width: '80px', height: '16px' }} />
                </div>
                <div style={{ flex: 1, paddingLeft: '12px' }}>
                  <div className="skeleton-line" style={{ width: '60px', height: '11px', marginBottom: '6px' }} />
                  <div className="skeleton-line" style={{ width: '80px', height: '16px' }} />
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="m-db-actions-grid" style={{ marginTop: '16px' }}>
              <div className="skeleton-line" style={{ width: '100%', height: '48px', borderRadius: '12px' }} />
              <div className="m-db-actions-row">
                <div className="skeleton-line" style={{ width: '100%', height: '48px', borderRadius: '12px' }} />
                <div className="skeleton-line" style={{ width: '100%', height: '48px', borderRadius: '12px' }} />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="m-db-summary-grid" style={{ marginTop: '16px' }}>
              <div className="m-db-stat-card">
                <div className="m-db-stat-header">
                  <div className="skeleton-circle" style={{ width: '32px', height: '32px' }} />
                  <div className="skeleton-pill" style={{ width: '45px', height: '18px' }} />
                </div>
                <div className="m-db-stat-body" style={{ marginTop: '8px' }}>
                  <div className="skeleton-line" style={{ width: '100px', height: '11px', marginBottom: '6px' }} />
                  <div className="skeleton-line" style={{ width: '70px', height: '16px' }} />
                </div>
              </div>
              <div className="m-db-stat-card">
                <div className="m-db-stat-header">
                  <div className="skeleton-circle" style={{ width: '32px', height: '32px' }} />
                  <div className="skeleton-pill" style={{ width: '45px', height: '18px' }} />
                </div>
                <div className="m-db-stat-body" style={{ marginTop: '8px' }}>
                  <div className="skeleton-line" style={{ width: '60px', height: '11px', marginBottom: '6px' }} />
                  <div className="skeleton-line" style={{ width: '70px', height: '16px' }} />
                </div>
              </div>
            </div>

            {/* Payment Alerts Section */}
            <div className="m-db-activity-section" style={{ marginTop: '16px' }}>
              <div className="bg-white border border-[#eaeef4] rounded-[18px] p-5 shadow-sm">
                <div className="skeleton-line" style={{ width: '120px', height: '16px', marginBottom: '12px' }} />
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-3 p-3 rounded-xl border border-[#f2f4f7]">
                    <div className="skeleton-circle" style={{ width: '36px', height: '36px', flexShrink: 0 }} />
                    <div className="flex-grow">
                      <div className="skeleton-line" style={{ width: '70%', height: '14px', marginBottom: '8px' }} />
                      <div className="skeleton-line" style={{ width: '45%', height: '11px' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart card */}
            <div className="m-db-chart-card" style={{ marginTop: '16px' }}>
              <div className="m-db-chart-header">
                <div>
                  <div className="skeleton-line" style={{ width: '80px', height: '16px', marginBottom: '6px' }} />
                  <div className="skeleton-line" style={{ width: '120px', height: '11px' }} />
                </div>
                <div className="m-db-chart-legend">
                  <div className="m-db-legend-item">
                    <div className="skeleton-circle" style={{ width: '10px', height: '10px' }} />
                    <div className="skeleton-line" style={{ width: '40px', height: '10px' }} />
                  </div>
                  <div className="m-db-legend-item">
                    <div className="skeleton-circle" style={{ width: '10px', height: '10px' }} />
                    <div className="skeleton-line" style={{ width: '40px', height: '10px' }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '120px', paddingTop: '16px', paddingBottom: '8px' }}>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
                    <div className="skeleton-line" style={{ width: '18px', height: `${50 + (idx % 3) * 20}px`, borderRadius: '4px' }} />
                    <div className="skeleton-line" style={{ width: '25px', height: '10px' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity Card */}
            <div className="m-db-activity-section" style={{ marginTop: '16px' }}>
              <div className="m-db-activity-header">
                <div className="skeleton-line" style={{ width: '120px', height: '16px' }} />
                <div className="skeleton-line" style={{ width: '50px', height: '12px' }} />
              </div>
              <div className="m-db-activity-list-card" style={{ marginTop: '8px' }}>
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="m-db-activity-row" style={{ borderBottom: idx < 2 ? '1px solid #f2f4f7' : 'none', padding: '12px' }}>
                    <div className="m-db-activity-left">
                      <div className="skeleton-circle" style={{ width: '32px', height: '32px' }} />
                      <div className="m-db-activity-info">
                        <div className="skeleton-line" style={{ width: '110px', height: '13px', marginBottom: '6px' }} />
                        <div className="skeleton-line" style={{ width: '70px', height: '10px' }} />
                      </div>
                    </div>
                    <div className="skeleton-line" style={{ width: '50px', height: '14px' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'detailed' && (
          <div className="m-db-content" style={{ marginTop: '16px' }}>
            {/* Detailed Net Position Card */}
            <div className="bg-white border border-[#eaeef4] rounded-[18px] p-5 shadow-sm">
              <div className="flex justify-between items-center">
                <div className="skeleton-line" style={{ width: '80px', height: '12px' }} />
                <div className="skeleton-pill" style={{ width: '90px', height: '22px' }} />
              </div>
              <div className="skeleton-line" style={{ width: '160px', height: '34px', marginTop: '12px', marginBottom: '16px' }} />
              <div style={{ height: '1px', background: '#f2f4f7', margin: '16px 0' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.1fr 1.2fr', gap: '4px' }}>
                <div style={{ paddingLeft: 0 }}>
                  <div className="skeleton-line" style={{ width: '60px', height: '11px', marginBottom: '6px' }} />
                  <div className="skeleton-line" style={{ width: '60px', height: '14px' }} />
                </div>
                <div style={{ paddingLeft: '8px', borderLeft: '1px solid #f2f4f7' }}>
                  <div className="skeleton-line" style={{ width: '60px', height: '11px', marginBottom: '6px' }} />
                  <div className="skeleton-line" style={{ width: '60px', height: '14px' }} />
                </div>
                <div style={{ paddingLeft: '8px', borderLeft: '1px solid #f2f4f7' }}>
                  <div className="skeleton-line" style={{ width: '60px', height: '11px', marginBottom: '6px' }} />
                  <div className="skeleton-line" style={{ width: '60px', height: '14px' }} />
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="m-db-actions-grid" style={{ marginTop: '16px' }}>
              <div className="skeleton-line" style={{ width: '100%', height: '48px', borderRadius: '12px' }} />
              <div className="m-db-actions-row">
                <div className="skeleton-line" style={{ width: '100%', height: '48px', borderRadius: '12px' }} />
                <div className="skeleton-line" style={{ width: '100%', height: '48px', borderRadius: '12px' }} />
              </div>
            </div>

            {/* By Entity Section */}
            <div className="m-db-activity-section" style={{ marginTop: '16px' }}>
              <div className="m-db-activity-header">
                <div className="skeleton-line" style={{ width: '90px', height: '16px' }} />
                <div className="skeleton-line" style={{ width: '50px', height: '12px' }} />
              </div>
              <div className="m-db-activity-list-card" style={{ marginTop: '8px' }}>
                {Array.from({ length: 2 }).map((_, idx) => (
                  <div key={idx} className="m-db-entity-row" style={{ padding: '16px', borderBottom: idx < 1 ? '1px solid #f2f4f7' : 'none' }}>
                    <div className="m-db-entity-row-top" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div className="skeleton-line" style={{ width: '120px', height: '14px' }} />
                      <div className="skeleton-line" style={{ width: '60px', height: '14px' }} />
                    </div>
                    <div className="skeleton-line" style={{ width: '80px', height: '11px', marginBottom: '8px' }} />
                    <div className="m-db-entity-bar-container" style={{ height: '6px', background: '#f2f4f7', borderRadius: '3px', marginBottom: '8px' }}>
                      <div className="skeleton-line" style={{ width: '40%', height: '100%', borderRadius: '3px' }} />
                    </div>
                    <div className="m-db-entity-label-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div className="skeleton-line" style={{ width: '70px', height: '11px' }} />
                      <div className="skeleton-line" style={{ width: '70px', height: '11px' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By Property Section */}
            <div className="m-db-activity-section" style={{ marginTop: '16px' }}>
              <div className="m-db-activity-header">
                <div className="skeleton-line" style={{ width: '90px', height: '16px' }} />
                <div className="skeleton-line" style={{ width: '50px', height: '12px' }} />
              </div>
              <div className="m-db-activity-list-card" style={{ marginTop: '8px' }}>
                {Array.from({ length: 2 }).map((_, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', padding: '16px', borderBottom: idx < 1 ? '1px solid #f2f4f7' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div>
                        <div className="skeleton-line" style={{ width: '140px', height: '14px', marginBottom: '6px' }} />
                        <div className="skeleton-line" style={{ width: '80px', height: '11px' }} />
                      </div>
                      <div className="skeleton-line" style={{ width: '60px', height: '14px' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                      <div className="skeleton-line" style={{ width: '70px', height: '11px' }} />
                      <div className="skeleton-line" style={{ width: '70px', height: '11px' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop Return
  return (
    <div className="desktop-client-dashboard boneyard-fallback">
      {/* Quick Actions Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="skeleton-line" style={{ width: '100%', height: '56px', borderRadius: '12px' }} />
        <div className="skeleton-line" style={{ width: '100%', height: '56px', borderRadius: '12px' }} />
        <div className="skeleton-line" style={{ width: '100%', height: '56px', borderRadius: '12px' }} />
      </div>

      {/* Net Equity Card */}
      <div className="bg-white border border-[#eaeef4] rounded-[18px] p-6 shadow-sm" style={{ width: '100%', marginTop: '24px' }}>
        <div className="flex justify-between items-center">
          <div className="skeleton-line" style={{ width: '80px', height: '14px' }} />
          <div className="skeleton-pill" style={{ width: '110px', height: '24px' }} />
        </div>
        <div className="skeleton-line" style={{ width: '220px', height: '42px', marginTop: '12px', marginBottom: '16px' }} />
        <div style={{ height: '1px', background: '#f2f4f7', margin: '16px 0' }} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={i === 0 ? { borderLeft: 'none', paddingLeft: 0 } : { borderLeft: '1px solid #f2f4f7', paddingLeft: '20px' }}>
              <div className="skeleton-line" style={{ width: '70px', height: '12px', marginBottom: '8px' }} />
              <div className="skeleton-line" style={{ width: '100px', height: '20px' }} />
            </div>
          ))}
        </div>
      </div>

      {/* Mini Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ marginTop: '24px' }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white border border-[#eaeef4] rounded-[18px] p-5 flex flex-col gap-3.5 shadow-sm">
            <div className="flex justify-between items-center">
              <div className="skeleton-circle" style={{ width: '36px', height: '36px' }} />
              <div className="skeleton-pill" style={{ width: '45px', height: '20px' }} />
            </div>
            <div className="flex flex-col gap-2">
              <div className="skeleton-line" style={{ width: '110px', height: '12px' }} />
              <div className="skeleton-line" style={{ width: '80px', height: '20px' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Dashboard Grid Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" style={{ marginTop: '24px' }}>
        {/* Chart card (span 2) */}
        <div className="md:col-span-2 xl:col-span-2 order-1 xl:order-1 bg-white border border-[#eaeef4] rounded-[18px] p-6 shadow-sm flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="skeleton-line" style={{ width: '120px', height: '18px' }} />
            <div className="skeleton-pill" style={{ width: '100px', height: '28px' }} />
          </div>
          {/* Skeleton Chart Bars */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '180px', paddingTop: '20px', paddingBottom: '10px' }}>
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
                <div className="skeleton-line" style={{ width: '30px', height: `${80 + (idx % 3) * 30}px`, borderRadius: '6px' }} />
                <div className="skeleton-line" style={{ width: '40px', height: '12px' }} />
              </div>
            ))}
          </div>
        </div>

        {/* Payment Alerts card */}
        <div className="col-span-1 order-3 xl:order-2 bg-white border border-[#eaeef4] rounded-[18px] p-5 shadow-sm flex flex-col gap-4">
          <div className="skeleton-line" style={{ width: '120px', height: '18px', marginBottom: '4px' }} />
          <div className="flex flex-col gap-4">
            {Array.from({ length: 2 }).map((_, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-xl border border-[#f2f4f7]">
                <div className="skeleton-circle" style={{ width: '36px', height: '36px', flexShrink: 0 }} />
                <div className="flex-grow">
                  <div className="skeleton-line" style={{ width: '70%', height: '14px', marginBottom: '8px' }} />
                  <div className="skeleton-line" style={{ width: '45%', height: '11px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity card */}
        <div className="col-span-1 order-2 xl:order-3 bg-white border border-[#eaeef4] rounded-[18px] p-5 shadow-sm flex flex-col gap-4">
          <div className="skeleton-line" style={{ width: '140px', height: '18px', marginBottom: '4px' }} />
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="flex justify-between items-center py-2" style={{ borderBottom: idx < 2 ? '1px solid #f2f4f7' : 'none' }}>
                <div className="flex items-center gap-3">
                  <div className="skeleton-circle" style={{ width: '34px', height: '34px' }} />
                  <div>
                    <div className="skeleton-line" style={{ width: '120px', height: '13px', marginBottom: '6px' }} />
                    <div className="skeleton-line" style={{ width: '80px', height: '10px' }} />
                  </div>
                </div>
                <div className="skeleton-line" style={{ width: '60px', height: '14px' }} />
              </div>
            ))}
          </div>
        </div>

        {/* By Property Section (span 2) */}
        <div className="md:col-span-2 xl:col-span-2 order-4 xl:order-4 bg-white border border-[#eaeef4] rounded-[18px] p-5 shadow-sm flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="skeleton-line" style={{ width: '120px', height: '18px' }} />
            <div className="skeleton-line" style={{ width: '50px', height: '14px' }} />
          </div>
          <div className="flex flex-col gap-4">
            {Array.from({ length: 2 }).map((_, idx) => (
              <div key={idx} className="py-3 flex flex-col gap-3" style={{ borderBottom: idx < 1 ? '1px solid #f2f4f7' : 'none' }}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="skeleton-line" style={{ width: '160px', height: '14px', marginBottom: '6px' }} />
                    <div className="skeleton-line" style={{ width: '90px', height: '11px' }} />
                  </div>
                  <div className="skeleton-line" style={{ width: '70px', height: '14px' }} />
                </div>
                <div className="flex gap-6">
                  <div className="skeleton-line" style={{ width: '80px', height: '12px' }} />
                  <div className="skeleton-line" style={{ width: '80px', height: '12px' }} />
                  <div className="skeleton-line" style={{ width: '90px', height: '12px' }} />
                  <div className="skeleton-line" style={{ width: '90px', height: '12px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EntityDetailSkeleton() {
  return (
    <section className="client-detail-page entity-detail-page boneyard-fallback">
      <div className="skeleton-pill skeleton-pill-wide" />

      <header className="entity-page-header">
        <div className="skeleton-stack skeleton-grow">
          <div className="skeleton-line skeleton-line-lg" />
          <div className="skeleton-line skeleton-line-md" />
        </div>
      </header>

      <TrendSkeleton />

      <section className="entity-resource-panel">
        <div className="entity-resource-tabs">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="skeleton-tab" />
          ))}
        </div>
        <div className="entity-resource-body">
          <div className="entity-resource-head">
            <div className="skeleton-line skeleton-line-lg" />
            <div className="skeleton-pill skeleton-pill-wide" />
          </div>
          <div className="entity-property-list">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="entity-property-row">
                <div className="skeleton-stack">
                  <div className="skeleton-line skeleton-line-lg" />
                  <div className="skeleton-line skeleton-line-md" />
                </div>
                <div className="skeleton-fact-grid">
                  {Array.from({ length: 3 }).map((__, factIndex) => (
                    <div key={factIndex} className="skeleton-stack">
                      <div className="skeleton-line skeleton-line-sm" />
                      <div className="skeleton-line skeleton-line-md" />
                    </div>
                  ))}
                </div>
                <div className="skeleton-pill" />
                <div className="skeleton-circle skeleton-circle-xs" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

export function PropertyDetailSkeleton() {
  return (
    <section className="client-detail-page property-detail-page property-detail-shell boneyard-fallback">
      <div className="skeleton-pill skeleton-pill-wide" />

      <header className="client-detail-entities property-hero-card">
        <div className="property-hero-top">
          <div className="skeleton-stack skeleton-grow">
            <div className="skeleton-line skeleton-line-lg" />
            <div className="skeleton-line skeleton-line-md" />
          </div>
          <div className="property-hero-actions">
            <div className="skeleton-pill" />
            <div className="skeleton-pill" />
          </div>
        </div>
        <div className="property-hero-facts">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="skeleton-stack">
              <div className="skeleton-line skeleton-line-sm" />
              <div className="skeleton-line skeleton-line-md" />
            </div>
          ))}
        </div>
      </header>

      <div className="client-stat-grid property-metric-grid">
        {Array.from({ length: 3 }).map((_, index) => (
          <article key={index} className="client-stat-card">
            <div className="skeleton-line skeleton-line-md" />
            <div className="skeleton-line skeleton-line-xl" />
          </article>
        ))}
      </div>

      <TrendSkeleton />

      <section className="property-detail-tabs skeleton-property-tabs">
        <div className="property-detail-tab-list">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="skeleton-input" />
          ))}
        </div>
        <div className="property-detail-tab-body">
          <div className="skeleton-stack">
            <div className="skeleton-line skeleton-line-lg" />
            <div className="skeleton-line skeleton-line-md" />
          </div>
        </div>
      </section>
    </section>
  );
}

export function EntityWizardSkeleton() {
  return (
    <section className="entity-wizard boneyard-fallback">
      <div className="skeleton-pill skeleton-pill-wide" />

      <div className="entity-wizard-steps skeleton-wizard-steps">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="entity-wizard-step">
            <div className="skeleton-circle skeleton-circle-sm" />
            <div className="skeleton-stack">
              <div className="skeleton-line skeleton-line-md" />
              <div className="skeleton-line skeleton-line-sm" />
            </div>
            {index < 3 && <div className="skeleton-connector" />}
          </div>
        ))}
      </div>

      <section className="entity-wizard-card">
        <header className="skeleton-stack">
          <div className="skeleton-line skeleton-line-lg" />
          <div className="skeleton-line skeleton-line-md" />
        </header>
        <div className="entity-type-grid">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="skeleton-panel skeleton-panel-compact" />
          ))}
        </div>
      </section>

      <div className="entity-wizard-footer">
        <div className="skeleton-pill" />
        <div className="entity-wizard-footer-actions">
          <div className="skeleton-pill" />
          <div className="skeleton-pill skeleton-pill-wide" />
        </div>
      </div>
    </section>
  );
}

export function ClientEntityWizardSkeleton() {
  return (
    <div className="entity-wizard-container">
      {/* Header section */}
      <div className="entity-wizard-header">
        <div className="entity-wizard-breadcrumb" style={{ gap: 8, display: "flex", alignItems: "center" }}>
          <div className="skeleton-pill" style={{ width: 80, height: 16, display: "inline-block" }} />
          <span className="entity-wizard-breadcrumb-separator">/</span>
          <div className="skeleton-pill" style={{ width: 100, height: 16, display: "inline-block" }} />
        </div>

        <div className="entity-wizard-title-row">
          <div className="entity-wizard-title-group" style={{ flex: 1 }}>
            <div className="skeleton-line" style={{ width: 220, height: 32, marginBottom: 8, borderRadius: 6 }} />
            <div className="skeleton-line" style={{ width: 340, height: 16, borderRadius: 4 }} />
          </div>
          <div className="skeleton-pill" style={{ width: 180, height: 38 }} />
        </div>
      </div>

      <div className="entity-wizard-layout">
        {/* Main form area */}
        <div className="entity-wizard-main">
          <div className="entity-wizard-card">
            {/* STEP 1 - ENTITY DETAILS */}
            <div className="entity-wizard-section">
              <div className="skeleton-line" style={{ width: 180, height: 14, marginBottom: 24, borderRadius: 4 }} />

              {/* Entity name field */}
              <div className="entity-wizard-field">
                <div className="skeleton-line" style={{ width: 100, height: 16, marginBottom: 8, borderRadius: 4 }} />
                <div className="skeleton-input" style={{ height: 48 }} />
              </div>

              {/* Entity type field */}
              <div className="entity-wizard-field">
                <div className="skeleton-line" style={{ width: 90, height: 16, marginBottom: 12, borderRadius: 4 }} />
                <div className="entity-type-grid">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="entity-type-card" style={{ height: 86, display: "flex", flexDirection: "column", justifyContent: "center", pointerEvents: "none" }}>
                      <div className="skeleton-line" style={{ width: "50%", height: 16, marginBottom: 8, borderRadius: 4 }} />
                      <div className="skeleton-line" style={{ width: "75%", height: 12, borderRadius: 4 }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions footer */}
            <div className="entity-wizard-actions">
              <div className="skeleton-pill" style={{ width: 80, height: 40 }} />
              <div className="entity-wizard-btn-group">
                <div className="skeleton-pill" style={{ width: 150, height: 40 }} />
                <div className="skeleton-pill" style={{ width: 220, height: 40 }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PropertyWizardSkeleton() {
  return (
    <section className="entity-wizard property-wizard boneyard-fallback">
      <div className="entity-wizard-top">
        <div className="skeleton-pill" style={{ width: 80, height: 20 }} />
      </div>

      <div className="entity-wizard-steps skeleton-wizard-steps">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="entity-wizard-step">
            <div className="skeleton-circle skeleton-circle-sm" />
            <div className="skeleton-stack">
              <div className="skeleton-line skeleton-line-md" />
              <div className="skeleton-line skeleton-line-sm" />
            </div>
            {index < 2 && <div className="skeleton-connector" />}
          </div>
        ))}
      </div>

      <div className="entity-wizard-card">
        <header className="skeleton-stack">
          <div className="skeleton-line skeleton-line-lg" />
          <div className="skeleton-line skeleton-line-md" />
        </header>

        <div className="entity-wizard-selected-chip property-entity-chip skeleton-row" style={{ gap: 16, marginBottom: 24 }}>
          <div className="skeleton-pill" style={{ width: 140, height: 28 }} />
          <div className="skeleton-pill" style={{ width: 100, height: 28 }} />
        </div>

        <div className="entity-wizard-label" style={{ marginBottom: 20 }}>
          <div className="skeleton-line skeleton-line-sm" style={{ marginBottom: 8, width: 120 }} />
          <div className="skeleton-input" style={{ height: 42 }} />
        </div>

        <div className="property-wizard-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="entity-wizard-label">
              <div className="skeleton-line skeleton-line-sm" style={{ marginBottom: 8, width: index % 2 === 0 ? 110 : 150 }} />
              <div className="skeleton-input" style={{ height: 42 }} />
            </div>
          ))}
          <div className="entity-wizard-label">
            <div className="skeleton-line skeleton-line-sm" style={{ marginBottom: 8, width: 140 }} />
            <div style={{ display: "flex", gap: 16, marginTop: 8, height: 20, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div className="skeleton-circle" style={{ width: 16, height: 16 }} />
                <div className="skeleton-line" style={{ width: 40, height: 14 }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div className="skeleton-circle" style={{ width: 16, height: 16 }} />
                <div className="skeleton-line" style={{ width: 40, height: 14 }} />
              </div>
            </div>
          </div>
        </div>

        <div className="property-image-section" style={{ marginTop: 24 }}>
          <div className="skeleton-line skeleton-line-sm" style={{ marginBottom: 8, width: 130 }} />
          <div className="skeleton-panel" style={{ height: 120, borderRadius: 12 }} />
        </div>

        <div className="entity-wizard-footer">
          <div />
          <div className="skeleton-pill skeleton-pill-wide" style={{ height: 40, width: 120 }} />
        </div>
      </div>
    </section>
  );
}

export function EntityPropertyListSkeleton() {
  return (
    <ul className="entity-property-list boneyard-fallback">
      {Array.from({ length: 3 }).map((_, index) => (
        <li key={index} className="entity-property-row">
          <div className="skeleton-stack skeleton-grow">
            <div className="skeleton-line skeleton-line-lg" />
            <div className="skeleton-line skeleton-line-md" />
          </div>
          <div className="skeleton-fact-grid">
            {Array.from({ length: 3 }).map((__, factIndex) => (
              <div key={factIndex} className="skeleton-stack">
                <div className="skeleton-line skeleton-line-sm" />
                <div className="skeleton-line skeleton-line-md" />
              </div>
            ))}
          </div>
          <div className="skeleton-pill" />
          <div className="skeleton-circle skeleton-circle-xs" />
        </li>
      ))}
    </ul>
  );
}

export function ClientEntityCardsSkeleton() {
  return (
    <div className="entity-card-grid boneyard-fallback">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="entity-ownership-card">
          <div className="entity-ownership-card-main">
            <div className="entity-ownership-card-top">
              <div className="skeleton-circle" />
              <div className="skeleton-pill" />
            </div>
            <div className="skeleton-stack">
              <div className="skeleton-line skeleton-line-lg" />
              <div className="skeleton-line skeleton-line-md" />
            </div>
            <div className="skeleton-stack skeleton-card-spacer">
              <div className="skeleton-line skeleton-line-md" />
              <div className="skeleton-line skeleton-line-md" />
              <div className="skeleton-line skeleton-line-sm" />
            </div>
          </div>
          <div className="skeleton-card-footer" />
        </div>
      ))}
    </div>
  );
}

export function TrendSkeleton() {
  return (
    <section className="entity-trend-card skeleton-trend-card" aria-hidden="true">
      <div className="entity-trend-head">
        <div className="skeleton-line skeleton-line-lg" />
        <div className="skeleton-pill skeleton-pill-wide" />
      </div>
      <div className="skeleton-chart">
        <div className="skeleton-chart-axis" />
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="skeleton-chart-column">
            <span style={{ height: `${42 + (index % 3) * 18}%` }} />
            <span style={{ height: `${58 + (index % 2) * 16}%` }} />
          </div>
        ))}
      </div>
      <div className="skeleton-chart-legend">
        <div className="skeleton-pill" />
        <div className="skeleton-pill" />
      </div>
    </section>
  );
}

export function AccountantReconciliationSkeleton({ hasActiveRecon }: { hasActiveRecon?: boolean }) {
  return (
    <section className="accountant-reconciliation-page boneyard-fallback">
      {/* Back to Entity Link skeleton */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <div className="skeleton-circle" style={{ width: 20, height: 20 }} />
        <div className="skeleton-line" style={{ width: 120, height: 14 }} />
      </div>

      {/* Page Title skeleton */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div className="skeleton-line" style={{ width: 260, height: 32, borderRadius: 8 }} />
      </div>

      {hasActiveRecon ? (
        <>
          {/* Active Statement Card skeleton */}
          <section className="accountant-uploaded-statements-card" style={{ marginBottom: 24, padding: "20px 24px" }}>
            <div className="skeleton-row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
              <div className="skeleton-line" style={{ width: 150, height: 20 }} />
            </div>
            <div className="skeleton-row" style={{ gap: 16, alignItems: "center" }}>
              <div className="skeleton-circle" style={{ width: 44, height: 44 }} />
              <div className="skeleton-stack" style={{ flex: 1, gap: 8 }}>
                <div className="skeleton-line" style={{ width: "40%", height: 16 }} />
                <div className="skeleton-line" style={{ width: "25%", height: 12 }} />
              </div>
              <div className="skeleton-stack" style={{ alignItems: "flex-end", gap: 8 }}>
                <div className="skeleton-line" style={{ width: 100, height: 20 }} />
                <div className="skeleton-line" style={{ width: 80, height: 12 }} />
              </div>
            </div>
          </section>

          {/* KPI Cards skeleton */}
          <div className="accountant-reconciliation-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20, marginBottom: 24 }}>
            {Array.from({ length: 4 }).map((_, idx) => (
              <article key={idx} style={{ padding: "16px 20px", borderRadius: 12, border: "1px solid #e3e8ef", background: "#ffffff" }}>
                <div className="skeleton-line" style={{ width: "50%", height: 12, marginBottom: 12 }} />
                <div className="skeleton-line" style={{ width: "70%", height: 24, marginBottom: 12 }} />
                <div className="skeleton-line" style={{ width: "40%", height: 10 }} />
              </article>
            ))}
          </div>

          {/* Filter/Tab bar skeleton */}
          <section className="accountant-reconciliation-filter-card" style={{ marginBottom: 16 }}>
            <div className="accountant-reconciliation-tabs" style={{ borderBottom: "1px solid #f1f3f6", paddingBottom: 0 }}>
              <div className="skeleton-pill" style={{ width: 120, height: 36, borderRadius: "8px 8px 0 0" }} />
              <div className="skeleton-pill" style={{ width: 100, height: 36, borderRadius: "8px 8px 0 0" }} />
              <div className="skeleton-pill" style={{ width: 100, height: 36, borderRadius: "8px 8px 0 0" }} />
            </div>
            <div className="accountant-reconciliation-controls" style={{ padding: "12px 24px", display: "flex", gap: 16, alignItems: "center" }}>
              <div className="skeleton-input" style={{ flex: 1, minHeight: 38, borderRadius: 8 }} />
              <div className="skeleton-pill" style={{ width: 90, height: 38, borderRadius: 8 }} />
              <div className="skeleton-pill" style={{ width: 90, height: 38, borderRadius: 8 }} />
              <div className="skeleton-pill" style={{ width: 120, height: 38, borderRadius: 8 }} />
            </div>
          </section>

          {/* Table skeleton */}
          <section className="accountant-reconciliation-table">
            <div className="accountant-reconciliation-table-head" style={{ borderBottom: "1px solid #e7ebf0" }}>
              <span className="skeleton-line" style={{ width: 100 }} />
              <span className="skeleton-line" style={{ width: 80 }} />
              <span className="skeleton-line" style={{ width: 80 }} />
              <span className="skeleton-line" style={{ width: 70 }} />
              <span className="skeleton-line" style={{ width: 60 }} />
              <span className="skeleton-line" style={{ width: 60 }} />
              <span className="skeleton-line" style={{ width: 80 }} />
            </div>
            {Array.from({ length: 6 }).map((_, rowIndex) => (
              <div key={rowIndex} className="accountant-reconciliation-table-row" style={{ borderBottom: "1px solid #f1f3f6" }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div className="skeleton-circle" style={{ width: 24, height: 24 }} />
                </div>
                <div className="skeleton-stack" style={{ gap: 6 }}>
                  <div className="skeleton-line" style={{ width: 150, height: 14 }} />
                  <div className="skeleton-line" style={{ width: 80, height: 10 }} />
                </div>
                <div>
                  <div className="skeleton-line" style={{ width: 100, height: 12 }} />
                </div>
                <div>
                  <div className="skeleton-line" style={{ width: 110, height: 28, borderRadius: 6 }} />
                </div>
                <div>
                  <div className="skeleton-line" style={{ width: 90, height: 28, borderRadius: 6 }} />
                </div>
                <div>
                  <div className="skeleton-line" style={{ width: 70, height: 14 }} />
                </div>
                <div>
                  <div className="skeleton-line" style={{ width: 70, height: 14 }} />
                </div>
                <div>
                  <div className="skeleton-pill" style={{ width: 100, height: 32, borderRadius: 6 }} />
                </div>
              </div>
            ))}
          </section>
        </>
      ) : (
        /* Import grid skeleton (when history is loading but no active statement is selected) */
        <div className="accountant-reconciliation-import-grid">
          <section className="accountant-upload-statement-card">
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", width: "100%", padding: 40, gap: 16 }}>
              <div className="skeleton-circle" style={{ width: 64, height: 64 }} />
              <div className="skeleton-line" style={{ width: 200, height: 20 }} />
              <div className="skeleton-line" style={{ width: 280, height: 14 }} />
              <div className="skeleton-pill" style={{ width: 180, height: 44, marginTop: 12 }} />
            </div>
          </section>
          <section className="accountant-existing-documents-card" style={{ padding: 24 }}>
            <div className="skeleton-row" style={{ justifyContent: "space-between", marginBottom: 20 }}>
              <div className="skeleton-stack" style={{ flex: 1, gap: 8 }}>
                <div className="skeleton-line" style={{ width: 220, height: 18 }} />
                <div className="skeleton-line" style={{ width: 180, height: 12 }} />
              </div>
            </div>
            <div className="skeleton-stack" style={{ gap: 12, marginBottom: 20 }}>
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} style={{ display: "flex", gap: 12, padding: 12, border: "1px solid #f1f3f6", borderRadius: 8 }}>
                  <div className="skeleton-circle" style={{ width: 20, height: 20, borderRadius: 4 }} />
                  <div className="skeleton-stack" style={{ flex: 1, gap: 8 }}>
                    <div className="skeleton-line" style={{ width: "60%", height: 14 }} />
                    <div className="skeleton-line" style={{ width: "40%", height: 10 }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="skeleton-pill" style={{ width: "100%", height: 44, borderRadius: 8 }} />
          </section>
        </div>
      )}
    </section>
  );
}

export function ClientPropertiesSkeleton() {
  return (
    <section className="portal-page boneyard-fallback">
      {/* Header Skeleton */}
      <div className="m-db-subpage-header-skeleton">
        <div className="skeleton-line" style={{ width: 140, height: 28, borderRadius: 8 }} />
        <div className="skeleton-circle" style={{ width: 40, height: 40 }} />
      </div>

      <div className="m-db-content-container-skeleton">
        {/* Search Box Skeleton */}
        <div className="m-db-search-skeleton-container">
          <div className="skeleton-input" style={{ width: "100%", height: 45, borderRadius: 12 }} />
        </div>

        {/* Pills Row Skeleton */}
        <div className="m-db-entity-pills-row" style={{ gap: 8, paddingBottom: 16 }}>
          <div className="skeleton-pill" style={{ width: 110, height: 38 }} />
          <div className="skeleton-pill" style={{ width: 130, height: 38 }} />
          <div className="skeleton-pill" style={{ width: 90, height: 38 }} />
        </div>

        {/* Portfolio Summary Card Skeleton */}
        <div className="m-db-portfolio-summary-card">
          <div className="m-db-portfolio-col" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="skeleton-line" style={{ width: "60%", height: 14 }} />
            <span className="skeleton-line" style={{ width: "80%", height: 24 }} />
          </div>
          <div className="m-db-portfolio-col divider-left" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="skeleton-line" style={{ width: "50%", height: 14 }} />
            <span className="skeleton-line" style={{ width: "70%", height: 24 }} />
          </div>
          <div className="m-db-portfolio-col divider-left" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="skeleton-line" style={{ width: "40%", height: 14 }} />
            <span className="skeleton-line" style={{ width: "60%", height: 24 }} />
          </div>
        </div>

        {/* Property cards container skeleton */}
        <div className="property-cards-container">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="m-db-property-list-card">
              <div className="m-db-property-img-container">
                <div className="skeleton-panel" style={{ width: "100%", height: "100%", borderRadius: 0 }} />
              </div>
              <div className="m-db-property-details">
                <div className="skeleton-line" style={{ width: "70%", height: 18, marginBottom: 8 }} />
                <div className="skeleton-row" style={{ gap: 6, marginBottom: 16 }}>
                  <div className="skeleton-circle" style={{ width: 14, height: 14 }} />
                  <div className="skeleton-line" style={{ width: "40%", height: 12 }} />
                </div>
                
                <div className="m-db-property-stats-line">
                  <div style={{ flex: 1 }}>
                    <div className="skeleton-line" style={{ width: "80%", height: 12 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="skeleton-line" style={{ width: "70%", height: 12 }} />
                  </div>
                </div>

                <div className="m-db-property-bottom-line">
                  <div className="skeleton-pill" style={{ width: 70, height: 24 }} />
                  <div className="skeleton-line" style={{ width: 80, height: 14 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function JournalEntrySkeleton() {
  return (
    <section style={{ padding: "24px", maxWidth: "1280px", margin: "0 auto", fontFamily: "Inter, sans-serif" }}>
      {/* Header Skeleton */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div className="skeleton-stack" style={{ gap: 8 }}>
          <div className="skeleton-pill" style={{ width: 100, height: 16 }} />
          <div className="skeleton-line-lg" style={{ width: 280, height: 32 }} />
          <div className="skeleton-line" style={{ width: 160, height: 16 }} />
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <div className="skeleton-pill" style={{ width: 80, height: 40, borderRadius: 8 }} />
          <div className="skeleton-pill" style={{ width: 160, height: 40, borderRadius: 8 }} />
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <div className="skeleton-pill" style={{ width: 130, height: 36, borderRadius: 20 }} />
        <div className="skeleton-pill" style={{ width: 150, height: 36, borderRadius: 20 }} />
      </div>

      {/* Info Boxes Skeleton */}
      <div className="skeleton-input" style={{ height: 64, borderRadius: 10, marginBottom: "16px" }} />
      <div className="skeleton-input" style={{ height: 64, borderRadius: 10, marginBottom: "24px" }} />

      {/* Action Row Skeleton */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div style={{ display: "flex", gap: "10px" }}>
          <div className="skeleton-pill" style={{ width: 100, height: 36, borderRadius: 6 }} />
          <div className="skeleton-pill" style={{ width: 100, height: 36, borderRadius: 6 }} />
        </div>
        <div className="skeleton-pill" style={{ width: 50, height: 16 }} />
      </div>

      {/* Table Skeleton */}
      <div style={{ border: "1px solid #cbd5e1", borderRadius: "12px", overflow: "hidden", marginBottom: "20px" }}>
        {/* Table Header */}
        <div className="skeleton-input" style={{ height: 42, borderRadius: 0, borderBottom: "1.5px solid #cbd5e1" }} />
        {/* Table Rows */}
        {Array.from({ length: 3 }).map((_, idx) => (
          <div
            key={idx}
            className="skeleton-row"
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid #e2e8f0",
              alignItems: "center",
              gap: 16,
              justifyContent: "space-between"
            }}
          >
            <div className="skeleton-pill" style={{ width: 20, height: 20 }} />
            <div className="skeleton-input" style={{ height: 36, flex: 1.2 }} />
            <div className="skeleton-input" style={{ height: 36, flex: 1.5 }} />
            <div className="skeleton-input" style={{ height: 36, flex: 1 }} />
            <div className="skeleton-line" style={{ height: 16, flex: 1.5 }} />
            <div className="skeleton-input" style={{ height: 36, flex: 1 }} />
            <div className="skeleton-input" style={{ height: 36, flex: 1 }} />
            <div className="skeleton-input" style={{ height: 36, flex: 1.8 }} />
            <div className="skeleton-input" style={{ height: 36, flex: 1.2 }} />
            <div className="skeleton-input" style={{ height: 36, flex: 1.5 }} />
          </div>
        ))}
      </div>

      {/* Bottom Summary Skeleton */}
      <div
        className="skeleton-row"
        style={{
          padding: "16px 24px",
          backgroundColor: "#f8fafc",
          border: "1px solid #cbd5e1",
          borderRadius: "12px",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <div style={{ display: "flex", gap: "32px" }}>
          <div className="skeleton-stack" style={{ gap: 4 }}>
            <div className="skeleton-line" style={{ width: 80, height: 11 }} />
            <div className="skeleton-line" style={{ width: 100, height: 20 }} />
          </div>
          <div className="skeleton-stack" style={{ gap: 4 }}>
            <div className="skeleton-line" style={{ width: 80, height: 11 }} />
            <div className="skeleton-line" style={{ width: 100, height: 20 }} />
          </div>
        </div>
        <div className="skeleton-pill" style={{ width: 120, height: 32, borderRadius: 20 }} />
      </div>
    </section>
  );
}


