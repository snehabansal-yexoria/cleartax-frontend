"use client";

import { useState } from "react";
import { SHOW_INVITE_CREDENTIALS } from "@/src/lib/appConfig";
import { Notice } from "./ui";

/** Response of POST /api/invite-user */
export type InviteResponse = {
  email?: string;
  role?: string;
  temporaryPassword?: string;
  invitationToken?: string;
};

/** Same link format the other invite screens produce: /invite?token=…#temporary_password=… */
export function buildInviteLink(origin: string, response: InviteResponse, fallback: { email: string; role: string }) {
  const url = new URL("/invite", origin);
  url.searchParams.set("token", String(response.invitationToken || ""));
  url.searchParams.set("email", String(response.email || fallback.email));
  url.searchParams.set("role", String(response.role || fallback.role));
  return `${url.toString()}#temporary_password=${encodeURIComponent(String(response.temporaryPassword || ""))}`;
}

/**
 * Confirmation after an invite. The invitee gets the link by email; the raw
 * link and temporary password are only shown when SHOW_INVITE_CREDENTIALS is on,
 * matching the rest of the app.
 */
export function InviteResult({ link, password, email }: { link: string; password: string; email: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (!SHOW_INVITE_CREDENTIALS) {
    return (
      <Notice tone="green" title={`Invite sent to ${email}`}>
        They&apos;ll get an email with a secure link to set their password. The link expires after 24 hours.
      </Notice>
    );
  }

  return (
    <Notice
      tone="green"
      title={`Invite created for ${email}`}
      action={
        <button type="button" className="cpc-btn cpc-btn-sm" onClick={copy}>
          {copied ? "Copied" : "Copy invite link"}
        </button>
      }
    >
      An email with this link has been sent. It expires after 24 hours. Backup temporary password:{" "}
      <code style={{ fontWeight: 600 }}>{password || "—"}</code>
    </Notice>
  );
}
