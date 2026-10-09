"use client";

import Link from "next/link";
import { useState } from "react";
import { InviteResult, buildInviteLink, type InviteResponse } from "../../_console/components/InviteResult";
import { Card, Field, Notice, PageHeader, cx } from "../../_console/components/ui";
import { ApiError, apiPost } from "../../_console/lib/api";
import { invalidateResource } from "../../_console/lib/useResource";

type Step = 1 | 2 | 3 | 4;

type Form = {
  name: string;
  orgEmail: string;
  tenantCode: string;
  contactNumber: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  plan: "free" | "starter" | "practice" | "enterprise";
  maxUsers: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
};

const EMPTY: Form = {
  name: "",
  orgEmail: "",
  tenantCode: "",
  contactNumber: "",
  addressLine1: "",
  city: "",
  state: "NSW",
  postalCode: "",
  country: "AU",
  plan: "practice",
  maxUsers: "25",
  adminFirstName: "",
  adminLastName: "",
  adminEmail: "",
};

const PLANS: { id: Form["plan"]; title: string; body: string; users: string }[] = [
  { id: "free", title: "Free", body: "Trial and small practices", users: "5" },
  { id: "starter", title: "Starter", body: "Up to 10 users", users: "10" },
  { id: "practice", title: "Practice", body: "Up to 25 users", users: "25" },
  { id: "enterprise", title: "Enterprise", body: "Custom limits", users: "100" },
];

const STEPS: { step: Step; label: string; sub: string }[] = [
  { step: 1, label: "Organisation details", sub: "Name, contact, address" },
  { step: 2, label: "Plan & limits", sub: "Seats" },
  { step: 3, label: "Invite admin", sub: "Who runs this organisation" },
  { step: 4, label: "Review & create", sub: "Check and send" },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function stepErrors(step: Step, form: Form) {
  const errors: string[] = [];
  if (step === 1) {
    if (!form.name.trim()) errors.push("Organisation name");
    if (!EMAIL.test(form.orgEmail.trim())) errors.push("Contact email");
    if (!form.tenantCode.trim()) errors.push("Tenant code");
    if (!form.addressLine1.trim()) errors.push("Address");
    if (!form.city.trim()) errors.push("City");
    if (!form.state.trim()) errors.push("State");
    if (!form.postalCode.trim()) errors.push("Postcode");
  }
  if (step === 2 && !(Number(form.maxUsers) > 0)) errors.push("Max users");
  if (step === 3) {
    if (!form.adminFirstName.trim()) errors.push("Admin first name");
    if (!EMAIL.test(form.adminEmail.trim())) errors.push("Admin email");
  }
  return errors;
}

export default function CreateOrganisationPage() {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<Form>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ orgName: string; invite?: { link: string; password: string; email: string }; inviteError?: string } | null>(null);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
  const errors = stepErrors(step, form);

  function next() {
    setTouched(true);
    if (errors.length) return;
    setTouched(false);
    setStep((current) => Math.min(4, current + 1) as Step);
  }

  async function create() {
    setSubmitting(true);
    setError("");
    try {
      const created = await apiPost<{ organization: { id: string; name: string } }>("/api/organizations/create", {
        name: form.name.trim(),
        org_email: form.orgEmail.trim(),
        tenant_code: form.tenantCode.trim(),
        contact_number: form.contactNumber.trim(),
        address_line1: form.addressLine1.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        country: form.country.trim() || "AU",
        postal_code: form.postalCode.trim(),
        subscription_plan: form.plan,
        max_users_allowed: Number(form.maxUsers) || 5,
      });
      invalidateResource("super:");

      try {
        const invite = await apiPost<InviteResponse>("/api/invite-user", {
          email: form.adminEmail.trim(),
          role: "admin",
          organization_id: created.organization.id,
          full_name: `${form.adminFirstName.trim()} ${form.adminLastName.trim()}`.trim(),
        });
        setDone({
          orgName: created.organization.name || form.name,
          invite: {
            link: buildInviteLink(window.location.origin, invite, { email: form.adminEmail.trim(), role: "admin" }),
            password: String(invite.temporaryPassword || ""),
            email: form.adminEmail.trim(),
          },
        });
      } catch (inviteError) {
        setDone({
          orgName: created.organization.name || form.name,
          inviteError: inviteError instanceof Error ? inviteError.message : "The admin invite couldn't be sent.",
        });
      }
    } catch (cause) {
      setError(cause instanceof ApiError || cause instanceof Error ? cause.message : "The organisation couldn't be created.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <>
        <PageHeader title="Organisation created" crumbs={[{ label: "Organisations", href: "/dashboard/super-admin/organisations" }, { label: done.orgName }]} />
        <Notice tone="green" title={`${done.orgName} is ready`}>The organisation now appears in your list.</Notice>
        {done.invite ? <InviteResult {...done.invite} /> : null}
        {done.inviteError ? (
          <Notice tone="amber" title="The admin invite wasn't sent">
            {done.inviteError} You can invite the admin from the organisation&apos;s page.
          </Notice>
        ) : null}
        <div className="cpc-actions">
          <Link className="cpc-btn cpc-btn-primary" href="/dashboard/super-admin/organisations">
            Go to organisations
          </Link>
          <button
            type="button"
            className="cpc-btn"
            onClick={() => {
              setForm(EMPTY);
              setStep(1);
              setDone(null);
            }}
          >
            Add another
          </button>
        </div>
      </>
    );
  }

  const input = (key: keyof Form, label: string, options: { type?: string; placeholder?: string; span?: boolean; autoComplete?: string } = {}) => {
    const invalid = touched && errors.some((name) => label.toLowerCase().startsWith(name.toLowerCase()));
    return (
      <Field label={label} htmlFor={`co-${key}`} className={options.span ? "cpc-span-all" : undefined}>
        <input
          id={`co-${key}`}
          className="cpc-input"
          type={options.type ?? "text"}
          autoComplete={options.autoComplete ?? "off"}
          placeholder={options.placeholder}
          value={form[key]}
          aria-invalid={invalid}
          style={invalid ? { borderColor: "var(--cpc-red)" } : undefined}
          onChange={(event) => set(key, event.target.value as Form[typeof key])}
        />
      </Field>
    );
  };

  return (
    <div style={{ maxWidth: "80em", display: "flex", flexDirection: "column", gap: "1.45em" }}>
      <PageHeader
        title="Add organisation"
        subtitle="Four short steps. The admin gets a link to set up their account."
        crumbs={[{ label: "Organisations", href: "/dashboard/super-admin/organisations" }, { label: "Add organisation" }]}
      />

      <div className="cpc-split">
        <nav className="cpc-card cpc-steps" aria-label="Steps" style={{ flex: "1 1 16em", padding: "0.85em" }}>
          {STEPS.map((item) => {
            const on = item.step === step;
            const isDone = item.step < step;
            return (
              <button
                key={item.step}
                type="button"
                className={cx("cpc-step", on && "is-on", isDone && "is-done")}
                aria-current={on ? "step" : undefined}
                disabled={item.step > step}
                onClick={() => setStep(item.step)}
              >
                <span className="cpc-step-dot">{isDone ? "✓" : item.step}</span>
                <span>
                  <span className="cpc-strong" style={{ display: "block", fontSize: "0.96em" }}>{item.label}</span>
                  <span className="cpc-person-sub">{item.sub}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="cpc-split-main">
          <Card title={STEPS[step - 1].label}>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.15em" }}>
              {step === 1 ? (
                <div className="cpc-form-grid">
                  {input("name", "Organisation name *", { placeholder: "e.g. Bluegum Accountants" })}
                  {input("orgEmail", "Contact email *", { type: "email", placeholder: "hello@company.com.au" })}
                  {input("tenantCode", "Tenant code *", { placeholder: "Unique short code, e.g. BLUEGUM" })}
                  {input("contactNumber", "Phone", { type: "tel", placeholder: "+61" })}
                  {input("addressLine1", "Address *", { span: true, placeholder: "Street address" })}
                  {input("city", "City *", { placeholder: "Suburb or city" })}
                  <Field label="State *" htmlFor="co-state">
                    <select id="co-state" className="cpc-select" value={form.state} onChange={(e) => set("state", e.target.value)}>
                      {["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                  {input("postalCode", "Postcode *", { placeholder: "2000" })}
                </div>
              ) : null}

              {step === 2 ? (
                <>
                  <div className="cpc-grid-4" role="radiogroup" aria-label="Plan">
                    {PLANS.map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        role="radio"
                        aria-checked={form.plan === plan.id}
                        className={cx("cpc-role-card", form.plan === plan.id && "is-on")}
                        onClick={() => setForm((current) => ({ ...current, plan: plan.id, maxUsers: plan.users }))}
                      >
                        <span className="cpc-strong">{plan.title}</span>
                        <span className="cpc-small cpc-muted">{plan.body}</span>
                      </button>
                    ))}
                  </div>
                  <div className="cpc-form-grid">{input("maxUsers", "Max users *", { type: "number" })}</div>
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <p className="cpc-small cpc-muted">
                    This person runs the organisation: invites accountants and clients and manages its data settings.
                  </p>
                  <div className="cpc-form-grid">
                    {input("adminFirstName", "Admin first name *")}
                    {input("adminLastName", "Last name")}
                    {input("adminEmail", "Admin email *", { type: "email", span: true })}
                  </div>
                  <p className="cpc-small cpc-muted">The invite link expires after 24 hours.</p>
                </>
              ) : null}

              {step === 4 ? (
                <div className="cpc-grid-3">
                  <div className="cpc-card" style={{ padding: "1.15em" }}>
                    <div className="cpc-label" style={{ marginBottom: "0.7em" }}>Organisation</div>
                    <dl className="cpc-dl">
                      <dt>Name</dt>
                      <dd>{form.name}</dd>
                      <dt>Contact</dt>
                      <dd>{form.orgEmail}</dd>
                      <dt>Tenant code</dt>
                      <dd>{form.tenantCode}</dd>
                      <dt>Address</dt>
                      <dd>{[form.addressLine1, form.city, form.state, form.postalCode].filter(Boolean).join(", ")}</dd>
                    </dl>
                  </div>
                  <div className="cpc-card" style={{ padding: "1.15em" }}>
                    <div className="cpc-label" style={{ marginBottom: "0.7em" }}>Plan</div>
                    <dl className="cpc-dl">
                      <dt>Plan</dt>
                      <dd>{PLANS.find((p) => p.id === form.plan)?.title}</dd>
                      <dt>Max users</dt>
                      <dd>{form.maxUsers}</dd>
                    </dl>
                  </div>
                  <div className="cpc-card" style={{ padding: "1.15em" }}>
                    <div className="cpc-label" style={{ marginBottom: "0.7em" }}>Admin</div>
                    <dl className="cpc-dl">
                      <dt>Name</dt>
                      <dd>{`${form.adminFirstName} ${form.adminLastName}`.trim()}</dd>
                      <dt>Email</dt>
                      <dd>{form.adminEmail}</dd>
                      <dt>Invite</dt>
                      <dd>Sent on create</dd>
                    </dl>
                  </div>
                </div>
              ) : null}

              {touched && errors.length ? (
                <Notice tone="red" title="A few fields need attention">{errors.join(", ")}</Notice>
              ) : null}
              {error ? <Notice tone="red" title="Organisation not created">{error}</Notice> : null}

              <hr className="cpc-hr" />
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.7em", flexWrap: "wrap" }}>
                <button type="button" className="cpc-btn" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1) as Step)}>
                  Back
                </button>
                <div className="cpc-actions">
                  <Link className="cpc-btn cpc-btn-ghost" href="/dashboard/super-admin/organisations">
                    Cancel
                  </Link>
                  {step < 4 ? (
                    <button type="button" className="cpc-btn cpc-btn-primary" onClick={next}>
                      Continue
                    </button>
                  ) : (
                    <button type="button" className="cpc-btn cpc-btn-primary" disabled={submitting} onClick={create}>
                      {submitting ? "Creating…" : "Create organisation & send invite"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
