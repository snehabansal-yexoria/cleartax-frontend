"use client";

import { Fragment } from "react";
import type { BalanceSheet, BalanceSheetSection } from "./balanceSheetApi";
import "./balance-sheet.css";

function money(n: number | null | undefined) {
  if (n === null || n === undefined) return "";
  const s = Math.abs(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `($${s})` : `$${s}`;
}

function longDate(iso: string | null) {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

function shortDate(iso: string | null) {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

type Totals = { cur: number; prev: number };

function sectionTotals(s: BalanceSheetSection): Totals {
  let cur = 0;
  let prev = 0;
  for (const g of s.groups)
    for (const sg of g.subgroups)
      for (const l of sg.lines) {
        cur += l.amount;
        prev += l.compareAmount ?? 0;
      }
  return { cur, prev };
}

/**
 * The balance sheet table: Assets, Liabilities, Equity with group and section
 * totals and a balance check. Read only. The comparison column appears only
 * when `showCompare` is on and the data carries a comparison date.
 */
export default function BalanceSheetReport({
  sheet,
  showCompare,
}: {
  sheet: BalanceSheet;
  showCompare: boolean;
}) {
  const compare = showCompare && !!sheet.compareAsAt;
  const totals = Object.fromEntries(sheet.sections.map((s) => [s.key, sectionTotals(s)])) as Record<
    BalanceSheetSection["key"],
    Totals
  >;
  const le = {
    cur: (totals.liabilities?.cur ?? 0) + (totals.equity?.cur ?? 0),
    prev: (totals.liabilities?.prev ?? 0) + (totals.equity?.prev ?? 0),
  };
  const check = (totals.assets?.cur ?? 0) - le.cur;
  const checkPrev = (totals.assets?.prev ?? 0) - le.prev;
  const amountCell = (n: number | null | undefined) => (
    <td className={`bs-num${n !== null && n !== undefined && n < 0 ? " bs-neg" : ""}`}>{money(n)}</td>
  );

  return (
    <section className="bs-report">
      <div className="bs-report-title">
        <strong>{sheet.entityName}</strong>
        <span>BALANCE SHEET</span>
        <em>As at {longDate(sheet.asAt)} · Amounts in AUD ($)</em>
      </div>
      <div className="bs-table-wrap">
        <table className="bs-table">
          <thead>
            <tr>
              <th className="bs-code">Account code</th>
              <th>Account name</th>
              <th className="bs-num">{shortDate(sheet.asAt)}</th>
              {compare ? <th className="bs-num">{shortDate(sheet.compareAsAt)}</th> : null}
            </tr>
          </thead>
          <tbody>
            {sheet.sections.map((s) => (
              <Fragment key={s.key}>
                <tr className="bs-sec">
                  <td colSpan={compare ? 4 : 3}>{s.title.toUpperCase()}</td>
                </tr>
                {s.groups.map((g, gi) => {
                  const gLines = g.subgroups.flatMap((sg) => sg.lines);
                  const gCur = gLines.reduce((a, l) => a + l.amount, 0);
                  const gPrev = gLines.reduce((a, l) => a + (l.compareAmount ?? 0), 0);
                  return (
                    <Fragment key={`${s.key}-${gi}`}>
                      {g.name ? (
                        <tr className="bs-grp">
                          <td colSpan={compare ? 4 : 3}>{g.name}</td>
                        </tr>
                      ) : null}
                      {g.subgroups.map((sg) => (
                        <Fragment key={`${s.key}-${gi}-${sg.name}`}>
                          <tr className="bs-sub">
                            <td colSpan={compare ? 4 : 3}>{sg.name}</td>
                          </tr>
                          {sg.lines.map((l) => (
                            <tr key={l.code}>
                              <td className="bs-code">{l.code}</td>
                              <td className="bs-name">{l.name}</td>
                              {amountCell(l.amount)}
                              {compare ? amountCell(l.compareAmount) : null}
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                      {g.name ? (
                        <tr className="bs-tot">
                          <td />
                          <td>Total {g.name}</td>
                          {amountCell(gCur)}
                          {compare ? amountCell(gPrev) : null}
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
                <tr className="bs-big">
                  <td />
                  <td>TOTAL {s.title.toUpperCase()}</td>
                  {amountCell(totals[s.key].cur)}
                  {compare ? amountCell(totals[s.key].prev) : null}
                </tr>
              </Fragment>
            ))}
            <tr className="bs-big">
              <td />
              <td>TOTAL LIABILITIES AND EQUITY</td>
              {amountCell(le.cur)}
              {compare ? amountCell(le.prev) : null}
            </tr>
            <tr className="bs-chk">
              <td />
              <td>Balance check (Assets − Liabilities − Equity)</td>
              <td className="bs-num">{Math.abs(check) < 0.005 ? "✓ $0.00" : money(check)}</td>
              {compare ? <td className="bs-num">{Math.abs(checkPrev) < 0.005 ? "✓ $0.00" : money(checkPrev)}</td> : null}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
