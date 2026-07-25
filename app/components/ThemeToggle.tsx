"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          border: "1px solid var(--border)",
          background: "var(--surface-1)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      />
    );
  }

  const isDark = theme === "dark";

  const handleToggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <>
      <style>{`
        .theme-toggle-btn {
          position: relative;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 1px solid var(--border);
          background: var(--surface-1);
          color: var(--text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          overflow: hidden;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), 
                      background-color 0.3s ease, 
                      border-color 0.3s ease,
                      box-shadow 0.3s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          outline: none;
        }

        .theme-toggle-btn:hover {
          transform: scale(1.08);
          background: var(--surface-2);
          border-color: var(--text-muted);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
        }

        .theme-toggle-btn:focus-visible {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(244, 161, 23, 0.2);
        }

        .theme-toggle-btn:active {
          transform: scale(0.92);
        }

        .theme-toggle-btn svg {
          position: absolute;
          width: 20px;
          height: 20px;
          transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
        }

        .theme-toggle-btn .sun-icon {
          transform: rotate(0deg) scale(1);
          opacity: 1;
        }

        .theme-toggle-btn .moon-icon {
          transform: rotate(90deg) scale(0);
          opacity: 0;
        }

        .theme-toggle-btn.is-dark .sun-icon {
          transform: rotate(-90deg) scale(0);
          opacity: 0;
        }

        .theme-toggle-btn.is-dark .moon-icon {
          transform: rotate(0deg) scale(1);
          opacity: 1;
        }
      `}</style>
      <button
        type="button"
        onClick={handleToggle}
        className={`theme-toggle-btn ${isDark ? "is-dark" : ""}`}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="sun-icon"
        >
          <circle cx="12" cy="12" r="4" fill="currentColor" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="M4.93 4.93l1.41 1.41" />
          <path d="M17.66 17.66l1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="M6.34 17.66l-1.41 1.41" />
          <path d="M19.07 4.93l-1.41 1.41" />
        </svg>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="moon-icon"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" fill="currentColor" fillOpacity="0.15" />
        </svg>
      </button>
    </>
  );
}

