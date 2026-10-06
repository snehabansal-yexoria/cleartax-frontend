"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { entityTabs, type EntityTab } from "./types";

export type EntityTabsProps = {
  currentTab: EntityTab;
  /** Tabs whose body has been opened at least once; they stay mounted but hidden. */
  openedTabs: ReadonlySet<EntityTab>;
  onChange: (tab: EntityTab) => void;
  panels: Partial<Record<EntityTab, ReactNode>>;
};

export function tabId(tab: EntityTab) {
  return `entity-tab-${tab}`;
}

export function tabPanelId(tab: EntityTab) {
  return `entity-tabpanel-${tab}`;
}

/**
 * APG tablist with manual activation: arrows/Home/End move focus, Enter or
 * Space activates through the button's native click. Opened panels stay
 * mounted (hidden when inactive) so a tab's filters and pages survive a switch.
 */
export default function EntityTabs({ currentTab, openedTabs, onChange, panels }: EntityTabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabRefs.current.findIndex((el) => el === document.activeElement);
    if (index < 0) return;
    const last = entityTabs.length - 1;
    const next =
      event.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    event.preventDefault();
    tabRefs.current[next]?.focus();
  }

  return (
    <section className="entity-resource-panel">
      <div
        className="entity-resource-tabs"
        role="tablist"
        aria-label="Entity resources"
        onKeyDown={onKeyDown}
      >
        {entityTabs.map((tab, index) => {
          const active = tab.id === currentTab;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={tabId(tab.id)}
              aria-selected={active}
              aria-controls={openedTabs.has(tab.id) ? tabPanelId(tab.id) : undefined}
              tabIndex={active ? 0 : -1}
              className={active ? "is-active" : ""}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
              {tab.id === "reconciliation" && <span className="entity-tab-alpha-badge">Alpha</span>}
            </button>
          );
        })}
      </div>

      {entityTabs.map((tab) =>
        openedTabs.has(tab.id) ? (
          <div
            key={tab.id}
            role="tabpanel"
            id={tabPanelId(tab.id)}
            aria-labelledby={tabId(tab.id)}
            tabIndex={0}
            hidden={tab.id !== currentTab}
            className="entity-resource-body entity-tabpanel"
          >
            {panels[tab.id]}
          </div>
        ) : null,
      )}
    </section>
  );
}
