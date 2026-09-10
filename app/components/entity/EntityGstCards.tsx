"use client";

import { StatValueSkeleton, TextSkeleton } from "@/app/components/PortalSkeletons";
import { RegionError } from "@/app/components/ui/RegionError";
import type { AsyncRegion } from "@/app/components/useAsyncRegion";
import { formatCurrency } from "@/src/lib/currency";
import { isPending } from "./types";

export type GstCardData = {
  gstOnPurchases: number;
  gstOnSales: number;
  periodLabel: string;
};

export type EntityGstCardsProps = {
  gst: AsyncRegion<GstCardData>;
};

function GstCard({
  tone,
  label,
  amount,
  gst,
  icon,
}: {
  tone: "purchases" | "sales";
  label: string;
  amount: (data: GstCardData) => number;
  gst: AsyncRegion<GstCardData>;
  icon: React.ReactNode;
}) {
  const pending = isPending(gst.status);
  const failed = gst.status === "error" || (gst.status === "ready" && gst.data === null);

  return (
    <article
      className={`client-stat-card is-compact is-gst-${tone}`}
      aria-busy={pending || undefined}
    >
      <div className="client-stat-copy">
        <span className="client-stat-label">{label}</span>
        {pending ? (
          <TextSkeleton width="30%" />
        ) : failed ? (
          <RegionError compact message="GST summary unavailable" onRetry={gst.reload} />
        ) : gst.data?.periodLabel ? (
          <span className="client-stat-period">{gst.data.periodLabel}</span>
        ) : null}
        <strong className="client-stat-value" title={failed ? gst.error ?? undefined : undefined}>
          {pending ? <StatValueSkeleton /> : failed || !gst.data ? "—" : formatCurrency(amount(gst.data))}
        </strong>
      </div>
      <span className={`client-stat-icon is-gst-${tone}`}>{icon}</span>
    </article>
  );
}

export default function EntityGstCards({ gst }: EntityGstCardsProps) {
  return (
    <div className="entity-gst-grid">
      <GstCard
        tone="purchases"
        label="GST on purchase"
        amount={(d) => d.gstOnPurchases}
        gst={gst}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 20, height: 20 }}>
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
        }
      />
      <GstCard
        tone="sales"
        label="GST on sales"
        amount={(d) => d.gstOnSales}
        gst={gst}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 20, height: 20 }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        }
      />
    </div>
  );
}
