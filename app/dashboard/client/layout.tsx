"use client";

import "./client.css";
import { useEffect, useState, Suspense } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMockClientApi } from "./mockApiInterceptor";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  useMockClientApi();
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'home' | 'activity' | 'property' | 'entity' | 'insights'>('home');

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    if (pathname.includes('/transactions')) {
      setActiveTab('activity');
    } else if (pathname.includes('/properties') || pathname.includes('/property')) {
      setActiveTab('property');
    } else if (pathname.includes('/entities') || pathname.includes('/entity')) {
      setActiveTab('entity');
    } else if (pathname.includes('/insights')) {
      setActiveTab('insights');
    } else {
      const searchParams = new URLSearchParams(window.location.search);
      const view = searchParams.get('view');
      if (view === 'property') {
        setActiveTab('property');
      } else if (view === 'insights') {
        setActiveTab('insights');
      } else {
        setActiveTab('home');
      }
    }
  }, [isMobile, pathname]);

  if (!isMobile) {
    return <>{children}</>;
  }

  const handleNavClick = (view: 'home' | 'activity' | 'property' | 'entity' | 'insights') => {
    if (view === 'home') {
      router.push('/dashboard/client');
    } else if (view === 'activity') {
      router.push('/dashboard/client/transactions');
    } else if (view === 'property') {
      router.push('/dashboard/client/properties');
    } else if (view === 'entity') {
      router.push('/dashboard/client/entities');
    } else if (view === 'insights') {
      router.push('/dashboard/client/insights');
    }
  };

  return (
    <div className="mobile-client-dashboard-layout mobile-client-dashboard">
      <div className="mobile-client-dashboard-content-area">
        <Suspense fallback={null}>
          {children}
        </Suspense>
      </div>

      {/* Shared Mobile Bottom Navigation */}
      <div className="m-db-nav-bar" style={{ zIndex: 100 }}>
        <button
          type="button"
          className={`m-db-nav-item${activeTab === 'home' ? ' is-active' : ''}`}
          onClick={() => handleNavClick('home')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '22px', height: '22px', fill: activeTab === 'home' ? 'rgba(26, 35, 90, 0.1)' : 'none', stroke: 'currentColor', strokeWidth: 2 }}>
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>Home</span>
        </button>

        <button
          type="button"
          className={`m-db-nav-item${activeTab === 'activity' ? ' is-active' : ''}`}
          onClick={() => handleNavClick('activity')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '22px', height: '22px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>Activity</span>
        </button>

        <button
          type="button"
          className={`m-db-nav-item${activeTab === 'property' ? ' is-active' : ''}`}
          onClick={() => handleNavClick('property')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '22px', height: '22px', fill: activeTab === 'property' ? 'rgba(26, 35, 90, 0.1)' : 'none', stroke: 'currentColor', strokeWidth: 2 }}>
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
          <span>Property</span>
        </button>

        <button
          type="button"
          className={`m-db-nav-item${activeTab === 'entity' ? ' is-active' : ''}`}
          onClick={() => handleNavClick('entity')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '22px', height: '22px', fill: activeTab === 'entity' ? 'rgba(26, 35, 90, 0.1)' : 'none', stroke: 'currentColor', strokeWidth: 2 }}>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
          <span>Entity</span>
        </button>

        <button
          type="button"
          className={`m-db-nav-item${activeTab === 'insights' ? ' is-active' : ''}`}
          onClick={() => handleNavClick('insights')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '22px', height: '22px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span>Insights</span>
        </button>
      </div>
    </div>
  );
}
