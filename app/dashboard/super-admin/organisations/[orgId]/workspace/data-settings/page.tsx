"use client";

import { useState } from "react";
import { Dialog } from "../../../../../_console/components/Dialog";
import { WorkspaceBanner, useWorkspaceOrg, workspacePath } from "../../../../../_console/components/Workspace";
import { BackLink } from "../../../../../_console/components/ui";
import { Badge, Card, Field, Notice, PageHeader } from "../../../../../_console/components/ui";
import { exportRows } from "../../../../../_console/lib/export";
import { DEFAULT_CODES, DEFAULT_LIST_RULES, type AccountCode, type ListRule } from "../../../../../_console/lib/workspaceData";

type RuleKey = "add" | "edit" | "del";
const RULES: { key: RuleKey; title: string; text: string }[] = [
  { key: "add", title: "Admin can add new values", text: "New values start unprotected" },
  { key: "edit", title: "Admin can edit and reorder", text: "Rename and change the dropdown order" },
  { key: "del", title: "Admin can delete", text: "Values in use always ask for a replacement" },
];

const allowed = (value: boolean) => <Badge tone={value ? "green" : "gray"}>{value ? "Allowed" : "Locked"}</Badge>;

export default function WorkspaceDataRulesPage() {
  const { org, rows } = useWorkspaceOrg();
  const [lists, setLists] = useState<ListRule[]>(DEFAULT_LIST_RULES);
  const [codes, setCodes] = useState<AccountCode[]>(DEFAULT_CODES);
  const [editing, setEditing] = useState<ListRule | null>(null);
  const [protecting, setProtecting] = useState<AccountCode | null>(null);
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState("");

  function say(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 4000);
  }

  function applyRules() {
    if (!editing) return;
    setLists((all) => all.map((list) => (list.name === editing.name ? editing : list)));
    say(`Rules for ${editing.name} applied`);
    setEditing(null);
  }

  function protect() {
    if (!protecting) return;
    setCodes((all) => all.map((code) => (code.code === protecting.code ? { ...code, isProtected: true } : code)));
    setLists((all) => all.map((list) => (list.name === "Account codes" ? { ...list, protectedCount: list.protectedCount + 1 } : list)));
    say(`${protecting.code} · ${protecting.name} is now protected`);
    setProtecting(null);
  }

  function exportLists() {
    exportRows("excel", {
      title: `${org?.name ?? "Organisation"} · data settings`,
      filename: "data-settings-rules",
      columns: [
        { header: "List", value: (list: ListRule) => list.name },
        { header: "Values", value: (list: ListRule) => list.values },
        { header: "Protected", value: (list: ListRule) => list.protectedCount },
        { header: "Admin can add", value: (list: ListRule) => (list.add ? "Allowed" : "Locked") },
        { header: "Admin can edit & reorder", value: (list: ListRule) => (list.edit ? "Allowed" : "Locked") },
        { header: "Admin can delete", value: (list: ListRule) => (list.del ? "Allowed" : "Locked") },
      ],
      rows: lists,
    });
  }

  const accountCodes = lists.find((list) => list.name === "Account codes");

  return (
    <>
      <WorkspaceBanner org={org} rows={rows} section="data-settings" />
      <BackLink href={workspacePath(org?.id ?? "")}>Back to {org?.name ?? "organisation"}</BackLink>
      <PageHeader
        title="Data settings & rules"
        subtitle="The same lists the admin manages, plus the rules only you can set: which lists the admin can edit and which values are protected."
        actions={
          <button type="button" className="cpc-btn" onClick={exportLists}>
            Export all lists
          </button>
        }
      />

      <Notice tone="blue" title={`These rules apply to ${org?.name ?? "this organisation"} only`}>
        Each organisation keeps its own lists. Protected values can&apos;t be renamed, reordered or deleted by the organisation&apos;s admin.
      </Notice>

      <Card flush title="Who can edit each list" meta="Locked = the admin sees the list but can’t change it">
        <div className="cpc-table-wrap">
          <table className="cpc-table">
            <thead>
              <tr>
                <th>List</th>
                <th className="is-right">Values</th>
                <th className="is-right">Protected</th>
                <th>Admin can add</th>
                <th>Admin can edit &amp; reorder</th>
                <th>Admin can delete</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lists.map((list) => (
                <tr key={list.name}>
                  <td className="cpc-strong">{list.name}</td>
                  <td className="is-right cpc-num">{list.values}</td>
                  <td className="is-right cpc-num">{list.protectedCount}</td>
                  <td>{allowed(list.add)}</td>
                  <td>{allowed(list.edit)}</td>
                  <td>{allowed(list.del)}</td>
                  <td className="is-right">
                    <button type="button" className="cpc-btn cpc-btn-sm" onClick={() => setEditing({ ...list })}>
                      Change
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card flush title="Account codes · protected values" meta="Lock codes the ATO schedule depends on">
        <div className="cpc-table-wrap">
          <table className="cpc-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>ATO rental schedule item</th>
                <th className="is-right">Used in</th>
                <th>Protection</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => (
                <tr key={code.code}>
                  <td className="cpc-num cpc-strong">{code.code}</td>
                  <td>{code.name}</td>
                  <td className="cpc-small">{code.ato}</td>
                  <td className="is-right cpc-num">{code.used.toLocaleString()}</td>
                  <td>
                    <Badge tone={code.isProtected ? "purple" : "gray"}>{code.isProtected ? "Protected" : "Editable"}</Badge>
                  </td>
                  <td className="is-right">
                    {code.isProtected ? null : (
                      <button
                        type="button"
                        className="cpc-btn cpc-btn-sm"
                        onClick={() => {
                          setReason("");
                          setProtecting(code);
                        }}
                      >
                        Protect
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="cpc-table-foot">
          <span>
            {accountCodes?.values ?? 0} codes · {accountCodes?.protectedCount ?? 0} protected
          </span>
          <span>Changes to rules are written to the audit trail</span>
        </div>
      </Card>

      {/* Change rules */}
      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Rules for ${editing.name}` : ""}
        subtitle={org?.name}
        footer={
          <>
            <button type="button" className="cpc-btn" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="button" className="cpc-btn cpc-btn-primary" onClick={applyRules}>
              Apply rules
            </button>
          </>
        }
      >
        {editing ? (
          <>
            {RULES.map((rule) => (
              <div key={rule.key} className="cpc-switch-row">
                <div style={{ flex: 1 }}>
                  <div className="cpc-strong">{rule.title}</div>
                  <div className="cpc-person-sub">{rule.text}</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  className="cpc-switch"
                  aria-checked={editing[rule.key]}
                  aria-label={rule.title}
                  onClick={() => setEditing({ ...editing, [rule.key]: !editing[rule.key] })}
                />
              </div>
            ))}
            {editing.protectedCount > 0 ? (
              <p className="cpc-small" style={{ background: "#f1f4fd", border: "1px solid #d6def7", borderRadius: 8, padding: 10 }}>
                {editing.protectedCount} protected value{editing.protectedCount === 1 ? "" : "s"} stay locked whatever you choose here.
              </p>
            ) : null}
          </>
        ) : null}
      </Dialog>

      {/* Protect */}
      <Dialog
        open={Boolean(protecting)}
        onClose={() => setProtecting(null)}
        title={protecting ? `Protect ${protecting.code} · ${protecting.name}?` : ""}
        footer={
          <>
            <button type="button" className="cpc-btn" onClick={() => setProtecting(null)}>
              Cancel
            </button>
            <button type="button" className="cpc-btn cpc-btn-primary" onClick={protect}>
              Protect code
            </button>
          </>
        }
      >
        <div className="cpc-list">
          <div className="cpc-list-row">
            <span>Admin can rename, reorder or delete it</span>
            <Badge tone="gray">No</Badge>
          </div>
          <div className="cpc-list-row">
            <span>Accountants can still use it on transactions</span>
            <Badge tone="green">Yes</Badge>
          </div>
        </div>
        <Field label="Reason (optional)" htmlFor="p-r">
          <input id="p-r" className="cpc-input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Mapped to ATO schedule" />
        </Field>
      </Dialog>

      {toast ? (
        <div role="status" style={{ position: "fixed", right: 24, bottom: 24, zIndex: 60, background: "#101828", color: "#fff", padding: "12px 16px", borderRadius: 12, fontSize: 14, boxShadow: "0 12px 30px rgba(0,0,0,.25)" }}>
          {toast}
        </div>
      ) : null}
    </>
  );
}
