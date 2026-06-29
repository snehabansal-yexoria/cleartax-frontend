"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Initialize dark mode state based on localStorage on client-side mount
    const savedDarkMode = localStorage.getItem("clearPortfolio.darkMode") === "true";
    setIsDark(savedDarkMode);
    
    if (savedDarkMode) {
      // Dynamic import DarkReader to prevent SSR issues
      import("darkreader").then((DarkReader) => {
        DarkReader.enable({
          brightness: 100,
          contrast: 95,
          sepia: 0,
        });
      });
    }
  }, []);

  const handleToggle = async () => {
    const DarkReader = await import("darkreader");
    if (isDark) {
      DarkReader.disable();
      localStorage.setItem("clearPortfolio.darkMode", "false");
      setIsDark(false);
    } else {
      DarkReader.enable({
        brightness: 100,
        contrast: 95,
        sepia: 0,
      });
      localStorage.setItem("clearPortfolio.darkMode", "true");
      setIsDark(true);
    }
  };

  if (!mounted) {
    return (
      <div 
        style={{ 
          width: "40px", 
          height: "40px", 
          borderRadius: "50%", 
          background: "rgba(0,0,0,0.03)" 
        }} 
      />
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="theme-toggle-btn"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        border: "1px solid #eaeef4",
        background: "#ffffff",
        color: "#475467",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      {isDark ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: "20px", height: "20px" }}
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
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: "20px", height: "20px" }}
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" fill="currentColor" fillOpacity="0.1" />
        </svg>
      )}
    </button>
  );
}
