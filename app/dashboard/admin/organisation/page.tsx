"use client";

import { useMemo, useState } from "react";
import { PersonalDetailsFields, splitName, useFormState } from "../../_console/components/ProfileForm";
import { Badge, Card, Field, Notice, PageHeader, PendingAction, Skeleton, Tabs } from "../../_console/components/ui";
import { useOrganization } from "../../_console/lib/adminData";
import { initials } from "../../_console/lib/format";
import { useCurrentUser } from "../../_console/lib/superAdminData";

type Section = "organisation" | "me";

const SAVE_REASON = "Saving needs the organisation and user update endpoints";

export default function AdminOrganisationProfilePage() {
  const organization = useOrganization();
  const me = useCurrentUser();
  const [section, setSection] = useState<Section>("organisation");

  const orgInitial = useMemo(
    () =>
      organization.data
        ? { tradingName: organization.data.name, contactEmail: "", phone: "", address: "" }
        : undefined,
    [organization.data],
  );
  const org = useFormState(orgInitial);

  const meInitial = useMemo(
    () => (me.data ? { ...splitName(me.data.fullName), email: me.data.email, phone: "" } : undefined),
    [me.data],
  );
  const profile = useFormState(meInitial);
  const dirty = org.dirty || profile.dirty;

  function scrollTo(next: Section) {
    setSection(next);
    document.getElementById(`section-${next}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <PageHeader
        title="Organisation profile"
        subtitle="You administer one organisation. It was created by the platform's Super Admin, who controls the locked fields."
        actions={
          <>
            <button
              type="button"
              className="cpc-btn"
              disabled={!dirty}
              onClick={() => {
                org.reset();
                profile.reset();
              }}
            >
              Discard
            </button>
            <PendingAction variant="primary" reason={SAVE_REASON}>
              Save changes
            </PendingAction>
          </>
        }
      />

      {organization.error ? <Notice tone="red" title="Couldn't load your organisation">{organization.error.message}</Notice> : null}

      <Tabs
        label="Profile sections"
        value={section}
        onChange={scrollTo}
        items={[
          { id: "organisation", label: "Organisation" },
          { id: "me", label: "My profile" },
        ]}
      />

      <div className="cpc-split">
        <div className="cpc-split-main">
          <Card id="section-organisation" title="Organisation details" actions={<Badge tone="gray">Created by Super Admin</Badge>}>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.15em" }}>
              <div style={{ display: "flex", gap: "1.15em", alignItems: "center", flexWrap: "wrap" }}>
                <span className="cpc-brand-logo" style={{ width: "4.5em", height: "4.5em", fontSize: "1.3em", borderRadius: "1em" }} aria-hidden="true">
                  {initials(organization.data?.name ?? "Org")}
                </span>
                <div className="cpc-actions">
                  <PendingAction small reason="Logo upload needs an organisation update endpoint">Upload logo</PendingAction>
                </div>
                <span className="cpc-small cpc-muted">PNG or SVG, at least 256 px. Shown on invites and exported reports.</span>
              </div>

              {organization.isLoading ? (
                <Skeleton height="9em" />
              ) : (
                <div className="cpc-form-grid">
                  <Field label="Legal name · locked" htmlFor="o-legal">
                    <input id="o-legal" className="cpc-input" value={organization.data?.name ?? ""} disabled />
                  </Field>
                  <Field label="Trading name" htmlFor="o-trading">
                    <input id="o-trading" className="cpc-input" value={org.values?.tradingName ?? ""} onChange={(e) => org.set("tradingName", e.target.value)} />
                  </Field>
                  <Field label="Contact email" htmlFor="o-email">
                    <input id="o-email" className="cpc-input" type="email" autoComplete="email" value={org.values?.contactEmail ?? ""} placeholder="admin@yourpractice.com.au" onChange={(e) => org.set("contactEmail", e.target.value)} />
                  </Field>
                  <Field label="Phone" htmlFor="o-phone">
                    <input id="o-phone" className="cpc-input" type="tel" autoComplete="tel" value={org.values?.phone ?? ""} placeholder="+61" onChange={(e) => org.set("phone", e.target.value)} />
                  </Field>
                  <Field label="Address" htmlFor="o-address" className="cpc-span-all">
                    <input id="o-address" className="cpc-input" autoComplete="street-address" value={org.values?.address ?? ""} placeholder="Street, suburb, state, postcode" onChange={(e) => org.set("address", e.target.value)} />
                  </Field>
                </div>
              )}
            </div>
          </Card>

          <Card id="section-me" title="My profile">
            <div style={{ display: "flex", flexDirection: "column", gap: "1.15em" }}>
              {me.isLoading ? (
                <Skeleton height="6em" />
              ) : (
                <PersonalDetailsFields idPrefix="me" values={profile.values} onChange={profile.set} />
              )}
              <div className="cpc-actions">
                <PendingAction small reason="Password change needs a Cognito change-password flow in the app">Change password</PendingAction>
                <PendingAction small reason="MFA settings need a Cognito MFA flow in the app">Manage MFA</PendingAction>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
