"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Skeleton } from "boneyard-js/react";
import { ClientEntitiesSkeleton } from "@/app/components/PortalSkeletons";
import { logout } from "@/src/lib/logout";
import { getSession } from "@/src/lib/session";
import type { CoreEntity } from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

function titleCase(value: string) {
  if (!value) return "";
  return value
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export default function ClientInsightsPage() {
  const router = useRouter();
  const [entities, setEntities] = useState<CoreEntity[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<{ fullName?: string; email?: string } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  
  // Interactive UI state
  const [timeFilter, setTimeFilter] = useState<'year' | 'quarter' | 'month'>('year');
  const [showForecast, setShowForecast] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Responsive design listener
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch data from backend API
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;
        if (!session) {
          router.replace("/login/user");
          return;
        }
        const token = session.getIdToken().getJwtToken();

        // 1. Fetch current user
        try {
          const userRes = await fetch("/api/users/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (userRes.ok) {
            const data = await userRes.json();
            if (!cancelled) setCurrentUser(data);
          }
        } catch (err) {
          console.error("Failed to fetch current user:", err);
        }

        // 2. Fetch entities
        const res = await fetch("/api/entities", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;

        let loadedEntities: CoreEntity[] = [];
        if (res.ok) {
          const data = (await res.json()) as { items?: CoreEntity[] };
          loadedEntities = data.items || [];
          if (!cancelled) setEntities(loadedEntities);
        } else {
          const data = await res.json().catch(() => ({}));
          if (!cancelled) setErrorMessage(data.error || "Failed to load your entities.");
        }

        if (cancelled || loadedEntities.length === 0) {
          if (!cancelled) setIsLoading(false);
          return;
        }

        // 3. Fetch properties for each entity in parallel
        const propertyPromises = loadedEntities.map(async (entity) => {
          try {
            const propRes = await fetch(`/api/entities/${entity.id}/properties`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (propRes.ok) {
              const data = await propRes.json();
              return (data.items || []).map((p: any) => ({ ...p, entityId: entity.id }));
            }
          } catch (err) {
            console.error(`Failed to fetch properties for entity ${entity.id}:`, err);
          }
          return [];
        });

        const propertiesArrays = await Promise.all(propertyPromises);
        const allProperties = propertiesArrays.flat();
        if (!cancelled) setProperties(allProperties);

        if (cancelled) return;

        // 4. Fetch transactions
        try {
          const txRes = await fetch("/api/transactions", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (txRes.ok) {
            const data = await txRes.json();
            if (!cancelled) setTransactions(data.items || []);
          }
        } catch (err) {
          console.error("Failed to fetch transactions:", err);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load insights data:", error);
          setErrorMessage("Unexpected error loading insights data.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  // Formatting helpers
  const firstWord = (str: string) => (str ? str.split(/[\s,]+/)[0] : "");
  const userName = currentUser?.fullName
    ? firstWord(currentUser.fullName)
    : currentUser?.email
    ? titleCase(currentUser.email.split("@")[0])
    : "Sarah";

  const getInitials = (value: string) => {
    if (!value) return "SJ";
    const localPart = value.split("@")[0] || value;
    const parts = localPart
      .split(/[._-]/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return localPart.slice(0, 2).toUpperCase();
  };

  const userInitials = currentUser?.fullName
    ? getInitials(currentUser.fullName)
    : currentUser?.email
    ? getInitials(currentUser.email)
    : "SJ";

  // Financial period date range helpers
  const periodBounds = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let startCurr: Date;
    let endCurr: Date;
    let startPrev: Date;
    let endPrev: Date;

    if (timeFilter === "year") {
      startCurr = new Date(currentYear, 0, 1);
      endCurr = new Date(currentYear, 11, 31, 23, 59, 59);
      startPrev = new Date(currentYear - 1, 0, 1);
      endPrev = new Date(currentYear - 1, 11, 31, 23, 59, 59);
    } else if (timeFilter === "quarter") {
      const quarterIndex = Math.floor(currentMonth / 3); // 0, 1, 2, 3
      startCurr = new Date(currentYear, quarterIndex * 3, 1);
      endCurr = new Date(currentYear, (quarterIndex + 1) * 3, 0, 23, 59, 59);

      let prevQuarterIndex = quarterIndex - 1;
      let prevYear = currentYear;
      if (prevQuarterIndex < 0) {
        prevQuarterIndex = 3;
        prevYear -= 1;
      }
      startPrev = new Date(prevYear, prevQuarterIndex * 3, 1);
      endPrev = new Date(prevYear, (prevQuarterIndex + 1) * 3, 0, 23, 59, 59);
    } else {
      // month
      startCurr = new Date(currentYear, currentMonth, 1);
      endCurr = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

      let prevMonth = currentMonth - 1;
      let prevYear = currentYear;
      if (prevMonth < 0) {
        prevMonth = 11;
        prevYear -= 1;
      }
      startPrev = new Date(prevYear, prevMonth, 1);
      endPrev = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59);
    }

    return { startCurr, endCurr, startPrev, endPrev };
  }, [timeFilter]);

  // Net Cash Flow calculations
  const cashFlowMetrics = useMemo(() => {
    const filterTxs = (start: Date, end: Date) => {
      return transactions.filter((tx) => {
        if (!tx.invoiceDate) return false;
        const d = new Date(tx.invoiceDate);
        return d >= start && d <= end;
      });
    };

    const currentTxs = filterTxs(periodBounds.startCurr, periodBounds.endCurr);
    const previousTxs = filterTxs(periodBounds.startPrev, periodBounds.endPrev);

    const getTotals = (txs: any[]) => {
      const income = txs
        .filter((tx) => tx.type === "revenue")
        .reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);
      const expense = txs
        .filter((tx) => tx.type === "expense")
        .reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);
      return { income, expense, net: income - expense };
    };

    const curr = getTotals(currentTxs);
    const prev = getTotals(previousTxs);

    let trendPercentage = 0;
    if (prev.net !== 0) {
      trendPercentage = ((curr.net - prev.net) / Math.abs(prev.net)) * 100;
    } else if (curr.net !== 0) {
      trendPercentage = curr.net > 0 ? 100 : -100;
    }

    return {
      currentNet: curr.net,
      trendPercentage,
    };
  }, [transactions, periodBounds]);

  // Line Chart Data points calculation
  const lineChartPoints = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const points: number[] = [];

    if (timeFilter === "year") {
      for (let m = 0; m <= currentMonth; m++) {
        const monthStart = new Date(currentYear, m, 1);
        const monthEnd = new Date(currentYear, m + 1, 0, 23, 59, 59);
        const txs = transactions.filter((tx) => {
          if (!tx.invoiceDate) return false;
          const d = new Date(tx.invoiceDate);
          return d >= monthStart && d <= monthEnd;
        });
        const inc = txs.filter((tx) => tx.type === "revenue").reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);
        const exp = txs.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);
        points.push(inc - exp);
      }
    } else if (timeFilter === "quarter") {
      const quarterIndex = Math.floor(currentMonth / 3);
      const endOffset = currentMonth % 3; // how far into current quarter we are
      for (let i = 0; i <= endOffset; i++) {
        const m = quarterIndex * 3 + i;
        const monthStart = new Date(currentYear, m, 1);
        const monthEnd = new Date(currentYear, m + 1, 0, 23, 59, 59);
        const txs = transactions.filter((tx) => {
          if (!tx.invoiceDate) return false;
          const d = new Date(tx.invoiceDate);
          return d >= monthStart && d <= monthEnd;
        });
        const inc = txs.filter((tx) => tx.type === "revenue").reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);
        const exp = txs.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);
        points.push(inc - exp);
      }
    } else {
      // Month (5-day intervals)
      const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      const currentDay = now.getDate();
      const intervalSize = 5;
      const totalIntervals = Math.min(Math.ceil(currentDay / intervalSize), 6);

      for (let i = 0; i < totalIntervals; i++) {
        const startDay = i * intervalSize + 1;
        const endDay = Math.min((i + 1) * intervalSize, lastDay);
        const start = new Date(currentYear, currentMonth, startDay);
        const end = new Date(currentYear, currentMonth, endDay, 23, 59, 59);
        const txs = transactions.filter((tx) => {
          if (!tx.invoiceDate) return false;
          const d = new Date(tx.invoiceDate);
          return d >= start && d <= end;
        });
        const inc = txs.filter((tx) => tx.type === "revenue").reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);
        const exp = txs.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);
        points.push(inc - exp);
      }
    }

    // Fallback in case of empty points to prevent render failure
    return points.length === 0 ? [0] : points;
  }, [transactions, timeFilter]);

  // Generate path data for SVG
  const lineChartSvg = useMemo(() => {
    const width = 340;
    const height = 90;
    const paddingX = 5;
    const paddingY = 15;
    const usableWidth = width - 2 * paddingX;
    const usableHeight = height - 2 * paddingY;

    const min = Math.min(...lineChartPoints);
    const max = Math.max(...lineChartPoints);
    const range = max - min === 0 ? 1 : max - min;

    const coords = lineChartPoints.map((p, idx) => {
      const x = lineChartPoints.length > 1
        ? paddingX + (idx / (lineChartPoints.length - 1)) * usableWidth
        : paddingX + usableWidth / 2;
      const y = height - paddingY - ((p - min) / range) * usableHeight;
      return { x, y };
    });

    const linePath = coords
      .map((c, idx) => `${idx === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(" ");

    const areaPath = coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${height} L ${coords[0].x.toFixed(1)} ${height} Z`
      : "";

    return { linePath, areaPath, width, height };
  }, [lineChartPoints]);

  // Income vs Expenses Stacked Bar Chart Calculations (Last 6 Months vs Next 6 Months Projection)
  const barChartData = useMemo(() => {
    if (!showForecast) {
      // Last 6 months historical
      const list = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const m = d.getMonth();
        const y = d.getFullYear();
        const label = d.toLocaleDateString("en-US", { month: "short" });

        const monthStart = new Date(y, m, 1);
        const monthEnd = new Date(y, m + 1, 0, 23, 59, 59);

        const txs = transactions.filter((tx) => {
          if (!tx.invoiceDate) return false;
          const txd = new Date(tx.invoiceDate);
          return txd >= monthStart && txd <= monthEnd;
        });

        const income = txs
          .filter((tx) => tx.type === "revenue")
          .reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);
        const expense = txs
          .filter((tx) => tx.type === "expense")
          .reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);

        list.push({ label, income, expense });
      }
      return list;
    } else {
      // Next 6 months forecast based on historical average
      const totalInc = transactions
        .filter((tx) => tx.type === "revenue")
        .reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);
      const totalExp = transactions
        .filter((tx) => tx.type === "expense")
        .reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);

      let uniqueMonthsCount = 1;
      if (transactions.length > 0) {
        const dates = transactions
          .map((tx) => tx.invoiceDate)
          .filter(Boolean)
          .map((d) => new Date(d));
        if (dates.length > 0) {
          const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
          const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
          const diffMonths =
            (maxDate.getFullYear() - minDate.getFullYear()) * 12 +
            maxDate.getMonth() -
            minDate.getMonth();
          uniqueMonthsCount = Math.max(diffMonths + 1, 1);
        }
      }

      const avgInc = totalInc / uniqueMonthsCount;
      const avgExp = totalExp / uniqueMonthsCount;

      const list = [];
      for (let i = 1; i <= 6; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() + i);
        const label = d.toLocaleDateString("en-US", { month: "short" });

        // Introduce minor realistic seasonal variations
        const variationInc = 1 + Math.sin(i) * 0.08;
        const variationExp = 1 + Math.cos(i) * 0.05;

        list.push({
          label,
          income: Math.round(avgInc * (avgInc > 0 ? variationInc : 0)),
          expense: Math.round(avgExp * (avgExp > 0 ? variationExp : 0)),
        });
      }
      return list;
    }
  }, [transactions, showForecast]);

  const maxMonthSum = useMemo(() => {
    const sums = barChartData.map((d) => d.income + d.expense);
    return Math.max(...sums, 1);
  }, [barChartData]);

  // Expense Breakdown calculations
  const expenseBreakdown = useMemo(() => {
    const expenseTxs = transactions.filter((tx) => tx.type === "expense");
    const total = expenseTxs.reduce(
      (sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0),
      0
    );

    const categoriesMap: Record<string, number> = {};
    expenseTxs.forEach((tx) => {
      const cat = tx.categoryName || "General Expenses";
      categoriesMap[cat] =
        (categoriesMap[cat] || 0) + (tx.netAmount || tx.grossAmount || 0);
    });

    const categoriesArray = Object.entries(categoriesMap).map(
      ([name, amount]) => ({
        name,
        amount,
        percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
      })
    );

    categoriesArray.sort((a, b) => b.amount - a.amount);

    if (categoriesArray.length <= 3) {
      return { total, items: categoriesArray };
    }

    const items = categoriesArray.slice(0, 3);
    const otherAmount = categoriesArray
      .slice(3)
      .reduce((sum, c) => sum + c.amount, 0);
    items.push({
      name: "Other",
      amount: otherAmount,
      percentage: total > 0 ? Math.round((otherAmount / total) * 100) : 0,
    });

    return { total, items };
  }, [transactions]);

  const topPerformingProperties = useMemo(() => {
    const list = properties.map((prop) => {
      const propTxs = transactions.filter((tx) => {
        return (
          tx.propertyIds?.includes(prop.id) ||
          tx.propertyNames?.includes(prop.name)
        );
      });

      const periodTxs = propTxs.filter((tx) => {
        if (!tx.invoiceDate) return false;
        const d = new Date(tx.invoiceDate);
        return d >= periodBounds.startCurr && d <= periodBounds.endCurr;
      });

      const income = periodTxs
        .filter((tx) => tx.type === "revenue")
        .reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);

      const expense = periodTxs
        .filter((tx) => tx.type === "expense")
        .reduce((sum, tx) => sum + (tx.netAmount || tx.grossAmount || 0), 0);

      const net = income - expense;
      const returnRate = prop.estimatedMarketValue > 0 ? (net / prop.estimatedMarketValue) * 100 : 0;

      return {
        name: prop.name,
        income,
        expense,
        net,
        returnRate,
      };
    });

    list.sort((a, b) => b.income - a.income || b.returnRate - a.returnRate);
    return list.slice(0, 3);
  }, [properties, transactions, periodBounds]);

  const formatKCurrency = (val: number) => {
    const sign = val >= 0 ? "+" : "-";
    const kVal = Math.abs(val) / 1000;
    return `${sign}$${kVal.toFixed(1)}K`;
  };

  // Doughnut Chart circle properties
  const doughnutCircumference = 282.743; // 2 * Math.PI * 45
  const categoryColors = ["#1b265c", "#f7a61a", "#12b76a", "#475467"];

  const formatCurrency = (val: number) => {
    const sign = val < 0 ? "-" : "";
    const absVal = Math.abs(val);
    return `${sign}$${absVal.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  };

  const trendBadgeStyle =
    cashFlowMetrics.trendPercentage >= 0
      ? { background: "#ecfdf3", color: "#027a48" }
      : { background: "#fef3f2", color: "#b42318" };

  const trendSign = cashFlowMetrics.trendPercentage >= 0 ? "+" : "";

  // Check if workspace is empty
  const isWorkspaceEmpty = properties.length === 0 && transactions.length === 0;

  if (isMobile) {
    return (
      <Skeleton
        name="client-insights-mobile"
        loading={isLoading}
        fallback={<ClientEntitiesSkeleton />}
      >
        <div
          className="mobile-client-dashboard"
          style={{
            padding: "0 16px 90px 16px",
            background: "#f7f9fc",
            minHeight: "100vh",
            fontFamily: "Inter, -apple-system, sans-serif",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "24px 0 16px 0",
            }}
          >
            <div>
              <p
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#8c9ba5",
                  margin: 0,
                }}
              >
                Portfolio analytics
              </p>
              <h1
                style={{
                  fontSize: "28px",
                  fontWeight: 700,
                  color: "#101828",
                  margin: "4px 0 0 0",
                }}
              >
                Insights
              </h1>
            </div>
            <Link
              href="/dashboard/client/profile"
              className="m-db-avatar-circle"
              style={{
                backgroundColor: "#1d2d5c",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
                fontSize: "14px",
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                border: "2px solid #eaeef4",
                textDecoration: "none",
              }}
            >
              {userInitials}
            </Link>
          </div>

          {/* Time Filter Pills */}
          <div style={{ display: "flex", gap: "10px", margin: "16px 0 20px 0" }}>
            {[
              { label: "This Year", val: "year" },
              { label: "This Quarter", val: "quarter" },
              { label: "This Month", val: "month" },
            ].map((p) => (
              <button
                key={p.val}
                type="button"
                onClick={() => setTimeFilter(p.val as any)}
                style={{
                  padding: "8px 18px",
                  borderRadius: "20px",
                  fontSize: "14px",
                  fontWeight: 600,
                  border: "1px solid #d0d5dd",
                  background: timeFilter === p.val ? "#1b265c" : "#ffffff",
                  color: timeFilter === p.val ? "#ffffff" : "#1b265c",
                  cursor: "pointer",
                  outline: "none",
                  transition: "all 0.2s",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {isWorkspaceEmpty ? (
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #eaeef4",
                borderRadius: "18px",
                padding: "32px 24px",
                textAlign: "center",
                boxShadow: "0 4px 12px rgba(16, 24, 40, 0.02)",
              }}
            >
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#101828", margin: "0 0 10px 0" }}>
                No Analytics Data
              </h3>
              <p style={{ fontSize: "14px", color: "#667085", lineHeight: 1.5, margin: "0 0 24px 0" }}>
                We could not find any properties or transactions associated with your account. Add them to view your net cash flow, historical trends, and expense breakdown.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <Link
                  href="/dashboard/client/entities"
                  style={{
                    display: "block",
                    padding: "12px",
                    borderRadius: "12px",
                    background: "#1b265c",
                    color: "#ffffff",
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: "14px",
                  }}
                >
                  Go to Entities
                </Link>
                <Link
                  href="/dashboard/client/transactions"
                  style={{
                    display: "block",
                    padding: "12px",
                    borderRadius: "12px",
                    border: "1px solid #d0d5dd",
                    background: "#ffffff",
                    color: "#344054",
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: "14px",
                  }}
                >
                  View Transactions
                </Link>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Card 1: Net Cash Flow */}
              <div
                className="m-db-stat-card"
                style={{
                  background: "#ffffff",
                  border: "1px solid #eaeef4",
                  borderRadius: "18px",
                  padding: "20px 20px 12px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0",
                  boxShadow: "0 4px 12px rgba(16, 24, 40, 0.02)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#667085" }}>
                    Net Cash Flow
                  </span>
                  <span
                    className="m-db-trend-badge"
                    style={{
                      ...trendBadgeStyle,
                      padding: "2px 8px",
                      borderRadius: "20px",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    {trendSign}
                    {cashFlowMetrics.trendPercentage.toFixed(1)}%
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: 700,
                    color: cashFlowMetrics.currentNet >= 0 ? "#12b76a" : "#f04438",
                    margin: "8px 0 12px 0",
                  }}
                >
                  {formatCurrency(cashFlowMetrics.currentNet)}
                </div>

                {/* SVG Trend Line Chart */}
                <div style={{ width: "100%", height: "90px", marginTop: "4px" }}>
                  <svg
                    viewBox={`0 0 ${lineChartSvg.width} ${lineChartSvg.height}`}
                    width="100%"
                    height="100%"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#12b76a" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#12b76a" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {lineChartSvg.areaPath && (
                      <path d={lineChartSvg.areaPath} fill="url(#areaGradient)" />
                    )}
                    {lineChartSvg.linePath && (
                      <path
                        d={lineChartSvg.linePath}
                        fill="none"
                        stroke="#12b76a"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                  </svg>
                </div>
              </div>

              {/* Card 2: Income vs Expenses */}
              <div
                className="m-db-chart-card"
                style={{
                  background: "#ffffff",
                  border: "1px solid #eaeef4",
                  borderRadius: "18px",
                  padding: "20px",
                  boxShadow: "0 4px 12px rgba(16, 24, 40, 0.02)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <div
                  className="m-db-chart-header"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <h3 className="m-db-chart-title" style={{ fontSize: "16px", fontWeight: 700 }}>
                      Income vs Expenses
                    </h3>
                    <div
                      className="m-db-chart-subtitle"
                      style={{
                        fontSize: "12px",
                        color: "#8c9ba5",
                        marginTop: "4px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span>{showForecast ? "Next 6 months" : "Last 6 months"}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowForecast((f) => !f)}
                    style={{
                      border: "none",
                      background: "none",
                      color: "#475467",
                      fontSize: "12px",
                      fontWeight: 500,
                      textDecoration: "underline",
                      cursor: "pointer",
                      padding: 0,
                      outline: "none",
                    }}
                  >
                    {showForecast ? "Show last 6 months" : "Show next 6 months"}
                  </button>
                </div>

                {/* Stacked columns wrapper */}
                <div className="m-db-chart-bars-wrap">
                  {barChartData.map((d) => {
                    const total = d.income + d.expense;
                    const barHeightPct = total > 0 ? (total / maxMonthSum) * 100 : 0;
                    const incPct = total > 0 ? (d.income / total) * 100 : 0;
                    const expPct = total > 0 ? (d.expense / total) * 100 : 0;

                    return (
                      <div key={d.label} className="m-db-chart-bar-container">
                        <div
                          className="m-db-chart-bar-pill"
                          style={{
                            height: `${Math.max(barHeightPct, 4)}%`,
                            minHeight: "16px",
                            display: "flex",
                            flexDirection: "column-reverse",
                          }}
                        >
                          <div
                            className="m-db-chart-bar-income"
                            style={{
                              height: `${incPct}%`,
                              backgroundColor: "#1b265c",
                            }}
                            title={`Income: ${formatCurrency(d.income)}`}
                          />
                          <div
                            className="m-db-chart-bar-expense"
                            style={{
                              height: `${expPct}%`,
                              backgroundColor: "#f7a61a",
                            }}
                            title={`Expense: ${formatCurrency(d.expense)}`}
                          />
                        </div>
                        <span className="m-db-chart-bar-label">{d.label}</span>
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{
                    height: "1px",
                    background: "#eaeef4",
                    margin: "4px 0",
                  }}
                />

                <div
                  className="m-db-chart-legend"
                  style={{ display: "flex", gap: "16px", fontSize: "12px" }}
                >
                  <div className="m-db-legend-item" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "3px",
                        backgroundColor: "#1b265c",
                      }}
                    />
                    <span style={{ color: "#475467", fontWeight: 500 }}>Income</span>
                  </div>
                  <div className="m-db-legend-item" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "3px",
                        backgroundColor: "#f7a61a",
                      }}
                    />
                    <span style={{ color: "#475467", fontWeight: 500 }}>Expenses</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Expense breakdown */}
              <div
                className="m-db-stat-card"
                style={{
                  background: "#ffffff",
                  border: "1px solid #eaeef4",
                  borderRadius: "18px",
                  padding: "20px",
                  boxShadow: "0 4px 12px rgba(16, 24, 40, 0.02)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#101828", margin: 0 }}>
                  Expense breakdown
                </h3>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "24px",
                  }}
                >
                  {/* Doughnut SVG */}
                  <div
                    style={{
                      width: "110px",
                      height: "110px",
                      position: "relative",
                      flexShrink: 0,
                    }}
                  >
                    <svg viewBox="0 0 100 100" width="100%" height="100%">
                      {expenseBreakdown.total === 0 ? (
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke="#f2f4f7"
                          strokeWidth="10"
                        />
                      ) : (
                        (() => {
                          let accumulatedPercentage = 0;
                          return expenseBreakdown.items.map((item, idx) => {
                            const offset =
                              (accumulatedPercentage / 100) * doughnutCircumference;
                            accumulatedPercentage += item.percentage;
                            return (
                              <circle
                                key={item.name}
                                cx="50"
                                cy="50"
                                r="45"
                                fill="none"
                                stroke={categoryColors[idx % categoryColors.length]}
                                strokeWidth="10"
                                strokeDasharray={`${((item.percentage / 100) * doughnutCircumference).toFixed(2)} ${doughnutCircumference}`}
                                strokeDashoffset={-offset}
                                transform="rotate(-90 50 50)"
                              />
                            );
                          });
                        })()
                      )}
                    </svg>
                  </div>

                  {/* Legend list */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      flexGrow: 1,
                    }}
                  >
                    {expenseBreakdown.total === 0 ? (
                      <span style={{ fontSize: "13px", color: "#667085" }}>
                        No expense items recorded.
                      </span>
                    ) : (
                      expenseBreakdown.items.map((item, idx) => (
                        <div
                          key={item.name}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: "13px",
                            fontWeight: 500,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div
                              style={{
                                width: "10px",
                                height: "10px",
                                borderRadius: "2px",
                                backgroundColor:
                                  categoryColors[idx % categoryColors.length],
                              }}
                            />
                            <span style={{ color: "#344054" }}>{item.name}</span>
                          </div>
                          <strong style={{ color: "#101828" }}>{item.percentage}%</strong>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Card 4: Top performing */}
              <div
                className="m-db-stat-card"
                style={{
                  background: "#ffffff",
                  border: "1px solid #eaeef4",
                  borderRadius: "18px",
                  padding: "20px",
                  boxShadow: "0 4px 12px rgba(16, 24, 40, 0.02)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#101828", margin: 0 }}>
                    Top performing
                  </h3>
                  <p style={{ fontSize: "12px", color: "#667085", margin: "4px 0 0 0" }}>
                    By income - {timeFilter === "year" ? "This Year" : timeFilter === "quarter" ? "This Quarter" : "This Month"}
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "4px" }}>
                  {topPerformingProperties.length === 0 ? (
                    <span style={{ fontSize: "13px", color: "#667085" }}>
                      No properties found.
                    </span>
                  ) : (
                    topPerformingProperties.map((item, idx) => (
                      <div
                        key={item.name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingBottom: idx < topPerformingProperties.length - 1 ? "12px" : "0",
                          borderBottom: idx < topPerformingProperties.length - 1 ? "1px solid #f2f4f7" : "none",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          {/* Rank Circle */}
                          <div
                            style={{
                              width: "24px",
                              height: "24px",
                              borderRadius: "50%",
                              backgroundColor: "#1b265c",
                              color: "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "12px",
                              fontWeight: 700,
                            }}
                          >
                            {idx + 1}
                          </div>
                          <span style={{ fontSize: "14px", fontWeight: 600, color: "#101828" }}>
                            {item.name}
                          </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                          <span style={{ fontSize: "13px", color: "#667085", fontWeight: 500 }}>
                            {item.returnRate.toFixed(1)}%
                          </span>
                          <span
                            style={{
                              fontSize: "14px",
                              fontWeight: 700,
                              color: item.net >= 0 ? "#12b76a" : "#f04438",
                            }}
                          >
                            {formatKCurrency(item.net)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Skeleton>
    );
  }

  // Responsive Desktop Return Layout
  return (
    <Skeleton
      name="client-insights-desktop"
      loading={isLoading}
      fallback={<ClientEntitiesSkeleton />}
    >
      <section className="portal-page" style={{ fontFamily: "Inter, -apple-system, sans-serif" }}>
        {/* Portal Page Header */}
        <div className="portal-page-header">
          <div>
            <p className="portal-kicker">Client Workspace</p>
            <h1>Portfolio Insights</h1>
            <p>Interactive data visualizations and detailed metrics for your portfolio.</p>
          </div>

          <div className="portal-page-actions">
            <Link href="/dashboard/client/entities/new" className="entity-wizard-primary">
              + Add Entity
            </Link>
            <Link href="/dashboard/client/transactions/new" className="portal-secondary-link">
              + Add Transaction
            </Link>
            <button type="button" className="portal-secondary-link" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        {errorMessage && (
          <p className="entity-wizard-error" style={{ marginBottom: "20px" }}>
            {errorMessage}
          </p>
        )}

        {isWorkspaceEmpty ? (
          <div className="client-detail-empty" style={{ padding: "40px" }}>
            <p>
              You haven&apos;t added any entities, properties, or transactions yet. To view insights, please add legal structures and link bank accounts or add transaction logs.
            </p>
            <div style={{ marginTop: "20px", display: "flex", gap: "12px" }}>
              <Link href="/dashboard/client/entities/new" className="entity-wizard-primary">
                Add Your First Entity
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Filter Pills row */}
            <div style={{ display: "flex", gap: "10px" }}>
              {[
                { label: "This Year", val: "year" },
                { label: "This Quarter", val: "quarter" },
                { label: "This Month", val: "month" },
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => setTimeFilter(p.val as any)}
                  style={{
                    padding: "8px 20px",
                    borderRadius: "20px",
                    fontSize: "14px",
                    fontWeight: 600,
                    border: "1px solid #d0d5dd",
                    background: timeFilter === p.val ? "#1b265c" : "#ffffff",
                    color: timeFilter === p.val ? "#ffffff" : "#1b265c",
                    cursor: "pointer",
                    outline: "none",
                    transition: "all 0.2s",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Desktop Two-Column Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.5fr 1fr",
                gap: "24px",
                alignItems: "start",
              }}
            >
              {/* Left Column */}
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                {/* Net Cash Flow Card */}
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #eaeef4",
                    borderRadius: "18px",
                    padding: "24px",
                    boxShadow: "0 4px 12px rgba(16, 24, 40, 0.01)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#667085" }}>
                      Net Cash Flow
                    </span>
                    <span
                      className="m-db-trend-badge"
                      style={{
                        ...trendBadgeStyle,
                        padding: "4px 12px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      {trendSign}
                      {cashFlowMetrics.trendPercentage.toFixed(1)}%
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "36px",
                      fontWeight: 800,
                      color: cashFlowMetrics.currentNet >= 0 ? "#12b76a" : "#f04438",
                      margin: "12px 0 16px 0",
                    }}
                  >
                    {formatCurrency(cashFlowMetrics.currentNet)}
                  </div>

                  {/* SVG Line Chart for Desktop */}
                  <div style={{ width: "100%", height: "130px", marginTop: "10px" }}>
                    <svg
                      viewBox={`0 0 ${lineChartSvg.width} ${lineChartSvg.height}`}
                      width="100%"
                      height="100%"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="areaGradientDesktop" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#12b76a" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="#12b76a" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      {lineChartSvg.areaPath && (
                        <path d={lineChartSvg.areaPath} fill="url(#areaGradientDesktop)" />
                      )}
                      {lineChartSvg.linePath && (
                        <path
                          d={lineChartSvg.linePath}
                          fill="none"
                          stroke="#12b76a"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                    </svg>
                  </div>
                </div>

                {/* Income vs Expenses Card */}
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #eaeef4",
                    borderRadius: "18px",
                    padding: "24px",
                    boxShadow: "0 4px 12px rgba(16, 24, 40, 0.01)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "20px",
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#101828", margin: 0 }}>
                        Income vs Expenses
                      </h3>
                      <p style={{ fontSize: "13px", color: "#8c9ba5", margin: "4px 0 0 0" }}>
                        {showForecast
                          ? "Projected monthly distributions for the next 6 months"
                          : "Historical monthly cash distributions for the past 6 months"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowForecast((f) => !f)}
                      style={{
                        border: "none",
                        background: "none",
                        color: "#1b265c",
                        fontSize: "14px",
                        fontWeight: 600,
                        textDecoration: "underline",
                        cursor: "pointer",
                        padding: 0,
                        outline: "none",
                      }}
                    >
                      {showForecast ? "Show last 6 months" : "Show next 6 months"}
                    </button>
                  </div>

                  <div className="m-db-chart-bars-wrap" style={{ height: "180px" }}>
                    {barChartData.map((d) => {
                      const total = d.income + d.expense;
                      const barHeightPct = total > 0 ? (total / maxMonthSum) * 100 : 0;
                      const incPct = total > 0 ? (d.income / total) * 100 : 0;
                      const expPct = total > 0 ? (d.expense / total) * 100 : 0;

                      return (
                        <div key={d.label} className="m-db-chart-bar-container">
                          <div
                            className="m-db-chart-bar-pill"
                            style={{
                              height: `${Math.max(barHeightPct, 4)}%`,
                              width: "36px",
                              minHeight: "16px",
                              display: "flex",
                              flexDirection: "column-reverse",
                            }}
                          >
                            <div
                              style={{
                                height: `${incPct}%`,
                                backgroundColor: "#1b265c",
                              }}
                              title={`Income: ${formatCurrency(d.income)}`}
                            />
                            <div
                              style={{
                                height: `${expPct}%`,
                                backgroundColor: "#f7a61a",
                              }}
                              title={`Expense: ${formatCurrency(d.expense)}`}
                            />
                          </div>
                          <span className="m-db-chart-bar-label" style={{ fontSize: "12px", marginTop: "8px" }}>
                            {d.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      height: "1px",
                      background: "#eaeef4",
                      margin: "16px 0",
                    }}
                  />

                  <div style={{ display: "flex", gap: "24px", fontSize: "13px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div
                        style={{
                          width: "14px",
                          height: "14px",
                          borderRadius: "4px",
                          backgroundColor: "#1b265c",
                        }}
                      />
                      <span style={{ color: "#475467", fontWeight: 500 }}>Income</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div
                        style={{
                          width: "14px",
                          height: "14px",
                          borderRadius: "4px",
                          backgroundColor: "#f7a61a",
                        }}
                      />
                      <span style={{ color: "#475467", fontWeight: 500 }}>Expenses</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                {/* Expense Breakdown Card */}
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #eaeef4",
                    borderRadius: "18px",
                    padding: "24px",
                    boxShadow: "0 4px 12px rgba(16, 24, 40, 0.01)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "20px",
                  }}
                >
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#101828", margin: 0 }}>
                    Expense breakdown
                  </h3>
                  <p style={{ fontSize: "13px", color: "#8c9ba5", margin: "4px 0 0 0" }}>
                    Portfolio expenses sorted by category.
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "24px",
                  }}
                >
                  {/* Doughnut SVG */}
                  <div
                    style={{
                      width: "140px",
                      height: "140px",
                      position: "relative",
                    }}
                  >
                    <svg viewBox="0 0 100 100" width="100%" height="100%">
                      {expenseBreakdown.total === 0 ? (
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke="#f2f4f7"
                          strokeWidth="10"
                        />
                      ) : (
                        (() => {
                          let accumulatedPercentage = 0;
                          return expenseBreakdown.items.map((item, idx) => {
                            const offset =
                              (accumulatedPercentage / 100) * doughnutCircumference;
                            accumulatedPercentage += item.percentage;
                            return (
                              <circle
                                key={item.name}
                                cx="50"
                                cy="50"
                                r="45"
                                fill="none"
                                stroke={categoryColors[idx % categoryColors.length]}
                                strokeWidth="10"
                                strokeDasharray={`${((item.percentage / 100) * doughnutCircumference).toFixed(2)} ${doughnutCircumference}`}
                                strokeDashoffset={-offset}
                                transform="rotate(-90 50 50)"
                              />
                            );
                          });
                        })()
                      )}
                    </svg>
                  </div>

                  {/* Legend list */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      width: "100%",
                    }}
                  >
                    {expenseBreakdown.total === 0 ? (
                      <span style={{ fontSize: "14px", color: "#667085", textAlign: "center" }}>
                        No expense items recorded.
                      </span>
                    ) : (
                      expenseBreakdown.items.map((item, idx) => (
                        <div
                          key={item.name}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: "14px",
                            fontWeight: 500,
                            padding: "6px 0",
                            borderBottom: "1px dashed #eaeef4",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div
                              style={{
                                width: "12px",
                                height: "12px",
                                borderRadius: "3px",
                                backgroundColor:
                                  categoryColors[idx % categoryColors.length],
                              }}
                            />
                            <span style={{ color: "#344054" }}>{item.name}</span>
                          </div>
                          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                            <span style={{ color: "#667085" }}>
                              {formatCurrency(item.amount)}
                            </span>
                            <strong style={{ color: "#101828", minWidth: "35px", textAlign: "right" }}>
                              {item.percentage}%
                            </strong>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Top Performing Card */}
              <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #eaeef4",
                    borderRadius: "18px",
                    padding: "24px",
                    boxShadow: "0 4px 12px rgba(16, 24, 40, 0.01)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "20px",
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#101828", margin: 0 }}>
                      Top performing
                    </h3>
                    <p style={{ fontSize: "13px", color: "#8c9ba5", margin: "4px 0 0 0" }}>
                      By income - {timeFilter === "year" ? "This Year" : timeFilter === "quarter" ? "This Quarter" : "This Month"}
                    </p>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "4px" }}>
                    {topPerformingProperties.length === 0 ? (
                      <span style={{ fontSize: "14px", color: "#667085" }}>
                        No properties found.
                      </span>
                    ) : (
                      topPerformingProperties.map((item, idx) => (
                        <div
                          key={item.name}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingBottom: idx < topPerformingProperties.length - 1 ? "14px" : "0",
                            borderBottom: idx < topPerformingProperties.length - 1 ? "1px dashed #eaeef4" : "none",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                            {/* Rank Circle */}
                            <div
                              style={{
                                width: "26px",
                                height: "26px",
                                borderRadius: "50%",
                                backgroundColor: "#1b265c",
                                color: "#ffffff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "13px",
                                fontWeight: 700,
                              }}
                            >
                              {idx + 1}
                            </div>
                            <span style={{ fontSize: "15px", fontWeight: 600, color: "#101828" }}>
                              {item.name}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                            <span style={{ fontSize: "14px", color: "#667085", fontWeight: 500 }}>
                              {item.returnRate.toFixed(1)}%
                            </span>
                            <span
                              style={{
                                fontSize: "15px",
                                fontWeight: 700,
                                color: item.net >= 0 ? "#12b76a" : "#f04438",
                                minWidth: "65px",
                                textAlign: "right"
                              }}
                            >
                              {formatKCurrency(item.net)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
      </Skeleton>
    );
  }
