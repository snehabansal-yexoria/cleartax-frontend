"use client";

import type { ReactNode } from "react";
import { StatValueSkeleton, TextSkeleton } from "@/app/components/PortalSkeletons";
import { RegionError } from "@/app/components/ui/RegionError";
import type { AsyncRegion } from "@/app/components/useAsyncRegion";
import { formatCurrency } from "@/src/lib/currency";
import { isPending } from "./types";

export type EntityStatCardsProps = {
  propertiesCount: AsyncRegion<number>;
  transactionsCount: AsyncRegion<number>;
  /** Sum of estimated market values plus how many properties it spans. */
  marketValue: AsyncRegion<{ value: number; propertyCount: number }>;
};

function StatValue<T>({
  region,
  render,
  errorMessage,
}: {
  region: AsyncRegion<T>;
  render: (data: T) => ReactNode;
  errorMessage: string;
}) {
  if (isPending(region.status)) return <StatValueSkeleton />;
  if (region.status === "error" || region.data === null) {
    return (
      <>
        —
        <RegionError compact message={errorMessage} onRetry={region.reload} />
      </>
    );
  }
  return <>{render(region.data)}</>;
}

export default function EntityStatCards({
  propertiesCount,
  transactionsCount,
  marketValue,
}: EntityStatCardsProps) {
  return (
    <div className="client-stat-grid entity-stat-grid">
      <article
        className="client-stat-card is-compact"
        aria-busy={isPending(propertiesCount.status) || undefined}
      >
        <div className="client-stat-copy">
          <span className="client-stat-label">Total Properties</span>
          <strong className="client-stat-value">
            <StatValue
              region={propertiesCount}
              render={(count) => count}
              errorMessage="Couldn't load properties"
            />
          </strong>
        </div>
        <span className="client-stat-icon is-property">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 21V9l8-6 8 6v12" />
            <path d="M9 21v-7h6v7" />
            <path d="M9 10h.01" />
            <path d="M15 10h.01" />
          </svg>
        </span>
      </article>

      <article
        className="client-stat-card is-compact"
        aria-busy={isPending(transactionsCount.status) || undefined}
      >
        <div className="client-stat-copy">
          <span className="client-stat-label">Total Transactions</span>
          <strong className="client-stat-value">
            <StatValue
              region={transactionsCount}
              render={(count) => count}
              errorMessage="Couldn't load the transaction count"
            />
          </strong>
        </div>
        <span className="client-stat-icon is-transaction">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </span>
      </article>

      <article
        className="client-stat-card is-compact"
        aria-busy={isPending(marketValue.status) || undefined}
      >
        <div className="client-stat-copy">
          <span className="client-stat-label">
            Market Value
            <button
              type="button"
              className="client-stat-info"
              aria-label="Estimated market value of all properties in this entity, including inactive ones"
              title="Estimated market value of all properties in this entity, including inactive ones"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </button>
          </span>
          <strong className="client-stat-value">
            <StatValue
              region={marketValue}
              render={(data) => formatCurrency(data.value, { decimals: 0 })}
              errorMessage="Couldn't load market value"
            />
          </strong>
          <span className="client-stat-sub">
            {marketValue.status === "ready" && marketValue.data ? (
              `Across ${marketValue.data.propertyCount} ${marketValue.data.propertyCount === 1 ? "property" : "properties"}`
            ) : isPending(marketValue.status) ? (
              <TextSkeleton width="38%" />
            ) : null}
          </span>
        </div>
        <span className="client-stat-icon is-value">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </span>
      </article>
    </div>
  );
}
