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
