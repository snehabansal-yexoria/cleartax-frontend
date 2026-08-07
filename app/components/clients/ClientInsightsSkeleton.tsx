import React from "react";

export default function ClientInsightsSkeleton() {
  return (
    <div className="insights-skeleton-container">
      {/* Scoped styles for the skeleton layout to mirror the real UI */}
      <style>{`
        .insights-skeleton-container {
          background: var(--surface-0);
          min-height: 100vh;
          padding: 24px 16px 90px 16px;
          font-family: "Inter", -apple-system, sans-serif;
          box-sizing: border-box;
        }
        @media (min-width: 768px) {
          .insights-skeleton-container {
            padding: 40px;
          }
        }
        .insights-skeleton-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .insights-skeleton-pills {
          display: flex;
          gap: 10px;
          margin: 16px 0 24px 0;
        }
        .skeleton-insights-grid {
          display: grid;
          gap: 24px;
        }
        @media (min-width: 1024px) {
          .skeleton-insights-grid {
            grid-template-columns: 1fr 1.25fr;
            grid-template-areas:
              "cashflow income-expense"
              "expense-breakdown top-performing";
          }
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          .skeleton-insights-grid {
            grid-template-columns: 1fr 1fr;
            grid-template-areas:
              "cashflow cashflow"
              "income-expense income-expense"
              "expense-breakdown top-performing";
          }
        }
        .area-cashflow { grid-area: cashflow; }
        .area-income-expense { grid-area: income-expense; }
        .area-expense-breakdown { grid-area: expense-breakdown; }
        .area-top-performing { grid-area: top-performing; }

        .insights-skeleton-card {
          background: var(--surface-1);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);
          display: flex;
          flex-direction: column;
        }
        .skeleton-chart-container {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          height: 140px;
          padding-top: 16px;
          margin-bottom: 12px;
          position: relative;
        }
        .skeleton-chart-bar-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
          height: 100%;
          justify-content: flex-end;
        }
        .skeleton-chart-bars {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          width: 100%;
          justify-content: center;
          height: calc(100% - 20px);
        }
        .skeleton-chart-legend {
          display: flex;
          gap: 16px;
          margin-top: 12px;
        }
        .skeleton-donut-wrapper {
          display: flex;
          align-items: center;
          gap: 24px;
          margin-top: 16px;
        }
        @media (max-width: 1024px) {
          .skeleton-donut-wrapper {
            flex-direction: column;
            align-items: center;
          }
        }
        .skeleton-list-rows {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: 16px;
        }
        .skeleton-list-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 12px;
          border-bottom: 1px dashed var(--border);
        }
        .skeleton-list-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
      `}</style>

      {/* Header */}
      <div className="insights-skeleton-header">
        <div>
          <div className="skeleton-line" style={{ width: "120px", height: "12px", marginBottom: "8px" }} />
          <div className="skeleton-line" style={{ width: "160px", height: "28px" }} />
        </div>
        <div className="skeleton-circle" style={{ width: "40px", height: "40px" }} />
      </div>

      {/* Time Filter Pills */}
      <div className="insights-skeleton-pills">
        <div className="skeleton-pill" style={{ width: "90px", height: "36px", borderRadius: "20px" }} />
        <div className="skeleton-pill" style={{ width: "105px", height: "36px", borderRadius: "20px" }} />
        <div className="skeleton-pill" style={{ width: "95px", height: "36px", borderRadius: "20px" }} />
      </div>

      {/* 4 Cards Grid */}
      <div className="skeleton-insights-grid">
        
        {/* Card 1: Net Cash Flow */}
        <div className="insights-skeleton-card area-cashflow">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <div className="skeleton-line" style={{ width: "100px", height: "14px", marginBottom: "6px" }} />
              <div className="skeleton-line" style={{ width: "70px", height: "10px" }} />
            </div>
            <div className="skeleton-pill" style={{ width: "60px", height: "22px", borderRadius: "20px" }} />
          </div>
          <div className="skeleton-line" style={{ width: "150px", height: "32px", marginBottom: "20px" }} />
          {/* Chart placeholder */}
          <div className="skeleton-panel" style={{ width: "100%", height: "100px", borderRadius: "8px", marginTop: "auto" }} />
        </div>

        {/* Card 2: Income vs Expenses */}
        <div className="insights-skeleton-card area-income-expense">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <div className="skeleton-line" style={{ width: "150px", height: "16px", marginBottom: "6px" }} />
              <div className="skeleton-line" style={{ width: "90px", height: "10px" }} />
            </div>
            <div className="skeleton-line" style={{ width: "110px", height: "14px" }} />
          </div>

          <div className="skeleton-chart-container">
            {/* 6 months columns of bars */}
            {[
              { inc: "65%", exp: "40%" },
              { inc: "80%", exp: "55%" },
              { inc: "45%", exp: "70%" },
              { inc: "75%", exp: "50%" },
              { inc: "90%", exp: "35%" },
              { inc: "55%", exp: "60%" }
            ].map((heights, index) => (
              <div key={index} className="skeleton-chart-bar-group">
                <div className="skeleton-chart-bars">
                  <div className="skeleton-line" style={{ width: "12px", height: heights.inc, borderRadius: "4px 4px 0 0" }} />
                  <div className="skeleton-line" style={{ width: "12px", height: heights.exp, borderRadius: "4px 4px 0 0" }} />
                </div>
                <div className="skeleton-line" style={{ width: "24px", height: "8px", marginTop: "6px" }} />
              </div>
            ))}
          </div>

          <div className="skeleton-chart-legend">
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
          <div>
            <div className="skeleton-line" style={{ width: "130px", height: "16px", marginBottom: "6px" }} />
            <div className="skeleton-line" style={{ width: "110px", height: "10px" }} />
          </div>

          <div className="skeleton-donut-wrapper">
            {/* Donut circle placeholder */}
            <div className="skeleton-circle" style={{ width: "110px", height: "110px", flexShrink: 0 }} />

            {/* Legend list skeleton */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", flexGrow: 1, width: "100%" }}>
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div className="skeleton-circle" style={{ width: "10px", height: "10px" }} />
                    <div className="skeleton-line" style={{ width: "80px", height: "12px" }} />
                  </div>
                  <div className="skeleton-line" style={{ width: "28px", height: "12px" }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 4: Top performing */}
        <div className="insights-skeleton-card area-top-performing">
          <div>
            <div className="skeleton-line" style={{ width: "110px", height: "16px", marginBottom: "6px" }} />
            <div className="skeleton-line" style={{ width: "135px", height: "10px" }} />
          </div>

          <div className="skeleton-list-rows">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="skeleton-list-row">
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="skeleton-circle" style={{ width: "26px", height: "26px" }} />
                  <div className="skeleton-line" style={{ width: "120px", height: "14px" }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
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
