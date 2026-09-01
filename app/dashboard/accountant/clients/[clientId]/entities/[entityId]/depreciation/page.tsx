"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import DepreciationReport from "@/app/components/DepreciationReport";

/**
 * Depreciation module → Asset Depreciation Report, at entity scope.
 *
 * Entity rather than property because depreciation is claimed on the entity's
 * return; the per-property view is on the property page and the per-asset
 * report is one click further in.
 */
export default function EntityDepreciationPage() {
  const params = useParams<{ clientId: string; entityId: string }>();
  const clientId = params?.clientId ?? "";
  const entityId = params?.entityId ?? "";
  const base = `/dashboard/accountant/clients/${clientId}/entities/${entityId}`;

  return (
    <div className="client-detail-page property-detail-page property-detail-shell" style={{ padding: "0 32px 60px" }}>
      <div style={{ margin: "12px 0 24px" }}>
        <Link
          href={base}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            color: "#475569",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px" }}>
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to entity
        </Link>
      </div>

      <DepreciationReport
        level="entity"
        id={entityId}
        assetHrefBase={`${base}/assets`}
        title="Asset Depreciation Report"
      />
    </div>
  );
}
