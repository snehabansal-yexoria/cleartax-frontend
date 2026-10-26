"use client";

import { StatValueSkeleton, TextSkeleton } from "@/app/components/PortalSkeletons";
import { RegionError } from "@/app/components/ui/RegionError";
import type { AsyncRegion } from "@/app/components/useAsyncRegion";
import { isPending } from "./types";

export type GstCardData = {
  gstOnPurchases: number;
  gstOnSales: number;
  periodLabel: string;
};

export type EntityGstCardsProps = {
  gst: AsyncRegion<GstCardData>;
};

function formatAud(val: number): string {
  return `A$ ${val.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

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
  const isPurchases = tone === "purchases";

  const borderColor = isPurchases ? "#fee2e2" : "#dcfce7";
  const bgColor = isPurchases ? "#fef2f2" : "#f0fdf4";
  const labelColor = isPurchases ? "#b91c1c" : "#15803d";
  const iconBg = isPurchases ? "#ef4444" : "#12b76a";

  return (
    <article
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 28px",
        border: `1px solid ${borderColor}`,
        borderRadius: "10px",
        background: bgColor,
        boxShadow: "0 8px 20px rgba(16, 24, 40, 0.05)",
      }}
      aria-busy={pending || undefined}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: labelColor,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        {pending ? (
          <TextSkeleton width="30%" />
        ) : failed ? (
          <RegionError compact message="GST summary unavailable" onRetry={gst.reload} />
        ) : gst.data?.periodLabel ? (
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: labelColor,
              opacity: 0.75,
            }}
          >
            {gst.data.periodLabel}
          </span>
        ) : null}
        <strong
          style={{
            fontSize: "28px",
            fontWeight: 800,
            color: "#000000",
            marginTop: "4px",
            fontVariantNumeric: "tabular-nums",
          }}
          title={failed ? gst.error ?? undefined : undefined}
        >
          {pending ? (
            <StatValueSkeleton />
          ) : failed || !gst.data ? (
            "—"
          ) : (
            formatAud(amount(gst.data))
          )}
        </strong>
      </div>
      <span
        style={{
          background: iconBg,
          color: "#ffffff",
          borderRadius: "9px",
          width: "46px",
          height: "46px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
    </article>
  );
}

export default function EntityGstCards({ gst }: EntityGstCardsProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "18px",
        marginTop: "18px",
        marginBottom: "18px",
      }}
    >
      <GstCard
        tone="purchases"
        label="GST on purchase"
        amount={(d) => d.gstOnPurchases}
        gst={gst}
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ width: "20px", height: "20px" }}
          >
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
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ width: "20px", height: "20px" }}
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        }
      />
    </div>
  );
}
