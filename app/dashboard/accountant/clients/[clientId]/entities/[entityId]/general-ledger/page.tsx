"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getSession } from "@/src/lib/session";
import { StaticSelect } from "@/app/components/TransactionsFeature";
import { TableRowsSkeleton } from "@/app/components/PortalSkeletons";
import type { CoreChartAccount, CoreGeneralLedger } from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): { getJwtToken(): string };
}

function currentFinancialYear(): number {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

export default function GeneralLedgerPage() {
  const params = useParams<{ clientId: string; entityId: string }>();
  const router = useRouter();
  const clientId = params?.clientId ?? "";
  const entityId = params?.entityId ?? "";

  const [token, setToken] = useState("");
  const [ledger, setLedger] = useState<CoreGeneralLedger | null>(null);
  const [accounts, setAccounts] = useState<CoreChartAccount[]>([]);
  const [financialYear, setFinancialYear] = useState(currentFinancialYear());
  const [accountCode, setAccountCode] = useState("");
  const [source, setSource] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyExport, setBusyExport] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Check user session
  useEffect(() => {
    (async () => {
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) {
        router.replace("/login/user");
        return;
      }
      setToken(session.getIdToken().getJwtToken());
    })();
  }, [router]);

  // Load chart of accounts
  useEffect(() => {
    if (!token) return;
    (async () => {
      const res = await fetch("/api/chart-of-accounts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAccounts(Array.isArray(data.items) ? data.items : []);
      }
    })();
  }, [token]);

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("financial_year", String(financialYear));
    if (accountCode) sp.set("account_code", accountCode);
    if (source !== "all") sp.set("source", source);
    return sp.toString();
  }, [financialYear, accountCode, source]);

  // Fetch ledger data
  useEffect(() => {
    if (!token || !entityId) return;
    const controller = new AbortController();

    (async () => {
      setIsLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/entities/${encodeURIComponent(entityId)}/general-ledger?${query}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body?.message || body?.error || "Could not load the general ledger.",
          );
        }
        setLedger(await res.json());
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setError((err as Error)?.message ?? "Could not load the general ledger.");
        setLedger(null);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [token, entityId, query]);

  const exportAs = async (format: "csv" | "xlsx" | "pdf") => {
    setBusyExport(format);
    setError("");
    try {
      const res = await fetch(
        `/api/entities/${encodeURIComponent(entityId)}/general-ledger/export?${query}&format=${format}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message || body?.error || "The export failed.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `general-ledger-FY${financialYear}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error)?.message ?? "The export failed.");
    } finally {
      setBusyExport(null);
    }
  };

  const years = Array.from({ length: 6 }, (_, i) => currentFinancialYear() - i);

  const yearOptions = useMemo(
    () =>
      years.map((y) => ({
        label: `FY${y - 1}–${String(y).slice(2)}`,
        value: String(y),
      })),
    [years],
  );

  const accountOptions = useMemo(
    () => [
      { label: "All accounts", value: "" },
      ...accounts.map((a) => ({
        label: `${a.accountCode} · ${a.accountName}`,
        value: a.accountCode,
      })),
    ],
    [accounts],
  );

  const sourceOptions = useMemo(
    () => [
      { label: "Journals and transactions", value: "all" },
      { label: "Journals only", value: "journal" },
      { label: "Transactions only", value: "transaction" },
    ],
    [],
  );

  const backHref = `/dashboard/accountant/clients/${clientId}/entities/${entityId}?tab=journal`;
  const backLabel = ledger?.scope.name || "Entity";

  const allAccountsCount = ledger?.accounts.length ?? 0;
  const allCollapsed = allAccountsCount > 0 && collapsed.size === allAccountsCount;

  const toggleAll = useCallback(() => {
    if (!ledger) return;
    if (collapsed.size === ledger.accounts.length) {
      setCollapsed(new Set());
    } else {
      setCollapsed(new Set(ledger.accounts.map((a) => a.accountCode)));
    }
  }, [collapsed.size, ledger]);

  const toggleAccount = useCallback((code: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }, []);

  return (
    <div className="journal-page general-ledger-page">
      <header className="journal-page-head">
        <Link href={backHref} className="entity-wizard-back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {backLabel}
        </Link>
        <h1>General Ledger</h1>
        <p className="journal-page-sub">
          {ledger?.period.label ?? `FY${financialYear}`} · every debit and credit
          against each account
        </p>
      </header>

      <div className="journal-list-filters">
        <div className="journal-filter-field">
          <span className="journal-filter-field-label">Financial year</span>
          <StaticSelect
            value={String(financialYear)}
            options={yearOptions}
            onChange={(val) => setFinancialYear(Number(val))}
          />
        </div>

        <div className="journal-filter-field journal-filter-account">
          <span className="journal-filter-field-label">Account</span>
          <StaticSelect
            value={accountCode}
            options={accountOptions}
            onChange={(val) => setAccountCode(val)}
            showSearch={true}
            placeholder="All accounts"
          />
        </div>

        <div className="journal-filter-field">
          <span className="journal-filter-field-label">Source</span>
          <StaticSelect
            value={source}
            options={sourceOptions}
            onChange={(val) => setSource(val)}
          />
        </div>

        <div className="journal-filter-actions-end">
          {ledger && ledger.accounts.length > 0 && (
            <button
              type="button"
              className="journal-toggle-all-btn"
              onClick={toggleAll}
            >
              {allCollapsed ? "Expand all" : "Collapse all"}
            </button>
          )}

          <div className="journal-export-row">
            <button
              type="button"
              className="journal-export-btn"
              disabled={busyExport !== null || isLoading || !ledger}
              onClick={() => void exportAs("csv")}
              title="Export General Ledger as CSV"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {busyExport === "csv" ? "Exporting…" : "CSV"}
            </button>
            <button
              type="button"
              className="journal-export-btn"
              disabled={busyExport !== null || isLoading || !ledger}
              onClick={() => void exportAs("xlsx")}
              title="Export General Ledger as XLSX"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {busyExport === "xlsx" ? "Exporting…" : "XLSX"}
            </button>
            <button
              type="button"
              className="journal-export-btn"
              disabled={busyExport !== null || isLoading || !ledger}
              onClick={() => void exportAs("pdf")}
              title="Export General Ledger as PDF"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {busyExport === "pdf" ? "Exporting…" : "PDF"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="entity-wizard-error" role="alert" style={{ marginTop: "16px" }}>
          {error}
        </div>
      )}

      {isLoading && (
        <div style={{ marginTop: "20px" }}>
          <div className="gl-skeleton-card">
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <div style={{ width: "24px", height: "24px", borderRadius: "4px", background: "#f1f5f9" }} />
              <div style={{ width: "220px", height: "20px", borderRadius: "4px", background: "#f1f5f9" }} />
              <div style={{ width: "80px", height: "20px", borderRadius: "999px", background: "#f1f5f9" }} />
              <div style={{ marginLeft: "auto", width: "180px", height: "20px", borderRadius: "4px", background: "#f1f5f9" }} />
            </div>
            <div className="journal-grid-wrap" style={{ marginTop: "12px" }}>
              <table className="journal-grid">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Source</th>
                    <th scope="col">Reference</th>
                    <th scope="col">Description</th>
                    <th scope="col">Contra</th>
                    <th scope="col">GST code</th>
                    <th scope="col" className="is-numeric">Debit</th>
                    <th scope="col" className="is-numeric">Credit</th>
                    <th scope="col" className="is-numeric">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <TableRowsSkeleton rows={4} columns={9} />
                </tbody>
              </table>
            </div>
          </div>
          <div className="gl-skeleton-card">
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <div style={{ width: "24px", height: "24px", borderRadius: "4px", background: "#f1f5f9" }} />
              <div style={{ width: "200px", height: "20px", borderRadius: "4px", background: "#f1f5f9" }} />
              <div style={{ width: "80px", height: "20px", borderRadius: "999px", background: "#f1f5f9" }} />
              <div style={{ marginLeft: "auto", width: "160px", height: "20px", borderRadius: "4px", background: "#f1f5f9" }} />
            </div>
          </div>
        </div>
      )}

      {!isLoading && ledger && (
        <>
          {/*
            This is deliberately not called a Trial Balance. Ordinary
            transactions post only their P&L leg — there is no cash or GST
            contra for them — so debits and credits do not foot to zero. The gap
            is shown rather than hidden.
          */}
          <div
            className="journal-hint is-info"
            style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginTop: "16px" }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: "18px", height: "18px", flexShrink: 0, marginTop: "2px" }}
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div>
              <strong>Account activity, not a trial balance.</strong> Only journal
              entries carry both sides, so debits and credits do not balance
              across all accounts. The difference of{" "}
              <strong>A$ {Math.abs(ledger.unbalancedBy).toFixed(2)}</strong> is
              the value of activity recorded without a matching contra entry.
              Dates are invoice dates (accruals basis).
              {ledger.unmappedRowCount > 0 && (
                <>
                  {" "}
                  <strong>{ledger.unmappedRowCount}</strong> transactions are not
                  shown because their category has no account code.
                </>
              )}
            </div>
          </div>

          {ledger.accounts.length === 0 && (
            <p className="transactions-empty-state" style={{ padding: "48px 16px", textAlign: "center" }}>
              No activity in this period.
            </p>
          )}

          {ledger.accounts.map((account) => {
            const isCollapsed = collapsed.has(account.accountCode);
            return (
              <section
                className={`gl-account${isCollapsed ? " is-collapsed" : ""}`}
                key={account.accountCode}
              >
                <header
                  className="gl-account-head"
                  onClick={() => toggleAccount(account.accountCode)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={!isCollapsed}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleAccount(account.accountCode);
                    }
                  }}
                >
                  <button
                    type="button"
                    className="journal-expand-button"
                    aria-expanded={!isCollapsed}
                    aria-label={`${isCollapsed ? "Expand" : "Collapse"} account ${account.accountCode}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAccount(account.accountCode);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "24px",
                      height: "24px",
                      padding: 0,
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      style={{
                        width: "16px",
                        height: "16px",
                        transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                        transition: "transform 0.15s ease",
                      }}
                    >
                      <polyline
                        points="6 9 12 15 18 9"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <h2>
                    {account.accountCode} · {account.accountName}
                  </h2>
                  <span className={`journal-account-chip is-${account.category}`}>
                    {account.category}
                  </span>
                  {account.openingBalanceBasis === "reset_annually" && (
                    <span className="gl-account-note">
                      Resets each financial year
                    </span>
                  )}
                  <span className="gl-account-balance">
                    Opening <strong>A$ {account.openingBalance.toFixed(2)}</strong> · Closing{" "}
                    <strong>A$ {account.closingBalance.toFixed(2)}</strong>
                  </span>
                </header>

                {!isCollapsed && (
                  <div className="journal-grid-wrap">
                    <table className="journal-grid">
                      <thead>
                        <tr>
                          <th scope="col">Date</th>
                          <th scope="col">Source</th>
                          <th scope="col">Reference</th>
                          <th scope="col">Description</th>
                          <th scope="col">Contra</th>
                          <th scope="col">GST code</th>
                          <th scope="col" className="is-numeric">Debit</th>
                          <th scope="col" className="is-numeric">Credit</th>
                          <th scope="col" className="is-numeric">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {account.rows.map((row) => (
                          <tr key={`${row.sourceKind}-${row.sourceId}`}>
                            <td>{row.date}</td>
                            <td>
                              <span className="journal-status-chip">
                                {row.sourceKind === "journal" ? "Journal" : "Transaction"}
                              </span>
                              {row.isAssetPurchase && (
                                <span
                                  className="journal-status-chip is-warning"
                                  title="Capital purchase: shown here in full, but the P&L shows depreciation instead"
                                >
                                  Capital
                                </span>
                              )}
                            </td>
                            <td>{row.reference || "—"}</td>
                            <td>{row.description || "—"}</td>
                            <td>{row.contraAccounts.join(", ") || "—"}</td>
                            <td>{row.gstCode || "—"}</td>
                            <td className="is-numeric">
                              {row.debit ? row.debit.toFixed(2) : "—"}
                            </td>
                            <td className="is-numeric">
                              {row.credit ? row.credit.toFixed(2) : "—"}
                            </td>
                            <td className="is-numeric">{row.balance.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={6}>Closing balance</td>
                          <td className="is-numeric">{account.debits.toFixed(2)}</td>
                          <td className="is-numeric">{account.credits.toFixed(2)}</td>
                          <td className="is-numeric">
                            {account.closingBalance.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
