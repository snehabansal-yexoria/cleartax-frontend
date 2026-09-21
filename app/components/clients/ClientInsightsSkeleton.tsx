import React from "react";

export default function ClientInsightsSkeleton() {
  return (
    <div className="insights-skeleton-container">
      {/* Header */}
      <div className="insights-skeleton-header">
        <div>
          <div className="skeleton-line" style={{ width: "120px", height: "12px", marginBottom: "8px" }} />
          <div className="skeleton-line" style={{ width: "160px", height: "28px" }} />
        </div>
        <div className="skeleton-circle insights-skeleton-avatar" style={{ width: "40px", height: "40px", borderRadius: "50%" }} />
      </div>

      {/* Time Filter Pills */}
      <div className="insights-skeleton-pills">
        <div className="skeleton-pill" style={{ width: "90px", height: "36px", borderRadius: "20px", flexShrink: 0 }} />
        <div className="skeleton-pill" style={{ width: "105px", height: "36px", borderRadius: "20px", flexShrink: 0 }} />
        <div className="skeleton-pill" style={{ width: "95px", height: "36px", borderRadius: "20px", flexShrink: 0 }} />
      </div>

      {/* 4 Cards Grid */}
      <div className="skeleton-insights-grid">
        
        {/* Card 1: Net Cash Flow */}
        <div className="insights-skeleton-card area-cashflow">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div className="skeleton-line" style={{ width: "100px", height: "14px" }} />
              <div className="skeleton-pill" style={{ width: "55px", height: "20px", borderRadius: "20px" }} />
            </div>
          </div>
          <div className="skeleton-line" style={{ width: "140px", height: "28px", margin: "8px 0 12px 0" }} />
          {/* Chart placeholder */}
          <div className="skeleton-panel" style={{ width: "100%", height: "85px", borderRadius: "8px", marginTop: "auto" }} />
        </div>

        {/* Card 2: Income vs Expenses */}
        <div className="insights-skeleton-card area-income-expense">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <div className="skeleton-line" style={{ width: "140px", height: "16px", marginBottom: "6px" }} />
              <div className="skeleton-line" style={{ width: "80px", height: "10px" }} />
            </div>
            <div className="skeleton-line" style={{ width: "110px", height: "12px" }} />
          </div>

          <div className="m-db-chart-bars-wrap" style={{ height: "140px", padding: "0" }}>
            {[65, 80, 45, 75, 90, 60].map((heightPct, index) => (
              <div key={index} className="m-db-chart-bar-container">
                <div
                  className="m-db-chart-bar-pill skeleton-panel"
                  style={{
                    height: `${heightPct}%`,
                    minHeight: "20px",
                    width: "28px",
                    borderRadius: "8px",
                  }}
                />
                <div className="skeleton-line" style={{ width: "24px", height: "10px", marginTop: "6px" }} />
              </div>
            ))}
          </div>

          <div style={{ height: "1px", background: "var(--border, #eaeef4)", margin: "8px 0" }} />

          <div style={{ display: "flex", gap: "16px", marginTop: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div className="skeleton-line" style={{ width: "12px", height: "12px", borderRadius: "3px" }} />
              <div className="skeleton-line" style={{ width: "45px", height: "10px" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div className="skeleton-line" style={{ width: "12px", height: "12px", borderRadius: "3px" }} />
              <div className="skeleton-line" style={{ width: "55px", height: "10px" }} />
            </div>
          </div>
        </div>

        {/* Card 3: Expense breakdown */}
        <div className="insights-skeleton-card area-expense-breakdown">
          <div style={{ marginBottom: "16px" }}>
            <div className="skeleton-line" style={{ width: "130px", height: "16px" }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "20px", width: "100%" }}>
            {/* Donut circle placeholder */}
            <div className="skeleton-circle" style={{ width: "100px", height: "100px", flexShrink: 0, borderRadius: "50%" }} />

            {/* Legend list skeleton */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", flexGrow: 1, minWidth: 0, width: "100%" }}>
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div className="skeleton-circle" style={{ width: "10px", height: "10px", borderRadius: "2px", flexShrink: 0 }} />
                    <div className="skeleton-line" style={{ width: "70px", height: "12px" }} />
                  </div>
                  <div className="skeleton-line" style={{ width: "28px", height: "12px" }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 4: Top performing */}
        <div className="insights-skeleton-card area-top-performing">
          <div style={{ marginBottom: "16px" }}>
            <div className="skeleton-line" style={{ width: "110px", height: "16px", marginBottom: "6px" }} />
            <div className="skeleton-line" style={{ width: "130px", height: "10px" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingBottom: idx < 2 ? "12px" : "0",
                  borderBottom: idx < 2 ? "1px solid var(--border, #eaeef4)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="skeleton-circle" style={{ width: "24px", height: "24px", borderRadius: "50%", flexShrink: 0 }} />
                  <div className="skeleton-line" style={{ width: "100px", height: "14px" }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div className="skeleton-line" style={{ width: "35px", height: "14px" }} />
                  <div className="skeleton-line" style={{ width: "55px", height: "14px" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
