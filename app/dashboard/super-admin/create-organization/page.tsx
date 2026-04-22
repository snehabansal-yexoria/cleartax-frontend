"use client";

import { useState } from "react";
import { getSession } from "../../../../src/lib/session";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

export default function CreateOrganizationPage() {
  const [form, setForm] = useState({
    name: "",
    orgEmail: "",
    tenantCode: "",
    contactNumber: "",
    addressLine1: "",
    city: "",
    state: "",
    country: "AU",
    postalCode: "",
    subscriptionPlan: "free",
    maxUsersAllowed: "5",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function createOrganization() {
    try {
      setLoading(true);
      setMessage("");
      const session = (await getSession()) as SessionWithIdToken | null;

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
        body: JSON.stringify({
          name: form.name,
          org_email: form.orgEmail,
          tenant_code: form.tenantCode,
          contact_number: form.contactNumber,
          address_line1: form.addressLine1,
          city: form.city,
          state: form.state,
          country: form.country,
          postal_code: form.postalCode,
          subscription_plan: form.subscriptionPlan,
          max_users_allowed: Number(form.maxUsersAllowed) || 5,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.details || data.error || "Failed to create organization");
        return;
      }

      setMessage(`Organization created: ${data.organization.name}`);
      setForm({
        name: "",
        orgEmail: "",
        tenantCode: "",
        contactNumber: "",
        addressLine1: "",
        city: "",
        state: "",
        country: "AU",
        postalCode: "",
        subscriptionPlan: "free",
        maxUsersAllowed: "5",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: "560px" }}>
      <h1>Create Organization</h1>

      <input
        type="text"
        placeholder="Organization Name"
        value={form.name}
        onChange={(e) => updateField("name", e.target.value)}
        style={{ width: "100%", padding: "10px" }}
      />

      <br />
      <br />

      <input
        type="email"
        placeholder="Organization Email"
        value={form.orgEmail}
        onChange={(e) => updateField("orgEmail", e.target.value)}
        style={{ width: "100%", padding: "10px" }}
      />

      <br />
      <br />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <input
          type="text"
          placeholder="Tenant Code"
          value={form.tenantCode}
          onChange={(e) => updateField("tenantCode", e.target.value.toUpperCase())}
          style={{ width: "100%", padding: "10px" }}
        />
        <input
          type="text"
          placeholder="Contact Number"
          value={form.contactNumber}
          onChange={(e) => updateField("contactNumber", e.target.value)}
          style={{ width: "100%", padding: "10px" }}
        />
      </div>

      <br />

      <input
        type="text"
        placeholder="Address Line 1"
        value={form.addressLine1}
        onChange={(e) => updateField("addressLine1", e.target.value)}
        style={{ width: "100%", padding: "10px" }}
      />

      <br />
      <br />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <input
          type="text"
          placeholder="City"
          value={form.city}
          onChange={(e) => updateField("city", e.target.value)}
          style={{ width: "100%", padding: "10px" }}
        />
        <input
          type="text"
          placeholder="State"
          value={form.state}
          onChange={(e) => updateField("state", e.target.value)}
          style={{ width: "100%", padding: "10px" }}
        />
        <input
          type="text"
          placeholder="Country"
          value={form.country}
          onChange={(e) => updateField("country", e.target.value)}
          style={{ width: "100%", padding: "10px" }}
        />
        <input
          type="text"
          placeholder="Postal Code"
          value={form.postalCode}
          onChange={(e) => updateField("postalCode", e.target.value)}
          style={{ width: "100%", padding: "10px" }}
        />
      </div>

      <br />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <input
          type="text"
          placeholder="Subscription Plan"
          value={form.subscriptionPlan}
          onChange={(e) => updateField("subscriptionPlan", e.target.value)}
          style={{ width: "100%", padding: "10px" }}
        />
        <input
          type="number"
          placeholder="Max Users Allowed"
          value={form.maxUsersAllowed}
          onChange={(e) => updateField("maxUsersAllowed", e.target.value)}
          style={{ width: "100%", padding: "10px" }}
          min="1"
        />
      </div>

      <br />

      <button
        onClick={createOrganization}
        disabled={
          loading ||
          !form.name.trim() ||
          !form.orgEmail.trim() ||
          !form.tenantCode.trim() ||
          !form.addressLine1.trim() ||
          !form.city.trim() ||
          !form.state.trim() ||
          !form.country.trim() ||
          !form.postalCode.trim()
        }
      >
        {loading ? "Creating..." : "Create Organization"}
      </button>

      {message && <p style={{ marginTop: "20px" }}>{message}</p>}
    </div>
  );
}
