import { Skeleton } from "./ui";

/** Route-level fallback used by loading.tsx: header, KPI row, two cards, a table. */
export function ConsolePageSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.45em" }} aria-busy="true" aria-label="Loading">
      <div className="cpc-page-head">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6em", width: "min(28em, 100%)" }}>
          <Skeleton width="60%" height="1.9em" />
          <Skeleton width="90%" height="0.95em" />
        </div>
        <Skeleton width="11em" height="2.86em" />
      </div>
      <div className="cpc-kpis">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="cpc-kpi">
            <Skeleton width="45%" height="0.75em" />
            <Skeleton width="60%" height="1.9em" />
            <Skeleton width="75%" height="0.85em" />
          </div>
        ))}
      </div>
      <div className="cpc-grid-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="cpc-card" style={{ display: "flex", flexDirection: "column", gap: "0.9em" }}>
            <Skeleton width="40%" height="1.1em" />
            <Skeleton height="12em" />
          </div>
        ))}
      </div>
      <div className="cpc-card" style={{ display: "flex", flexDirection: "column", gap: "0.9em" }}>
        <Skeleton width="30%" height="1.1em" />
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} height="1.6em" />
        ))}
      </div>
    </div>
  );
}
