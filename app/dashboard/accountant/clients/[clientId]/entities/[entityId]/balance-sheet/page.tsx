"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getSession } from "@/src/lib/session";
import { StaticSelect } from "@/app/components/TransactionsFeature";
import BalanceSheetReport from "@/app/components/balance-sheet/BalanceSheetReport";
import OpeningBalanceDrawer from "@/app/components/balance-sheet/OpeningBalanceDrawer";
import {
  downloadBlob,
  exportBalanceSheet,
  loadBalanceSheet,
  loadOpeningBalance,
  saveOpeningBalance,
  type BalanceSheet,
  type BalanceSheetCompare,
  type OpeningBalance,
} from "@/app/components/balance-sheet/balanceSheetApi";

interface SessionWithIdToken {
  getIdToken(): { getJwtToken(): string };
}

function financialYearRange() {
  const now = new Date();
  const endYear = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  return { from: `${endYear - 1}-07-01`, to: `${endYear}-06-30` };
}

const COMPARE_OPTIONS = [
  { label: "No comparison", value: "none" },
  { label: "Previous year (PY)", value: "py" },
  { label: "Previous period (PP)", value: "pp" },
];

export default function EntityBalanceSheetPage() {
  const params = useParams<{ clientId: string; entityId: string }>();
  const router = useRouter();
  const clientId = params?.clientId ?? "";
  const entityId = params?.entityId ?? "";

  const fy = useRef(financialYearRange()).current;
  const [token, setToken] = useState("");
  const [entityName, setEntityName] = useState("");
  const [from, setFrom] = useState(fy.from);
  const [to, setTo] = useState(fy.to);
  const [compare, setCompare] = useState<BalanceSheetCompare>("none");
  const [sheet, setSheet] = useState<BalanceSheet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyExport, setBusyExport] = useState<string | null>(null);

  const [opening, setOpening] = useState<OpeningBalance | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [savingOpening, setSavingOpening] = useState(false);
  const [openingError, setOpeningError] = useState("");
  const [openingNotice, setOpeningNotice] = useState("");
  const [openingVersion, setOpeningVersion] = useState(0);

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

  // Entity name for the back link and report title (existing endpoint).
  useEffect(() => {
    if (!token || !entityId) return;
    (async () => {
      const res = await fetch(`/api/entities/${encodeURIComponent(entityId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { name?: string };
        setEntityName(data?.name ?? "");
      }
    })();
  }, [token, entityId]);

  useEffect(() => {
    if (!token || !entityId) return;
    (async () => {
      try {
        setOpening(await loadOpeningBalance(token, entityId));
      } catch (err) {
        setOpeningNotice((err as Error)?.message ?? "Could not load the opening balance.");
      }
    })();
  }, [token, entityId]);

  const query = useMemo(() => ({ from, to, compare }), [from, to, compare]);

  useEffect(() => {
    if (!token || !entityId) return;
    const controller = new AbortController();
    (async () => {
      setIsLoading(true);
      setError("");
      try {
        setSheet(await loadBalanceSheet(token, entityId, query, controller.signal));
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setError((err as Error)?.message ?? "Could not load the balance sheet.");
        setSheet(null);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [token, entityId, query, openingVersion]);

  const exportAs = async (format: "csv" | "xlsx" | "pdf") => {
    if (!sheet) return;
    setBusyExport(format);
    setError("");
    try {
      downloadBlob(await exportBalanceSheet(token, entityId, query, format), `balance-sheet-${to}.${format}`);
    } catch (err) {
      setError((err as Error)?.message ?? "The export failed.");
    } finally {
      setBusyExport(null);
    }
  };

  const onSaveOpening = async (value: OpeningBalance) => {
    setSavingOpening(true);
    setOpeningError("");
    try {
      setOpening(await saveOpeningBalance(token, entityId, value));
      setPanelOpen(false);
      setOpeningNotice("Opening balance saved.");
      // The report reads the opening balance, so it has to be fetched again.
      setOpeningVersion((v) => v + 1);
    } catch (err) {
      setOpeningError((err as Error)?.message ?? "Could not save the opening balance.");
    } finally {
      setSavingOpening(false);
    }
  };

  const backHref = `/dashboard/accountant/clients/${clientId}/entities/${entityId}`;
  const exportIcon = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );

  return (
    <div className="journal-page general-ledger-page balance-sheet-page">
      <header className="journal-page-head">
        <Link href={backHref} className="entity-wizard-back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {entityName || "Entity"}
        </Link>
        <h1>Balance Sheet</h1>
        <p className="journal-page-sub">
          {opening
            ? `Opening balance as at ${new Date(`${opening.asAt}T00:00:00`).toLocaleDateString("en-AU")} · built from Balance Sheet transactions and journal entries`
            : "Built from Balance Sheet transactions and journal entries"}
        </p>
      </header>

      <div className="journal-list-filters">
        <div className="journal-filter-field">
          <span className="journal-filter-field-label">From</span>
          <input className="bs-date" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="journal-filter-field">
          <span className="journal-filter-field-label">To</span>
          <input className="bs-date" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="journal-filter-field">
          <span className="journal-filter-field-label">Compare to</span>
          <StaticSelect value={compare} options={COMPARE_OPTIONS} onChange={(v) => setCompare(v as BalanceSheetCompare)} />
        </div>

        <div className="journal-filter-actions-end">
          <button
            type="button"
            className={opening ? "bs-btn" : "bs-btn is-primary"}
            onClick={() => {
              setOpeningError("");
              setPanelOpen(true);
            }}
          >
            {opening ? "Edit Opening Balance" : "+ Add Opening Balance"}
          </button>
          <div className="journal-export-row">
            {(["csv", "xlsx", "pdf"] as const).map((f) => (
              <button
                key={f}
                type="button"
                className="journal-export-btn"
                disabled={busyExport !== null || isLoading || !sheet}
                onClick={() => void exportAs(f)}
                title={`Export Balance Sheet as ${f.toUpperCase()}`}
              >
                {exportIcon}
                {busyExport === f ? "…" : f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {!opening ? (
          <div className="bs-notice">
            <span>
              <b>No opening balance yet.</b> Add the Current Assets opening balance so the balance sheet starts from
              the right figures.
            </span>
          </div>
        ) : null}
        {openingNotice ? <div className="bs-notice">{openingNotice}</div> : null}
        {sheet && sheet.unmappedCount > 0 ? (
          <div className="bs-notice is-sample">
            <span>
              <b>
                {sheet.unmappedCount} Balance Sheet {sheet.unmappedCount === 1 ? "transaction is" : "transactions are"} not
                included.
              </b>{" "}
              Their category was typed by hand and names no account. Edit them in All Transactions and pick an account
              from the list.
            </span>
          </div>
        ) : null}
        {error ? <div className="bs-notice is-sample">{error}</div> : null}

        {isLoading && !sheet ? (
          <div className="bs-report" style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
            Loading balance sheet…
          </div>
        ) : sheet ? (
          <BalanceSheetReport sheet={sheet} showCompare={compare !== "none"} />
        ) : null}
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
          Accounts with no balance are hidden. Codes and names come from the Balance Sheet chart of accounts.
        </p>
      </div>

      {panelOpen ? (
        <OpeningBalanceDrawer
          initial={opening}
          defaultAsAt={from}
          saving={savingOpening}
          error={openingError}
          onCancel={() => setPanelOpen(false)}
          onSave={(v) => void onSaveOpening(v)}
        />
      ) : null}
    </div>
  );
}
