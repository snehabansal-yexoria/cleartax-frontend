"use client";

import { useState } from "react";
import { getSession } from "../../../../src/lib/session";

export default function CreateOrganizationPage() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  async function createOrganization() {
    const session: any = await getSession();

    if (!session) {
      alert("Session expired");
      return;
    }

    const token = session.getIdToken().getJwtToken();

    const res = await fetch("/api/organizations/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error);
      return;
    }

    setMessage(`Organization created: ${data.organization.name}`);
    setName("");
  }

  return (
    <div style={{ maxWidth: "500px" }}>
      <h1>Create Organization</h1>

      <input
        type="text"
        placeholder="Organization Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <br />
      <br />

      <button onClick={createOrganization}>Create Organization</button>

      {message && <p style={{ marginTop: "20px" }}>{message}</p>}
    </div>
  );
}
