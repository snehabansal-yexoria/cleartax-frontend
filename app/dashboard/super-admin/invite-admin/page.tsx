"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { InviteResult, buildInviteLink, type InviteResponse } from "../../_console/components/InviteResult";
import { Card, Field, Notice, PageHeader, SelectField } from "../../_console/components/ui";
import { apiPost } from "../../_console/lib/api";
import { useOrganisations } from "../../_console/lib/superAdminData";
import { invalidateResource } from "../../_console/lib/useResource";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function InviteAdminPage() {
  const params = useSearchParams();
  const orgs = useOrganisations();
  const [orgId, setOrgId] = useState(params.get("org") ?? "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ link: string; password: string; email: string } | null>(null);

  const options = useMemo(
    () => [{ value: "", label: "Choose an organisation" }, ...(orgs.data ?? []).map((org) => ({ value: org.id, label: org.name }))],
    [orgs.data],
  );
  const canSubmit = Boolean(orgId) && EMAIL.test(email.trim()) && Boolean(firstName.trim()) && !submitting;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const response = await apiPost<InviteResponse>("/api/invite-user", {
        email: email.trim(),
        role: "admin",
        organization_id: orgId,
        full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      });
      setResult({
        link: buildInviteLink(window.location.origin, response, { email: email.trim(), role: "admin" }),
        password: String(response.temporaryPassword || ""),
        email: email.trim(),
      });
      setFirstName("");
      setLastName("");
      setEmail("");
      invalidateResource("super:admins");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong while creating the invite.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: "52em", display: "flex", flexDirection: "column", gap: "1.45em" }}>
      <PageHeader title="Invite admin" subtitle="Invite the person who will run an organisation." crumbs={[{ label: "Admins", href: "/dashboard/super-admin/admins" }, { label: "Invite admin" }]} />
      {result ? <InviteResult {...result} /> : null}
      {error ? <Notice tone="red" title="Invite not sent">{error}</Notice> : null}
      <Card title="Invite details">
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "1em" }} noValidate>
          <SelectField id="ia-org" label="Organisation *" value={orgId} onChange={setOrgId} options={options} />
          <div className="cpc-form-grid">
            <Field label="First name *" htmlFor="ia-first">
              <input id="ia-first" className="cpc-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </Field>
            <Field label="Last name" htmlFor="ia-last">
              <input id="ia-last" className="cpc-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </Field>
            <Field label="Email *" htmlFor="ia-email" className="cpc-span-all">
              <input id="ia-email" className="cpc-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>
          <div className="cpc-actions">
            <button type="submit" className="cpc-btn cpc-btn-primary" disabled={!canSubmit}>
              {submitting ? "Sending…" : "Send invite"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
