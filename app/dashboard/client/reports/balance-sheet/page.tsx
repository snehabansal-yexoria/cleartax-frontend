"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getSession } from "@/src/lib/session";
import { useClientHoldings } from "@/app/components/useClientHoldings";
import { reportYearOptions } from "@/app/components/reports/client/reportScope";
import { fyOption } from "@/app/components/reports/client/reportFormat";
import { DownloadIcon } from "@/app/components/reports/client/reportRegistry";
import { CLIENT_REPORTS_PATH } from "@/app/components/reports/client/reportLinks";
import { downloadReportPdf, reportFileName } from "@/app/components/reports/client/downloadReportPdf";
import BalanceSheetReport from "@/app/components/balance-sheet/BalanceSheetReport";
import {
  downloadBlob,
  exportBalanceSheet,
  loadBalanceSheet,
  type BalanceSheet,
  type BalanceSheetCompare,
  type BalanceSheetQuery,
} from "@/app/components/balance-sheet/balanceSheetApi";

interface SessionWithIdToken {
  getIdToken(): { getJwtToken(): string };
}

type Choice = { entityId: string; fy: number; compare: BalanceSheetCompare };

function queryFor(c: Choice): BalanceSheetQuery {
  return { from: `${c.fy - 1}-07-01`, to: `${c.fy}-06-30`, compare: c.compare };
}

/**
 * Client portal → Reports → Balance Sheet. Works like the other client
 * reports: choose the entity and financial year (and, if wanted, a period to
 * compare with), Build report, then read it or download it. View only — the
 * client cannot change any figure here.
 */
export default function ClientBalanceSheetReportPage() {
  const holdings = useClientHoldings();
  const entities = holdings.data ?? [];
  const years = reportYearOptions();

  const [token, setToken] = useState("");
  const [draft, setDraft] = useState<Choice>({ entityId: "", fy: years[0], compare: "none" });
  const [built, setBuilt] = useState<Choice | null>(null);
  const [sheet, setSheet] = useState<BalanceSheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "pdf" | "xlsx">("");
  const outRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const session = (await getSession()) as SessionWithIdToken | null;
      if (session) setToken(session.getIdToken().getJwtToken());
    })();
  }, []);

  const entityId = draft.entityId || entities[0]?.id || "";
  const entityName = entities.find((e) => e.id === (built?.entityId ?? entityId))?.name ?? "Entity";
  const stale = built !== null && (built.entityId !== entityId || built.fy !== draft.fy || built.compare !== draft.compare);

  const build = async () => {
    if (!token || !entityId) return;
    const choice = { ...draft, entityId };
    setBuilt(choice);
    setLoading(true);
    setError("");
    try {
      setSheet(await loadBalanceSheet(token, entityId, queryFor(choice)));
    } catch (err) {
      setError((err as Error)?.message ?? "Could not build the balance sheet.");
      setSheet(null);
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    const doc = outRef.current?.querySelector<HTMLElement>(".bs-report");
    if (!doc || !built) return;
    setBusy("pdf");
    try {
      await downloadReportPdf(doc, reportFileName("Balance-Sheet", entityName, fyOption(built.fy)));
    } finally {
      setBusy("");
    }
  };

  const downloadExcel = async () => {
    if (!built || !sheet) return;
    setBusy("xlsx");
    try {
      downloadBlob(await exportBalanceSheet(token, built.entityId, queryFor(built), "xlsx"), `Balance-Sheet_${fyOption(built.fy)}.xlsx`);
    } catch (err) {
      setError((err as Error)?.message ?? "The download failed.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="cp-report cp-page-wrap">
      <div className="cp-page">
        <div className="cp-phead cp-noprint">
          <div>
            <Link className="cp-back" href={CLIENT_REPORTS_PATH}>
              ← All reports
            </Link>
            <div className="cp-eyebrow">Clear Portfolio · Client portal · Reports</div>
            <h1>Balance Sheet</h1>
          </div>
          <div className="cp-controls">
            <div className="cp-field">
              <label htmlFor="bs-entity">Entity</label>
              <select
                id="bs-entity"
                className="cp-select"
                value={entityId}
                disabled={holdings.data == null}
                onChange={(e) => setDraft((d) => ({ ...d, entityId: e.target.value }))}
              >
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="cp-field">
              <label htmlFor="bs-fy">Financial year</label>
              <select
                id="bs-fy"
                className="cp-select cp-select--fy"
                value={draft.fy}
                onChange={(e) => setDraft((d) => ({ ...d, fy: Number(e.target.value) }))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {fyOption(y)}
                  </option>
                ))}
              </select>
            </div>
            <div className="cp-field">
              <label htmlFor="bs-compare">Compare to</label>
              <select
                id="bs-compare"
                className="cp-select"
                value={draft.compare}
                onChange={(e) => setDraft((d) => ({ ...d, compare: e.target.value as BalanceSheetCompare }))}
              >
                <option value="none">No comparison</option>
                <option value="py">Previous year</option>
                <option value="pp">Previous quarter</option>
              </select>
            </div>
            <button
              type="button"
              className={`cp-btn ${!built ? "cp-btn--primary" : stale ? "cp-btn--tile" : "cp-btn--soft"}`}
              onClick={() => void build()}
              disabled={!entityId || !token || loading}
            >
              {built ? "Update report" : "Build report"}
            </button>
            {built && sheet ? (
              <>
                <button type="button" className="cp-btn cp-btn--primary" onClick={() => void downloadPdf()} disabled={busy !== "" || stale}>
                  <DownloadIcon />
                  {busy === "pdf" ? "Preparing PDF…" : "Download PDF"}
                </button>
                <button type="button" className="cp-btn cp-btn--soft" onClick={() => void downloadExcel()} disabled={busy !== "" || stale}>
                  <DownloadIcon />
                  Excel
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div ref={outRef} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {!built ? (
            <div className="cp-empty">
              Choose the <b>entity</b>, <b>financial year</b> and whether to compare, then select <b>Build report</b>.
            </div>
          ) : loading ? (
            <div className="cp-empty">Building the balance sheet…</div>
          ) : error ? (
            <div className="cp-empty">{error}</div>
          ) : sheet ? (
            <>
              {sheet.unmappedCount > 0 ? (
                <div className="bs-notice is-sample cp-noprint">
                  <span>
                    {sheet.unmappedCount} {sheet.unmappedCount === 1 ? "item is" : "items are"} not included yet. Your
                    accountant needs to file {sheet.unmappedCount === 1 ? "it" : "them"} under an account.
                  </span>
                </div>
              ) : null}
              <BalanceSheetReport sheet={sheet} showCompare={built.compare !== "none"} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
