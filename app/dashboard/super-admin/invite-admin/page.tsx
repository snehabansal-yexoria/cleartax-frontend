"use client";

import { useState, useEffect } from "react";
import { getSession } from "../../../../src/lib/session";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

interface OrganizationOption {
  id: string;
  name: string;
}

export default function InviteAdminPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");
  const [inviteLink, setInviteLink] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔥 NEW STATE
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [selectedOrg, setSelectedOrg] = useState("");

  // 🔥 FETCH ORGANIZATIONS
  useEffect(() => {
    async function fetchOrganizations() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;

        if (!session) return;

        const token = session.getIdToken().getJwtToken();

        const res = await fetch("/api/organizations/list", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();
        setOrganizations(data.organizations || []);
      } catch (error) {
        console.error("Error fetching organizations:", error);
      }
    }

    fetchOrganizations();
  }, []);

  async function createUser() {
    try {
      setLoading(true);

      const session = (await getSession()) as SessionWithIdToken | null;

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
          organization_id: selectedOrg, // 🔥 NEW
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
      setSelectedOrg(""); // reset
    } catch (error) {
      console.error("Invite error:", error);
      alert("Something went wrong while creating the user.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: "500px" }}>
      <h1>Invite User</h1>

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
          <option value="admin">Admin</option>
          {/* <option value="accountant">Accountant</option> */}
          {/* <option value="client">Client</option> */}
        </select>

        <br />
        <br />

        {/* 🔥 NEW ORGANIZATION DROPDOWN */}
        <label>Organization</label>
        <br />

        <select
          value={selectedOrg}
          onChange={(e) => setSelectedOrg(e.target.value)}
          style={{ width: "100%", padding: "8px" }}
        >
          <option value="">Select Organization</option>

          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>

        <br />
        <br />

        <button
          onClick={createUser}
          disabled={loading || !selectedOrg} // 🔥 prevent invalid submit
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

          <p style={{ marginTop: "10px" }}>
            Send this link and password to the invited user.
          </p>
        </div>
      )}
    </div>
  );
}
