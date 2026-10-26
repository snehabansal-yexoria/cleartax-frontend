"use client";

import { useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";

/**
 * The client portal's segmented control (the home page's Summary / Detailed
 * look, `.m-db-toggle`) as an accessible tablist: arrow keys / Home / End move
 * between tabs, only the selected tab is in the tab order, and the panel is
 * labelled by its tab.
 *
 * Used for the entity and property pages' Overview / Reporting switch on
 * phones, where the report lives inside the page instead of in the nav.
 */

export type SegmentedTab<T extends string> = { id: T; label: string };

type Props<T extends string> = {
  /** Prefix for the tab/panel ids; unique per page. */
  idBase: string;
  label: string;
  tabs: SegmentedTab<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
};

export const segmentedTabId = (idBase: string, id: string) => `${idBase}-tab-${id}`;
export const segmentedPanelId = (idBase: string, id: string) => `${idBase}-panel-${id}`;

export default function ClientSegmentedTabs<T extends string>({
  idBase,
  label,
  tabs,
  value,
  onChange,
  className,
}: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    event.preventDefault();
    refs.current[next]?.focus();
    onChange(tabs[next].id);
  };

  return (
    <div className={`m-db-toggle${className ? ` ${className}` : ""}`} role="tablist" aria-label={label}>
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={segmentedTabId(idBase, tab.id)}
            aria-selected={selected}
            // Only the selected panel is rendered, so only it can be controlled.
            aria-controls={selected ? segmentedPanelId(idBase, tab.id) : undefined}
            tabIndex={selected ? 0 : -1}
            className={`m-db-toggle-btn${selected ? " is-active" : ""}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/** Attributes that make an existing element the panel for one tab. */
export function segmentedPanelProps(idBase: string, tabId: string) {
  return {
    role: "tabpanel",
    id: segmentedPanelId(idBase, tabId),
    "aria-labelledby": segmentedTabId(idBase, tabId),
  } as const;
}

/** The panel for one tab; render only the selected one. */
export function SegmentedTabPanel({
  idBase,
  tabId,
  children,
  className,
}: {
  idBase: string;
  tabId: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div {...segmentedPanelProps(idBase, tabId)} className={className}>
      {children}
    </div>
  );
}
