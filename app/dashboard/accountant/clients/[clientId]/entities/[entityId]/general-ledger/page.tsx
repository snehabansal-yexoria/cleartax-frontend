"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getSession } from "@/src/lib/session";
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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

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
  };

  const backHref = `/dashboard/accountant/clients/${clientId}/entities/${entityId}?tab=journal`;
  const years = Array.from({ length: 6 }, (_, i) => currentFinancialYear() - i);

  return (
    <div className="journal-page general-ledger-page">
      <header className="journal-page-head">
        <Link href={backHref} className="entity-wizard-back">
          ← {ledger?.scope.name || "Entity"}
        </Link>
        <h1>General Ledger</h1>
        <p className="journal-page-sub">
          {ledger?.period.label ?? `FY${financialYear}`} · every debit and credit
          against each account
        </p>
      </header>

      <div className="journal-list-filters">
        <label>
          <span>Financial year</span>
          <select
            value={financialYear}
            onChange={(e) => setFinancialYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                FY{y - 1}–{String(y).slice(2)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Account</span>
          <select
            value={accountCode}
            onChange={(e) => setAccountCode(e.target.value)}
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.accountCode}>
                {a.accountCode} · {a.accountName}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Source</span>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">Journals and transactions</option>
            <option value="journal">Journals only</option>
            <option value="transaction">Transactions only</option>
          </select>
        </label>

        <div className="journal-export-row">
          <button type="button" onClick={() => void exportAs("csv")}>CSV</button>
          <button type="button" onClick={() => void exportAs("xlsx")}>XLSX</button>
          <button type="button" onClick={() => void exportAs("pdf")}>PDF</button>
        </div>
      </div>

      {error && <div className="entity-wizard-error">{error}</div>}

      {ledger && (
        <>
          {/*
            This is deliberately not called a Trial Balance. Ordinary
            transactions post only their P&L leg — there is no cash or GST
            contra for them — so debits and credits do not foot to zero. The gap
            is shown rather than hidden.
          */}
          <div className="journal-hint is-info">
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

          {isLoading && <p className="journal-hint">Loading…</p>}

          {!isLoading && ledger.accounts.length === 0 && (
            <p className="transactions-empty-state">
              No activity in this period.
            </p>
          )}

          {ledger.accounts.map((account) => {
            const isCollapsed = collapsed.has(account.accountCode);
            return (
              <section className="gl-account" key={account.accountCode}>
                <header className="gl-account-head">
                  <button
                    type="button"
                    className="journal-expand-button"
                    aria-expanded={!isCollapsed}
                    onClick={() =>
                      setCollapsed((prev) => {
                        const next = new Set(prev);
                        if (next.has(account.accountCode)) {
                          next.delete(account.accountCode);
                        } else {
                          next.add(account.accountCode);
                        }
                        return next;
                      })
                    }
                  >
                    {isCollapsed ? "▸" : "▾"}
                  </button>
                  <h2>
                    {account.accountCode} · {account.accountName}
                  </h2>
                  <span className={`journal-account-chip is-${account.category}`}>
                    {account.category}
                  </span>
                  <span className="gl-account-balance">
                    Opening A$ {account.openingBalance.toFixed(2)} · Closing A${" "}
                    {account.closingBalance.toFixed(2)}
                  </span>
                  {account.openingBalanceBasis === "reset_annually" && (
                    <span className="gl-account-note">
                      Resets each financial year
                    </span>
                  )}
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
