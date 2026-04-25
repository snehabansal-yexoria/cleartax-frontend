"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getSession } from "@/src/lib/session";
import type { CoreEntity } from "@/src/lib/coreApi";

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

function titleCase(value: string) {
  if (!value) return "";
  return value
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const clientId = params?.id ?? "";

  const [client, setClient] = useState<ClientRecord | null>(null);
  const [entities, setEntities] = useState<CoreEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;
        if (!session) {
          router.replace("/login/user");
          return;
        }
        const token = session.getIdToken().getJwtToken();

        const [clientsRes, entitiesRes] = await Promise.all([
          fetch("/api/users/me/clients?scope=all", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/entities?client_id=${encodeURIComponent(clientId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (cancelled) return;

        if (clientsRes.ok) {
          const data = (await clientsRes.json()) as { clients: ClientRecord[] };
          const match = (data.clients || []).find((c) => c.id === clientId) ?? null;
          setClient(match);
          if (!match) {
            setLoadError("We couldn't find this client in your organisation.");
          }
        } else {
          setLoadError("Failed to load client.");
        }

        if (entitiesRes.ok) {
          const data = (await entitiesRes.json()) as { items: CoreEntity[] };
          setEntities(data.items || []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load client detail:", error);
          setLoadError("Unexpected error loading client.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (clientId) load();
    return () => {
      cancelled = true;
    };
  }, [clientId, router]);

  const entityCountCopy = useMemo(() => {
    if (entities.length === 0) return "No entities yet";
    if (entities.length === 1) return "1 entity";
    return `${entities.length} entities`;
  }, [entities.length]);

  if (isLoading) {
    return (
      <section className="client-detail-page">
        <p>Loading client…</p>
      </section>
    );
  }

  if (!client) {
    return (
      <section className="client-detail-page">
        <Link href="/dashboard/accountant/clients" className="entity-wizard-back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Back to Clients
        </Link>
        <p className="entity-wizard-error">{loadError || "Client not found."}</p>
      </section>
    );
  }

  return (
    <section className="client-detail-page">
      <Link href="/dashboard/accountant/clients" className="entity-wizard-back">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Back to Clients
      </Link>

      <header className="client-detail-header">
        <div>
          <h1>{client.name}</h1>
          <p>{client.email}</p>
          <span className="client-detail-meta">
            {titleCase(client.status)} · {entityCountCopy}
          </span>
        </div>

        <Link
          href={`/dashboard/accountant/clients/${clientId}/entities/new`}
          className="entity-wizard-primary"
        >
          + Add Entity
        </Link>
      </header>

      <section className="client-detail-entities">
        <div className="client-detail-entities-head">
          <h2>Entities</h2>
          <p>Legal structures this client owns or benefits from.</p>
        </div>

        {entities.length === 0 ? (
          <div className="client-detail-empty">
            <p>
              No entities yet. Use <strong>Add Entity</strong> to register their first
              one — you&apos;ll be able to map properties and transactions afterwards.
            </p>
          </div>
        ) : (
          <ul className="client-detail-entity-list">
            {entities.map((entity) => (
              <li key={entity.id} className="client-detail-entity-row">
                <div>
                  <strong>{entity.name}</strong>
                  <span>{titleCase(entity.entityType)}</span>
                </div>
                <div className="client-detail-entity-meta">
                  <span>
                    {entity.beneficiaries.length} beneficiar
                    {entity.beneficiaries.length === 1 ? "y" : "ies"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
