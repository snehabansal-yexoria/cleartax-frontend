"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSession } from "../../../../src/lib/session";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

interface OrganizationResponse {
  organization: {
    id: string;
    name: string;
  } | null;
}

interface AdminContactResponse {
  adminContact: {
    email: string;
    role: string;
  } | null;
}

function formatDisplayName(email: string) {
  const localPart = (email.split("@")[0] || "accountant").replace(/[._-]/g, " ");
  return localPart.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getInitials(value: string) {
  if (!value) return "AP";

  const parts = value
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return value.slice(0, 2).toUpperCase();
}

export default function AccountantAccountPage() {
  const [email, setEmail] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;

        if (!session) {
          return;
        }

        const token = session.getIdToken().getJwtToken();
        const tokenPayload = JSON.parse(atob(token.split(".")[1] || ""));
        const currentEmail = tokenPayload.email || "";
        setEmail(currentEmail);

        const res = await fetch("/api/users/me/organization", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          return;
        }

        const data = (await res.json()) as OrganizationResponse;
        setOrganizationName(data.organization?.name || "");

        const adminContactRes = await fetch("/api/users/me/admin-contact", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (adminContactRes.ok) {
          const adminData =
            (await adminContactRes.json()) as AdminContactResponse;
          setAdminEmail(adminData.adminContact?.email || "");
        }
      } catch (error) {
        console.error("Failed to load accountant profile:", error);
      }
    }

    loadProfile();
  }, []);

  const displayName = formatDisplayName(email || "Sarah Johnson");
  const initials = getInitials(displayName);
  const adminName = formatDisplayName(adminEmail || "Michael Roberts");

  return (
    <section className="accountant-account-page">
      <Link href="/dashboard/accountant" className="accountant-back-link">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m15 6-6 6 6 6" />
        </svg>
        Back to Dashboard
      </Link>

      <div className="accountant-account-heading">
        <h1>Accountant Profile</h1>
        <p>Manage your profile information and settings</p>
      </div>

      <div className="accountant-account-grid">
        <section className="accountant-account-card">
          <div className="accountant-account-hero">
            <div className="accountant-account-avatar-wrap">
              <div className="accountant-account-avatar">{initials}</div>
              <button type="button" className="accountant-avatar-upload">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 16V7" />
                  <path d="m8.5 10.5 3.5-3.5 3.5 3.5" />
                  <path d="M20 16.5v.5A2 2 0 0 1 18 19H6a2 2 0 0 1-2-2v-.5" />
                </svg>
              </button>
            </div>

            <div className="accountant-account-hero-copy">
              <h2>{displayName}</h2>
              <p>{organizationName || "Accounting Pro Solutions"}</p>
              <button type="button" className="accountant-upload-link">
                Upload Profile Picture
              </button>
            </div>
          </div>

          <div className="accountant-profile-fields">
            <div className="accountant-profile-field">
              <label>Full Name</label>
              <div className="accountant-profile-input">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 21v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>{displayName}</span>
              </div>
            </div>

            <div className="accountant-profile-field">
              <label>Email Address</label>
              <div className="accountant-profile-input">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
                <span>{email || "sarah.johnson@accountingpro.com"}</span>
              </div>
            </div>

            <div className="accountant-profile-field">
              <label>Phone Number</label>
              <div className="accountant-profile-input">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.3 19.3 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.6a2 2 0 0 1-.6 1.8l-1.3 1.3a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 1.8-.6l2.6.4A2 2 0 0 1 22 16.9z" />
                </svg>
                <span>+1 (555) 123-4567</span>
              </div>
            </div>

            <div className="accountant-profile-field">
              <label>Organisation Name</label>
              <div className="accountant-profile-input">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="4" y="3" width="10" height="18" rx="2" />
                  <path d="M14 9h6v12h-6" />
                  <path d="M8 7h2" />
                  <path d="M8 11h2" />
                  <path d="M8 15h2" />
                </svg>
                <span>{organizationName || "Accounting Pro Solutions"}</span>
              </div>
            </div>

            <div className="accountant-profile-field">
              <label>Alternate Name</label>
              <div className="accountant-profile-input accountant-profile-input-editable">
                <span>{displayName.split(" ")[0]} J.</span>
                <button type="button">Edit</button>
              </div>
            </div>

            <div className="accountant-profile-field">
              <label>Address</label>
              <div className="accountant-profile-input accountant-profile-input-editable">
                <span>Level 12, 456 Collins</span>
                <button type="button">Edit</button>
              </div>
            </div>
          </div>
        </section>

        <aside className="accountant-admin-card">
          <div className="accountant-admin-card-header">
            <div className="accountant-admin-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 21v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <h3>Admin Contact</h3>
              <p>Primary administrator</p>
            </div>
          </div>

          <div className="accountant-admin-info">
            <div>
              <span>Name</span>
              <strong>{adminName}</strong>
            </div>
            <div>
              <span>Email Address</span>
              <strong>{adminEmail || "No admin info available yet"}</strong>
            </div>
            <div>
              <span>Contact Number</span>
              <strong>{adminEmail ? "Contact via email" : "Not available"}</strong>
            </div>
          </div>

          <button type="button" className="accountant-admin-cta">
            Contact Admin
          </button>
        </aside>
      </div>
    </section>
  );
}
