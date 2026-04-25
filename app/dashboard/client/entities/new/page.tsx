"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AddEntityWizard from "@/app/components/AddEntityWizard";
import { getSession } from "@/src/lib/session";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

const USER_ID_LENGTH = 10;

function subFromJwt(jwt: string): string {
  const [, payload] = jwt.split(".");
  if (!payload) return "";
  try {
    const json =
      typeof atob === "function"
        ? atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
        : Buffer.from(payload, "base64").toString("utf8");
    const claims = JSON.parse(json) as { sub?: string };
    return claims.sub ?? "";
  } catch {
    return "";
  }
}

export default function ClientAddEntityPage() {
  const router = useRouter();
  const [selfUserId, setSelfUserId] = useState<string | null>(null);

  useEffect(() => {
    async function resolveSelf() {
      const session = (await getSession()) as SessionWithIdToken | null;
      if (!session) {
        router.replace("/login/user");
        return;
      }
      const jwt = session.getIdToken().getJwtToken();
      const sub = subFromJwt(jwt);
      if (!sub) {
        router.replace("/login/user");
        return;
      }
      setSelfUserId(sub.slice(0, USER_ID_LENGTH));
    }

    resolveSelf();
  }, [router]);

  if (!selfUserId) {
    return (
      <section className="entity-wizard">
        <p>Loading your workspace…</p>
      </section>
    );
  }

  return (
    <AddEntityWizard
      createdFor={selfUserId}
      backLabel="My Workspace"
      backHref="/dashboard/client"
      onSuccessHref="/dashboard/client"
    />
  );
}
