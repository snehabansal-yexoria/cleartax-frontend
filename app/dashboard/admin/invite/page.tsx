"use client";

import { useState } from "react";
import { getSession } from "../../../../src/lib/session";

export default function InviteUserByAdmin() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("accountant");
  const [inviteLink, setInviteLink] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function createUser() {
    try {
      setLoading(true);

      const session: any = await getSession();

      if (!session) {
        alert("Session expired. Please login again.");
        return;
      }

      const token = session.getIdToken().getJwtToken();

      const res = await fetch("/api/invite-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          role,
          // ❌ NO organization_id here
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to create user");
        return;
      }

      setTempPassword(data.temporaryPassword);

      const link = `${window.location.origin}/login`;
      setInviteLink(link);

      setEmail("");
    } catch (error) {
      console.error("Invite error:", error);
      alert("Something went wrong while creating the user.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: "500px" }}>
      <h1>Invite User (Admin)</h1>

      <div style={{ marginTop: "20px" }}>
        <label>Email</label>
        <br />

        <input
          type="email"
          placeholder="User Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: "8px" }}
        />

        <br />
        <br />

        <label>Role</label>
        <br />

        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          style={{ width: "100%", padding: "8px" }}
        >
          <option value="accountant">Accountant</option>
          <option value="client">Client</option>
        </select>

        <br />
        <br />

        <button
          onClick={createUser}
          disabled={loading}
          style={{
            padding: "10px 16px",
            background: "#2563eb",
            color: "white",
            border: "none",
            cursor: "pointer",
            borderRadius: "4px",
          }}
        >
          {loading ? "Creating User..." : "Create User"}
        </button>
      </div>

      {inviteLink && (
        <div
          style={{
            marginTop: "30px",
            padding: "15px",
            background: "#ecfdf5",
            border: "1px solid #10b981",
            borderRadius: "6px",
          }}
        >
          <h3>User Created</h3>

          <p>
            <strong>Temporary Password:</strong>
          </p>
          <pre>{tempPassword}</pre>

          <p>
            <strong>Invite Link:</strong>
          </p>
          <a href={inviteLink} target="_blank" style={{ color: "#2563eb" }}>
            {inviteLink}
          </a>
        </div>
      )}
    </div>
  );
}
