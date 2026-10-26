import React from "react";

export default function ClientEntitiesSkeleton() {
  return (
    <div className="desktop-client-dashboard" style={{ background: 'transparent', minHeight: '100vh', paddingBottom: '40px' }}>
      {/* Header Skeleton */}
      <div 
        className="flex justify-between items-center bg-transparent mb-8 pt-0 pb-0"
        style={{ padding: '0 4px' }}
      >
        <div className="skeleton-line" style={{ width: '150px', height: '32px', borderRadius: '8px' }} />
        <div className="skeleton-circle" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
      </div>

      {/* Content Area */}
      <div style={{ padding: '0 4px' }}>
        {/* Blue Summary Card Skeleton */}
        <div 
          className="relative w-full rounded-[20px] py-6 px-6 mb-6 entities-portfolio-summary-card"
          style={{ height: '140px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}
        >
          <div className="skeleton-line skeleton-line-summary" style={{ width: '180px', height: '14px' }} />
          <div className="skeleton-line skeleton-line-summary" style={{ width: '220px', height: '36px', borderRadius: '8px' }} />
          <div className="skeleton-line skeleton-line-summary" style={{ width: '140px', height: '14px' }} />
        </div>

        {/* Your Entities Header Skeleton */}
        <div className="skeleton-line" style={{ width: '120px', height: '16px', marginTop: '28px', marginBottom: '16px' }} />

        {/* Grid/List of Entity Cards Skeleton */}
        <div className="grid grid-cols-1 gap-5 w-full min-[1200px]:grid-cols-2 min-[1200px]:gap-6 min-[1600px]:grid-cols-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div 
              key={index}
              className="bg-white border border-[#eaeef4] rounded-2xl p-6 flex flex-col gap-6 shadow-[0_1px_3px_rgba(16,24,40,0.05)]"
              style={{
                background: 'var(--surface-1)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-2" style={{ flex: 1 }}>
                  <div className="skeleton-line" style={{ width: '60%', height: '18px', borderRadius: '4px' }} />
                  <div className="skeleton-line" style={{ width: '40%', height: '12px', borderRadius: '4px' }} />
                </div>
                <div className="skeleton-circle" style={{ width: '36px', height: '36px', borderRadius: '8px' }} />
              </div>

              <div className="flex justify-between items-center">
                <div className="flex flex-col gap-2">
                  <div className="skeleton-line" style={{ width: '60px', height: '10px' }} />
                  <div className="skeleton-line" style={{ width: '80px', height: '14px' }} />
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <div className="skeleton-line" style={{ width: '50px', height: '10px' }} />
                  <div className="skeleton-line" style={{ width: '70px', height: '14px' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
