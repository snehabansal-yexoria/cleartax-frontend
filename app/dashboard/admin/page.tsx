"use client";

import { Skeleton } from "boneyard-js/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PortalDashboardSkeleton } from "../../components/PortalSkeletons";
import { getSession } from "@/src/lib/session";
import "./admin.css";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

interface InvitedUser {
  id: string;
  email: string;
  role: string;
  status: string;
  name: string;
  organizationName: string;
  invitedByEmail: string;
  createdAt: string | null;
}

interface InvitedUsersResponse {
  summary: {
    total: number;
    pending: number;
    admins: number;
    accountants: number;
    clients: number;
    organizations: number;
  };
  users: InvitedUser[];
}

interface ToastMessage {
  id: string;
  title: string;
  desc: string;
  type: "success" | "info";
}

interface UnclassifiedTx {
  id: string;
  description: string;
  amount: string;
  date: string;
  client: string;
}

export default function AdminPage() {
  const [organizationName, setOrganizationName] = useState("");
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Toast System State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (title: string, desc: string, type: "success" | "info" = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((current) => [...current, { id, title, desc, type }]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 4000);
  };

  // Date Filtering State
  const [selectedDate, setSelectedDate] = useState("Jun 2026");
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);

  // SVG Chart Tooltip State
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Modals & Overlay Drawers State
  const [activeModal, setActiveModal] = useState<"review" | "invites" | "michael" | "accountant" | null>(null);
  const [selectedAccountant, setSelectedAccountant] = useState<any | null>(null);
  const [invitesSearch, setInvitesSearch] = useState("");

  // Interactive State for Unclassified Transactions
  const [unclassifiedTxs, setUnclassifiedTxs] = useState<UnclassifiedTx[]>([
    { id: "tx-1", description: "Property Rent Receipt - Unit 4B", amount: "$3,450.00", date: "2026-06-11", client: "Apex Holdings" },
    { id: "tx-2", description: "Maintenance & Plumbing Invoice #902", amount: "$850.00", date: "2026-06-10", client: "Blue Sky Trust" },
    { id: "tx-3", description: "Commercial Security Deposit", amount: "$5,200.00", date: "2026-06-08", client: "Vertex Capital" },
    { id: "tx-4", description: "Tax Advisory Filing Fee", amount: "$1,250.00", date: "2026-06-05", client: "Zenith Estates" },
  ]);
  const [txAssignee, setTxAssignee] = useState("Akash Sharma");

  // Dynamic state computed from API data
  const accountantCount = useMemo(
    () => invitedUsers.filter((user) => user.role === "accountant").length,
    [invitedUsers],
  );

  const clientCount = useMemo(
    () => invitedUsers.filter((user) => user.role === "client").length,
    [invitedUsers],
  );

  useEffect(() => {
    async function loadAdminDashboard() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;

        if (!session) {
          return;
        }

        const token = session.getIdToken().getJwtToken();

        const [orgRes, invitedRes] = await Promise.all([
          fetch("/api/users/me/organization", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/users/me/invited", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        if (orgRes.ok) {
          const data = await orgRes.json();
          setOrganizationName(data.organization?.name || "");
        }

        if (invitedRes.ok) {
          const data = (await invitedRes.json()) as InvitedUsersResponse;
          setInvitedUsers(data.users || []);
          setPendingCount(data.summary?.pending || 0);
        }
      } catch (error) {
        console.error("Failed to load admin dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadAdminDashboard();
  }, []);

  // Recalculated Stats based on Date Filter
  const statsMap: Record<string, any> = {
    "Jun 2026": { portfolio: "$94.2M", profit: "$2.7M", clients: 84, rate: "64%", ratio: "3,104 of 4,821 transactions", factor: 1.0 },
    "May 2026": { portfolio: "$91.8M", profit: "$2.4M", clients: 82, rate: "68%", ratio: "3,210 of 4,720 transactions", factor: 0.96 },
    "Apr 2026": { portfolio: "$89.5M", profit: "$2.1M", clients: 79, rate: "71%", ratio: "3,120 of 4,394 transactions", factor: 0.91 },
    "Mar 2026": { portfolio: "$85.4M", profit: "$1.8M", clients: 75, rate: "59%", ratio: "2,490 of 4,220 transactions", factor: 0.84 },
  };

  const activeStats = statsMap[selectedDate] || statsMap["Jun 2026"];

  // Revenue vs Expenses SVG Chart Data (base year figures)
  const chartMonths = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const baseRevenue = [440, 390, 340, 500, 480, 420, 280, 480, 610, 630, 690, 660];
  const baseExpenses = [280, 250, 210, 310, 300, 280, 190, 300, 380, 410, 440, 450];
  const baseNetProfit = [160, 140, 130, 190, 180, 140, 90, 180, 230, 220, 250, 210];

  // Adjust values based on the month factor
  const revenueData = baseRevenue.map((val) => Math.round(val * activeStats.factor));
  const expensesData = baseExpenses.map((val) => Math.round(val * activeStats.factor));
  const netProfitData = baseNetProfit.map((val) => Math.round(val * activeStats.factor));

  // CSV Generator & Download Trigger
  const handleExportReport = () => {
    addToast("Exporting Report", `Generating spreadsheet for ${selectedDate}...`, "info");

    setTimeout(() => {
      const csvRows = [
        ["ClearPortfolio Administrative Summary", `Period: ${selectedDate}`],
        ["Organization Name", organizationName || "Sunrise Accounting Co."],
        [],
        ["SUMMARY METRICS"],
        ["Total Portfolio Value", activeStats.portfolio],
        ["Net Profit (FY)", activeStats.profit],
        ["Active Clients count", activeStats.clients],
        ["Reconciliation Rate", activeStats.rate],
        ["Reconciled Transactions Volume", activeStats.ratio],
        [],
        ["ACCOUNTANT PERFORMANCE"],
        ["Accountant", "Role", "Clients Assigned", "Portfolio Value", "Transactions Logged", "Reconciliation %", "Last Active"],
        ["Akash Sharma", "Senior accountant", "11", "$18.4M", "842", "78%", "Today"],
        ["Satnam Singh", "Accountant", "9", "$13.7M", "614", "55%", "Yesterday"],
        ["Priya Rajan", "Accountant", "8", "$9.8M", "498", "82%", "Today"],
        ["Michael Chen", "Junior accountant", "5", "$4.1M", "213", "31%", "3 days ago"]
      ];

      const csvContent = "data:text/csv;charset=utf-8," 
        + csvRows.map((e) => e.map(val => `"${val}"`).join(",")).join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Sunrise_Accounting_Report_${selectedDate.replace(" ", "_")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addToast("Report Downloaded", `CSV report for ${selectedDate} exported successfully!`, "success");
    }, 1200);
  };

  // Assign Unclassified Transaction
  const handleAssignTx = (id: string, description: string) => {
    setUnclassifiedTxs((current) => current.filter((t) => t.id !== id));
    addToast("Transaction Assigned", `"${description}" assigned to ${txAssignee} successfully.`, "success");
  };

  // Resend Invite to User
  const handleResendInvite = (email: string) => {
    addToast("Invitation Resent", `Onboarding token resent to ${email}.`, "success");
  };

  // Request Workload Review
  const handleRequestReview = (name: string) => {
    addToast("Review Requested", `Performance notification dispatched to ${name}.`, "success");
    setActiveModal(null);
  };

  // Filtered db invites search list
  const filteredInvites = invitedUsers.filter((user) => {
    const q = invitesSearch.toLowerCase();
    return user.name?.toLowerCase().includes(q) || user.email?.toLowerCase().includes(q);
  });

  // Render SVG Chart Columns & Path
  const renderRevenueChart = () => {
    const chartHeight = 200;
    const chartWidth = 620;
    const xStart = 50;
    const yStart = 20;
    const barWidth = 10;
    const spacing = chartWidth / 12;

    const points = netProfitData.map((val, i) => {
      const x = xStart + i * spacing + spacing / 2;
      const y = yStart + chartHeight - (val / 700) * chartHeight;
      return `${x},${y}`;
    });
    const linePath = `M ${points.join(" L ")}`;

    return (
      <svg viewBox="0 0 700 260" width="100%" height="260" className="chart-svg-render">
        {/* Horizontal Grid Lines */}
        {[0, 100, 200, 300, 400, 500, 600, 700].map((val) => {
          const y = yStart + chartHeight - (val / 700) * chartHeight;
          return (
            <g key={val}>
              <line
                x1={xStart}
                y1={y}
                x2={xStart + chartWidth}
                y2={y}
                stroke="#F2F4F7"
                strokeWidth="1"
              />
              <text
                x={xStart - 10}
                y={y + 4}
                textAnchor="end"
                fill="#98A2B3"
                fontSize="11"
                fontWeight="500"
                fontFamily="Inter, sans-serif"
              >
                ${val}K
              </text>
            </g>
          );
        })}

        {/* Vertical Columns for Revenue & Expenses */}
        {chartMonths.map((month, i) => {
          const xCenter = xStart + i * spacing + spacing / 2;
          const revHeight = (revenueData[i] / 700) * chartHeight;
          const expHeight = (expensesData[i] / 700) * chartHeight;

          const revY = yStart + chartHeight - revHeight;
          const expY = yStart + chartHeight - expHeight;

          return (
            <g
              key={month}
              className="chart-interactive-group"
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const parentRect = e.currentTarget.ownerDocument.getElementById("revenue-chart-card")?.getBoundingClientRect();
                
                if (parentRect) {
                  setTooltipPos({
                    x: rect.left - parentRect.left + rect.width / 2,
                    y: rect.top - parentRect.top - 10
                  });
                }
                setHoveredMonthIndex(i);
              }}
              onMouseLeave={() => setHoveredMonthIndex(null)}
            >
              {/* Invisible trigger block for easier hovering */}
              <rect
                x={xCenter - spacing / 2}
                y={yStart}
                width={spacing}
                height={chartHeight}
                fill="transparent"
              />
              {/* Revenue Bar */}
              <rect
                x={xCenter - barWidth - 1}
                y={revY}
                width={barWidth}
                height={revHeight}
                fill="#039855"
                rx="2"
              />
              {/* Expenses Bar */}
              <rect
                x={xCenter + 1}
                y={expY}
                width={barWidth}
                height={expHeight}
                fill="#D92D20"
                rx="2"
              />
              {/* Month Text Label */}
              <text
                x={xCenter}
                y={yStart + chartHeight + 20}
                textAnchor="middle"
                fill="#667085"
                fontSize="12"
                fontWeight="500"
                fontFamily="Inter, sans-serif"
              >
                {month}
              </text>
            </g>
          );
        })}

        {/* Net Profit Line Connection */}
        <path
          d={linePath}
          fill="none"
          stroke="#1570EF"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Net Profit Dot Nodes */}
        {points.map((pt, i) => {
          const [x, y] = pt.split(",").map(Number);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="5"
              fill="#1570EF"
              stroke="#FFFFFF"
              strokeWidth="2"
            />
          );
        })}
      </svg>
    );
  };

  return (
    <Skeleton
      name="admin-dashboard"
      loading={isLoading}
      fallback={<PortalDashboardSkeleton />}
    >
      <div className="admin-dashboard-container">
        {/* Floating Toast Alerts */}
        <div className="admin-toast-container">
          {toasts.map((toast) => (
            <div key={toast.id} className="admin-toast-bubble">
              <div className={`toast-icon-circle ${toast.type}`}>
                {toast.type === "success" ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                )}
              </div>
              <div className="toast-content-wrapper">
                <div className="toast-title-text">{toast.title}</div>
                <div className="toast-desc-text">{toast.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Header bar */}
        <header className="admin-dashboard-header">
          <div className="admin-header-title">
            <h1>Good morning</h1>
            <p>Here's how {organizationName || "Sunrise Accounting Co."} is performing — FY 2025-26</p>
          </div>
          <div className="admin-header-actions">
            <button
              className="btn-header-action"
              type="button"
              onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
            >
              <svg viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {selectedDate}
            </button>

            {isDateDropdownOpen && (
              <div className="date-picker-dropdown">
                {["Jun 2026", "May 2026", "Apr 2026", "Mar 2026"].map((d) => (
                  <button
                    key={d}
                    className={`dropdown-option ${selectedDate === d ? "active" : ""}`}
                    type="button"
                    onClick={() => {
                      setSelectedDate(d);
                      setIsDateDropdownOpen(false);
                      addToast("Dashboard Filtered", `Displaying aggregated financials for ${d}.`, "info");
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}

            <button className="btn-header-action" type="button" onClick={handleExportReport}>
              <svg viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export report
            </button>
          </div>
        </header>

        {/* Stats 4-column overview */}
        <section className="admin-stats-grid">
          <article className="admin-stat-card">
            <h3 className="stat-card-kicker">TOTAL PORTFOLIO VALUE</h3>
            <strong className="stat-card-value">{activeStats.portfolio}</strong>
            <p className="stat-card-trend">
              <span className="trend-positive">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
                3.1%
              </span>
              <span className="trend-period">vs last quarter</span>
            </p>
          </article>

          <article className="admin-stat-card">
            <h3 className="stat-card-kicker">NET PROFIT (FY)</h3>
            <strong className="stat-card-value">{activeStats.profit}</strong>
            <p className="stat-card-trend">
              <span className="trend-positive">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
                12.4%
              </span>
              <span className="trend-period">vs FY 24-25</span>
            </p>
          </article>

          <article className="admin-stat-card">
            <h3 className="stat-card-kicker">ACTIVE CLIENTS</h3>
            <strong className="stat-card-value">{clientCount || activeStats.clients}</strong>
            <p className="stat-card-trend">
              <span className="trend-positive">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
                +6
              </span>
              <span className="trend-period">this month</span>
            </p>
          </article>

          <article className="admin-stat-card">
            <h3 className="stat-card-kicker">RECONCILIATION RATE</h3>
            <strong className="stat-card-value">{activeStats.rate}</strong>
            <p className="stat-card-trend">
              <span className="trend-period">{activeStats.ratio}</span>
            </p>
          </article>
        </section>

        {/* Charts & Snapshot 2-column section */}
        <section className="admin-two-col-grid">
          {/* Revenue Card */}
          <article className="admin-dashboard-card" id="revenue-chart-card">
            <div className="card-header-with-actions">
              <div className="card-title-group">
                <h2>Revenue vs expenses</h2>
                <p className="card-header-kicker">Monthly · AUD $K · FY 2025-26</p>
              </div>
              <div className="chart-legend-container">
                <div className="legend-item">
                  <span className="legend-color revenue" />
                  Revenue
                </div>
                <div className="legend-item">
                  <span className="legend-color expenses" />
                  Expenses
                </div>
                <div className="legend-item">
                  <span className="legend-color net-profit" />
                  Net profit
                </div>
              </div>
            </div>
            
            <div className="chart-svg-wrapper">
              {renderRevenueChart()}

              {/* Float Hover Tooltip bubble */}
              {hoveredMonthIndex !== null && (
                <div
                  className="chart-tooltip-bubble"
                  style={{
                    left: `${tooltipPos.x}px`,
                    top: `${tooltipPos.y}px`
                  }}
                >
                  <div className="chart-tooltip-month">{chartMonths[hoveredMonthIndex]} 2025-26</div>
                  <div className="chart-tooltip-row">
                    <span><span className="chart-tooltip-dot" style={{ backgroundColor: "#039855" }} />Revenue:</span>
                    <strong>${revenueData[hoveredMonthIndex]}K</strong>
                  </div>
                  <div className="chart-tooltip-row">
                    <span><span className="chart-tooltip-dot" style={{ backgroundColor: "#D92D20" }} />Expenses:</span>
                    <strong>${expensesData[hoveredMonthIndex]}K</strong>
                  </div>
                  <div className="chart-tooltip-row">
                    <span><span className="chart-tooltip-dot" style={{ backgroundColor: "#1570EF" }} />Net Profit:</span>
                    <strong>${netProfitData[hoveredMonthIndex]}K</strong>
                  </div>
                </div>
              )}
            </div>
          </article>

          {/* Org Snapshot Card */}
          <article className="admin-dashboard-card">
            <div className="card-header-with-actions">
              <div className="card-title-group">
                <h2>Org snapshot</h2>
              </div>
            </div>
            <div className="snapshot-list">
              <div className="snapshot-row">
                <span className="snapshot-label">Accountants</span>
                <div className="snapshot-value-group">
                  <span className="snapshot-count">{accountantCount || 12}</span>
                  <span className="snapshot-subtext">active</span>
                </div>
              </div>
              <div className="snapshot-row">
                <span className="snapshot-label">Clients</span>
                <div className="snapshot-value-group">
                  <span className="snapshot-count">{clientCount || 84}</span>
                  <span className="snapshot-subtext">registered</span>
                </div>
              </div>
              <div className="snapshot-row">
                <span className="snapshot-label">Properties</span>
                <div className="snapshot-value-group">
                  <span className="snapshot-count">218</span>
                </div>
              </div>
              <div className="snapshot-row">
                <span className="snapshot-label">Entities</span>
                <div className="snapshot-value-group">
                  <span className="snapshot-count">143</span>
                </div>
              </div>
              <div className="snapshot-row">
                <span className="snapshot-label">Transactions</span>
                <div className="snapshot-value-group">
                  <span className="snapshot-count">4,821</span>
                </div>
              </div>
              <div className="snapshot-row">
                <span className="snapshot-label">Documents</span>
                <div className="snapshot-value-group">
                  <span className="snapshot-count">1,094</span>
                </div>
              </div>
            </div>
          </article>
        </section>

        {/* Entity Progress & Property Status 2-column section */}
        <section className="admin-two-col-grid">
          {/* Portfolio by Entity Card */}
          <article className="admin-dashboard-card">
            <div className="card-header-with-actions">
              <div className="card-title-group">
                <h2>Portfolio by entity type</h2>
                <p className="card-header-kicker">$94.2M total</p>
              </div>
            </div>
            <div className="portfolio-entity-list">
              <div className="portfolio-entity-item">
                <div className="portfolio-entity-label-row">
                  <span className="entity-label-name">Discretionary trust</span>
                  <span className="entity-label-value">$32.4M · <span className="entity-label-clients">38 clients</span></span>
                </div>
                <div className="progress-bar-container">
                  <div className="progress-bar-fill progress-fill-purple" style={{ width: "80%" }} />
                </div>
              </div>

              <div className="portfolio-entity-item">
                <div className="portfolio-entity-label-row">
                  <span className="entity-label-name">Individual</span>
                  <span className="entity-label-value">$21.8M · <span className="entity-label-clients">26 clients</span></span>
                </div>
                <div className="progress-bar-container">
                  <div className="progress-bar-fill progress-fill-blue" style={{ width: "54%" }} />
                </div>
              </div>

              <div className="portfolio-entity-item">
                <div className="portfolio-entity-label-row">
                  <span className="entity-label-name">SMSF</span>
                  <span className="entity-label-value">$19.6M · <span className="entity-label-clients">18 clients</span></span>
                </div>
                <div className="progress-bar-container">
                  <div className="progress-bar-fill progress-fill-teal" style={{ width: "48%" }} />
                </div>
              </div>

              <div className="portfolio-entity-item">
                <div className="portfolio-entity-label-row">
                  <span className="entity-label-name">Company (Pty Ltd)</span>
                  <span className="entity-label-value">$11.2M · <span className="entity-label-clients">14 clients</span></span>
                </div>
                <div className="progress-bar-container">
                  <div className="progress-bar-fill progress-fill-lightblue" style={{ width: "28%" }} />
                </div>
              </div>

              <div className="portfolio-entity-item">
                <div className="portfolio-entity-label-row">
                  <span className="entity-label-name">Unit trust & partnership</span>
                  <span className="entity-label-value">$9.2M · <span className="entity-label-clients">16 clients</span></span>
                </div>
                <div className="progress-bar-container">
                  <div className="progress-bar-fill progress-fill-gray" style={{ width: "23%" }} />
                </div>
              </div>
            </div>
          </article>

          {/* Property Status Card */}
          <article className="admin-dashboard-card">
            <div className="card-header-with-actions">
              <div className="card-title-group">
                <h2>Property portfolio status</h2>
                <p className="card-header-kicker">218 properties</p>
              </div>
            </div>
            <div className="property-status-list">
              <div className="property-status-item">
                <div className="property-status-left">
                  <span className="status-dot-indicator status-dot-green" />
                  Rented
                </div>
                <div className="property-status-right">
                  94<span className="property-status-pct">43%</span>
                </div>
              </div>

              <div className="property-status-item">
                <div className="property-status-left">
                  <span className="status-dot-indicator status-dot-gray" />
                  Vacant
                </div>
                <div className="property-status-right">
                  52<span className="property-status-pct">24%</span>
                </div>
              </div>

              <div className="property-status-item">
                <div className="property-status-left">
                  <span className="status-dot-indicator status-dot-blue" />
                  Self-occupied
                </div>
                <div className="property-status-right">
                  38<span className="property-status-pct">17%</span>
                </div>
              </div>

              <div className="property-status-item">
                <div className="property-status-left">
                  <span className="status-dot-indicator status-dot-yellow" />
                  Available for rent
                </div>
                <div className="property-status-right">
                  18<span className="property-status-pct">8%</span>
                </div>
              </div>

              <div className="property-status-item">
                <div className="property-status-left">
                  <span className="status-dot-indicator status-dot-orange" />
                  Under renovation
                </div>
                <div className="property-status-right">
                  10<span className="property-status-pct">5%</span>
                </div>
              </div>

              <div className="property-status-item">
                <div className="property-status-left">
                  <span className="status-dot-indicator status-dot-red" />
                  Listed for sale
                </div>
                <div className="property-status-right">
                  6<span className="property-status-pct">3%</span>
                </div>
              </div>
            </div>
          </article>
        </section>

        {/* Accountant Performance Section */}
        <section className="performance-section">
          <div className="performance-header">
            <h2>Accountant performance</h2>
            <Link href="/dashboard/admin/old-ui" className="performance-view-all">
              View preserved old UI
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>
          <div className="performance-table-wrapper">
            <table className="performance-table">
              <thead>
                <tr>
                  <th>ACCOUNTANT</th>
                  <th>CLIENTS</th>
                  <th>PORTFOLIO VALUE</th>
                  <th>TRANSACTIONS</th>
                  <th>RECONCILED</th>
                  <th>LAST ACTIVE</th>
                </tr>
              </thead>
              <tbody>
                <tr onClick={() => {
                  setSelectedAccountant({ name: "Akash Sharma", role: "Senior accountant", clients: 11, value: "$18.4M", txs: 842, rate: 78, avatar: "AK", avatarClass: "avatar-blue", lastActive: "Today" });
                  setActiveModal("accountant");
                }}>
                  <td>
                    <div className="table-accountant-profile">
                      <div className="profile-avatar-circle avatar-blue">AK</div>
                      <div className="profile-details">
                        <span className="profile-name">Akash Sharma</span>
                        <span className="profile-role">Senior accountant</span>
                      </div>
                    </div>
                  </td>
                  <td><span className="table-text-bold">11</span></td>
                  <td><span className="table-text-bold">$18.4M</span></td>
                  <td><span>842</span></td>
                  <td>
                    <div className="reconciled-cell">
                      <div className="reconciled-progress-bar">
                        <div className="reconciled-progress-fill green" style={{ width: "78%", backgroundColor: "#12B76A" }} />
                      </div>
                      <span className="reconciled-percentage">78%</span>
                    </div>
                  </td>
                  <td>
                    <span className="badge-last-active today">Today</span>
                  </td>
                </tr>

                <tr onClick={() => {
                  setSelectedAccountant({ name: "Satnam Singh", role: "Accountant", clients: 9, value: "$13.7M", txs: 614, rate: 55, avatar: "SN", avatarClass: "avatar-teal", lastActive: "Yesterday" });
                  setActiveModal("accountant");
                }}>
                  <td>
                    <div className="table-accountant-profile">
                      <div className="profile-avatar-circle avatar-teal">SN</div>
                      <div className="profile-details">
                        <span className="profile-name">Satnam Singh</span>
                        <span className="profile-role">Accountant</span>
                      </div>
                    </div>
                  </td>
                  <td><span className="table-text-bold">9</span></td>
                  <td><span className="table-text-bold">$13.7M</span></td>
                  <td><span>614</span></td>
                  <td>
                    <div className="reconciled-cell">
                      <div className="reconciled-progress-bar">
                        <div className="reconciled-progress-fill yellow" style={{ width: "55%", backgroundColor: "#EAAA08" }} />
                      </div>
                      <span className="reconciled-percentage">55%</span>
                    </div>
                  </td>
                  <td>
                    <span className="badge-last-active yesterday">Yesterday</span>
                  </td>
                </tr>

                <tr onClick={() => {
                  setSelectedAccountant({ name: "Priya Rajan", role: "Accountant", clients: 8, value: "$9.8M", txs: 498, rate: 82, avatar: "PR", avatarClass: "avatar-purple", lastActive: "Today" });
                  setActiveModal("accountant");
                }}>
                  <td>
                    <div className="table-accountant-profile">
                      <div className="profile-avatar-circle avatar-purple">PR</div>
                      <div className="profile-details">
                        <span className="profile-name">Priya Rajan</span>
                        <span className="profile-role">Accountant</span>
                      </div>
                    </div>
                  </td>
                  <td><span className="table-text-bold">8</span></td>
                  <td><span className="table-text-bold">$9.8M</span></td>
                  <td><span>498</span></td>
                  <td>
                    <div className="reconciled-cell">
                      <div className="reconciled-progress-bar">
                        <div className="reconciled-progress-fill green" style={{ width: "82%", backgroundColor: "#12B76A" }} />
                      </div>
                      <span className="reconciled-percentage">82%</span>
                    </div>
                  </td>
                  <td>
                    <span className="badge-last-active today">Today</span>
                  </td>
                </tr>

                <tr onClick={() => {
                  setSelectedAccountant({ name: "Michael Chen", role: "Junior accountant", clients: 5, value: "$4.1M", txs: 213, rate: 31, avatar: "MC", avatarClass: "avatar-orange", lastActive: "3 days ago" });
                  setActiveModal("accountant");
                }}>
                  <td>
                    <div className="table-accountant-profile">
                      <div className="profile-avatar-circle avatar-orange">MC</div>
                      <div className="profile-details">
                        <span className="profile-name">Michael Chen</span>
                        <span className="profile-role">Junior accountant</span>
                      </div>
                    </div>
                  </td>
                  <td><span className="table-text-bold">5</span></td>
                  <td><span className="table-text-bold">$4.1M</span></td>
                  <td><span>213</span></td>
                  <td>
                    <div className="reconciled-cell">
                      <div className="reconciled-progress-bar">
                        <div className="reconciled-progress-fill red" style={{ width: "31%", backgroundColor: "#F04438" }} />
                      </div>
                      <span className="reconciled-percentage">31%</span>
                    </div>
                  </td>
                  <td>
                    <span className="badge-last-active days-ago">3 days ago</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Needs Attention Alert Section */}
        <section className="needs-attention-container">
          <h3 className="needs-attention-title">NEEDS ATTENTION</h3>

          <article className="alert-banner-card red">
            <div className="alert-banner-left">
              <h4 className="alert-banner-headline">{unclassifiedTxs.length ? "Unclassified Transactions Alert" : "Transactions Reconciled"}</h4>
              <p className="alert-banner-description">
                {unclassifiedTxs.length 
                  ? `There are ${unclassifiedTxs.length} unclassified bank feed records across active client accounts.`
                  : "All recent organization-scoped bank feed transactions have been reconciled successfully."}
              </p>
            </div>
            {unclassifiedTxs.length > 0 && (
              <button className="btn-alert-action" type="button" onClick={() => setActiveModal("review")}>
                Review ({unclassifiedTxs.length})
              </button>
            )}
          </article>

          <article className="alert-banner-card yellow">
            <div className="alert-banner-left">
              <h4 className="alert-banner-headline">{pendingCount || 13} clients pending registration</h4>
              <p className="alert-banner-description">Onboarding link tokens sent to clients but they have not yet logged in or accepted. Some tokens expired.</p>
            </div>
            <button className="btn-alert-action" type="button" onClick={() => setActiveModal("invites")}>
              View invites
            </button>
          </article>

          <article className="alert-banner-card orange">
            <div className="alert-banner-left">
              <h4 className="alert-banner-headline">Michael Chen — reconciliation rate below target (31%)</h4>
              <p className="alert-banner-description">Michael is assigned 213 properties transactions, but has completed reconciliation on only 66 this month.</p>
            </div>
            <button className="btn-alert-action" type="button" onClick={() => setActiveModal("michael")}>View profile</button>
          </article>
        </section>

        {/* ------------------- MODALS & DRAWERS DEFINITIONS ------------------- */}

        {/* 1. Unclassified Transactions Review Slide-over drawer */}
        {activeModal === "review" && (
          <div className="admin-modal-overlay" onClick={() => setActiveModal(null)}>
            <div className="admin-drawer-card" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h3>Unclassified Bank Feeds</h3>
                <button className="admin-modal-close-btn" onClick={() => setActiveModal(null)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="admin-modal-body">
                <p style={{ color: "#667085", fontSize: "13px" }}>Assign transactions below to an accountant to begin manual reconciliation matching.</p>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "#475467" }}>SELECT ASSIGNEE</label>
                  <select
                    className="modal-invites-search"
                    value={txAssignee}
                    onChange={(e) => setTxAssignee(e.target.value)}
                  >
                    <option value="Akash Sharma">Akash Sharma (Senior accountant)</option>
                    <option value="Satnam Singh">Satnam Singh (Accountant)</option>
                    <option value="Priya Rajan">Priya Rajan (Accountant)</option>
                    <option value="Michael Chen">Michael Chen (Junior accountant)</option>
                  </select>
                </div>

                <div className="modal-items-list" style={{ marginTop: "12px" }}>
                  <h4 className="modal-list-title">PENDING TRANSACTIONS</h4>
                  {unclassifiedTxs.map((tx) => (
                    <article className="modal-list-item-row" key={tx.id}>
                      <div className="modal-item-left">
                        <span className="modal-item-name">{tx.description}</span>
                        <span className="modal-item-sub">{tx.client} · {tx.date}</span>
                      </div>
                      <div className="modal-item-right" style={{ flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                        <span className="table-text-bold" style={{ color: "#B42318" }}>{tx.amount}</span>
                        <button
                          className="btn-alert-action"
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                          onClick={() => handleAssignTx(tx.id, tx.description)}
                        >
                          Assign
                        </button>
                      </div>
                    </article>
                  ))}
                  {unclassifiedTxs.length === 0 && (
                    <div style={{ textAlign: "center", padding: "32px", color: "#98A2B3" }}>No unclassified bank feeds remaining.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Database Invites modal */}
        {activeModal === "invites" && (
          <div className="admin-modal-overlay" onClick={() => setActiveModal(null)}>
            <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h3>Pending Client Registrations ({filteredInvites.length})</h3>
                <button className="admin-modal-close-btn" onClick={() => setActiveModal(null)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="admin-modal-body">
                <input
                  type="text"
                  placeholder="Search invited emails or names..."
                  className="modal-invites-search"
                  value={invitesSearch}
                  onChange={(e) => setInvitesSearch(e.target.value)}
                />
                
                <div className="modal-items-list" style={{ minHeight: "200px" }}>
                  <h4 className="modal-list-title">INVITATION SENT LOGS</h4>
                  {filteredInvites.map((user) => (
                    <div className="modal-list-item-row" key={user.id}>
                      <div className="modal-item-left">
                        <span className="modal-item-name">{user.name || "Unnamed Onboarding Contact"}</span>
                        <span className="modal-item-sub">{user.email}</span>
                      </div>
                      <div className="modal-item-right">
                        <span className="modal-badge-role">{user.role}</span>
                        <span className={`modal-badge-status ${user.status.toLowerCase() === "active" ? "active" : "pending"}`}>
                          {user.status}
                        </span>
                        <button
                          className="btn-alert-action"
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                          onClick={() => handleResendInvite(user.email)}
                        >
                          Resend
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredInvites.length === 0 && (
                    <div style={{ textAlign: "center", padding: "48px", color: "#98A2B3" }}>No matching invitation records.</div>
                  )}
                </div>
              </div>
              <div className="admin-modal-footer">
                <button className="btn-alert-action" onClick={() => setActiveModal(null)}>Close</button>
                <Link href="/dashboard/admin/invite" className="btn-alert-action" style={{ backgroundColor: "#1570EF", color: "#FFFFFF", borderColor: "#1570EF", textDecoration: 'none' }}>
                  Invite New Client
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* 3. Michael Chen detailed view */}
        {activeModal === "michael" && (
          <div className="admin-modal-overlay" onClick={() => setActiveModal(null)}>
            <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h3>Workload Audit: Michael Chen</h3>
                <button className="admin-modal-close-btn" onClick={() => setActiveModal(null)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="admin-modal-body">
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div className="profile-avatar-circle avatar-orange" style={{ width: "60px", height: "60px", fontSize: "20px" }}>MC</div>
                  <div>
                    <h4 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: "700" }}>Michael Chen</h4>
                    <p style={{ margin: 0, color: "#667085", fontSize: "13px" }}>Junior Accountant · Assigned since March 2026</p>
                  </div>
                </div>

                <div className="modal-stat-group">
                  <div className="modal-stat-item">
                    <span className="modal-stat-label">Assigned Clients</span>
                    <span className="modal-stat-value">5 clients</span>
                  </div>
                  <div className="modal-stat-item">
                    <span className="modal-stat-label">Reconciled Rate</span>
                    <span className="modal-stat-value" style={{ color: "#D92D20" }}>31%</span>
                  </div>
                  <div className="modal-stat-item">
                    <span className="modal-stat-label">Assigned Value</span>
                    <span className="modal-stat-value">$4.1M</span>
                  </div>
                </div>

                <div>
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: "700", color: "#475467" }}>PERFORMANCE OBSERVATIONS</h4>
                  <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#475467", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <li>Reconciliation has been completed on only 66 of 213 properties ledger transactions.</li>
                    <li>Organization-wide target threshold is set to 80% completion by end of the fiscal month.</li>
                    <li>Average response lag for client questions is currently 3.4 days.</li>
                  </ul>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button className="btn-alert-action" onClick={() => setActiveModal(null)}>Dismiss</button>
                <button
                  className="btn-alert-action"
                  style={{ backgroundColor: "#F04438", color: "#FFFFFF", borderColor: "#F04438" }}
                  onClick={() => handleRequestReview("Michael Chen")}
                >
                  Send Warnings Alert
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. Accountant work profile row-click modal */}
        {activeModal === "accountant" && selectedAccountant && (
          <div className="admin-modal-overlay" onClick={() => setActiveModal(null)}>
            <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h3>Accountant Profile View</h3>
                <button className="admin-modal-close-btn" onClick={() => setActiveModal(null)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="admin-modal-body">
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div className={`profile-avatar-circle ${selectedAccountant.avatarClass}`} style={{ width: "60px", height: "60px", fontSize: "20px" }}>
                    {selectedAccountant.avatar}
                  </div>
                  <div>
                    <h4 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: "700" }}>{selectedAccountant.name}</h4>
                    <p style={{ margin: 0, color: "#667085", fontSize: "13px" }}>{selectedAccountant.role} · Active in Org</p>
                  </div>
                </div>

                <div className="modal-stat-group">
                  <div className="modal-stat-item">
                    <span className="modal-stat-label">Assigned Clients</span>
                    <span className="modal-stat-value">{selectedAccountant.clients} clients</span>
                  </div>
                  <div className="modal-stat-item">
                    <span className="modal-stat-label">Reconciled Rate</span>
                    <span className="modal-stat-value" style={{ color: selectedAccountant.rate >= 75 ? "#039855" : selectedAccountant.rate >= 50 ? "#B54708" : "#D92D20" }}>
                      {selectedAccountant.rate}%
                    </span>
                  </div>
                  <div className="modal-stat-item">
                    <span className="modal-stat-label">Portfolio Value</span>
                    <span className="modal-stat-value">{selectedAccountant.value}</span>
                  </div>
                </div>

                <div>
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: "700", color: "#475467" }}>WORKLOAD METRICS</h4>
                  <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse", color: "#475467" }}>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid #F2F4F7" }}>
                        <td style={{ padding: "8px 0" }}>Total Logged Transactions:</td>
                        <td style={{ padding: "8px 0", fontWeight: "700", textAlign: "right" }}>{selectedAccountant.txs}</td>
                      </tr>
                      <tr style={{ borderBottom: "1px solid #F2F4F7" }}>
                        <td style={{ padding: "8px 0" }}>Last active status timestamp:</td>
                        <td style={{ padding: "8px 0", fontWeight: "700", textAlign: "right" }}>{selectedAccountant.lastActive}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "8px 0" }}>Avg Client Response Latency:</td>
                        <td style={{ padding: "8px 0", fontWeight: "700", textAlign: "right" }}>
                          {selectedAccountant.rate >= 75 ? "12 hrs" : selectedAccountant.rate >= 50 ? "1.2 days" : "3.4 days"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button className="btn-alert-action" onClick={() => setActiveModal(null)}>Close</button>
                <button
                  className="btn-alert-action"
                  style={{ backgroundColor: "#1570EF", color: "#FFFFFF", borderColor: "#1570EF" }}
                  onClick={() => {
                    addToast("Contact Dispatched", `Notification chat ping sent to ${selectedAccountant.name}.`, "success");
                    setActiveModal(null);
                  }}
                >
                  Send Direct Ping
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Skeleton>
  );
}
