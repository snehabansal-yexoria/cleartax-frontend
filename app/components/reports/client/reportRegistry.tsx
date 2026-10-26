import type { ReactNode } from "react";
import type { ClientReportKey } from "./reportLinks";

/**
 * The client reports, in the order the Reports list shows them. Add a report
 * here (and a body component in ClientReportPage) and it appears on both the
 * desktop Reports page and the phone's Insights → Reports tab.
 */

export type ClientReportDef = {
  key: ClientReportKey;
  title: string;
  blurb: string;
  bullets: string[];
  /** Download PDF file name stem. */
  fileName: string;
  icon: ReactNode;
};

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const DownloadIcon = () => (
  <svg {...svgProps}>
    <path d="M12 4v12M7 11l5 5 5-5M5 20h14" />
  </svg>
);

export const CLIENT_REPORTS: ClientReportDef[] = [
  {
    key: "pl",
    title: "Profit & Loss",
    blurb: "See what your properties earned, what they cost and the result.",
    bullets: ["Money in, money out and net result", "Month-by-month chart", "Costs by category and by property"],
    fileName: "Profit-and-Loss",
    icon: (
      <svg {...svgProps}>
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 5-6" />
      </svg>
    ),
  },
  {
    key: "depreciation",
    title: "Depreciation",
    blurb: "See this year's claim for buildings and fixtures, item by item.",
    bullets: ["Building and fixtures claim", "Item list with values", "Five-year outlook"],
    fileName: "Depreciation",
    icon: (
      <svg {...svgProps}>
        <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
        <path d="M16 4v3" />
      </svg>
    ),
  },
  {
    key: "gst",
    title: "GST",
    blurb: "See your BAS figures by quarter, or why no GST applies.",
    bullets: ["GST collected and claimed", "Quarterly BAS summary", "GST inside costs you can't claim"],
    fileName: "GST",
    icon: (
      <svg {...svgProps}>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8M8 11h2M14 11h2M8 15h2M14 15h2" />
      </svg>
    ),
  },
  {
    key: "portfolio",
    title: "Portfolio Summary",
    blurb: "Your whole position: value, loans, equity and results by entity.",
    bullets: ["Market value, loans and LVR", "Results by entity and property", "Printable statement"],
    fileName: "Portfolio-Summary",
    icon: (
      <svg {...svgProps}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 15v-3M12 15V8M17 15v-5" />
      </svg>
    ),
  },
];

/** The three reports built on the shared report page (Portfolio Summary has its own). */
export type BuildableReportKey = Exclude<ClientReportKey, "portfolio">;

export function isBuildableReport(key: string): key is BuildableReportKey {
  return key === "pl" || key === "depreciation" || key === "gst";
}

export function reportDef(key: ClientReportKey): ClientReportDef {
  return CLIENT_REPORTS.find((r) => r.key === key) ?? CLIENT_REPORTS[0];
}
