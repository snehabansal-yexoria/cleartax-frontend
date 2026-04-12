"use client";

import { useEffect, useState } from "react";
import { getSession } from "../../../src/lib/session";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

export default function AdminPage() {
  const [organizationName, setOrganizationName] = useState("");

  useEffect(() => {
    async function loadOrganization() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;

        if (!session) {
          return;
        }

        const token = session.getIdToken().getJwtToken();

        const res = await fetch("/api/users/me/organization", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          return;
        }

        const data = await res.json();
        setOrganizationName(data.organization?.name || "");
      } catch (error) {
        console.error("Failed to load organization:", error);
      }
    }

    loadOrganization();
  }, []);

  return (
    <div>
      <h1>Admin Panel</h1>

      <p>Invite accountants and manage users.</p>
      {organizationName && <p>Organization: {organizationName}</p>}
    </div>
  );
}
