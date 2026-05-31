"use client";

import { useState } from "react";
import Link from "next/link";
import { getSession } from "@/src/lib/session";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

function buildInviteLink(params: {
  origin: string;
  token: string;
  email: string;
  role: string;
  temporaryPassword: string;
}) {
  const url = new URL("/invite", params.origin);
  url.searchParams.set("token", params.token);
  url.searchParams.set("email", params.email);
  url.searchParams.set("role", params.role);

  return `${url.toString()}#temporary_password=${encodeURIComponent(
    params.temporaryPassword,
  )}`;
}

export default function InviteUserByAdmin() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("accountant");
  const [inviteLink, setInviteLink] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  function handleCopy(text: string, setCopiedState: (v: boolean) => void) {
    void navigator.clipboard.writeText(text);
    setCopiedState(true);
    setTimeout(() => setCopiedState(false), 2000);
  }

  async function createUser() {
    if (!email || !email.includes("@")) {
      alert("Please enter a valid email address.");
      return;
    }

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
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to create user");
        return;
      }

      setTempPassword(data.temporaryPassword);
      setInviteLink(
        buildInviteLink({
          origin: window.location.origin,
          token: String(data.invitationToken || ""),
          email: String(data.email || email),
          role: String(data.role || role),
          temporaryPassword: String(data.temporaryPassword || ""),
        }),
      );

      setEmail("");
    } catch (error) {
      console.error("Invite error:", error);
      alert("Something went wrong while creating the user.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="portal-page">
      <style>{`
        .invite-container {
          max-width: 680px;
          margin: 0 auto;
          animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        
        .premium-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
          padding: 32px;
          margin-top: 24px;
        }

        .role-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          margin-top: 12px;
          margin-bottom: 24px;
        }
        
        @media (min-width: 640px) {
          .role-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        .role-card {
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px 16px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          position: relative;
          background: #f8fafc;
        }

        .role-card:hover {
          border-color: #cbd5e1;
          transform: translateY(-2px);
          background: #ffffff;
        }

        .role-card.is-active {
          border-color: #2563eb;
          background: rgba(37, 99, 235, 0.02);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.08);
        }

        .role-card-icon {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
          color: #64748b;
          transition: all 0.25s ease;
        }

        .role-card.is-active .role-card-icon {
          background: rgba(37, 99, 235, 0.1);
          color: #2563eb;
        }

        .role-card-title {
          font-weight: 700;
          font-size: 0.95rem;
          color: #0f172a;
          margin-bottom: 6px;
        }

        .role-card-desc {
          font-size: 0.78rem;
          color: #64748b;
          line-height: 1.4;
        }

        .role-badge-checked {
          position: absolute;
          top: 10px;
          right: 10px;
          color: #2563eb;
          opacity: 0;
          transform: scale(0.8);
          transition: all 0.2s ease;
        }

        .role-card.is-active .role-badge-checked {
          opacity: 1;
          transform: scale(1);
        }

        .custom-input-group {
          position: relative;
          margin-bottom: 24px;
        }

        .custom-input-label {
          display: block;
          font-weight: 600;
          font-size: 0.88rem;
          color: #334155;
          margin-bottom: 8px;
        }

        .input-with-icon {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon-left {
          position: absolute;
          left: 14px;
          color: #94a3b8;
          pointer-events: none;
        }

        .custom-field {
          width: 100%;
          padding: 12px 14px 12px 42px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 0.95rem;
          color: #0f172a;
          transition: all 0.2s ease;
          background: #ffffff;
        }

        .custom-field:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
          outline: none;
        }

        .submit-btn-premium {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 12px 24px;
          background: #2563eb;
          color: #ffffff;
          font-weight: 600;
          font-size: 0.95rem;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2), 0 2px 4px -1px rgba(37, 99, 235, 0.1);
        }

        .submit-btn-premium:hover:not(:disabled) {
          background: #1d4ed8;
          box-shadow: 0 6px 10px -1px rgba(37, 99, 235, 0.25), 0 3px 6px -1px rgba(37, 99, 235, 0.15);
        }

        .submit-btn-premium:disabled {
          background: #94a3b8;
          cursor: not-allowed;
          box-shadow: none;
        }

        .success-card {
          margin-top: 32px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 12px;
          padding: 24px;
          animation: slideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .success-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 99px;
          background: #dcfce7;
          color: #15803d;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 12px;
        }

        .copy-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 8px 12px;
          margin-top: 6px;
          margin-bottom: 16px;
        }

        .copy-box-text {
          flex: 1;
          font-size: 0.88rem;
          color: #334155;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .copy-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 12px;
          font-size: 0.75rem;
          font-weight: 600;
          color: #0f172a;
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          gap: 4px;
        }

        .copy-btn:hover {
          background: #e2e8f0;
          border-color: #94a3b8;
        }

        .copy-btn.copied {
          background: #dcfce7;
          color: #15803d;
          border-color: #86efac;
        }

        .password-pre {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 10px 14px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.9rem;
          color: #0f172a;
          margin: 6px 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="invite-container">
        <div className="portal-page-header">
          <div>
            <p className="portal-kicker">Admin Workspace &gt; Invites</p>
            <h1>Invite Team Member</h1>
            <p>Send a secure link to add an accountant, client, or regional manager to your organization.</p>
          </div>

          <Link href="/dashboard/admin" className="portal-secondary-link">
            Back to Dashboard
          </Link>
        </div>

        <div className="premium-card">
          <div className="custom-input-group">
            <span className="custom-input-label">Select Workspace Role</span>
            <div className="role-grid">
              {/* Accountant Card */}
              <div
                className={`role-card${role === "accountant" ? " is-active" : ""}`}
                onClick={() => setRole("accountant")}
              >
                <div className="role-badge-checked">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="role-card-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <span className="role-card-title">Accountant</span>
                <p className="role-card-desc">Process accounts, tax entries & ledgers.</p>
              </div>

              {/* Client Card */}
              <div
                className={`role-card${role === "client" ? " is-active" : ""}`}
                onClick={() => setRole("client")}
              >
                <div className="role-badge-checked">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="role-card-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <span className="role-card-title">Client</span>
                <p className="role-card-desc">Access organization client views & reports.</p>
              </div>

              {/* Regional Manager Card */}
              <div
                className={`role-card${role === "regional_manager" ? " is-active" : ""}`}
                onClick={() => setRole("regional_manager")}
              >
                <div className="role-badge-checked">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="role-card-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </div>
                <span className="role-card-title">Reg. Manager</span>
                <p className="role-card-desc">Oversee multiple organization activities.</p>
              </div>
            </div>
          </div>

          <div className="custom-input-group">
            <label htmlFor="email" className="custom-input-label">Email Address</label>
            <div className="input-with-icon">
              <span className="input-icon-left">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </span>
              <input
                id="email"
                type="email"
                placeholder="colleague@yourcompany.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="custom-field"
              />
            </div>
          </div>

          <button
            onClick={createUser}
            disabled={loading}
            className="submit-btn-premium"
          >
            {loading ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ animation: "spin 1s linear infinite" }}>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" />
                  <path d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" />
                </svg>
                <span>Creating Member Profile...</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
                <span>Send Workspace Invitation</span>
              </>
            )}
          </button>
        </div>

        {inviteLink && (
          <div className="success-card">
            <div className="success-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Member Account Provisioned</span>
            </div>
            
            <h3 style={{ color: "#0f172a", fontSize: "1.1rem", fontWeight: 700, marginBottom: "8px" }}>
              Invitation Ready to Send
            </h3>

            <p style={{ color: "#475569", fontSize: "0.85rem", lineHeight: "1.5", marginBottom: "16px" }}>
              The account credentials have been successfully created. Copy and share the secure login link below with the user.
            </p>

            <div>
              <span className="custom-input-label" style={{ fontSize: "0.8rem" }}>Secure Invite Link</span>
              <div className="copy-box">
                <span className="copy-box-text">{inviteLink}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(inviteLink, setCopiedLink)}
                  className={`copy-btn${copiedLink ? " copied" : ""}`}
                >
                  {copiedLink ? "Copied!" : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            <div>
              <span className="custom-input-label" style={{ fontSize: "0.8rem" }}>Backup Temporary Password</span>
              <div className="password-pre">
                <span>{tempPassword}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(tempPassword, setCopiedPassword)}
                  className={`copy-btn${copiedPassword ? " copied" : ""}`}
                  style={{ background: "#ffffff" }}
                >
                  {copiedPassword ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
