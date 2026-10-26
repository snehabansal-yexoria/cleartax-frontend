"use client";

import Link from "next/link";
import ToggleSwitch from "@/app/components/ToggleSwitch";
import { EntityPropertyListSkeleton } from "@/app/components/PortalSkeletons";
import { RegionError } from "@/app/components/ui/RegionError";
import type { AsyncRegion } from "@/app/components/useAsyncRegion";
import { formatCurrency } from "@/src/lib/currency";
import { formatDateAU } from "@/src/lib/dates";
import type { CoreProperty } from "@/src/lib/coreApi";
import { isPending } from "./types";
import { appendQueryParam, titleCase } from "./utils";

export type PropertiesTabProps = {
  properties: AsyncRegion<CoreProperty[]>;
  entityDisabled: boolean;
  entityReconciled: boolean;
  isClientView: boolean;
  addPropertyHref: string;
  propertyDetailHrefBase: string;
  addTransactionHref: string;
  togglingPropertyId: string | null;
  onToggleProperty: (property: CoreProperty, next: boolean) => void;
};

export default function PropertiesTab({
  properties,
  entityDisabled,
  entityReconciled,
  isClientView,
  addPropertyHref,
  propertyDetailHrefBase,
  addTransactionHref,
  togglingPropertyId,
  onToggleProperty,
}: PropertiesTabProps) {
  const items = properties.data ?? [];

  return (
    <div aria-busy={isPending(properties.status) || undefined}>
      <div className="entity-resource-head">
        <h2>Entity Property</h2>
        {entityDisabled ? (
          <button type="button" className="entity-wizard-primary is-green" disabled title="Entity is inactive">
            + Add Property
          </button>
        ) : (
          <Link href={addPropertyHref} className="entity-wizard-primary is-green">
            + Add Property
          </Link>
        )}
      </div>

      {isPending(properties.status) ? (
        <EntityPropertyListSkeleton />
      ) : properties.status === "error" ? (
        <RegionError
          message={properties.error ?? "Could not load properties."}
          onRetry={properties.reload}
        />
      ) : items.length === 0 ? (
        <div className="client-detail-empty">
          <p>No properties have been linked to this entity yet.</p>
        </div>
      ) : (
        <ul className="entity-property-list">
          {items.map((property) => {
            const propertyDisabled = property.enabled === false;
            const detailHref = `${propertyDetailHrefBase}/${property.id}`;
            return (
              <li key={property.id} className={`entity-property-row${!isClientView ? " has-toggle" : ""}`}>
                <div className="entity-property-main">
                  <Link href={detailHref} className="entity-property-title-link">
                    <strong>{property.name}</strong>
                  </Link>
                  <span>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                    {property.locationText}
                  </span>
                </div>
                {!isClientView && (
                  <ToggleSwitch
                    checked={!propertyDisabled}
                    onChange={(checked) => onToggleProperty(property, checked)}
                    disabled={entityDisabled}
                    loading={togglingPropertyId === property.id}
                    green
                    label={propertyDisabled ? "Inactive" : "Active"}
                    title={
                      entityDisabled
                        ? "Activate the entity first"
                        : propertyDisabled
                          ? "Activate this property"
                          : "Deactivate this property"
                    }
                  />
                )}
                <dl>
                  <div>
                    <dt>Property Type</dt>
                    <dd>{titleCase(property.propertyType)}</dd>
                  </div>
                  <div>
                    <dt>Date Added</dt>
                    <dd>{formatDateAU(property.createdAt, "Recently")}</dd>
                  </div>
                  <div>
                    <dt>Market Value</dt>
                    <dd>{formatCurrency(property.estimatedMarketValue ?? 0, { decimals: 0 })}</dd>
                  </div>
                </dl>
                {entityReconciled || entityDisabled || propertyDisabled ? (
                  <span
                    className="entity-property-action is-disabled"
                    title={
                      entityReconciled
                        ? "Entity is reconciled"
                        : entityDisabled
                          ? "Entity is inactive"
                          : "Property is inactive"
                    }
                  >
                    + Add Transaction
                  </span>
                ) : (
                  <Link
                    href={appendQueryParam(addTransactionHref, "propertyId", property.id)}
                    className="entity-property-action"
                  >
                    + Add Transaction
                  </Link>
                )}
                <Link
                  href={detailHref}
                  className="entity-property-chevron-link"
                  aria-label={`Open ${property.name}`}
                >
                  <svg className="entity-property-chevron" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
