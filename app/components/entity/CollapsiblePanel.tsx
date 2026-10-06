"use client";

import type { ReactNode } from "react";

export type CollapsiblePanelProps = {
  id: string;
  title: string;
  subtitle: string;
  tone: "personal" | "asset";
  icon: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
};

/**
 * Toggle button plus a grid-collapsed body (0fr → 1fr on --t-base).
 *
 * The body stays mounted so its region keeps whatever it has loaded; `inert`
 * removes the collapsed content from the tab order and the accessibility tree.
 */
export default function CollapsiblePanel({
  id,
  title,
  subtitle,
  tone,
  icon,
  expanded,
  onToggle,
  children,
}: CollapsiblePanelProps) {
  const bodyId = `${id}-body`;
  const headId = `${id}-toggle`;

  return (
    <div className="entity-panel">
      <button
        type="button"
        id={headId}
        className={`entity-panel-toggle is-${tone}`}
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={onToggle}
      >
        <span className="entity-panel-toggle-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="entity-panel-toggle-copy">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </span>
        <svg className="entity-panel-toggle-chevron" viewBox="0 0 24 24" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      <div
        id={bodyId}
        role="region"
        aria-labelledby={headId}
        className={`entity-panel-body${expanded ? " is-open" : ""}`}
      >
        <div className="entity-panel-body-inner" inert={!expanded}>
          {children}
        </div>
      </div>
    </div>
  );
}
