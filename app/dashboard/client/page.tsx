"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Skeleton } from "boneyard-js/react";
import { ClientEntitiesSkeleton } from "@/app/components/PortalSkeletons";
import { logout } from "@/src/lib/logout";
import { getSession } from "@/src/lib/session";
import type { CoreEntity } from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

function titleCase(value: string) {
  if (!value) return "";
  return value
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export default function ClientPage() {
  const router = useRouter();
  const [entities, setEntities] = useState<CoreEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

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

        const res = await fetch("/api/entities", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;

        if (res.ok) {
          const data = (await res.json()) as { items?: CoreEntity[] };
          setEntities(data.items || []);
        } else {
          const data = await res.json().catch(() => ({}));
          setErrorMessage(data.error || "Failed to load your entities.");
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load client entities:", error);
          setErrorMessage("Unexpected error loading your workspace.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <Skeleton
      name="client-entities-page"
      loading={isLoading}
      fallback={<ClientEntitiesSkeleton />}
    >
      <section className="portal-page">
        <div className="portal-page-header">
          <div>
            <p className="portal-kicker">Client Workspace</p>
            <h1>Your Entities</h1>
            <p>Register the legal structures that hold your properties.</p>
          </div>

          <div className="portal-page-actions">
            <Link
              href="/dashboard/client/entities/new"
              className="entity-wizard-primary"
            >
              + Add Entity
            </Link>
            <button
              type="button"
              className="portal-secondary-link"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>

        {errorMessage ? (
          <p className="entity-wizard-error">{errorMessage}</p>
        ) : entities.length === 0 ? (
          <div className="client-detail-empty">
            <p>
              You haven&apos;t added any entities yet. Use <strong>Add Entity</strong>{" "}
              to register your first Individual, Trust, Company or SMSF — then you
              can map properties and transactions to it.
            </p>
          </div>
        ) : (
          <ul className="client-detail-entity-list">
            {entities.map((entity) => (
              <li key={entity.id} className="client-detail-entity-row">
                <div>
                  <Link
                    href={`/dashboard/client/entities/${entity.id}`}
                    className="client-detail-entity-link"
                  >
                    <strong>{entity.name}</strong>
                  </Link>
                  <span>{titleCase(entity.entityType)}</span>
                </div>
                <div className="client-detail-entity-meta">
                  <span>
                    {entity.beneficiaries.length} beneficiar
                    {entity.beneficiaries.length === 1 ? "y" : "ies"}
                  </span>
                  <Link
                    href={`/dashboard/client/entities/${entity.id}/edit`}
                    className="entity-icon-action"
                    aria-label={`Edit ${entity.name}`}
                    title="Edit entity"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Skeleton>
  );
}
