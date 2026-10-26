"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { EntityPropertyListSkeleton } from "@/app/components/PortalSkeletons";
import { RegionError } from "@/app/components/ui/RegionError";
import type { AsyncRegion } from "@/app/components/useAsyncRegion";
import { getIdToken } from "@/src/lib/authToken";
import { formatDateAU } from "@/src/lib/dates";
import type { ReconciliationSession } from "@/src/lib/coreApi";
import { isPending } from "./types";

export type ReconciliationTabProps = {
  entityId: string;
  clientId: string;
  entityName: string;
  entityDisabled: boolean;
  reconciliationHref?: string;
  sessions: AsyncRegion<ReconciliationSession[]>;
  onCreated: (session: ReconciliationSession) => void;
};

const inputStyle = { padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 } as const;

export default function ReconciliationTab({
  entityId,
  clientId,
  entityName,
  entityDisabled,
  reconciliationHref,
  sessions,
  onCreated,
}: ReconciliationTabProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [accountAffected, setAccountAffected] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [labelError, setLabelError] = useState<string | null>(null);

  function resetForm() {
    setLabel("");
    setAccountAffected("");
    setFrom("");
    setTo("");
    setLabelError(null);
    setFormError(null);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setLabelError(null);
    setFormError(null);
    const trimmed = label.trim();
    if (!trimmed) {
      setLabelError("Label is required");
      return;
    }
    if (from && to && from > to) {
      setFormError("Start date cannot be after end date");
      return;
    }
    setSaving(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/entities/${encodeURIComponent(entityId)}/reconciliation-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          label: trimmed,
          periodFrom: from || null,
          periodTo: to || null,
          accountAffected: accountAffected.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new Error(data.message || data.error || `Failed to create session (${res.status})`);
      }
      const created = (await res.json()) as ReconciliationSession;
      onCreated(created);
      setOpen(false);
      resetForm();
      if (reconciliationHref) {
        router.push(`${reconciliationHref}/${encodeURIComponent(created.id)}`);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  const list = sessions.data ?? [];
  const hasAnyLedgerButton = list.some((s) => s.status === "completed");

  return (
    <div aria-busy={isPending(sessions.status) || undefined}>
      <div className="entity-resource-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Bank Reconciliations</h2>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="button"
            className="entity-wizard-primary is-green"
            disabled={entityDisabled}
            title={entityDisabled ? "Entity is inactive" : undefined}
            onClick={() => {
              if (entityDisabled) return;
              setOpen((current) => {
                if (current) resetForm();
                return !current;
              });
            }}
          >
            {open ? "Cancel" : "+ New Reconciliation"}
          </button>
          <button
            type="button"
            className="entity-wizard-primary is-orange"
            disabled={entityDisabled}
            title={entityDisabled ? "Entity is inactive" : undefined}
            onClick={() => {
              if (entityDisabled) return;
              router.push(
                `/dashboard/accountant/clients/${clientId}/entities/${entityId}/journal-entry/new?from=reconciliation&fromName=${encodeURIComponent(entityName)}`,
              );
            }}
          >
            + Add Journal Entry
          </button>
        </div>
      </div>

      {open && (
        <form
          onSubmit={handleCreate}
          className="recon-session-form"
          noValidate
          style={{ display: "grid", gap: 12, padding: 16, border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 16 }}
        >
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>Account name/number</span>
            <input
              type="text"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                if (labelError) setLabelError(null);
              }}
              placeholder="e.g. 12345678"
              maxLength={120}
              required
              style={{
                ...inputStyle,
                border: labelError ? "1px solid #fda4af" : inputStyle.border,
                outlineColor: labelError ? "#f43f5e" : undefined,
              }}
            />
            {labelError && (
              <span style={{ color: "#e11d48", fontSize: 12, marginTop: 4, fontWeight: 500 }}>{labelError}</span>
            )}
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>Account Affected (optional)</span>
            <input
              type="text"
              value={accountAffected}
              onChange={(e) => setAccountAffected(e.target.value)}
              placeholder="e.g. Main Operating Account"
              maxLength={120}
              style={inputStyle}
            />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>Period from (optional)</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>Period to (optional)</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
            </label>
          </div>
          {formError && <RegionError message={formError} />}
          <div>
            <button type="submit" className="entity-wizard-primary is-green" disabled={saving}>
              {saving ? "Creating…" : "Create & Open"}
            </button>
          </div>
        </form>
      )}

      {isPending(sessions.status) ? (
        <EntityPropertyListSkeleton variant="reconciliation" rows={2} />
      ) : sessions.status === "error" ? (
        <RegionError message={sessions.error ?? "Could not load reconciliations."} onRetry={sessions.reload} />
      ) : list.length === 0 ? (
        <div className="client-detail-empty">
          <p>No reconciliations yet. Create one to start uploading bank statements.</p>
        </div>
      ) : (
        <ul className="entity-property-list">
          {list.map((s) => {
            const period =
              s.periodFrom && s.periodTo
                ? `${s.periodFrom} → ${s.periodTo}`
                : s.periodFrom || s.periodTo || "—";
            const statusColor =
              s.status === "completed" ? "var(--color-success, #16a34a)" : "var(--color-warning, #ca8a04)";
            return (
              <li
                key={s.id}
                className={`entity-property-row reconciliation-row${!hasAnyLedgerButton ? " has-no-action" : ""}`}
              >
                <div className="entity-property-main">
                  <strong>{s.label}</strong>
                  <span style={{ color: statusColor, fontWeight: 600, textTransform: "capitalize", fontSize: 13 }}>
                    {s.status}
                  </span>
                </div>
                <dl>
                  <div>
                    <dt>Statements</dt>
                    <dd>{s.statementCount}</dd>
                  </div>
                  <div>
                    <dt>Account</dt>
                    <dd>{s.accountAffected || "—"}</dd>
                  </div>
                  <div>
                    <dt>Period</dt>
                    <dd>{period}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatDateAU(s.createdAt)}</dd>
                  </div>
                </dl>
                {hasAnyLedgerButton && (
                  <div className="reconciliation-action-slot">
                    {s.status === "completed" && (
                      <button
                        type="button"
                        className="entity-wizard-primary is-orange"
                        style={{ minHeight: 36, height: 36, padding: "0 12px", fontSize: 13, borderRadius: 6, boxShadow: "none", whiteSpace: "nowrap" }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(
                            `/dashboard/accountant/clients/${clientId}/entities/${entityId}/reconciliation/${s.id}/ledger`,
                          );
                        }}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 14, height: 14, stroke: "currentColor", strokeWidth: 2, fill: "none", marginRight: 6 }}>
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                        </svg>
                        View Ledger
                      </button>
                    )}
                  </div>
                )}
                {reconciliationHref && (
                  <Link
                    href={`${reconciliationHref}/${encodeURIComponent(s.id)}`}
                    className="entity-property-chevron-link"
                    aria-label={`Open reconciliation ${s.label}`}
                  >
                    <svg className="entity-property-chevron" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
