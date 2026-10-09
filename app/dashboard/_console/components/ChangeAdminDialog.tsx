"use client";

import { useState, type FormEvent } from "react";
import { apiPost } from "../lib/api";
import type { InvitedUser } from "../lib/adminData";
import { invalidateResource } from "../lib/useResource";
import { Dialog } from "./Dialog";
import { InviteResult, buildInviteLink, type InviteResponse } from "./InviteResult";
import { Field, Notice, Person, cx } from "./ui";

type Handover = "deactivate" | "keep";

/**
 * Replaces an organisation's admin by inviting a new person by email.
 * The invite goes through POST /api/invite-user. Deactivating the previous
 * admin needs a backend endpoint, so that choice is recorded but not applied.
 */
export function ChangeAdminDialog({
  open,
  onClose,
  organisation,
  currentAdmin,
  mode = "change",
}: {
  open: boolean;
  onClose: () => void;
  organisation: { id: string; name: string } | null;
  currentAdmin: InvitedUser | null;
  mode?: "change" | "invite";
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [handover, setHandover] = useState<Handover>("keep");
  const [reason, setReason] = useState("Admin left the company");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ link: string; password: string; email: string } | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isChange = mode === "change" && Boolean(currentAdmin);

  function close() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setError("");
    setResult(null);
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organisation || !emailValid || !firstName.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await apiPost<InviteResponse>("/api/invite-user", {
        email: email.trim(),
        role: "admin",
        organization_id: organisation.id,
        full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      });
      setResult({
        link: buildInviteLink(window.location.origin, response, { email: email.trim(), role: "admin" }),
        password: String(response.temporaryPassword || ""),
        email: email.trim(),
      });
      invalidateResource("super:admins");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The invite couldn't be created.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={isChange ? "Change admin" : "Invite admin"}
      subtitle={organisation?.name}
      footer={
        result ? (
          <button type="button" className="cpc-btn cpc-btn-primary" onClick={close}>
            Done
          </button>
        ) : (
          <>
            <button type="button" className="cpc-btn" onClick={close}>
              Cancel
            </button>
            <button
              type="submit"
              form="change-admin-form"
              className="cpc-btn cpc-btn-primary"
              disabled={submitting || !emailValid || !firstName.trim() || !organisation}
            >
              {submitting ? "Sending…" : isChange ? "Send invite & change admin" : "Send invite"}
            </button>
          </>
        )
      }
    >
      {result ? (
        <>
          <InviteResult {...result} />
          {isChange && handover === "deactivate" ? (
            <Notice tone="amber" title="Previous admin is still active">
              Deactivating {currentAdmin?.name || currentAdmin?.email} needs a backend endpoint. Ask the platform team to disable the account until then.
            </Notice>
          ) : null}
        </>
      ) : (
        <form id="change-admin-form" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "1em" }} noValidate>
          {isChange && currentAdmin ? (
            <div className="cpc-card" style={{ padding: "0.85em", background: "#faf9f7" }}>
              <Person name={currentAdmin.name || currentAdmin.email} sub={`Current admin · ${currentAdmin.email}`} />
            </div>
          ) : null}
          <span className="cpc-label">Invite the new admin</span>
          <div className="cpc-form-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <Field label="First name *" htmlFor="ca-first">
              <input id="ca-first" className="cpc-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </Field>
            <Field label="Last name" htmlFor="ca-last">
              <input id="ca-last" className="cpc-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </Field>
          </div>
          <Field label="Email *" htmlFor="ca-email">
            <input
              id="ca-email"
              className="cpc-input"
              type="email"
              value={email}
              aria-invalid={email.length > 0 && !emailValid}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {isChange ? (
            <>
              <Field label={`${currentAdmin?.name || "Current admin"}'s account after the change`}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5em" }}>
                  {(
                    [
                      ["keep", "Keep until the new admin accepts", "Then deactivate"],
                      ["deactivate", "Deactivate", "Login blocked. Their history is kept."],
                    ] as const
                  ).map(([value, title, sub]) => (
                    <label key={value} className={cx("cpc-radio-row", handover === value && "is-on")}>
                      <input type="radio" name="handover" checked={handover === value} onChange={() => setHandover(value)} />
                      <span>
                        <span className="cpc-strong" style={{ display: "block" }}>{title}</span>
                        <span className="cpc-person-sub">{sub}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Reason" htmlFor="ca-reason">
                <select id="ca-reason" className="cpc-select" value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option>Admin left the company</option>
                  <option>Organisation request</option>
                  <option>Other</option>
                </select>
              </Field>
            </>
          ) : null}
          {error ? <Notice tone="red" title="Invite not sent">{error}</Notice> : null}
        </form>
      )}
    </Dialog>
  );
}
