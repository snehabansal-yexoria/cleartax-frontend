"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { logout } from "@/src/lib/logout";

interface ClientLogoutContextType {
  triggerLogout: () => void;
  isLoggingOut: boolean;
}

const ClientLogoutContext = createContext<ClientLogoutContextType>({
  triggerLogout: () => {},
  isLoggingOut: false,
});

export const useClientLogout = () => useContext(ClientLogoutContext);

/**
 * Global helper to trigger client logout from anywhere even outside React context.
 */
export function triggerClientLogout() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cleartax:client-logout"));
  }
}

export function ClientLogoutProvider({ children }: { children: React.ReactNode }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const logoutInitiatedRef = useRef(false);

  const startLogout = useCallback(() => {
    if (logoutInitiatedRef.current) return;
    logoutInitiatedRef.current = true;
    setIsLoggingOut(true);
    setIsExiting(false);
    setIsComplete(false);

    // Fast, slick, minimalist timeline (~950ms total)
    // 0ms - 250ms: Fade in overlay and clear session
    const t1 = setTimeout(() => {
      try {
        logout();
      } catch (err) {
        console.warn("Logout cleanup error:", err);
      }
    }, 250);

    // 550ms: Mark complete (show subtle checkmark)
    const t2 = setTimeout(() => {
      setIsComplete(true);
    }, 550);

    // 800ms: Smooth fade out
    const t3 = setTimeout(() => {
      setIsExiting(true);
    }, 800);

    // 950ms: Clean redirect to login
    const t4 = setTimeout(() => {
      window.location.replace("/login");
    }, 980);

    // Safety timeout
    const tSafety = setTimeout(() => {
      window.location.replace("/login");
    }, 2000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(tSafety);
    };
  }, []);

  useEffect(() => {
    const handleCustomLogout = () => {
      startLogout();
    };
    window.addEventListener("cleartax:client-logout", handleCustomLogout);
    return () => {
      window.removeEventListener("cleartax:client-logout", handleCustomLogout);
    };
  }, [startLogout]);

  return (
    <ClientLogoutContext.Provider value={{ triggerLogout: startLogout, isLoggingOut }}>
      {children}
      {isLoggingOut && (
        <ClientLogoutOverlay isComplete={isComplete} isExiting={isExiting} />
      )}
    </ClientLogoutContext.Provider>
  );
}

export function ClientLogoutOverlay({
  isComplete = false,
  isExiting = false,
}: {
  isComplete?: boolean;
  isExiting?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Signing out"
      className={`minimal-logout-backdrop ${isExiting ? "is-exiting" : ""}`}
    >
      <style>{`
        .minimal-logout-backdrop {
          position: fixed;
          inset: 0;
          z-index: 999999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          animation: minimalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          padding: 16px;
          user-select: none;
          transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .minimal-logout-backdrop.is-exiting {
          opacity: 0;
          pointer-events: none;
        }

        @keyframes minimalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .minimal-logout-card {
          position: relative;
          width: 100%;
          max-width: 290px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(0, 0, 0, 0.06);
          box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(255, 255, 255, 0.8) inset;
          padding: 28px 24px 26px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          animation: minimalCardIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          overflow: hidden;
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .minimal-logout-backdrop.is-exiting .minimal-logout-card {
          transform: scale(0.97) translateY(-6px);
          opacity: 0;
        }

        html.dark .minimal-logout-card,
        .dark .minimal-logout-card {
          background: rgba(23, 27, 54, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.09);
          box-shadow: 0 24px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
        }

        @keyframes minimalCardIn {
          0% {
            opacity: 0;
            transform: scale(0.94) translateY(10px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        /* Icon Container */
        .minimal-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
          position: relative;
          transition: all 0.25s ease;
        }

        /* Minimal Crisp Spinner */
        .minimal-spinner {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2px solid rgba(40, 51, 110, 0.12);
          border-top-color: #28336e;
          animation: minimalSpin 0.75s linear infinite;
        }

        html.dark .minimal-spinner,
        .dark .minimal-spinner {
          border-color: rgba(255, 255, 255, 0.12);
          border-top-color: #f4a117;
        }

        @keyframes minimalSpin {
          to { transform: rotate(360deg); }
        }

        /* Success Checkmark Circle */
        .minimal-check-circle {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(15, 110, 86, 0.1);
          color: #0F6E56;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: minimalCheckPop 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        html.dark .minimal-check-circle,
        .dark .minimal-check-circle {
          background: rgba(93, 202, 165, 0.15);
          color: #5DCAA5;
        }

        @keyframes minimalCheckPop {
          0% {
            transform: scale(0.6);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        /* Clean Typography */
        .minimal-title {
          font-size: 16px;
          font-weight: 600;
          color: #14172e;
          letter-spacing: -0.01em;
          margin: 0 0 4px 0;
          line-height: 1.3;
        }

        html.dark .minimal-title,
        .dark .minimal-title {
          color: #ffffff;
        }

        .minimal-subtitle {
          font-size: 13px;
          color: #64748b;
          margin: 0;
          font-weight: 400;
        }

        html.dark .minimal-subtitle,
        .dark .minimal-subtitle {
          color: #94a3b8;
        }

        /* Subtle Bottom Hairline Bar */
        .minimal-hairline-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 2px;
          width: 100%;
          background: linear-gradient(90deg, #28336e 0%, #f4a117 100%);
          animation: minimalLineExpand 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        html.dark .minimal-hairline-bar,
        .dark .minimal-hairline-bar {
          background: linear-gradient(90deg, #7380d4 0%, #f4a117 100%);
        }

        @keyframes minimalLineExpand {
          0% { transform: scaleX(0); transform-origin: left; }
          100% { transform: scaleX(1); transform-origin: left; }
        }
      `}</style>

      <div className="minimal-logout-card">
        {/* Minimal Icon */}
        <div className="minimal-icon-box">
          {isComplete ? (
            <div className="minimal-check-circle">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          ) : (
            <div className="minimal-spinner" />
          )}
        </div>

        {/* Minimal Typography */}
        <h3 className="minimal-title">
          {isComplete ? "Signed out" : "Signing out..."}
        </h3>
        <p className="minimal-subtitle">
          {isComplete ? "See you soon" : "Securing your session"}
        </p>

        {/* Flush Hairline Accent Line */}
        <div className="minimal-hairline-bar" />
      </div>
    </div>
  );
}
