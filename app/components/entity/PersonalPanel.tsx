"use client";

import { PanelRowsSkeleton } from "@/app/components/PortalSkeletons";
import { RegionError } from "@/app/components/ui/RegionError";
import type { AsyncRegion } from "@/app/components/useAsyncRegion";
import { personalCategoryLabel } from "@/app/components/usePersonalAndAssetTransactions";
import { formatCurrency } from "@/src/lib/currency";
import type { CorePersonalSummary } from "@/src/lib/coreApi";
import CollapsiblePanel from "./CollapsiblePanel";
import { isPending } from "./types";

export type PersonalPanelProps = {
  personal: AsyncRegion<CorePersonalSummary | null>;
  expanded: boolean;
  onToggle: () => void;
};

const icon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export default function PersonalPanel({ personal, expanded, onToggle }: PersonalPanelProps) {
  const categories = personal.data?.categories ?? [];

  let body: React.ReactNode;
  if (isPending(personal.status)) {
    body = <PanelRowsSkeleton rows={4} />;
  } else if (personal.status === "error") {
    body = (
      <RegionError
        message={personal.error ?? "Could not load personal transactions."}
        onRetry={personal.reload}
      />
    );
  } else if (categories.length === 0) {
    body = (
      <div className="client-detail-empty">
        <p>No personal transactions recorded for this entity.</p>
      </div>
    );
  } else {
    body = (
      <div className="entity-panel-list">
        {categories.map((c) => (
          <div
            key={`${c.categoryId}|${c.subcategoryName}`}
            className="entity-panel-list-row"
          >
            <span>{personalCategoryLabel(c)}</span>
            {/* Private spending is money out by definition; the API returns
                magnitudes and the sign is applied here. */}
            <strong>{formatCurrency(-c.grossAmount)}</strong>
          </div>
        ))}
        <div className="entity-panel-list-total">
          <strong>Total</strong>
          <strong>{formatCurrency(-(personal.data?.totalGross ?? 0))}</strong>
        </div>
      </div>
    );
  }

  return (
    <CollapsiblePanel
      id="entity-personal-panel"
      title="Personal Transactions"
      subtitle="Private spending totals by category"
      tone="personal"
      icon={icon}
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="entity-panel-card" aria-busy={isPending(personal.status) || undefined}>
        <h4 className="entity-panel-heading">Private spending</h4>
        {body}
      </div>
    </CollapsiblePanel>
  );
}
