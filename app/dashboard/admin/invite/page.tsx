"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { DataTable } from "../../_console/components/DataTable";
import { InviteResult, buildInviteLink, type InviteResponse } from "../../_console/components/InviteResult";
import { Card, EmptyState, Field, Notice, PageHeader, Person, StatusBadge, Tabs, cx } from "../../_console/components/ui";
import { apiPost } from "../../_console/lib/api";
import { isPendingStatus, usePeople, type InvitedUser } from "../../_console/lib/adminData";
import { formatDate, titleCase } from "../../_console/lib/format";
import { invalidateResource } from "../../_console/lib/useResource";

type Role = "client" | "accountant";
type Tab = "single" | "pending";

const ROLES: { id: Role | "rm"; title: string; body: string; disabled?: boolean }[] = [
  { id: "client", title: "Client", body: "Property investor. Sees their own portfolio, properties, transactions and documents." },
  { id: "accountant", title: "Accountant", body: "Manages assigned clients: transactions, reclassification, properties and reports." },
  { id: "rm", title: "Relationship manager", body: "Read-only oversight of assigned accountants. Available once the RM role exists in the backend.", disabled: true },
];

export default function AdminInvitePage() {
  const params = useSearchParams();
  const people = usePeople();
  const [tab, setTab] = useState<Tab>("single");
  const [role, setRole] = useState<Role>(params.get("role") === "accountant" ? "accountant" : "client");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ link: string; password: string; email: string } | null>(null);

  const pending = [...(people.data?.accountants ?? []), ...(people.data?.invitedClients ?? [])].filter((user) => isPendingStatus(user.status));
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailValid && firstName.trim() && !submitting;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const response = await apiPost<InviteResponse>("/api/invite-user", { email: email.trim(), role, full_name: fullName });
      setResult({
        link: buildInviteLink(window.location.origin, response, { email: email.trim(), role }),
        password: String(response.temporaryPassword || ""),
        email: email.trim(),
      });
      setFirstName("");
      setLastName("");
      setEmail("");
      invalidateResource("admin:people");
      people.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong while creating the invite.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader title="Invite users" subtitle="People join only by invitation. Each email can hold one account." />

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "1em", flexWrap: "wrap" }}>
        <Tabs
          label="Invite options"
          value={tab}
          onChange={setTab}
          items={[
            { id: "single", label: "Invite individually" },
            { id: "pending", label: "Pending invites", count: pending.length },
          ]}
        />
        <Link className="cpc-btn cpc-btn-sm" href="/dashboard/admin/bulk-upload">
          Bulk upload (CSV)
        </Link>
      </div>

      {tab === "single" ? (
        <>
          <div className="cpc-section-label">Select role</div>
          <div className="cpc-grid-3" role="radiogroup" aria-label="Role">
            {ROLES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={item.id === role}
                disabled={item.disabled}
                className={cx("cpc-role-card", item.id === role && "is-on")}
                onClick={() => item.id !== "rm" && setRole(item.id)}
              >
                <span className="cpc-strong">{item.title}</span>
                <span className="cpc-small cpc-muted">{item.body}</span>
              </button>
            ))}
          </div>

          {result ? <InviteResult {...result} /> : null}
          {error ? <Notice tone="red" title="Invite not sent">{error}</Notice> : null}

          <div className="cpc-grid-2">
            <Card title="Invite details">
              <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "1em" }} noValidate>
                <div className="cpc-form-grid">
                  <Field label="First name *" htmlFor="i-first">
                    <input id="i-first" className="cpc-input" autoComplete="off" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. Sneha" required />
                  </Field>
                  <Field label="Last name" htmlFor="i-last">
                    <input id="i-last" className="cpc-input" autoComplete="off" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="e.g. Bansal" />
                  </Field>
                  <Field label="Email address *" htmlFor="i-email" className="cpc-span-all">
                    <input
                      id="i-email"
                      className="cpc-input"
                      type="email"
                      autoComplete="off"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. sneha@email.com"
                      aria-invalid={email.length > 0 && !emailValid}
                      required
                    />
                  </Field>
                </div>
                <p className="cpc-small cpc-muted">
                  {role === "client"
                    ? "You can assign an accountant from the client's page once they've joined."
                    : "The accountant can pick up clients once they've set up their account."}{" "}
                  The invite link expires after 24 hours.
                </p>
                <div className="cpc-actions">
                  <button type="submit" className="cpc-btn cpc-btn-primary" disabled={!canSubmit}>
                    {submitting ? "Sending…" : `Invite ${titleCase(role).toLowerCase()}`}
                  </button>
                  <button
                    type="button"
                    className="cpc-btn"
                    onClick={() => {
                      setFirstName("");
                      setLastName("");
                      setEmail("");
                      setError("");
                    }}
                  >
                    Clear
                  </button>
                </div>
              </form>
            </Card>

            <Card title="What they'll receive">
              <div className="cpc-card" style={{ background: "#faf9f7", display: "flex", flexDirection: "column", gap: "0.75em" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.7em" }}>
                  <span className="cpc-brand-logo" style={{ width: "2.2em", height: "2.2em", fontSize: "0.8em" }}>CP</span>
                  <span className="cpc-strong">Welcome to ClearPortfolio</span>
                </div>
                <p>Hello {firstName.trim() || "[First name]"},</p>
                <p>
                  You&apos;ve been invited to join ClearPortfolio as a <strong>{titleCase(role)}</strong>. Use the link to set your password and
                  sign in.
                </p>
                <div>
                  <span className="cpc-btn cpc-btn-dark" aria-hidden="true">Set up your account →</span>
                </div>
                <p className="cpc-small cpc-muted">This link expires in 24 hours.</p>
              </div>
            </Card>
          </div>
        </>
      ) : (
        <Card flush title="Pending invites" meta="Invited but not yet activated">
          <DataTable<InvitedUser>
            caption="Pending invites"
            loading={people.isLoading}
            rows={pending}
            rowKey={(user) => user.id}
            initialSort={{ id: "sent", direction: "desc" }}
            empty={<EmptyState title="No pending invites" />}
            columns={[
              { id: "name", header: "Person", cell: (u) => <Person name={u.name || u.email} sub={u.email} />, sortValue: (u) => u.name },
              { id: "role", header: "Role", cell: (u) => titleCase(u.role), sortValue: (u) => u.role },
              { id: "status", header: "Status", cell: (u) => <StatusBadge status={u.status} /> },
              { id: "by", header: "Invited by", cell: (u) => <span className="cpc-muted">{u.invitedByEmail || "—"}</span> },
              { id: "sent", header: "Sent", cell: (u) => formatDate(u.createdAt), sortValue: (u) => u.createdAt ?? "" },
            ]}
          />
        </Card>
      )}
    </>
  );
}
