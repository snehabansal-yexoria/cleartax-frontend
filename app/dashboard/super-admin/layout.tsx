"use client";

import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import "../_console/console.css";
import { ConsolePageSkeleton } from "../_console/components/Skeletons";

/**
 * Super admin pages sit inside the shared dashboard shell (same sidebar and
 * topbar as admin and accountant). This wrapper only scopes the console
 * styles. The legacy bulk-upload page keeps its own styling.
 */
export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/dashboard/super-admin/bulk-upload")) return <>{children}</>;

  return (
    <div className="cpc cpc-embed">
      <div className="cpc-content">
        <Suspense fallback={<ConsolePageSkeleton />}>{children}</Suspense>
      </div>
    </div>
  );
}
