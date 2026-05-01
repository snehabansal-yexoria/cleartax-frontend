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

export function ClientPortfolioSkeleton() {
  return (
    <section className="client-detail-page client-portfolio-page boneyard-fallback">
      <div className="skeleton-pill skeleton-pill-wide" />

      <header className="client-profile-card">
        <div className="client-profile-main skeleton-grow">
          <div className="skeleton-circle skeleton-circle-lg" />
          <div className="skeleton-stack skeleton-grow">
            <div className="skeleton-line skeleton-line-lg" />
            <div className="skeleton-line skeleton-line-md" />
          </div>
        </div>
        <div className="skeleton-pill" />
      </header>

      <div className="client-stat-grid">
        {Array.from({ length: 3 }).map((_, index) => (
          <article key={index} className="client-stat-card">
            <div className="skeleton-circle skeleton-circle-sm" />
            <div className="skeleton-stack skeleton-grow">
              <div className="skeleton-line skeleton-line-md" />
              <div className="skeleton-line skeleton-line-xl" />
            </div>
          </article>
        ))}
      </div>

      <section className="client-portfolio-panel">
        <div className="client-portfolio-tabs">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton-tab" />
          ))}
        </div>
        <div className="client-portfolio-tab-body">
          <div className="client-portfolio-section-head">
            <div className="skeleton-line skeleton-line-lg" />
            <div className="skeleton-pill skeleton-pill-wide" />
          </div>
          <div className="entity-card-grid">
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
        </div>
      </section>
    </section>
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
          {Array.from({ length: 4 }).map((_, index) => (
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

function TrendSkeleton() {
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
