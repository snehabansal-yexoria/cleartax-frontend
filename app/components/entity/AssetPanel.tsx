"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { TableRowsSkeleton } from "@/app/components/PortalSkeletons";
import { RegionError } from "@/app/components/ui/RegionError";
import type { AsyncRegion } from "@/app/components/useAsyncRegion";
import { assetItemName } from "@/app/components/usePersonalAndAssetTransactions";
import { formatCurrency } from "@/src/lib/currency";
import { formatDateAU } from "@/src/lib/dates";
import type { CoreTransactionListItem } from "@/src/lib/coreApi";
import CollapsiblePanel from "./CollapsiblePanel";
import { isPending } from "./types";

export type AssetPanelData = {
  rows: CoreTransactionListItem[];
  total: number;
};

export type AssetPanelProps = {
  assets: AsyncRegion<AssetPanelData>;
  /** `${assetHrefBase}/${transactionId}` opens the asset. */
  assetHrefBase: string;
  expanded: boolean;
  onToggle: () => void;
  onViewAll: () => void;
};

const icon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

export default function AssetPanel({
  assets,
  assetHrefBase,
  expanded,
  onToggle,
  onViewAll,
}: AssetPanelProps) {
  const router = useRouter();
  const rows = useMemo(() => assets.data?.rows ?? [], [assets.data]);
  const total = assets.data?.total ?? 0;
  const href = (id: string) => `${assetHrefBase}/${encodeURIComponent(id)}`;

  let body: React.ReactNode;
  if (assets.status === "error") {
    body = (
      <RegionError
        message={assets.error ?? "Could not load asset transactions."}
        onRetry={assets.reload}
      />
    );
  } else if (assets.status === "ready" && rows.length === 0) {
    body = (
      <div className="client-detail-empty">
        <p>No asset purchases recorded for this entity.</p>
      </div>
    );
  } else {
    body = (
      <>
        <table className="entity-asset-table">
          <thead>
            <tr>
              <th scope="col">Property</th>
              <th scope="col">Asset Name</th>
              <th scope="col">Date</th>
              <th scope="col" className="is-numeric">
                Amount
              </th>
              <th scope="col" style={{ width: 24 }}>
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isPending(assets.status) ? (
              <TableRowsSkeleton rows={3} columns={5} />
            ) : (
              rows.map((t) => {
                // The purchase price, signed as money out. The year-one
                // deduction is quoted on the All Transactions grid and in the
                // depreciation module, not in this panel.
                const purchase = formatCurrency(-(t.grossAmount ?? 0));
                const name = assetItemName(t);
                const to = href(t.id);
                return (
                  <tr
                    key={t.id}
                    className="is-clickable"
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest("a")) return;
                      router.push(to);
                    }}
                  >
                    <td>{t.propertyNames?.[0] || "—"}</td>
                    <td>
                      <Link href={to} className="entity-asset-link">
                        {name}
                      </Link>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateAU(t.invoiceDate)}</td>
                    <td className="is-numeric entity-asset-amount">{purchase}</td>
                    <td className="is-numeric">
                      <Link
                        href={to}
                        className="entity-property-chevron-link"
                        aria-label={`Open ${name}`}
                      >
                        <svg className="entity-property-chevron" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="m9 6 6 6-6 6" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {assets.status === "ready" && total > rows.length && (
          <p className="entity-panel-footer">
            Showing {rows.length} of {total} ·{" "}
            <button type="button" className="entity-link-button" onClick={onViewAll}>
              View all
            </button>
          </p>
        )}
      </>
    );
  }

  return (
    <CollapsiblePanel
      id="entity-asset-panel"
      title="Asset Transactions"
      subtitle="Expenses marked as asset purchases"
      tone="asset"
      icon={icon}
      expanded={expanded}
      onToggle={onToggle}
    >
      <div
        className="entity-panel-card is-table"
        aria-busy={isPending(assets.status) || undefined}
      >
        {body}
      </div>
    </CollapsiblePanel>
  );
}
