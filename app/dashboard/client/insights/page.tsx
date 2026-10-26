"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "boneyard-js/react";
import ClientInsightsSkeleton from "@/app/components/clients/ClientInsightsSkeleton";
import { triggerClientLogout } from "../ClientLogoutAnimation";
import { getIdToken } from "@/src/lib/authToken";
import {
  formatCurrency as globalFormatCurrency,
  formatClientCurrency,
  formatExactCurrency,
  formatClientPercent,
  toneClass,
} from "@/app/components/clients/CurrencyFormatter";
import type { CoreEntity, CorePortfolioSummary } from "@/src/lib/coreApi";
import { usePortfolioSummary } from "@/app/components/usePortfolioSummary";
import type { AsyncRegion } from "@/app/components/useAsyncRegion";
import { toClientHoldings, type ClientHoldingEntity } from "@/app/components/useClientHoldings";
import { fetchCurrentUser, type CurrentUser } from "@/app/components/currentUser";
import RegionError from "@/app/components/ui/RegionError";
import FinancialYearPicker from "@/app/components/ui/FinancialYearPicker";
import ReportScopePicker from "@/app/components/reports/portfolio/ReportScopePicker";
import ClientSegmentedTabs, {
  SegmentedTabPanel,
  segmentedPanelProps,
} from "@/app/components/clients/ClientSegmentedTabs";
import ReportHub from "@/app/components/reports/client/ReportHub";
import { parseUuid } from "@/app/components/reports/portfolio/useReportSearchParams";
import {
  currentFinancialYear,
  monthAt,
  monthIndex,
  monthKey,
  monthShortLabel,
  percentChange,
  shiftMonth,
} from "@/app/components/clients/portfolioDashboard";
import {
  resolveInsightsPeriod,
  toIsoDate,
  validateCustomRange,
  type InsightsSelection,
} from "@/app/components/clients/insightsPeriod";

function titleCase(value: string) {
  if (!value) return "";
  return value
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/**
 * The latest figures for a region, kept on screen while the next period or
 * scope loads (the cards dim instead of collapsing to the skeleton, which
 * would also unmount the filter controls mid-edit). Never kept across an
 * error: a failed load shows "—", not the previous period's numbers.
 */
function useShownSummary(region: AsyncRegion<CorePortfolioSummary>): CorePortfolioSummary | null {
  const [last, setLast] = useState<CorePortfolioSummary | null>(region.data);
  if (region.data && region.data !== last) setLast(region.data);
  if (region.status === "error") return null;
  return region.data ?? last;
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

export default function ClientInsightsPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // The entity / property pickers' options, from the same /api/entities
  // read as `properties` (one request, not two).
  const [holdings, setHoldings] = useState<ClientHoldingEntity[]>([]);

  // Interactive UI state. One period selection (pill, FY dropdown or custom
  // range) and one scope; every change is a new summary request.
  const [selection, setSelection] = useState<InsightsSelection>({ kind: "fy-to-date" });
  const [scope, setScope] = useState<{ entityId: string | null; propertyId: string | null }>({
    entityId: null,
    propertyId: null,
  });
  const [fyPickerOpen, setFyPickerOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [customError, setCustomError] = useState("");
  const [showForecast, setShowForecast] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Phones: Insights | Reports (`?tab=reports`). The entity and property
  // pages' Reports buttons land on the Reports tab with `?entity=` /
  // `?property=` preselected for whichever report is opened.
  const searchParams = useSearchParams();
  const insightsTab: "insights" | "reports" =
    searchParams.get("tab") === "reports" ? "reports" : "insights";
  const reportsScope = {
    entityId: parseUuid(searchParams.get("entity")),
    propertyId: parseUuid(searchParams.get("property")),
  };
  const switchInsightsTab = (next: "insights" | "reports") => {
    router.replace(next === "reports" ? "/dashboard/client/insights?tab=reports" : "/dashboard/client/insights", {
      scroll: false,
    });
  };
  const reportsScopeName = reportsScope.propertyId
    ? holdings.flatMap((e) => e.properties).find((p) => p.id === reportsScope.propertyId)?.name ?? null
    : reportsScope.entityId
      ? holdings.find((e) => e.id === reportsScope.entityId)?.name ?? null
      : null;

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
          const items = data.items || [];
          setProperties(items.flatMap((entity: any) => entity.properties || []));
          setHoldings(toClientHoldings(items));
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
    triggerClientLogout();
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
  // Figures: the Portfolio Summary for exactly the selected window and scope
  // (?from=&to=, entity_id / property_id) — the same aggregate as the home
  // and Reports pages: gross, each property's share, unreviewed excluded.
  // Up to three reads: the window (every total, the breakdown, Top
  // Performing), the comparison window (the trend badge only) and, for a
  // window shorter than six months, the six months ending with it (the two
  // charts). The pills used to re-slice two preloaded years in the browser,
  // so they made no request at all.
  // ---------------------------------------------------------------------------
  const clientId = currentUser?.id || null;
  const financialYear = currentFinancialYear();
  const period = useMemo(() => resolveInsightsPeriod(selection, new Date()), [selection]);
  const { entityId, propertyId } = scope;

  const mainRegion = usePortfolioSummary(clientId, financialYear, entityId, propertyId, period.window);
  const comparisonRegion = usePortfolioSummary(clientId, financialYear, entityId, propertyId, period.comparison);
  const chartRegion = usePortfolioSummary(
    period.chartIsContext ? clientId : null,
    financialYear,
    entityId,
    propertyId,
    period.chartWindow,
  );
  const summary = useShownSummary(mainRegion);
  const comparisonSummary = useShownSummary(comparisonRegion);
  const contextSummary = useShownSummary(chartRegion);
  const chartSummary = period.chartIsContext ? contextSummary : summary;

  // A new period or scope is in flight: the cards dim on the last figures.
  const isRefreshing =
    mainRegion.status === "loading" ||
    (period.chartIsContext && chartRegion.status === "loading");

  const monthsByKey = useMemo(() => monthIndex(chartSummary), [chartSummary]);

  // Net Cash Flow for the window (income − expenses, before depreciation —
  // depreciation is no longer on this page), and its change on the
  // comparison window (null — no badge — when either side is zero).
  const currentNet = summary?.totals.cashFlow ?? 0;
  const displayCashFlowMetrics = {
    currentNet,
    trendPercentage:
      summary && comparisonSummary
        ? percentChange(currentNet, comparisonSummary.totals.cashFlow)
        : null,
  };

  // Line chart: monthly net across the chart window, up to this month.
  const displayLineChartPoints = useMemo(() => {
    const thisMonth = monthKey(new Date());
    const points = period.chartMonths
      .filter((key) => key <= thisMonth)
      .map((key) => {
        const m = monthAt(monthsByKey, key);
        return m.income - m.expenses;
      });
    return points.length === 0 ? [0] : points;
  }, [monthsByKey, period]);

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

  // Income vs Expenses: the chart window's months, or a projection of the
  // next six at their average. The projection is a flat average and says so,
  // and is offered only when the period runs to the present — projecting
  // forward from a past year means nothing.
  const canForecast = period.includesCurrentMonth;
  const forecasting = showForecast && canForecast;
  const displayBarChartData = useMemo(() => {
    const history = period.chartMonths.map((key) => {
      const m = monthAt(monthsByKey, key);
      return { key, label: monthShortLabel(key), income: m.income, expense: m.expenses };
    });
    if (!forecasting) return history;

    const thisMonth = monthKey(new Date());
    const active = history.filter((m) => m.key <= thisMonth && (m.income > 0 || m.expense > 0));
    const avgIncome = active.length ? active.reduce((s, m) => s + m.income, 0) / active.length : 0;
    const avgExpense = active.length ? active.reduce((s, m) => s + m.expense, 0) / active.length : 0;
    const now = new Date();
    return [1, 2, 3, 4, 5, 6].map((ahead) => {
      const key = monthKey(shiftMonth(now, ahead));
      return {
        key,
        label: monthShortLabel(key),
        income: Math.round(avgIncome),
        expense: Math.round(avgExpense),
      };
    });
  }, [monthsByKey, period, forecasting]);
  // Phones stack income on expense in narrow pills; past twelve bars they
  // stop fitting, so a long period shows its last twelve months there.
  const mobileBarChartData = displayBarChartData.slice(-12);
  const barChartSubtitle = forecasting
    ? "Next 6 months"
    : displayBarChartData.length > 12 && isMobile
      ? `Last 12 months · ${period.label}`
      : period.chartLabel;

  // Mobile stacks income on expense, so it scales to the month's SUM; desktop
  // draws them side by side, so its axis is the larger of the two.
  const displayMaxMonthSum = Math.max(...mobileBarChartData.map((d) => d.income + d.expense), 1);
  const barAxis = niceAxis(
    Math.max(...displayBarChartData.map((d) => Math.max(d.income, d.expense)), 0),
    7,
  );

  // Expense breakdown for exactly the window, from the summary's category
  // lines.
  const displayExpenseBreakdown = useMemo(() => {
    const categoriesArray = (summary?.expensesByCategory ?? [])
      .filter((line) => line.amount > 0)
      .map((line) => ({ name: line.categoryName || "Uncategorised", amount: line.amount }))
      .sort((a, b) => b.amount - a.amount);
    const total = categoriesArray.reduce((s, c) => s + c.amount, 0);
    const withPct = categoriesArray.map((c) => ({
      ...c,
      percentage: total > 0 ? Math.round((c.amount / total) * 100) : 0,
    }));

    if (withPct.length <= 3) {
      return { total, items: withPct };
    }
    const items = withPct.slice(0, 3);
    const otherAmount = withPct.slice(3).reduce((sum, c) => sum + c.amount, 0);
    items.push({
      name: "Other",
      amount: otherAmount,
      percentage: total > 0 ? Math.round((otherAmount / total) * 100) : 0,
    });
    return { total, items };
  }, [summary]);

  // Top performing: the window's per-property figures. "Net" is income −
  // expenses, like Net Cash Flow — depreciation is annual and is no longer
  // shown here, so it is not netted off a month or a fortnight.
  const displayTopPerformingProperties = useMemo(() => {
    const valueById = new Map(properties.map((p) => [p.id as string, Number(p.estimatedMarketValue) || 0]));
    return (summary?.properties ?? [])
      .map((row) => {
        const value = row.marketValue ?? valueById.get(row.propertyId) ?? 0;
        const net = row.income - row.expenses;
        return {
          name: row.name,
          income: row.income,
          net,
          returnRate: value > 0 ? (net / value) * 100 : 0,
        };
      })
      .sort((a, b) => b.income - a.income || b.returnRate - a.returnRate)
      .slice(0, 3);
  }, [summary, properties]);

  const formatKCurrency = (val: number) => {
    return formatExactCurrency(val, { showPlus: true });
  };

  // Doughnut Chart circle properties
  const doughnutCircumference = 282.743; // 2 * Math.PI * 45
  const categoryColors = ["#1b265c", "#f7a61a", "#12b76a", "#475467"];

  const formatCurrency = (val: number) => {
    return formatExactCurrency(val);
  };

  const trendPercentage = displayCashFlowMetrics.trendPercentage;
  const trendBadgeStyle =
    trendPercentage !== null && trendPercentage >= 0
      ? { background: "#ecfdf3", color: "#027a48" }
      : { background: "#fef3f2", color: "#b42318" };
  const trendLabel =
    trendPercentage !== null ? formatClientPercent(trendPercentage, { showPlus: true }) : "";
  const showTrendBadge = /[1-9]/.test(trendLabel);

  const periodLabel = period.label;
  const comparisonLabel = period.comparisonLabel;

  const regionError = (region: AsyncRegion<CorePortfolioSummary>) =>
    region.status === "error" ? region.error ?? "" : "";
  const figuresError =
    regionError(mainRegion) || (period.chartIsContext ? regionError(chartRegion) : "")
      ? `Couldn't load your figures. ${regionError(mainRegion) || regionError(chartRegion)}`.trim()
      : "";
  const retryFigures = () => {
    mainRegion.reload();
    comparisonRegion.reload();
    if (period.chartIsContext) chartRegion.reload();
  };
  // Hold the skeleton until the first summary arrives (no flash of zeros);
  // after that a change of period or scope dims the cards instead.
  const figuresLoading =
    isLoading || (clientId !== null && mainRegion.status === "loading" && !summary);
  const topPerformingLabel = `By income · ${periodLabel}`;

  // Check if workspace is empty
  const isWorkspaceEmpty = properties.length === 0 && (summary?.totals.transactionCount ?? 0) === 0;

  // ---------------------------------------------------------------------------
  // Period controls. The current FY in the dropdown is "This FY" (to date).
  // ---------------------------------------------------------------------------
  const selectedFy = selection.kind === "fy" ? selection.fy : financialYear;
  const fyYearOptions = [
    ...new Set<number>([financialYear, selectedFy, ...(summary?.availableFinancialYears ?? [])]),
  ].sort((a, b) => b - a);

  const choosePeriod = (next: InsightsSelection) => {
    setSelection(next);
    setCustomOpen(false);
    setCustomError("");
  };
  const chooseFinancialYear = (fy: number) =>
    choosePeriod(fy === financialYear ? { kind: "fy-to-date" } : { kind: "fy", fy });
  const openCustom = () => {
    setCustomFrom(period.window.from);
    setCustomTo(period.window.to > toIsoDate(new Date()) ? toIsoDate(new Date()) : period.window.to);
    setCustomError("");
    setCustomOpen(true);
  };
  const applyCustom = () => {
    const problem = validateCustomRange(customFrom, customTo);
    if (problem) {
      setCustomError(problem);
      return;
    }
    setSelection({ kind: "custom", from: customFrom, to: customTo });
    setCustomError("");
    setCustomOpen(false);
  };

  // The FY picker closes on any outside click (its button stops propagation).
  useEffect(() => {
    if (!fyPickerOpen) return;
    const close = () => setFyPickerOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [fyPickerOpen]);

  const PERIOD_PILLS: { label: string; kind: "fy-to-date" | "quarter" | "month" }[] = [
    { label: "This FY", kind: "fy-to-date" },
    { label: "This Quarter", kind: "quarter" },
    { label: "This Month", kind: "month" },
  ];

  /** Period pills, FY dropdown, custom range and scope — both layouts. */
  const renderFilters = (variant: "mobile" | "desktop") => (
    <div className={`insights-filters is-${variant}`}>
      <div className="insights-filters-row">
        {PERIOD_PILLS.map((p) => {
          const active = selection.kind === p.kind;
          return (
            <button
              key={p.kind}
              type="button"
              aria-pressed={active}
              onClick={() => choosePeriod({ kind: p.kind })}
              className={`insights-pill ${active ? "active" : "inactive"}`}
            >
              {p.label}
            </button>
          );
        })}
        <FinancialYearPicker
          value={selectedFy}
          onChange={chooseFinancialYear}
          isOpen={fyPickerOpen}
          setIsOpen={setFyPickerOpen}
          years={fyYearOptions}
        />
        <button
          type="button"
          aria-pressed={selection.kind === "custom"}
          aria-expanded={customOpen}
          onClick={() => (customOpen ? setCustomOpen(false) : openCustom())}
          className={`insights-pill ${selection.kind === "custom" ? "active" : "inactive"}`}
        >
          {selection.kind === "custom" ? periodLabel : "Custom range"}
        </button>
      </div>

      {customOpen && (
        <div className="insights-custom-range" role="group" aria-label="Custom date range">
          <label>
            <span>From</span>
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </label>
          <label>
            <span>To</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </label>
          <button type="button" className="insights-custom-apply" onClick={applyCustom}>
            Apply
          </button>
          {customError && (
            <p className="insights-custom-error" role="alert">
              {customError}
            </p>
          )}
        </div>
      )}

      <div className="insights-filters-row">
        <ReportScopePicker
          entities={holdings}
          entityId={entityId}
          propertyId={propertyId}
          onChange={setScope}
        />
        <span className="insights-filters-period" aria-live="polite">
          <span className="insights-filters-period-dot" aria-hidden="true" />
          {periodLabel}
          {isRefreshing ? " · Updating…" : ""}
        </span>
      </div>
    </div>
  );

  // The cards dim while a new period or scope loads.
  const refreshingStyle = {
    opacity: isRefreshing ? 0.55 : 1,
    transition: "opacity 0.15s ease",
  };

  if (isMobile) {
    const mobileShellStyle = {
      padding: "0 16px 90px 16px",
      background: "var(--surface-0)",
      minHeight: "100vh",
      fontFamily: "Inter, -apple-system, sans-serif",
    } as const;
    const mobileHeader = (
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
    );
    // The bottom nav stays at five tabs, so Reports lives inside Insights.
    const mobileTabs = (
      <ClientSegmentedTabs
        idBase="insights"
        label="Insights sections"
        tabs={[
          { id: "insights", label: "Insights" },
          { id: "reports", label: "Reports" },
        ]}
        value={insightsTab}
        onChange={switchInsightsTab}
        className="mb-4"
      />
    );

    if (insightsTab === "reports") {
      return (
        <div className="mobile-client-dashboard" style={mobileShellStyle}>
          {mobileHeader}
          {mobileTabs}
          <SegmentedTabPanel idBase="insights" tabId="reports" className="cp-report">
            <ReportHub
              variant="list"
              scope={reportsScope}
              scopeName={reportsScopeName}
              clearHref="/dashboard/client/insights?tab=reports"
            />
          </SegmentedTabPanel>
        </div>
      );
    }

    return (
      <Skeleton
        name="client-insights-mobile"
        loading={figuresLoading}
        fallback={<ClientInsightsSkeleton />}
      >
        <div className="mobile-client-dashboard" style={mobileShellStyle}>
          {mobileHeader}
          {mobileTabs}
          <div {...segmentedPanelProps("insights", "insights")}>
            {figuresError && (
              <div style={{ marginTop: "12px" }}>
                <RegionError message={figuresError} onRetry={retryFigures} />
              </div>
            )}

            {/* Period (pills, FY, custom range) and scope */}
            {renderFilters("mobile")}

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
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", ...refreshingStyle }} aria-busy={isRefreshing}>
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
                        title={comparisonLabel}
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
                        <span>{barChartSubtitle}</span>
                      </div>
                    </div>
                    {canForecast && (
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
                      {forecasting ? "Show recorded months" : "Show next 6 months"}
                    </button>
                    )}
                  </div>

                  {/* Stacked columns wrapper (narrow pills past six months) */}
                  <div className={`m-db-chart-bars-wrap${mobileBarChartData.length > 6 ? " is-fy" : ""}`}>
                    {mobileBarChartData.map((d) => {
                      const total = d.income + d.expense;
                      const barHeightPct = total > 0 ? (total / displayMaxMonthSum) * 100 : 0;
                      const incPct = total > 0 ? (d.income / total) * 100 : 0;
                      const expPct = total > 0 ? (d.expense / total) * 100 : 0;

                      return (
                        <div key={d.key} className="m-db-chart-bar-container">
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

        {/* Period (pills, FY, custom range) and scope */}
        {renderFilters("desktop")}

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
          <div className="insights-grid" style={refreshingStyle} aria-busy={isRefreshing}>
            {/* Card 1: Net Cash Flow */}
            <div className="insights-card area-cashflow">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                <div>
                  <span className="insights-card-title">Net Cash Flow</span>
                  <div className="insights-card-kicker">{periodLabel} · {comparisonLabel}</div>
                </div>
                {showTrendBadge && (
                  <span
                    className={`trend-badge ${toneClass(trendPercentage)}`}
                    title={comparisonLabel}
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
                    {barChartSubtitle}
                  </span>
                </div>
                {canForecast && (
                <button
                  type="button"
                  onClick={() => setShowForecast((f) => !f)}
                  className="forecast-toggle-btn"
                >
                  {forecasting ? "Show recorded months" : "Show next 6 months"}
                </button>
                )}
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
                        <div key={d.key} className="chart-month-column">
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

          </div>
        )}
      </div>
    </Skeleton>
  );
}
