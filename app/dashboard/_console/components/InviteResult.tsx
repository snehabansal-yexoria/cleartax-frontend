"use client";

import { useState } from "react";
import { Notice } from "./ui";

/** Response of POST /api/invite-user */
export type InviteResponse = {
  email?: string;
  role?: string;
  temporaryPassword?: string;
  invitationToken?: string;
};

/** Same link format the previous invite screens produced: /invite?token=…#temporary_password=… */
export function buildInviteLink(origin: string, response: InviteResponse, fallback: { email: string; role: string }) {
  const url = new URL("/invite", origin);
  url.searchParams.set("token", String(response.invitationToken || ""));
  url.searchParams.set("email", String(response.email || fallback.email));
  url.searchParams.set("role", String(response.role || fallback.role));
  return `${url.toString()}#temporary_password=${encodeURIComponent(String(response.temporaryPassword || ""))}`;
}

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
      Send this link to them. It includes the temporary password and takes them straight to setting their own password. It expires after 24
      hours. Backup temporary password: <code style={{ fontWeight: 600 }}>{password || "—"}</code>
    </Notice>
  );
}
