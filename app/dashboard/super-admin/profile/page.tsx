"use client";

import { useMemo } from "react";
import { PersonalDetailsFields, splitName, useFormState } from "../../_console/components/ProfileForm";
import { Avatar, Card, Notice, PageHeader, PendingAction, Skeleton } from "../../_console/components/ui";
import { useCurrentUser } from "../../_console/lib/superAdminData";

export default function SuperAdminProfilePage() {
  const me = useCurrentUser();
  const initial = useMemo(
    () => (me.data ? { ...splitName(me.data.fullName), email: me.data.email, phone: "" } : undefined),
    [me.data],
  );
  const form = useFormState(initial);
  const name = [form.values?.firstName, form.values?.lastName].filter(Boolean).join(" ") || me.data?.email || "Super admin";

  return (
    <div style={{ maxWidth: "78em", display: "flex", flexDirection: "column", gap: "1.45em" }}>
      <PageHeader
        title="My profile"
        subtitle="Your own details, sign-in security and the emails you get."
        actions={
          <>
            <button type="button" className="cpc-btn" disabled={!form.dirty} onClick={form.reset}>
              Discard
            </button>
            <PendingAction variant="primary" reason="Saving needs a user update endpoint">
              Save changes
            </PendingAction>
          </>
        }
      />

      {me.error ? <Notice tone="red" title="Couldn't load your profile">{me.error.message}</Notice> : null}

      <Card title="Personal details">
        <div style={{ display: "flex", flexDirection: "column", gap: "1.15em" }}>
          <div style={{ display: "flex", gap: "1em", alignItems: "center", flexWrap: "wrap" }}>
            <Avatar name={name} large />
            <PendingAction small reason="Photo upload needs a user update endpoint">Upload photo</PendingAction>
          </div>
          {me.isLoading ? <Skeleton height="6em" /> : <PersonalDetailsFields idPrefix="sa" values={form.values} onChange={form.set} />}
        </div>
      </Card>
    </div>
  );
}
