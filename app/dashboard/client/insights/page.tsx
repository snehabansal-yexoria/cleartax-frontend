"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Skeleton } from "boneyard-js/react";
import ClientInsightsSkeleton from "@/app/components/clients/ClientInsightsSkeleton";
import { logout } from "@/src/lib/logout";
import { getIdToken } from "@/src/lib/authToken";
import {
  formatCurrency as globalFormatCurrency,
  formatClientCurrency,
  formatClientPercent,
  toneClass,
} from "@/app/components/clients/CurrencyFormatter";
import type { CoreEntity } from "@/src/lib/coreApi";
import ClientDepreciationCard from "@/app/components/clients/ClientDepreciationCard";
import { usePortfolioSummary } from "@/app/components/usePortfolioSummary";
import { fetchCurrentUser, type CurrentUser } from "@/app/components/currentUser";
import RegionError from "@/app/components/ui/RegionError";
import {
  currentFinancialYear,
  fyShortLabel,
  monthAt,
  monthIndex,
  monthKey,
  monthShortLabel,
  percentChange,
  shiftMonth,
} from "@/app/components/clients/portfolioDashboard";

function titleCase(value: string) {
  if (!value) return "";
  return value
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

type TimeFilter = "year" | "quarter" | "month";

/** "YYYY-MM" keys from `from` to `to` inclusive (both month starts). */
function monthKeysBetween(from: Date, to: Date): string[] {
  const keys: string[] = [];
  for (let d = new Date(from.getFullYear(), from.getMonth(), 1); d <= to; d = shiftMonth(d, 1)) {
    keys.push(monthKey(d));
  }
  return keys;
}

/**
 * The window a period pill covers, and the window it is compared with — in
 * the Australian financial year (it used to be the calendar year).
 *
 *  year    FY to date (1 July → this month) vs the same months a year earlier
 *  quarter this FY quarter (Jul–Sep, Oct–Dec, Jan–Mar, Apr–Jun) vs the last one
 *  month   this month vs last month
 */
function periodWindows(filter: TimeFilter, now: Date) {
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (filter === "month") {
    return {
      current: [monthKey(thisMonth)],
      previous: [monthKey(shiftMonth(thisMonth, -1))],
    };
  }
  if (filter === "quarter") {
    // Calendar quarters line up with FY quarters (Jul, Oct, Jan, Apr).
    const start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    return {
      current: monthKeysBetween(start, shiftMonth(start, 2)),
      previous: monthKeysBetween(shiftMonth(start, -3), shiftMonth(start, -1)),
    };
  }
  const fyStart = new Date(currentFinancialYear(now) - 1, 6, 1);
  return {
    current: monthKeysBetween(fyStart, thisMonth),
    previous: monthKeysBetween(shiftMonth(fyStart, -12), shiftMonth(thisMonth, -12)),
  };
}

/**
 * A round axis top and evenly spaced ticks for `max`, so the labels describe
 * the bars. The axis used to be eight hardcoded labels ($14k…$0k) while the
 * bars were scaled to the data — a ~A$1M month sat under a "$14k" top label.
 */
function niceAxis(max: number, intervals: number): { top: number; ticks: number[] } {
  const safeMax = max > 0 ? max : 1;
  const rough = safeMax / intervals;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude;
  const top = step * intervals;
  return {
    top,
    ticks: Array.from({ length: intervals + 1 }, (_, i) => top - i * step),
  };
}

function formatAxisTick(value: number): string {
  if (value === 0) return "A$0";
  if (value >= 1_000_000) return `A$${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `A$${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `A$${Math.round(value)}`;
}

const PERIOD_LABEL: Record<TimeFilter, string> = {
  year: "Financial year to date",
  quarter: "This quarter",
  month: "This month",
};

const COMPARISON_LABEL: Record<TimeFilter, string> = {
  year: "vs same period last year",
  quarter: "vs last quarter",
  month: "vs last month",
};

export default function ClientInsightsPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // Interactive UI state
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('year');
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

  // The user (whose id keys the Portfolio Summary) and the properties (for
  // market values) load together. No transactions: every figure on this page
  // comes from the summary below.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        let token: string;
        try {
          token = await getIdToken();
        } catch {
          router.replace("/login/user");
          return;
        }

        const [userResult, entitiesResult] = await Promise.allSettled([
          fetchCurrentUser(token),
          fetch("/api/entities", { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (cancelled) return;

        if (userResult.status === "fulfilled") {
          setCurrentUser(userResult.value);
        } else {
          console.error("Failed to fetch current user:", userResult.reason);
        }

        if (entitiesResult.status === "fulfilled" && entitiesResult.value.ok) {
          const data = (await entitiesResult.value.json()) as { items?: CoreEntity[] };
          if (cancelled) return;
          setProperties((data.items || []).flatMap((entity: any) => entity.properties || []));
        } else {
          const data =
            entitiesResult.status === "fulfilled"
              ? await entitiesResult.value.json().catch(() => ({}))
              : {};
          if (cancelled) return;
          setErrorMessage(data.error || "Failed to load your entities.");
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
      : "";

  const getInitials = (value: string) => {
    if (!value) return "";
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
      : "";

  // ---------------------------------------------------------------------------
  // Figures: the Portfolio Summary for this financial year and the last (the
  // windows below can reach back before 1 July). Same aggregate as the home
  // and Reports pages — gross, each property's share, unreviewed excluded.
  // ---------------------------------------------------------------------------
  const clientId = currentUser?.id || null;
  const financialYear = currentFinancialYear();
  const summaryRegion = usePortfolioSummary(clientId, financialYear);
  const lastYearRegion = usePortfolioSummary(clientId, financialYear - 1);
  const summary = summaryRegion.data;
  const lastYearSummary = lastYearRegion.data;

  const monthsByKey = useMemo(() => monthIndex(lastYearSummary, summary), [lastYearSummary, summary]);
  const windows = useMemo(() => periodWindows(timeFilter, new Date()), [timeFilter]);

  const netOver = (keys: string[]) =>
    keys.reduce((sum, key) => {
      const m = monthAt(monthsByKey, key);
      return sum + m.income - m.expenses;
    }, 0);

  // Net Cash Flow for the selected period, and its change on the comparison
  // period (null — no badge — when either side is zero).
  const displayCashFlowMetrics = {
    currentNet: netOver(windows.current),
    trendPercentage: percentChange(netOver(windows.current), netOver(windows.previous)),
  };

  // Line chart: monthly net across the period. A single month has no shape,
  // so "This month" shows the six months leading up to it instead.
  const displayLineChartPoints = useMemo(() => {
    const now = new Date();
    const keys =
      timeFilter === "month"
        ? [5, 4, 3, 2, 1, 0].map((back) => monthKey(shiftMonth(now, -back)))
        : windows.current.filter((key) => key <= monthKey(now));
    const points = keys.map((key) => {
      const m = monthAt(monthsByKey, key);
      return m.income - m.expenses;
    });
    return points.length === 0 ? [0] : points;
  }, [monthsByKey, timeFilter, windows]);

  const displayLineChartSvg = useMemo(() => {
    const width = 340;
    const height = 90;
    const paddingX = 5;
    const paddingY = 15;
    const usableWidth = width - 2 * paddingX;
    const usableHeight = height - 2 * paddingY;

    const min = Math.min(...displayLineChartPoints);
    const max = Math.max(...displayLineChartPoints);
    const range = max - min === 0 ? 1 : max - min;

    const coords = displayLineChartPoints.map((p, idx) => {
      const x = displayLineChartPoints.length > 1
        ? paddingX + (idx / (displayLineChartPoints.length - 1)) * usableWidth
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
  }, [displayLineChartPoints]);

  // Income vs Expenses: the last six months, or a projection of the next six
  // at their average. The projection is a flat average and says so — it used
  // to add an invented sine-wave "seasonal variation".
  const displayBarChartData = useMemo(() => {
    const now = new Date();
    const history = [5, 4, 3, 2, 1, 0].map((back) => {
      const key = monthKey(shiftMonth(now, -back));
      const m = monthAt(monthsByKey, key);
      return { label: monthShortLabel(key), income: m.income, expense: m.expenses };
    });
    if (!showForecast) return history;

    const active = history.filter((m) => m.income > 0 || m.expense > 0);
    const avgIncome = active.length ? active.reduce((s, m) => s + m.income, 0) / active.length : 0;
    const avgExpense = active.length ? active.reduce((s, m) => s + m.expense, 0) / active.length : 0;
    return [1, 2, 3, 4, 5, 6].map((ahead) => ({
      label: monthShortLabel(monthKey(shiftMonth(now, ahead))),
      income: Math.round(avgIncome),
      expense: Math.round(avgExpense),
    }));
  }, [monthsByKey, showForecast]);

  // Mobile stacks income on expense, so it scales to the month's SUM; desktop
  // draws them side by side, so its axis is the larger of the two.
  const displayMaxMonthSum = Math.max(...displayBarChartData.map((d) => d.income + d.expense), 1);
  const barAxis = niceAxis(
    Math.max(...displayBarChartData.map((d) => Math.max(d.income, d.expense)), 0),
    7,
  );

  // Expense breakdown for the selected period, from the category × month
  // matrix — it used to ignore the period and sum every loaded row.
  const displayExpenseBreakdown = useMemo(() => {
    const inWindow = new Set(windows.current);
    const byCategory = new Map<string, number>();
    for (const cell of summary?.categoryMonths ?? []) {
      if (cell.type !== "expense" || !inWindow.has(cell.month)) continue;
      const name = cell.categoryName || "Uncategorised";
      byCategory.set(name, (byCategory.get(name) ?? 0) + cell.amount);
    }
    if (timeFilter === "year" || timeFilter === "quarter") {
      for (const cell of lastYearSummary?.categoryMonths ?? []) {
        if (cell.type !== "expense" || !inWindow.has(cell.month)) continue;
        const name = cell.categoryName || "Uncategorised";
        byCategory.set(name, (byCategory.get(name) ?? 0) + cell.amount);
      }
    }
    const total = Array.from(byCategory.values()).reduce((s, v) => s + v, 0);
    const categoriesArray = Array.from(byCategory.entries())
      .filter(([, amount]) => amount > 0)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    if (categoriesArray.length <= 3) {
      return { total, items: categoriesArray };
    }
    const items = categoriesArray.slice(0, 3);
    const otherAmount = categoriesArray.slice(3).reduce((sum, c) => sum + c.amount, 0);
    items.push({
      name: "Other",
      amount: otherAmount,
      percentage: total > 0 ? Math.round((otherAmount / total) * 100) : 0,
    });
    return { total, items };
  }, [summary, lastYearSummary, windows, timeFilter]);

  // Top performing: the summary has per-property totals for the financial
  // year only (no per-property months), so this card is the FY ranking
  // whatever pill is selected — and its label says so.
  const displayTopPerformingProperties = useMemo(() => {
    const valueById = new Map(properties.map((p) => [p.id as string, Number(p.estimatedMarketValue) || 0]));
    return (summary?.properties ?? [])
      .map((row) => {
        const value = row.marketValue ?? valueById.get(row.propertyId) ?? 0;
        return {
          name: row.name,
          income: row.income,
          net: row.netResult,
          returnRate: value > 0 ? (row.netResult / value) * 100 : 0,
        };
      })
      .sort((a, b) => b.income - a.income || b.returnRate - a.returnRate)
      .slice(0, 3);
  }, [summary, properties]);

  const formatKCurrency = (val: number) => {
    return formatClientCurrency(val, { short: true, showPlus: true, decimals: 1 });
  };

  // Doughnut Chart circle properties
  const doughnutCircumference = 282.743; // 2 * Math.PI * 45
  const categoryColors = ["#1b265c", "#f7a61a", "#12b76a", "#475467"];

  const formatCurrency = (val: number) => {
    return globalFormatCurrency(val, { decimals: 0 });
  };

  const trendPercentage = displayCashFlowMetrics.trendPercentage;
  const trendBadgeStyle =
    trendPercentage !== null && trendPercentage >= 0
      ? { background: "#ecfdf3", color: "#027a48" }
      : { background: "#fef3f2", color: "#b42318" };
  const trendLabel =
    trendPercentage !== null ? formatClientPercent(trendPercentage, { showPlus: true }) : "";
  const showTrendBadge = /[1-9]/.test(trendLabel);

  const periodLabel = PERIOD_LABEL[timeFilter];

  const figuresError =
    summaryRegion.status === "error"
      ? `Couldn't load your figures. ${summaryRegion.error ?? ""}`.trim()
      : "";
  const retryFigures = () => {
    summaryRegion.reload();
    lastYearRegion.reload();
  };
  // Hold the skeleton until the first summary arrives (no flash of zeros).
  const figuresLoading =
    isLoading || (clientId !== null && summaryRegion.status === "loading" && !summary);
  const topPerformingLabel = `By income · ${fyShortLabel(financialYear)}`;

  // Check if workspace is empty
  const isWorkspaceEmpty = properties.length === 0 && (summary?.totals.transactionCount ?? 0) === 0;

  if (isMobile) {
    return (
      <Skeleton
        name="client-insights-mobile"
        loading={figuresLoading}
        fallback={<ClientInsightsSkeleton />}
      >
        <div
          className="mobile-client-dashboard"
          style={{
            padding: "0 16px 90px 16px",
            background: "var(--surface-0)",
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

          {figuresError && (
            <div style={{ marginTop: "12px" }}>
              <RegionError message={figuresError} onRetry={retryFigures} />
            </div>
          )}

          {/* Time Filter Pills */}
          <div style={{ display: "flex", gap: "10px", margin: "16px 0 20px 0" }}>
            {[
              { label: "This FY", val: "year" },
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
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: "18px",
                padding: "32px 24px",
                textAlign: "center",
                boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
              }}
            >
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 10px 0" }}>
                No Analytics Data
              </h3>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.5, margin: "0 0 24px 0" }}>
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
                    border: "1px solid var(--border)",
                    background: "var(--surface-1)",
                    color: "var(--text-secondary)",
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
                  background: "var(--surface-1)",
                  border: "1px solid var(--border)",
                  borderRadius: "18px",
                  padding: "20px 20px 12px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0",
                  boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>
                    Net Cash Flow
                  </span>
                  {showTrendBadge && (
                    <span
                      className={`m-db-trend-badge ${toneClass(trendPercentage)}`}
                      title={COMPARISON_LABEL[timeFilter]}
                      style={{
                        ...trendBadgeStyle,
                        padding: "2px 8px",
                        borderRadius: "20px",
                        fontSize: "11px",
                        fontWeight: 600,
                      }}
                    >
                      {trendLabel}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: 700,
                    color: displayCashFlowMetrics.currentNet >= 0 ? "#12b76a" : "#f04438",
                    margin: "8px 0 12px 0",
                  }}
                >
                  {formatCurrency(displayCashFlowMetrics.currentNet)}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "-8px", marginBottom: "8px" }}>
                  {periodLabel}
                </div>

                {/* SVG Trend Line Chart */}
                <div style={{ width: "100%", height: "90px", marginTop: "4px" }}>
                  <svg
                    viewBox={`0 0 ${displayLineChartSvg.width} ${displayLineChartSvg.height}`}
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
                    {displayLineChartSvg.areaPath && (
                      <path d={displayLineChartSvg.areaPath} fill="url(#areaGradient)" />
                    )}
                    {displayLineChartSvg.linePath && (
                      <path
                        d={displayLineChartSvg.linePath}
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
                  background: "var(--surface-1)",
                  border: "1px solid var(--border)",
                  borderRadius: "18px",
                  padding: "20px",
                  boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
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
                        color: "var(--text-muted)",
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
                      color: "var(--text-secondary)",
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
                  {displayBarChartData.map((d) => {
                    const total = d.income + d.expense;
                    const barHeightPct = total > 0 ? (total / displayMaxMonthSum) * 100 : 0;
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
                              backgroundColor: "var(--brand)",
                            }}
                            title={`Income: ${formatCurrency(d.income)}`}
                          />
                          <div
                            className="m-db-chart-bar-expense"
                            style={{
                              height: `${expPct}%`,
                              backgroundColor: "var(--accent)",
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
                    background: "var(--border, #eaeef4)",
                    margin: "4px 0",
                  }}
                />

                <div
                  className="m-db-chart-legend"
                  style={{ display: "flex", gap: "16px", fontSize: "12px" }}
                >
                  <div className="m-db-legend-item" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div
                      className="m-db-legend-color income"
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "3px",
                        backgroundColor: "var(--brand)",
                      }}
                    />
                    <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>Income</span>
                  </div>
                  <div className="m-db-legend-item" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div
                      className="m-db-legend-color expense"
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "3px",
                        backgroundColor: "var(--accent)",
                      }}
                    />
                    <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>Expenses</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Expense breakdown */}
              <div
                className="m-db-stat-card"
                style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border)",
                  borderRadius: "18px",
                  padding: "20px",
                  boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
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
                      {displayExpenseBreakdown.total === 0 ? (
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
                          return displayExpenseBreakdown.items.map((item, idx) => {
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
                    {displayExpenseBreakdown.total === 0 ? (
                      <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                        No expense items recorded.
                      </span>
                    ) : (
                      displayExpenseBreakdown.items.map((item, idx) => (
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
                            <span style={{ color: "var(--text-secondary)" }}>{item.name}</span>
                          </div>
                          <strong style={{ color: "var(--text-primary)" }}>{item.percentage}%</strong>
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
                  background: "var(--surface-1)",
                  border: "1px solid var(--border)",
                  borderRadius: "18px",
                  padding: "20px",
                  boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                    Top performing
                  </h3>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
                    {topPerformingLabel}
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "4px" }}>
                  {displayTopPerformingProperties.length === 0 ? (
                    <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                      No properties found.
                    </span>
                  ) : (
                    displayTopPerformingProperties.map((item, idx) => (
                      <div
                        key={item.name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingBottom: idx < displayTopPerformingProperties.length - 1 ? "12px" : "0",
                          borderBottom: idx < displayTopPerformingProperties.length - 1 ? "1px solid var(--border)" : "none",
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
                          <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                            {item.name}
                          </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                          <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500 }}>
                            {formatClientPercent(item.returnRate)}
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
      loading={figuresLoading}
      fallback={<ClientInsightsSkeleton />}
    >
      <div className="desktop-client-dashboard">
        {/* Header */}
        <div className="insights-header-section">
          <p className="insights-kicker">Portfolio analytics</p>
          <h1 className="insights-title">Insights</h1>
        </div>

        {/* Filter Pills row */}
        <div className="insights-pills-row">
          {[
            { label: "This FY", val: "year" },
            { label: "This Quarter", val: "quarter" },
            { label: "This Month", val: "month" },
          ].map((p) => (
            <button
              key={p.val}
              type="button"
              onClick={() => setTimeFilter(p.val as any)}
              className={`insights-pill ${timeFilter === p.val ? "active" : "inactive"}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {errorMessage && (
          <p className="entity-wizard-error" style={{ marginBottom: "20px" }}>
            {errorMessage}
          </p>
        )}
        {figuresError && (
          <div style={{ marginBottom: "20px" }}>
            <RegionError message={figuresError} onRetry={retryFigures} />
          </div>
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
          <div className="insights-grid">
            {/* Card 1: Net Cash Flow */}
            <div className="insights-card area-cashflow">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                <div>
                  <span className="insights-card-title">Net Cash Flow</span>
                  <div className="insights-card-kicker">{periodLabel} · {COMPARISON_LABEL[timeFilter]}</div>
                </div>
                {showTrendBadge && (
                  <span
                    className={`trend-badge ${toneClass(trendPercentage)}`}
                    title={COMPARISON_LABEL[timeFilter]}
                    style={{
                      ...trendBadgeStyle,
                    }}
                  >
                    {trendLabel}
                  </span>
                )}
              </div>
              <div
                className="cashflow-value"
                style={{
                  color: displayCashFlowMetrics.currentNet >= 0 ? "#12b76a" : "#f04438",
                }}
              >
                {formatCurrency(displayCashFlowMetrics.currentNet)}
              </div>

              {/* SVG Line Chart */}
              <div style={{ width: "100%", height: "110px", marginTop: "auto" }}>
                <svg
                  viewBox={`0 0 ${displayLineChartSvg.width} ${displayLineChartSvg.height}`}
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
                  {displayLineChartSvg.areaPath && (
                    <path d={displayLineChartSvg.areaPath} fill="url(#areaGradientDesktop)" />
                  )}
                  {displayLineChartSvg.linePath && (
                    <path
                      d={displayLineChartSvg.linePath}
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
            <div className="insights-card area-income-expense">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <h3 className="insights-card-main-title">Income vs Expenses</h3>
                  <span className="insights-card-kicker">
                    {showForecast ? "Next 6 months" : "Last 6 months"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForecast((f) => !f)}
                  className="forecast-toggle-btn"
                >
                  {showForecast ? "Show last 6 months" : "Show next 6 months"}
                </button>
              </div>

              <div className="bar-chart-outer-container">
                {/* Y-Axis Labels */}
                <div className="chart-y-axis">
                  {barAxis.ticks.map((tick) => (
                    <span key={tick}>{formatAxisTick(tick)}</span>
                  ))}
                </div>

                {/* Grid and Bars wrapper */}
                <div className="chart-grid-and-bars-wrapper">
                  {/* Dashed Grid Lines */}
                  <div className="chart-grid-lines">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="chart-grid-line" />
                    ))}
                  </div>

                  {/* Columns */}
                  <div className="chart-bars-wrap">
                    {displayBarChartData.map((d) => {
                      // Scaled to the same rounded top the axis labels show.
                      const incomeHeightPct = d.income > 0 ? (d.income / barAxis.top) * 100 : 0;
                      const expenseHeightPct = d.expense > 0 ? (d.expense / barAxis.top) * 100 : 0;

                      return (
                        <div key={d.label} className="chart-month-column">
                          <div className="chart-bars-container">
                            <div
                              className="bar income-bar"
                              style={{ height: `${Math.max(incomeHeightPct, 2)}%` }}
                              title={`Income: ${formatCurrency(d.income)}`}
                            />
                            <div
                              className="bar expense-bar"
                              style={{ height: `${Math.max(expenseHeightPct, 2)}%` }}
                              title={`Expense: ${formatCurrency(d.expense)}`}
                            />
                          </div>
                          <span className="chart-month-label">{d.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="chart-legend-row">
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className="legend-color-box income-box" />
                  <span className="legend-label">Income</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className="legend-color-box expense-box" />
                  <span className="legend-label">Expenses</span>
                </div>
              </div>
            </div>

            {/* Card 3: Expense breakdown */}
            <div className="insights-card area-expense-breakdown">
              <div style={{ marginBottom: "20px" }}>
                <h3 className="insights-card-main-title">Expense breakdown</h3>
                <span className="insights-card-kicker">Where your money goes · {periodLabel.toLowerCase()}</span>
              </div>

              <div className="expense-breakdown-body">
                {/* Doughnut SVG */}
                <div className="donut-chart-wrapper">
                  <svg viewBox="0 0 100 100" width="100%" height="100%">
                    {displayExpenseBreakdown.total === 0 ? (
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
                        return displayExpenseBreakdown.items.map((item, idx) => {
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
                <div className="expense-legend-list">
                  {displayExpenseBreakdown.total === 0 ? (
                    <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                      No expense items recorded.
                    </span>
                  ) : (
                    displayExpenseBreakdown.items.map((item, idx) => (
                      <div key={item.name} className="expense-legend-row">
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            className="legend-color-dot"
                            style={{
                              backgroundColor: categoryColors[idx % categoryColors.length],
                            }}
                          />
                          <span className="legend-label">{item.name}</span>
                        </div>
                        <span className="legend-percentage">{item.percentage}%</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Card 4: Top performing */}
            <div className="insights-card area-top-performing">
              <div style={{ marginBottom: "20px" }}>
                <h3 className="insights-card-main-title">Top performing</h3>
                <span className="insights-card-kicker">{topPerformingLabel}</span>
              </div>

              <div className="top-performing-list">
                {displayTopPerformingProperties.length === 0 ? (
                  <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                    No properties found.
                  </span>
                ) : (
                  displayTopPerformingProperties.map((item, idx) => (
                    <div key={item.name} className="top-performing-row">
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div className="rank-circle">{idx + 1}</div>
                        <span className="property-name">{item.name}</span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                        <span className="yield-text">{formatClientPercent(item.returnRate)}</span>
                        <span className={`return-value ${toneClass(item.net)}`}>
                          {formatKCurrency(item.net)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Depreciation across the whole portfolio.
                Full width at the foot of the grid: it is a list rather than a
                chart, and it answers a different question from the four cards
                above — not "how did the year go" but "what is being claimed". */}
            {currentUser?.id && (
              <ClientDepreciationCard
                level="client"
                id={currentUser.id}
                showProperty
                className="insights-card area-depreciation"
                title="Depreciation"
              />
            )}
          </div>
        )}
      </div>
    </Skeleton>
  );
}
