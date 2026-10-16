"use client";

import { useState } from "react";
import { Dialog } from "../../../../../_console/components/Dialog";
import { WorkspaceBanner, useWorkspaceOrg, workspacePath } from "../../../../../_console/components/Workspace";
import { BackLink } from "../../../../../_console/components/ui";
import { Badge, Card, PageHeader, Tabs } from "../../../../../_console/components/ui";
import { DEFAULT_PERMISSIONS, ROLES, ROLE_HEADCOUNT, SAMPLE_EXCEPTIONS, type PermissionTable } from "../../../../../_console/lib/workspaceData";

type Tab = keyof PermissionTable;
type Value = "none" | "view" | "edit" | "on" | "off";

const LABEL: Record<Value, string> = { none: "No access", view: "View", edit: "View & edit", on: "Allowed", off: "Off" };
const NEXT: Record<Value, Value> = { none: "view", view: "edit", edit: "none", on: "off", off: "on" };
const clone = (table: PermissionTable): PermissionTable => JSON.parse(JSON.stringify(table));

export default function WorkspacePermissionsPage() {
  const { org, rows } = useWorkspaceOrg();
  const [tab, setTab] = useState<Tab>("screens");
  const [saved, setSaved] = useState<PermissionTable>(() => clone(DEFAULT_PERMISSIONS));
  const [draft, setDraft] = useState<PermissionTable>(() => clone(DEFAULT_PERMISSIONS));
  const [reviewing, setReviewing] = useState(false);
  const [toast, setToast] = useState("");

  const changes = (Object.keys(draft) as Tab[]).flatMap((group) =>
    draft[group].flatMap((row, ri) =>
      (row.values as Value[]).flatMap((value, ci) => {
        const before = saved[group][ri].values[ci] as Value;
        return value === before ? [] : [{ key: `${group}-${ri}-${ci}`, what: `${ROLES[ci]}s · ${row.name}${group === "exports" ? " export" : ""}`, people: ROLE_HEADCOUNT[ci], before, after: value }];
      }),
    ),
  );

  function toggle(ri: number, ci: number) {
    setDraft((current) => {
      const next = clone(current);
      const values = next[tab][ri].values as Value[];
      values[ci] = NEXT[values[ci]];
      return next;
    });
  }

  function save() {
    setSaved(clone(draft));
    setReviewing(false);
    setToast(`${changes.length} permission change${changes.length === 1 ? "" : "s"} saved`);
    window.setTimeout(() => setToast(""), 4000);
  }

  return (
    <>
      <WorkspaceBanner org={org} rows={rows} section="permissions" />
      <BackLink href={workspacePath(org?.id ?? "")}>Back to {org?.name ?? "organisation"}</BackLink>
      <PageHeader
        title="Permissions"
        subtitle="Decide which roles can open each screen, run each report and export data. Exceptions for one person are listed below."
        actions={
          <button type="button" className="cpc-btn cpc-btn-primary" disabled={changes.length === 0} onClick={() => setReviewing(true)}>
            Save permissions{changes.length ? ` (${changes.length})` : ""}
          </button>
        }
      />

      <Tabs
        label="Permission type"
        value={tab}
        onChange={setTab}
        items={[
          { id: "screens", label: "Screens" },
          { id: "reports", label: "Reports" },
          { id: "exports", label: "Exports" },
        ]}
      />

      <Card flush>
        <div className="cpc-table-wrap">
          <table className="cpc-table">
            <thead>
              <tr>
                <th>{tab === "screens" ? "Screen" : tab === "reports" ? "Report" : "Export"}</th>
                {ROLES.map((role) => (
                  <th key={role} style={{ textAlign: "center" }}>
                    {role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {draft[tab].map((row, ri) => (
                <tr key={row.name}>
                  <td>
                    <div className="cpc-strong">{row.name}</div>
                    <div className="cpc-person-sub">{row.desc}</div>
                  </td>
                  {(row.values as Value[]).map((value, ci) => (
                    <td key={ROLES[ci]} style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        className={`cpc-perm is-${value}`}
                        aria-label={`${row.name} for ${ROLES[ci]}: ${LABEL[value]}`}
                        onClick={() => toggle(ri, ci)}
                      >
                        {LABEL[value]}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="cpc-table-foot">
          <span>{tab === "screens" ? "Click to switch: No access → View → View & edit" : "Click to switch on or off"}</span>
        </div>
      </Card>

      <Card flush title="Exceptions for one person" meta="Overrides the role above, for this person only">
        <div className="cpc-table-wrap">
          <table className="cpc-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Exception</th>
                <th>Added by</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_EXCEPTIONS.map((item) => (
                <tr key={item.person}>
                  <td className="cpc-strong">{item.person}</td>
                  <td>{item.role}</td>
                  <td>
                    <Badge tone={item.kind === "allow" ? "green" : "red"}>{item.text}</Badge> {item.what}
                  </td>
                  <td className="cpc-small cpc-muted">{item.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog
        open={reviewing}
        onClose={() => setReviewing(false)}
        title={`Save ${changes.length} permission change${changes.length === 1 ? "" : "s"}?`}
        footer={
          <>
            <button type="button" className="cpc-btn" onClick={() => setReviewing(false)}>
              Keep editing
            </button>
            <button type="button" className="cpc-btn cpc-btn-primary" onClick={save}>
              Save {changes.length} change{changes.length === 1 ? "" : "s"}
            </button>
          </>
        }
      >
        <div className="cpc-list">
          {changes.map((change) => (
            <div key={change.key} className="cpc-list-row" style={{ alignItems: "flex-start" }}>
              <div>
                <div>{change.what}</div>
                <div className="cpc-person-sub">
                  {change.people} {change.people === 1 ? "person" : "people"} affected
                </div>
              </div>
              <span className="cpc-small">
                <span className="cpc-muted" style={{ textDecoration: "line-through" }}>
                  {LABEL[change.before]}
                </span>{" "}
                → <strong>{LABEL[change.after]}</strong>
              </span>
            </div>
          ))}
        </div>
        <p className="cpc-small cpc-muted">Takes effect the next time each person opens a page.</p>
      </Dialog>

      {toast ? (
        <div role="status" style={{ position: "fixed", right: 24, bottom: 24, zIndex: 60, background: "#101828", color: "#fff", padding: "12px 16px", borderRadius: 12, fontSize: 14, boxShadow: "0 12px 30px rgba(0,0,0,.25)" }}>
          {toast}
        </div>
      ) : null}
    </>
  );
}
