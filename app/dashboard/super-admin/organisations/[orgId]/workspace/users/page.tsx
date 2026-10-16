"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { requestPasswordReset } from "@/src/lib/auth";
import { Dialog } from "../../../../../_console/components/Dialog";
import { WorkspaceBanner, useWorkspaceOrg } from "../../../../../_console/components/Workspace";
import {
  Badge,
  Card,
  EmptyState,
  Field,
  FilterBar,
  Kpi,
  KpiGrid,
  PageHeader,
  Person,
  SearchField,
  SelectField,
} from "../../../../../_console/components/ui";
import { DataTable } from "../../../../../_console/components/DataTable";
import { apiPost } from "../../../../../_console/lib/api";
import { exportRows, type ExportFormat } from "../../../../../_console/lib/export";
import { formatDate } from "../../../../../_console/lib/format";
import { isSampleId } from "../../../../../_console/lib/sampleData";
import { isPendingStatus } from "../../../../../_console/lib/superAdminData";
import { invalidateResource } from "../../../../../_console/lib/useResource";
import { sampleUsers, type WsAccount, type WsRole, type WsUser } from "../../../../../_console/lib/workspaceData";

const ROLE_OPTIONS: WsRole[] = ["Admin", "Relationship manager", "Accountant", "Client"];
const ACCOUNT_TONE: Record<WsAccount, "green" | "amber" | "gray"> = { Active: "green", Invited: "amber", Disabled: "gray" };
const REASONS = ["Left the firm", "On leave", "Security concern", "Other"];

type DialogState =
  | { kind: "create" }
  | { kind: "export" }
  | { kind: "reset"; user: WsUser }
  | { kind: "disable"; user: WsUser }
  | { kind: "reactivate"; user: WsUser }
  | null;

export default function WorkspaceUsersPage() {
  const { org, rows, loading } = useWorkspaceOrg();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | WsRole>("all");
  const [accountFilter, setAccountFilter] = useState<"all" | WsAccount>("all");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [overrides, setOverrides] = useState<Record<string, Partial<WsUser>>>({});
  const [created, setCreated] = useState<WsUser[]>([]);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | undefined>(undefined);

  // Dialog fields
  const [form, setForm] = useState({ first: "", last: "", email: "", role: "Accountant" as WsRole, reportsTo: "" });
  const [signOutToo, setSignOutToo] = useState(false);
  const [moveTo, setMoveTo] = useState("");
  const [reason, setReason] = useState(REASONS[0]);
  const [notify, setNotify] = useState(true);
  const [format, setFormat] = useState<ExportFormat>("excel");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  function say(message: string) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 4000);
  }

  // Real admins of this organisation, then sample people (until a users-by-organisation API exists).
  const users = useMemo<WsUser[]>(() => {
    if (!org) return [];
    const admins: WsUser[] = org.admins.map((admin) => ({
      id: admin.id,
      name: admin.name || admin.email,
      email: admin.email,
      role: "Admin",
      account: isPendingStatus(admin.status) ? "Invited" : "Active",
      lastSignIn: isPendingStatus(admin.status) ? "Never" : "—",
      created: formatDate(admin.createdAt),
      sample: isSampleId(admin.id),
    }));
    const known = new Set(admins.map((user) => user.email.toLowerCase()));
    const people = [...admins, ...created, ...sampleUsers(org.email).filter((user) => !known.has(user.email.toLowerCase()))];
    return people.map((user) => ({ ...user, ...overrides[user.id] }));
  }, [org, created, overrides]);

  const rms = users.filter((user) => user.role === "Relationship manager" && user.account !== "Disabled");
  const accountants = users.filter((user) => user.role === "Accountant" && user.account === "Active");

  const visible = users.filter((user) => {
    const needle = query.trim().toLowerCase();
    if (needle && !`${user.name} ${user.email}`.toLowerCase().includes(needle)) return false;
    if (roleFilter !== "all" && user.role !== roleFilter) return false;
    if (accountFilter !== "all" && user.account !== accountFilter) return false;
    return true;
  });

  const count = (role: WsRole) => users.filter((user) => user.role === role);
  const summary = (list: WsUser[]) => {
    const active = list.filter((user) => user.account === "Active").length;
    const invited = list.filter((user) => user.account === "Invited").length;
    const disabled = list.filter((user) => user.account === "Disabled").length;
    return [`${active} active`, invited ? `${invited} invited` : "", disabled ? `${disabled} disabled` : ""].filter(Boolean).join(" · ");
  };

  function open(next: DialogState) {
    setError("");
    setBusy(false);
    setSignOutToo(false);
    setReason(REASONS[0]);
    setNotify(true);
    if (next?.kind === "create") setForm({ first: "", last: "", email: "", role: "Accountant", reportsTo: rms[0]?.name ?? "" });
    if (next?.kind === "disable") setMoveTo(accountants.find((acc) => acc.id !== next.user.id)?.name ?? "");
    if (next?.kind === "reactivate") setForm((value) => ({ ...value, role: next.user.role, reportsTo: rms[0]?.name ?? "" }));
    setDialog(next);
  }

  const close = () => setDialog(null);
  const firstName = (user: WsUser) => user.name.split(" ")[0];
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());

  async function createUser() {
    if (!org || !form.first.trim() || !emailValid) return;
    setBusy(true);
    setError("");
    try {
      const fullName = `${form.first.trim()} ${form.last.trim()}`.trim();
      // Only admins can be invited by a super admin today; other roles stay on this screen.
      if (form.role === "Admin" && !isSampleId(org.id)) {
        await apiPost("/api/invite-user", { email: form.email.trim(), role: "admin", organization_id: org.id, full_name: fullName });
        invalidateResource("super:admins");
      } else {
        setCreated((list) => [
          ...list,
          {
            id: `created-${list.length}-${form.email}`,
            name: fullName,
            email: form.email.trim(),
            role: form.role,
            account: "Invited",
            lastSignIn: "Never",
            created: "Today",
            reportsTo: form.role === "Accountant" ? form.reportsTo : undefined,
            sample: true,
          },
        ]);
      }
      say(`Invite sent to ${form.email.trim()}`);
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The invite couldn't be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(user: WsUser) {
    setBusy(true);
    setError("");
    try {
      if (!user.sample) await requestPasswordReset(user.email);
      say(`Password reset email sent to ${user.email}`);
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The reset email couldn't be sent.");
    } finally {
      setBusy(false);
    }
  }

  function setAccount(user: WsUser, patch: Partial<WsUser>, message: string) {
    setOverrides((all) => ({ ...all, [user.id]: { ...all[user.id], ...patch } }));
    say(message);
    close();
  }

  function runExport() {
    exportRows(format, {
      title: `${org?.name ?? "Organisation"} · users`,
      filename: "users",
      context: [`Role: ${roleFilter === "all" ? "All" : roleFilter}`, `Account: ${accountFilter === "all" ? "All" : accountFilter}`],
      columns: [
        { header: "Name", value: (user: WsUser) => user.name },
        { header: "Email", value: (user: WsUser) => user.email },
        { header: "Role", value: (user: WsUser) => user.role },
        { header: "Account", value: (user: WsUser) => user.account },
        { header: "Last sign-in", value: (user: WsUser) => user.lastSignIn },
        { header: "Created", value: (user: WsUser) => user.created },
      ],
      rows: visible,
    });
    close();
  }

  const d = dialog;
  return (
    <>
      <WorkspaceBanner org={org} rows={rows} section="users" />
      <PageHeader
        title="Users & roles"
        subtitle={`Everyone in ${org?.name ?? "this organisation"}. Create accounts, disable or reactivate them, and assign roles, including Admin.`}
        actions={
          <>
            <button type="button" className="cpc-btn" onClick={() => open({ kind: "export" })}>
              Export
            </button>
            <button type="button" className="cpc-btn cpc-btn-primary" onClick={() => open({ kind: "create" })}>
              + Create user
            </button>
          </>
        }
      />

      <KpiGrid>
        <Kpi label="Admins" loading={loading} value={count("Admin").length} hint={count("Admin")[0]?.name ?? "none yet"} />
        <Kpi label="Relationship managers" loading={loading} value={count("Relationship manager").length} hint={summary(count("Relationship manager"))} />
        <Kpi label="Accountants" loading={loading} value={count("Accountant").length} hint={summary(count("Accountant"))} />
        <Kpi label="Clients" loading={loading} value={count("Client").length} hint={summary(count("Client"))} />
      </KpiGrid>

      <FilterBar>
        <SearchField id="wu-q" value={query} onChange={setQuery} placeholder="Name or email" />
        <SelectField id="wu-r" label="Role" value={roleFilter} onChange={setRoleFilter} options={[{ value: "all", label: "All roles" }, ...ROLE_OPTIONS.map((role) => ({ value: role, label: role }))]} />
        <SelectField
          id="wu-a"
          label="Account"
          value={accountFilter}
          onChange={setAccountFilter}
          options={[
            { value: "all", label: "All" },
            { value: "Active", label: "Active" },
            { value: "Invited", label: "Invited" },
            { value: "Disabled", label: "Disabled" },
          ]}
        />
      </FilterBar>

      <Card flush>
        <DataTable<WsUser>
          caption="Users"
          loading={loading}
          rows={visible}
          rowKey={(user) => user.id}
          footer={`${users.length} people · role and account changes are written to the audit trail`}
          empty={<EmptyState title="No people match these filters" />}
          columns={[
            { id: "name", header: "Person", cell: (user) => <Person name={user.name} sub={user.email} />, sortValue: (user) => user.name },
            { id: "role", header: "Role", cell: (user) => user.role, sortValue: (user) => user.role },
            {
              id: "account",
              header: "Account",
              cell: (user) => (
                <Badge tone={ACCOUNT_TONE[user.account]} dot>
                  {user.account}
                </Badge>
              ),
              sortValue: (user) => user.account,
            },
            { id: "last", header: "Last sign-in", cell: (user) => <span className="cpc-small">{user.lastSignIn}</span> },
            { id: "created", header: "Created", cell: (user) => <span className="cpc-small cpc-muted">{user.created}</span> },
            {
              id: "actions",
              header: "",
              cell: (user) => (
                <div className="cpc-actions" style={{ flexWrap: "nowrap", justifyContent: "flex-end" }}>
                  <button type="button" className="cpc-btn cpc-btn-sm" disabled={user.account === "Invited"} onClick={() => open({ kind: "reset", user })}>
                    Reset password
                  </button>
                  {user.account === "Disabled" ? (
                    <button type="button" className="cpc-btn cpc-btn-sm" onClick={() => open({ kind: "reactivate", user })}>
                      Reactivate
                    </button>
                  ) : (
                    <button type="button" className="cpc-btn cpc-btn-sm cpc-btn-danger" onClick={() => open({ kind: "disable", user })}>
                      Disable
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Create user */}
      <Dialog
        open={d?.kind === "create"}
        onClose={close}
        title="Create user"
        subtitle="They get an email to set their password"
        footer={
          <>
            <button type="button" className="cpc-btn" onClick={close}>
              Cancel
            </button>
            <button type="button" className="cpc-btn cpc-btn-primary" disabled={busy || !form.first.trim() || !emailValid} onClick={createUser}>
              {busy ? "Sending…" : "Create & send invite"}
            </button>
          </>
        }
      >
        <div className="cpc-form-grid">
          <Field label="First name" htmlFor="cu-f">
            <input id="cu-f" className="cpc-input" value={form.first} onChange={(event) => setForm({ ...form, first: event.target.value })} />
          </Field>
          <Field label="Last name" htmlFor="cu-l">
            <input id="cu-l" className="cpc-input" value={form.last} onChange={(event) => setForm({ ...form, last: event.target.value })} />
          </Field>
        </div>
        <Field label="Email" htmlFor="cu-e">
          <input id="cu-e" className="cpc-input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder={`name@${org?.email?.split("@")[1] ?? "example.com.au"}`} />
        </Field>
        <SelectField id="cu-r" label="Role" value={form.role} onChange={(role) => setForm({ ...form, role })} options={ROLE_OPTIONS.map((role) => ({ value: role, label: role }))} />
        {form.role === "Accountant" ? (
          <SelectField id="cu-m" label="Reports to (RM)" value={form.reportsTo} onChange={(reportsTo) => setForm({ ...form, reportsTo })} options={rms.map((rm) => ({ value: rm.name, label: rm.name }))} />
        ) : null}
        {error ? <p className="cpc-small" style={{ color: "var(--cpc-red)" }}>{error}</p> : null}
      </Dialog>

      {/* Reset password */}
      <Dialog
        open={d?.kind === "reset"}
        onClose={close}
        title={d?.kind === "reset" ? `Reset password for ${d.user.name}?` : ""}
        footer={
          <>
            <button type="button" className="cpc-btn" onClick={close}>
              Cancel
            </button>
            <button type="button" className="cpc-btn cpc-btn-primary" disabled={busy} onClick={() => d?.kind === "reset" && resetPassword(d.user)}>
              {busy ? "Sending…" : "Send reset email"}
            </button>
          </>
        }
      >
        {d?.kind === "reset" ? (
          <>
            <div className="cpc-list">
              <div className="cpc-list-row">
                <span>Reset email sent to</span>
                <span>{d.user.email}</span>
              </div>
              <div className="cpc-list-row">
                <span>Their work</span>
                <span>Not affected</span>
              </div>
            </div>
            <label className="cpc-check">
              <input type="checkbox" checked={signOutToo} onChange={(event) => setSignOutToo(event.target.checked)} /> Also sign {firstName(d.user)} out on every device now
            </label>
            {error ? <p className="cpc-small" style={{ color: "var(--cpc-red)" }}>{error}</p> : null}
          </>
        ) : null}
      </Dialog>

      {/* Disable */}
      <Dialog
        open={d?.kind === "disable"}
        onClose={close}
        title={d?.kind === "disable" ? `Disable ${d.user.name}?` : ""}
        footer={
          <>
            <button type="button" className="cpc-btn" onClick={close}>
              Cancel
            </button>
            <button
              type="button"
              className="cpc-btn cpc-btn-danger"
              onClick={() => d?.kind === "disable" && setAccount(d.user, { account: "Disabled", lastSignIn: d.user.lastSignIn }, `${d.user.name} disabled`)}
            >
              Disable account
            </button>
          </>
        }
      >
        {d?.kind === "disable" ? (
          <>
            <div className="cpc-notice cpc-notice-red">
              <div>
                <strong>{firstName(d.user)} is signed out and can’t sign in</strong>
                <div className="cpc-small">Nothing is deleted. You can reactivate them any time.</div>
              </div>
            </div>
            {d.user.role === "Accountant" && (d.user.clients ?? 0) > 0 ? (
              <SelectField
                id="ds-c"
                label={`Their ${d.user.clients} clients go to`}
                value={moveTo}
                onChange={setMoveTo}
                options={accountants.filter((acc) => acc.id !== d.user.id).map((acc) => ({ value: acc.name, label: `${acc.name} · ${acc.clients ?? 0} clients` }))}
              />
            ) : null}
            <SelectField id="ds-r" label="Reason (saved to the audit log)" value={reason} onChange={setReason} options={REASONS.map((value) => ({ value, label: value }))} />
          </>
        ) : null}
      </Dialog>

      {/* Reactivate */}
      <Dialog
        open={d?.kind === "reactivate"}
        onClose={close}
        title={d?.kind === "reactivate" ? `Reactivate ${d.user.name}?` : ""}
        footer={
          <>
            <button type="button" className="cpc-btn" onClick={close}>
              Cancel
            </button>
            <button
              type="button"
              className="cpc-btn cpc-btn-primary"
              onClick={() => d?.kind === "reactivate" && setAccount(d.user, { account: "Active", role: form.role }, `${d.user.name} reactivated`)}
            >
              Reactivate
            </button>
          </>
        }
      >
        {d?.kind === "reactivate" ? (
          <>
            <SelectField id="ra-r" label="Role" value={form.role} onChange={(role) => setForm({ ...form, role })} options={ROLE_OPTIONS.map((role) => ({ value: role, label: role }))} />
            {form.role === "Accountant" ? (
              <SelectField id="ra-m" label="Reports to (RM)" value={form.reportsTo} onChange={(reportsTo) => setForm({ ...form, reportsTo })} options={rms.map((rm) => ({ value: rm.name, label: rm.name }))} />
            ) : null}
            <label className="cpc-check">
              <input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} /> Email {firstName(d.user)} that they can sign in again
            </label>
          </>
        ) : null}
      </Dialog>

      {/* Export */}
      <Dialog
        open={d?.kind === "export"}
        onClose={close}
        title="Export users"
        footer={
          <>
            <button type="button" className="cpc-btn" onClick={close}>
              Cancel
            </button>
            <button type="button" className="cpc-btn cpc-btn-dark" onClick={runExport}>
              Download {format === "csv" ? ".csv" : ".xls"}
            </button>
          </>
        }
      >
        <Field label="Format">
          <div className="cpc-seg" role="group" aria-label="Format">
            {(["csv", "excel"] as const).map((value) => (
              <button key={value} type="button" className={format === value ? "is-on" : undefined} onClick={() => setFormat(value)}>
                {value === "csv" ? "CSV" : "Excel"}
              </button>
            ))}
          </div>
        </Field>
        <p className="cpc-small cpc-muted">
          {visible.length} people · name, email, role, account status, last sign-in, created
        </p>
      </Dialog>

      {toast ? (
        <div role="status" style={{ position: "fixed", right: 24, bottom: 24, zIndex: 60, background: "#101828", color: "#fff", padding: "12px 16px", borderRadius: 12, fontSize: 14, boxShadow: "0 12px 30px rgba(0,0,0,.25)" }}>
          {toast}
        </div>
      ) : null}
    </>
  );
}
