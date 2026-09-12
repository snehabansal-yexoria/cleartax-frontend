"use client";

import Link from "next/link";
import ToggleSwitch from "@/app/components/ToggleSwitch";
import { EntityHeaderSkeleton, TextSkeleton } from "@/app/components/PortalSkeletons";
import type { AsyncRegion } from "@/app/components/useAsyncRegion";
import type { CoreEntity } from "@/src/lib/coreApi";
import { isPending } from "./types";
import { entityTypeLabel, pluralProperties } from "./utils";

export type EntityHeaderProps = {
  entity: AsyncRegion<CoreEntity>;
  /** null while the count is still unknown. */
  propertiesCount: number | null;
  backHref: string;
  backLabel: string;
  editEntityHref: string;
  isClientView: boolean;
  isTogglingEnabled: boolean;
  enabledError: string | null;
  onToggleEnabled: (next: boolean) => void;
  onOpenGst: () => void;
};

const actionsStyle = { display: "flex", alignItems: "center", gap: 12 } as const;

function ownerCopy(entity: CoreEntity): string {
  const count = entity.beneficiaries?.length ?? 0;
  return count === 1 ? "1 shareholder" : `${count} shareholders`;
}

export default function EntityHeader({
  entity,
  propertiesCount,
  backHref,
  backLabel,
  editEntityHref,
  isClientView,
  isTogglingEnabled,
  enabledError,
  onToggleEnabled,
  onOpenGst,
}: EntityHeaderProps) {
  const data = entity.data;
  const disabled = data?.enabled === false;
  const reconciled = data?.reconciled === true;

  return (
    <>
      <Link href={backHref} className="entity-wizard-back">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Back to {backLabel}
      </Link>

      <header className="entity-page-header" aria-busy={isPending(entity.status) || undefined}>
        {data ? (
          <>
            <div>
              <h1>
                {data.name}
                <span
                  className={`entity-disabled-badge${disabled ? " is-visible" : ""}`}
                  title="This entity is inactive and cannot be modified"
                >
                  Inactive
                </span>
              </h1>
              <p>
                {entityTypeLabel(data.entityType)} · {ownerCopy(data)} ·{" "}
                {propertiesCount === null ? (
                  <TextSkeleton width={80} />
                ) : (
                  pluralProperties(propertiesCount)
                )}
              </p>
            </div>
            <div style={actionsStyle}>
              {!isClientView && (
                <ToggleSwitch
                  checked={!disabled}
                  onChange={onToggleEnabled}
                  disabled={reconciled}
                  loading={isTogglingEnabled}
                  green
                  label={disabled ? "Inactive" : "Active"}
                  title={
                    reconciled
                      ? "Reconciled entities cannot be toggled"
                      : disabled
                        ? "Activate this entity"
                        : "Deactivate this entity"
                  }
                />
              )}
              {!reconciled && !disabled && (
                <Link
                  href={editEntityHref}
                  className="entity-icon-action entity-detail-edit-action"
                  aria-label={`Edit ${data.name}`}
                  title="Edit entity"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  <span>Edit Details</span>
                </Link>
              )}
              {/* Entity level is the BAS-lodging unit — GST is reported per ABN,
                  so this is the summary an accountant actually transcribes. */}
              <button
                type="button"
                className="property-outline-button"
                onClick={onOpenGst}
                title="View the BAS GST summary for this entity"
              >
                GST Summary
              </button>
            </div>
          </>
        ) : (
          <EntityHeaderSkeleton />
        )}
      </header>

      {enabledError && (
        <p className="entity-wizard-error" role="alert">
          {enabledError}
        </p>
      )}

      <div className={`entity-disabled-notice${disabled ? " is-visible" : ""}`} role="status">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="entity-reconciled-notice-icon" width={20} height={20}>
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12h8" />
        </svg>
        <div>
          <strong>Entity Inactive</strong>
          <p>
            This entity is inactive. All changes — transactions, properties,
            documents, and reconciliations — are blocked until it is activated.
          </p>
        </div>
      </div>

      {reconciled && (
        <div className="entity-reconciled-notice" role="status">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="entity-reconciled-notice-icon" width={20} height={20}>
            <circle cx="12" cy="12" r="10" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <div>
            <strong>Reconciliation Completed</strong>
            <p>
              This entity has been reconciled and is now read-only.
              No further transactions, statements, or edits can be made.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
