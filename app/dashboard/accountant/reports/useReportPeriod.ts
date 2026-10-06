"use client";

import { useState, useEffect } from "react";

// Storage keys
const PERIOD_KEY = "reports_selected_period";
const FROM_DATE_KEY = "reports_from_date";
const TO_DATE_KEY = "reports_to_date";

export function getOffsetDateStr(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function sanitizeDateString(val: string) {
  if (!val) return "";
  const parts = val.split("-");
  if (parts.length === 3) {
    let [year, month, day] = parts;
    if (year.length > 4) {
      year = year.substring(0, 4);
    }
    return `${year}-${month}-${day}`;
  }
  return val;
}

export function useReportPeriod() {
  const [selectedPeriod, setSelectedPeriodState] = useState<string>("Today");
  const [fromDate, setFromDateState] = useState<string>(() => getOffsetDateStr(0));
  const [toDate, setToDateState] = useState<string>(() => getOffsetDateStr(0));
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedPeriod = localStorage.getItem(PERIOD_KEY);
        const savedFrom = localStorage.getItem(FROM_DATE_KEY);
        const savedTo = localStorage.getItem(TO_DATE_KEY);

        if (savedPeriod) {
          setSelectedPeriodState(savedPeriod);
        }
        if (savedFrom) {
          setFromDateState(savedFrom);
        } else if (savedPeriod && savedPeriod !== "custom") {
          let offset = 0;
          if (savedPeriod === "7 days") offset = 7;
          else if (savedPeriod === "30 days") offset = 30;
          else if (savedPeriod === "3 months") offset = 90;
          setFromDateState(getOffsetDateStr(offset));
        }

        if (savedTo) {
          setToDateState(savedTo);
        }
      } catch (err) {
        console.error("Failed to read from localStorage:", err);
      } finally {
        setIsLoaded(true);
      }
    }
  }, []);

  const setSelectedPeriod = (period: string) => {
    setSelectedPeriodState(period);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(PERIOD_KEY, period);
      } catch (err) {
        console.error("Failed to save selected period to localStorage:", err);
      }
    }

    // Automatically update from/to dates based on period preset
    let offset = 0;
    if (period === "7 days") offset = 7;
    else if (period === "30 days") offset = 30;
    else if (period === "3 months") offset = 90;

    if (period !== "custom") {
      const from = getOffsetDateStr(offset);
      const to = getOffsetDateStr(0);
      setFromDateState(from);
      setToDateState(to);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(FROM_DATE_KEY, from);
          localStorage.setItem(TO_DATE_KEY, to);
        } catch (err) {
          console.error("Failed to save from/to dates to localStorage:", err);
        }
      }
    }
  };

  const setCustomRange = (from: string, to: string) => {
    setSelectedPeriodState("custom");
    setFromDateState(from);
    setToDateState(to);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(PERIOD_KEY, "custom");
        localStorage.setItem(FROM_DATE_KEY, from);
        localStorage.setItem(TO_DATE_KEY, to);
      } catch (err) {
        console.error("Failed to save custom range to localStorage:", err);
      }
    }
  };

  return {
    selectedPeriod,
    setSelectedPeriod,
    fromDate,
    toDate,
    setCustomRange,
    isLoaded,
  };
}
