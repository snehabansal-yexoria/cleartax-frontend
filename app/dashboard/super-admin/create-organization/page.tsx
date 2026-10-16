"use client";

import Link from "next/link";
import { useState } from "react";
import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import { InviteResult, buildInviteLink, type InviteResponse } from "../../_console/components/InviteResult";
import { Card, Field, Notice, PageHeader, PendingAction } from "../../_console/components/ui";
import { apiPost } from "../../_console/lib/api";
import { invalidateResource } from "../../_console/lib/useResource";

type Step = 1 | 2 | 3 | 4;

type Form = {
  name: string;
  address: string;
  timeZone: string;
  fyStart: string;
  maxAccountants: string;
  maxRms: string;
  maxClients: string;
  storage: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPhone: string;
  message: string;
};

const EMPTY: Form = {
  name: "",
  address: "",
  timeZone: "Australia/Sydney",
  fyStart: "1 July (ATO)",
  maxAccountants: "20",
  maxRms: "5",
  maxClients: "150",
  storage: "50 GB",
  adminFirstName: "",
  adminLastName: "",
  adminEmail: "",
  adminPhone: "",
  message: "",
};

const TIME_ZONES = [
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST)" },
  { value: "Australia/Adelaide", label: "Australia/Adelaide (ACST)" },
  { value: "Australia/Perth", label: "Australia/Perth (AWST)" },
];

const STEP_TITLES: Record<Step, string> = {
  1: "Organisation details",
  2: "Limits",
  3: "Invite the admin",
  4: "Review & create",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATES = "NSW|VIC|QLD|WA|SA|TAS|ACT|NT";

/**
 * Split "12 King William St, Adelaide SA 5000, Australia" into the fields the
 * organisations API stores. Returns null when suburb, state or postcode is missing.
 */
function parseAddress(value: string) {
  const parts = value
    .replace(/,?\s*Australia\s*$/i, "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const locality = parts[parts.length - 1].match(new RegExp(`^(.*?)\\s+(${STATES})\\s+(\\d{4})$`, "i"));
  if (!locality) return null;
  return {
    addressLine1: parts.slice(0, -1).join(", "),
    city: locality[1].trim(),
    state: locality[2].toUpperCase(),
    postalCode: locality[3],
  };
}

/** Short unique code the organisations API requires; not shown in the design. */
function tenantCodeFor(name: string) {
  const base = name.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8) || "ORG";
  return `${base}${Math.floor(1000 + Math.random() * 9000)}`;
}

function stepErrors(step: Step, form: Form) {
  const errors: string[] = [];
  if (step === 1) {
    if (!form.name.trim()) errors.push("Enter the organisation name.");
    if (!parseAddress(form.address)) {
      errors.push("Enter the full address with suburb, state and postcode, e.g. 12 King William St, Adelaide SA 5000.");
    }
  }
  if (step === 2) {
    for (const [label, value] of [
      ["Max accountants", form.maxAccountants],
      ["Max RMs", form.maxRms],
      ["Max clients", form.maxClients],
    ] as const) {
      if (value.trim() === "" || !(Number(value) >= 0)) errors.push(`${label} must be a number.`);
    }
  }
  if (step === 3) {
    if (!form.adminFirstName.trim()) errors.push("Enter the admin's first name.");
    if (!form.adminLastName.trim()) errors.push("Enter the admin's last name.");
    if (!EMAIL.test(form.adminEmail.trim())) errors.push("Enter a valid admin email.");
  }
  return errors;
}

export default function CreateOrganisationPage() {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<Form>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{
    orgName: string;
    invite?: { link: string; password: string; email: string };
    inviteError?: string;
  } | null>(null);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
  const errors = stepErrors(step, form);

  function next() {
    setTouched(true);
    if (errors.length) return;
    setTouched(false);
    setStep((current) => Math.min(4, current + 1) as Step);
  }

  async function create() {
    const address = parseAddress(form.address);
    if (!address) {
      setStep(1);
      setTouched(true);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const created = await apiPost<{ organization: { id: string; name: string } }>("/api/organizations/create", {
        name: form.name.trim(),
        // The design has no separate contact email; the admin is the contact.
        org_email: form.adminEmail.trim(),
        tenant_code: tenantCodeFor(form.name),
        contact_number: "",
        address_line1: address.addressLine1,
        city: address.city,
        state: address.state,
        country: "AU",
        postal_code: address.postalCode,
        // The API stores one seat limit: accountants + RMs + clients + the admin.
        max_users_allowed:
          (Number(form.maxAccountants) || 0) + (Number(form.maxRms) || 0) + (Number(form.maxClients) || 0) + 1,
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
      setError(cause instanceof Error ? cause.message : "The organisation couldn't be created.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div style={{ maxWidth: "78em", display: "flex", flexDirection: "column", gap: "1.45em" }}>
        <PageHeader
          title="Organisation created"
          crumbs={[{ label: "Organisations", href: "/dashboard/super-admin/organisations" }, { label: done.orgName }]}
        />
        <Notice tone="green" title={`${done.orgName} is ready`}>
          It now appears in your organisations list.
        </Notice>
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
      </div>
    );
  }

  const text = (
    key: keyof Form,
    label: string,
    options: { type?: string; placeholder?: string; span?: boolean; autoComplete?: string; inputMode?: "numeric" } = {},
  ) => (
    <Field label={label} htmlFor={`co-${key}`} className={options.span ? "cpc-span-all" : undefined}>
      <input
        id={`co-${key}`}
        className="cpc-input"
        type={options.type ?? "text"}
        inputMode={options.inputMode}
        autoComplete={options.autoComplete ?? "off"}
        placeholder={options.placeholder}
        value={form[key]}
        onChange={(event) => set(key, event.target.value as Form[typeof key])}
      />
    </Field>
  );

  const reviewBox = (title: string, rows: [string, string][]) => (
    <div className="cpc-card" style={{ padding: "1.15em" }}>
      <div className="cpc-label" style={{ marginBottom: "0.7em" }}>
        {title}
      </div>
      <dl className="cpc-dl">
        {rows.map(([term, value]) => (
          <div key={term} style={{ display: "contents" }}>
            <dt>{term}</dt>
            <dd>{value || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );

  return (
    <div style={{ maxWidth: "78em", display: "flex", flexDirection: "column", gap: "1.45em" }}>
      <PageHeader
        title="Add organisation"
        subtitle="Four short steps. The admin gets an email with a link to set up their account."
        crumbs={[{ label: "Organisations", href: "/dashboard/super-admin/organisations" }, { label: "Add organisation" }]}
      />

      <Card title={STEP_TITLES[step]} meta={`Step ${step} of 4`}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.15em" }}>
          {step === 1 ? (
            <>
              <div style={{ display: "flex", gap: "1em", alignItems: "center", flexWrap: "wrap" }}>
                <span
                  className="cpc-brand-logo"
                  style={{ width: "4em", height: "4em", fontSize: "0.9em", borderRadius: "0.85em", background: "#efeee9", color: "#5b6170" }}
                  aria-hidden="true"
                >
                  Logo
                </span>
                <PendingAction small reason="Logo upload needs an organisation logo endpoint">
                  Upload logo
                </PendingAction>
                <span className="cpc-small cpc-muted">Optional. The admin can add it later.</span>
              </div>
              <div className="cpc-form-grid">
                {text("name", "Organisation name *", { placeholder: "e.g. Bluegum Accountants", span: true })}
                <Field label="Address *" htmlFor="co-address" className="cpc-span-all">
                  <AddressAutocomplete
                    id="co-address"
                    value={form.address}
                    onChange={(value) => set("address", value)}
                    placeholder="Street, suburb, state, postcode"
                    inputClassName="cpc-input"
                  />
                </Field>
                <Field label="Time zone" htmlFor="co-tz">
                  <select id="co-tz" className="cpc-select" value={form.timeZone} onChange={(e) => set("timeZone", e.target.value)}>
                    {TIME_ZONES.map((zone) => (
                      <option key={zone.value} value={zone.value}>
                        {zone.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Financial year starts" htmlFor="co-fy">
                  <select id="co-fy" className="cpc-select" value={form.fyStart} onChange={(e) => set("fyStart", e.target.value)}>
                    <option>1 July (ATO)</option>
                  </select>
                </Field>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="cpc-form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 12em), 1fr))" }}>
                {text("maxAccountants", "Max accountants", { inputMode: "numeric" })}
                {text("maxRms", "Max RMs", { inputMode: "numeric" })}
                {text("maxClients", "Max clients", { inputMode: "numeric" })}
                <Field label="Storage" htmlFor="co-storage">
                  <select id="co-storage" className="cpc-select" value={form.storage} onChange={(e) => set("storage", e.target.value)}>
                    <option>50 GB</option>
                    <option>100 GB</option>
                  </select>
                </Field>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <p className="cpc-small cpc-muted">
                This person will run the organisation: invite accountants, RMs and clients, and manage its data settings.
              </p>
              <div className="cpc-form-grid">
                {text("adminFirstName", "First name *", { placeholder: "e.g. Sarah" })}
                {text("adminLastName", "Last name *", { placeholder: "e.g. Pike" })}
                {text("adminEmail", "Email *", { type: "email", placeholder: "sarah@bluegum.com.au" })}
                {text("adminPhone", "Phone", { type: "tel", placeholder: "+61", autoComplete: "tel" })}
                <Field label="Personal message (optional)" htmlFor="co-message" className="cpc-span-all">
                  <textarea
                    id="co-message"
                    className="cpc-textarea"
                    placeholder="Short note added to the invite email"
                    value={form.message}
                    onChange={(e) => set("message", e.target.value)}
                  />
                </Field>
              </div>
              <p className="cpc-small cpc-muted">The invite link expires after 24 hours and can be resent from the Admins page.</p>
            </>
          ) : null}

          {step === 4 ? (
            <div className="cpc-grid-3">
              {reviewBox("Organisation", [
                ["Name", form.name],
                ["Contact", form.adminEmail],
                ["Address", form.address],
                ["Time zone", form.timeZone],
              ])}
              {reviewBox("Limits", [
                ["Users", `${form.maxAccountants} accountants · ${form.maxRms} RMs · ${form.maxClients} clients`],
                ["Storage", form.storage],
              ])}
              {reviewBox("Admin", [
                ["Name", `${form.adminFirstName} ${form.adminLastName}`.trim()],
                ["Email", form.adminEmail],
                ["Invite", "Sent on create · expires in 24 h"],
              ])}
            </div>
          ) : null}

          {touched && errors.length ? (
            <Notice tone="red" title="A few fields need attention">
              {errors.join(" ")}
            </Notice>
          ) : null}
          {error ? (
            <Notice tone="red" title="Organisation not created">
              {error}
            </Notice>
          ) : null}

          <hr className="cpc-hr" />
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.7em", flexWrap: "wrap" }}>
            <button
              type="button"
              className="cpc-btn"
              disabled={step === 1}
              onClick={() => {
                setTouched(false);
                setStep((current) => Math.max(1, current - 1) as Step);
              }}
            >
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
  );
}
