"use client";

import { Skeleton } from "boneyard-js/react";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AccountantClientsSkeleton } from "../../../components/PortalSkeletons";
import { getSession } from "../../../../src/lib/session";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

interface ClientRecord {
  id: string;
  email: string;
  status: string;
  name: string;
  phoneNumber: string;
  invitedByEmail: string;
  joinedAt: string | null;
}

type ClientTab = "all" | "mine";

function getInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

function formatJoinedDate(value: string | null) {
  if (!value) return "Recently";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function AccountantClientsContent() {
  const searchParams = useSearchParams();
  const [currentTab, setCurrentTab] = useState<ClientTab>("all");
  const [allClients, setAllClients] = useState<ClientRecord[]>([]);
  const [myClients, setMyClients] = useState<ClientRecord[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [isInviteDrawerOpen, setInviteDrawerOpen] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [inviteForm, setInviteForm] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
  });

  useEffect(() => {
    if (searchParams.get("invite") === "1") {
      setInviteSuccess(false);
      setInviteDrawerOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    async function loadClients() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;

        if (!session) {
          return;
        }

        const token = session.getIdToken().getJwtToken();

        const [allRes, myRes] = await Promise.all([
          fetch("/api/users/me/clients?scope=all", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/users/me/clients?scope=mine", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (allRes.ok) {
          const data = await allRes.json();
          setAllClients(data.clients || []);
        }

        if (myRes.ok) {
          const data = await myRes.json();
          setMyClients(data.clients || []);
        }
      } catch (error) {
        console.error("Failed to load clients:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadClients();
  }, []);

  const visibleClients = useMemo(() => {
    const source = currentTab === "all" ? allClients : myClients;
    const query = searchValue.trim().toLowerCase();

    if (!query) {
      return source;
    }

    return source.filter(
      (client) =>
        client.name.toLowerCase().includes(query) ||
        client.email.toLowerCase().includes(query),
    );
  }, [allClients, myClients, currentTab, searchValue]);

  function toggleClientSelection(clientId: string) {
    setSelectedClientIds((current) =>
      current.includes(clientId)
        ? current.filter((id) => id !== clientId)
        : [...current, clientId],
    );
  }

  function resetInviteState() {
    setInviteForm({
      fullName: "",
      email: "",
      phoneNumber: "",
    });
    setTemporaryPassword("");
    setInviteSuccess(false);
    setInviteDrawerOpen(false);
  }

  async function handleInviteClient() {
    try {
      setInviteLoading(true);

      const session = (await getSession()) as SessionWithIdToken | null;

      if (!session) {
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
          email: inviteForm.email,
          role: "client",
          full_name: inviteForm.fullName,
          phone_number: inviteForm.phoneNumber,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to invite client");
        return;
      }

      setTemporaryPassword(data.temporaryPassword || "");
      setInviteSuccess(true);
    } catch (error) {
      console.error("Invite client error:", error);
      alert("Something went wrong while inviting the client.");
    } finally {
      setInviteLoading(false);
    }
  }

  return (
    <Skeleton
      name="accountant-clients"
      loading={isLoading}
      fallback={<AccountantClientsSkeleton />}
    >
      <section className="accountant-clients-page">
      <div className="accountant-clients-topbar">
        <div>
          <h1>All Clients</h1>
          <p>Manage and view all your property clients</p>
        </div>

        <button
          type="button"
          className="accountant-primary-cta"
          onClick={() => {
            setTemporaryPassword("");
            setInviteSuccess(false);
            setInviteDrawerOpen(true);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          Invite Client
        </button>
      </div>

      <div className="accountant-client-tabs">
        <button
          type="button"
          className={currentTab === "all" ? "is-active" : ""}
          onClick={() => setCurrentTab("all")}
        >
          All Clients
          <span>{allClients.length}</span>
        </button>
        <button
          type="button"
          className={currentTab === "mine" ? "is-active" : ""}
          onClick={() => setCurrentTab("mine")}
        >
          My Clients
          <span>{myClients.length}</span>
        </button>
      </div>

      <div className="accountant-clients-toolbar">
        <div className="accountant-client-search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6" />
            <path d="m20 20-4.2-4.2" />
          </svg>
          <input
            type="text"
            placeholder="Search by client name or email..."
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
          />
        </div>

        <button type="button" className="accountant-sort-button">
          Sort by Properties
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {selectedClientIds.length > 0 && (
        <div className="accountant-selection-banner">
          <span>{selectedClientIds.length} client selected</span>
          <button type="button">Add to list</button>
        </div>
      )}

      <div className="accountant-client-table">
        <div className="accountant-client-table-head">
          <div />
          <div>Client Name</div>
          <div>Email Address</div>
          <div>Status</div>
          <div>Invited By</div>
          <div>Joined By</div>
        </div>

        {visibleClients.map((client) => (
          <article key={client.id} className="accountant-client-table-row">
            <div>
              <input
                type="checkbox"
                checked={selectedClientIds.includes(client.id)}
                onChange={() => toggleClientSelection(client.id)}
              />
            </div>

            <div className="accountant-client-cell accountant-client-cell-primary">
              <div className="accountant-client-pill">
                {getInitials(client.name)}
              </div>
              <div>
                <Link
                  href={`/dashboard/accountant/clients/${client.id}`}
                  className="accountant-client-name-link"
                >
                  <strong>{client.name}</strong>
                </Link>
                <span>{client.phoneNumber || "+1 (555) 000-0000"}</span>
              </div>
            </div>

            <div className="accountant-client-cell">
              <span>{client.email}</span>
            </div>

            <div className="accountant-client-cell">
              <strong className="accountant-client-status">
                {client.status}
              </strong>
            </div>

            <div className="accountant-client-cell">
              <span>{client.invitedByEmail || "Organization Admin"}</span>
            </div>

            <div className="accountant-client-cell">
              <span>{formatJoinedDate(client.joinedAt)}</span>
            </div>
          </article>
        ))}
      </div>

      {isInviteDrawerOpen && (
        <div className="accountant-drawer-layer">
          <button
            type="button"
            className="accountant-drawer-backdrop"
            aria-label="Close invite drawer"
            onClick={resetInviteState}
          />

          <aside className="accountant-invite-drawer">
            <div className="accountant-invite-drawer-header">
              <div>
                <h2>Invite New Client</h2>
                <p>Send an invitation to a new client</p>
              </div>

              <button type="button" onClick={resetInviteState}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12" />
                  <path d="M18 6 6 18" />
                </svg>
              </button>
            </div>

            {inviteSuccess ? (
              <div className="accountant-invite-success">
                <div className="accountant-invite-success-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m22 2-7 20-4-9-9-4Z" />
                    <path d="M22 2 11 13" />
                  </svg>
                </div>
                <h3>Invitation Sent!</h3>
                <p>
                  That&apos;s another client invitation in the books. You can
                  track their onboarding status directly from your portfolio.
                </p>
                {temporaryPassword && (
                  <div className="accountant-temp-password-card">
                    <span>Temporary Password</span>
                    <strong>{temporaryPassword}</strong>
                    <p>Share this password securely with the client for now.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="accountant-invite-drawer-body">
                <label>
                  <span>
                    Full Name <span className="imp">*</span>
                  </span>
                  <input
                    type="text"
                    placeholder="Enter client's full name"
                    value={inviteForm.fullName}
                    onChange={(event) =>
                      setInviteForm((current) => ({
                        ...current,
                        fullName: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <span>
                    Email Address <span className="imp">*</span>
                  </span>
                  <input
                    type="email"
                    placeholder="client@example.com"
                    value={inviteForm.email}
                    onChange={(event) =>
                      setInviteForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <span>
                    Phone Number <small>(Optional)</small>
                  </span>
                  <input
                    type="tel"
                    placeholder="+91 87778 98789"
                    value={inviteForm.phoneNumber}
                    onChange={(event) =>
                      setInviteForm((current) => ({
                        ...current,
                        phoneNumber: event.target.value,
                      }))
                    }
                  />
                </label>

                <div className="accountant-invite-note">
                  <strong>What happens next?</strong>
                  <p>
                    The client will receive an email invitation to join the
                    platform and complete their registration.
                  </p>
                </div>
              </div>
            )}

            <div className="accountant-invite-drawer-footer">
              <button type="button" onClick={resetInviteState}>
                {inviteSuccess ? "Close" : "Cancel"}
              </button>
              {!inviteSuccess && (
                <button
                  type="button"
                  className="is-primary"
                  onClick={handleInviteClient}
                  disabled={
                    inviteLoading ||
                    !inviteForm.fullName.trim() ||
                    !inviteForm.email.trim()
                  }
                >
                  {inviteLoading ? "Sending..." : "Send Invitation"}
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
      </section>
    </Skeleton>
  );
}

export default function AccountantClientsPage() {
  return (
    <Suspense
      fallback={
        <section className="accountant-clients-page">
          <div className="accountant-clients-topbar">
            <div>
              <h1>All Clients</h1>
              <p>Manage and view all your property clients</p>
            </div>
          </div>
        </section>
      }
    >
      <AccountantClientsContent />
    </Suspense>
  );
}
