"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Skeleton } from "boneyard-js/react";
import JournalEntryEditor from "@/app/components/journal/JournalEntryEditor";
import { JournalEntrySkeleton } from "@/app/components/PortalSkeletons";
import { getSession } from "@/src/lib/session";
import type {
  CoreEntity,
  CoreJournalEntry,
  CoreProperty,
} from "@/src/lib/coreApi";

interface SessionWithIdToken {
  getIdToken(): { getJwtToken(): string };
}

interface ClientRecord {
  id: string;
  name: string;
  email: string;
}

export default function EditJournalEntryPage() {
  const params = useParams<{
    clientId: string;
    entityId: string;
    entryId: string;
  }>();
  const router = useRouter();

  const clientId = params?.clientId ?? "";
  const entityId = params?.entityId ?? "";
  const entryId = params?.entryId ?? "";

  const [entity, setEntity] = useState<CoreEntity | null>(null);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [properties, setProperties] = useState<CoreProperty[]>([]);
  const [entry, setEntry] = useState<CoreJournalEntry | null>(null);
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const session = (await getSession()) as SessionWithIdToken | null;
        if (!session) {
          router.replace("/login/user");
          return;
        }
        const idToken = session.getIdToken().getJwtToken();
        const headers = { Authorization: `Bearer ${idToken}` };
        if (!cancelled) setToken(idToken);

        const [entityRes, clientRes, propertiesRes, entryRes] = await Promise.all([
          fetch(`/api/entities/${encodeURIComponent(entityId)}`, { headers }),
          fetch(`/api/users/me/clients/${encodeURIComponent(clientId)}`, { headers }),
          fetch(`/api/entities/${encodeURIComponent(entityId)}/properties`, { headers }),
          fetch(`/api/journal-entries/${encodeURIComponent(entryId)}`, { headers }),
        ]);

        if (cancelled) return;

        if (!entryRes.ok) {
          setErrorMessage("That journal entry could not be loaded.");
          return;
        }
        if (entityRes.ok && clientRes.ok) {
          setEntity((await entityRes.json()) as CoreEntity);
          setClient((await clientRes.json()) as ClientRecord);
          if (propertiesRes.ok) {
            const data = await propertiesRes.json();
            setProperties(data.items || []);
          }
          setEntry((await entryRes.json()) as CoreJournalEntry);
        } else {
          setErrorMessage("Failed to load client or entity information.");
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load journal entry:", error);
          setErrorMessage("Unexpected error loading the journal entry.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (entityId && clientId && entryId) loadData();
    return () => {
      cancelled = true;
    };
  }, [clientId, entityId, entryId, router]);

  if (isLoading) {
    return (
      <Skeleton
        name="accountant-edit-journal-entry-page"
        loading
        fallback={<JournalEntrySkeleton />}
      >
        <JournalEntrySkeleton />
      </Skeleton>
    );
  }

  if (!entity || !client || !entry) {
    return (
      <section className="journal-page">
        <p className="entity-wizard-error">
          {errorMessage || "Journal entry not found."}
        </p>
        <button
          type="button"
          className="entity-wizard-secondary"
          onClick={() =>
            router.push(
              `/dashboard/accountant/clients/${clientId}/entities/${entityId}?tab=journal`,
            )
          }
        >
          Go back
        </button>
      </section>
    );
  }

  const backHref = `/dashboard/accountant/clients/${clientId}/entities/${entityId}?tab=journal`;

  return (
    <JournalEntryEditor
      clientId={clientId}
      entityId={entityId}
      client={client}
      entity={entity}
      properties={properties}
      token={token}
      backHref={backHref}
      backLabel={entity.name || "Entity"}
      initialEntry={entry}
    />
  );
}
