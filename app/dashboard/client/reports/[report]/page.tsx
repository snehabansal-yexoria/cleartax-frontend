"use client";

import { Suspense } from "react";
import { notFound, useParams } from "next/navigation";
import ClientReportPage from "@/app/components/reports/client/ClientReportPage";
import { isBuildableReport } from "@/app/components/reports/client/reportRegistry";

/**
 * /dashboard/client/reports/{pl|depreciation|gst}. Portfolio Summary keeps its
 * own route (reports/portfolio-summary), which Next matches before this one.
 */
function ReportRoute() {
  const params = useParams<{ report: string }>();
  const key = params?.report ?? "";
  if (!isBuildableReport(key)) notFound();
  return <ClientReportPage reportKey={key} />;
}

export default function ClientReportRoutePage() {
  return (
    <Suspense fallback={null}>
      <ReportRoute />
    </Suspense>
  );
}
