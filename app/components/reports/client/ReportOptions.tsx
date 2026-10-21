"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { ClientHoldingEntity } from "@/app/components/useClientHoldings";
import { titleWord, fyOption } from "./reportFormat";
import { allProperties, normaliseScope, reportYearOptions, type ReportScope } from "./reportScope";

/**
 * Choosing what a report covers: entity → property → financial year.
 *
 * One rule for both layouts: a property belongs to exactly one entity, so
 * picking a property selects its entity, and picking a different entity drops
 * a property outside it.
 */

export function applyEntity(draft: ReportScope, entityId: string | null, holdings: ClientHoldingEntity[]): ReportScope {
  const keepProperty =
    draft.propertyId != null &&
    entityId != null &&
    holdings.find((e) => e.id === entityId)?.properties.some((p) => p.id === draft.propertyId);
  return { ...draft, entityId, propertyId: keepProperty ? draft.propertyId : null };
}

export function applyProperty(draft: ReportScope, propertyId: string | null, holdings: ClientHoldingEntity[]): ReportScope {
  if (!propertyId) return { ...draft, propertyId: null };
  return normaliseScope({ ...draft, propertyId }, holdings);
}

function propertiesFor(entityId: string | null, holdings: ClientHoldingEntity[]) {
  const all = allProperties(holdings);
  return entityId ? all.filter((p) => p.entityId === entityId) : all;
}

const inactive = (enabled: boolean) => (enabled ? "" : " (inactive)");

// ---------------------------------------------------------------------------
// Desktop: three selects and the actions, in the page header.
// ---------------------------------------------------------------------------

export function ReportOptionsBar({
  draft,
  holdings,
  onChange,
  built,
  stale,
  onBuild,
  download,
}: {
  draft: ReportScope;
  holdings: ClientHoldingEntity[] | null;
  onChange: (next: ReportScope) => void;
  built: boolean;
  stale: boolean;
  onBuild: () => void;
  /** The Download PDF button, once a report is built. */
  download?: ReactNode;
}) {
  const id = useId();
  const list = holdings ?? [];
  const props = propertiesFor(draft.entityId, list);
  const grouped = !draft.entityId && list.length > 1;
  const disabled = holdings == null;

  return (
    <div className="cp-controls">
      <div className="cp-field">
        <label htmlFor={`${id}-entity`}>Entity</label>
        <select
          id={`${id}-entity`}
          className="cp-select"
          value={draft.entityId ?? ""}
          disabled={disabled}
          onChange={(e) => onChange(applyEntity(draft, e.target.value || null, list))}
        >
          <option value="">All entities</option>
          {list.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
              {inactive(e.enabled)}
            </option>
          ))}
        </select>
      </div>
      <div className="cp-field">
        <label htmlFor={`${id}-property`}>Property</label>
        <select
          id={`${id}-property`}
          className="cp-select"
          value={draft.propertyId ?? ""}
          disabled={disabled}
          onChange={(e) => onChange(applyProperty(draft, e.target.value || null, list))}
        >
          <option value="">All properties ({props.length})</option>
          {grouped
            ? list
                .filter((e) => e.properties.length)
                .map((e) => (
                  <optgroup key={e.id} label={e.name}>
                    {e.properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {inactive(p.enabled)}
                      </option>
                    ))}
                  </optgroup>
                ))
            : props.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {inactive(p.enabled)}
                </option>
              ))}
        </select>
      </div>
      <div className="cp-field">
        <label htmlFor={`${id}-fy`}>Financial year</label>
        <select
          id={`${id}-fy`}
          className="cp-select cp-select--fy"
          value={draft.fy}
          onChange={(e) => onChange({ ...draft, fy: Number(e.target.value) })}
        >
          {reportYearOptions().map((y) => (
            <option key={y} value={y}>
              {fyOption(y)}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        className={`cp-btn ${!built ? "cp-btn--primary" : stale ? "cp-btn--tile" : "cp-btn--soft"}`}
        onClick={onBuild}
        disabled={disabled}
      >
        {built ? "Update report" : "Build report"}
      </button>
      {download}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phone: a bottom sheet of radio lists. A native <dialog>, so focus is
// trapped, Escape closes it and the page behind is inert.
// ---------------------------------------------------------------------------

export function ReportOptionsSheet({
  reportTitle,
  initial,
  holdings,
  built,
  onClose,
  onBuild,
}: {
  reportTitle: string;
  initial: ReportScope;
  holdings: ClientHoldingEntity[] | null;
  built: boolean;
  onClose: () => void;
  onBuild: (scope: ReportScope) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [draft, setDraft] = useState(initial);
  const list = holdings ?? [];
  const props = propertiesFor(draft.entityId, list);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="cp-report cp-m-sheet"
      aria-labelledby={`${id}-title`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // A click on the backdrop lands on the dialog element itself; the
      // content sits in an inner box, so a click inside it never does.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cp-m-sheet-in">
        <div className="cp-m-grab" aria-hidden="true" />
        <div className="cp-m-sheet-h">
          <div>
            <h3 id={`${id}-title`}>Report options</h3>
            <div className="cp-m-sheet-sub">{reportTitle}: pick what the report should cover</div>
          </div>
          <button type="button" className="cp-m-x" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>

        {holdings == null ? (
          <div className="cp-m-sheet-sub">Loading your entities…</div>
        ) : (
          <>
            <fieldset className="cp-m-group">
              <legend className="cp-m-lab">1 · Entity</legend>
              <RadioOption
                name={`${id}-entity`}
                checked={!draft.entityId}
                onSelect={() => setDraft(applyEntity(draft, null, list))}
                label="All entities"
              />
              {list.map((e) => (
                <RadioOption
                  key={e.id}
                  name={`${id}-entity`}
                  checked={draft.entityId === e.id}
                  onSelect={() => setDraft(applyEntity(draft, e.id, list))}
                  label={`${e.name}${inactive(e.enabled)}`}
                  sub={titleWord(e.entityType)}
                />
              ))}
            </fieldset>

            <fieldset className="cp-m-group">
              <legend className="cp-m-lab">2 · Property</legend>
              <RadioOption
                name={`${id}-property`}
                checked={!draft.propertyId}
                onSelect={() => setDraft(applyProperty(draft, null, list))}
                label={`All properties${draft.entityId ? " of this entity" : ""}`}
                sub={String(props.length)}
              />
              {props.map((p) => (
                <RadioOption
                  key={p.id}
                  name={`${id}-property`}
                  checked={draft.propertyId === p.id}
                  onSelect={() => setDraft(applyProperty(draft, p.id, list))}
                  label={`${p.name}${inactive(p.enabled)}`}
                  sub={draft.entityId ? p.locationText : p.entityName}
                />
              ))}
            </fieldset>

            <fieldset className="cp-m-group">
              <legend className="cp-m-lab">3 · Financial year</legend>
              <div className="cp-m-fy">
                {reportYearOptions().map((y) => (
                  <label key={y} className="cp-m-fy-opt">
                    <input
                      type="radio"
                      className="cp-sr"
                      name={`${id}-fy`}
                      checked={draft.fy === y}
                      onChange={() => setDraft({ ...draft, fy: y })}
                    />
                    <span>{fyOption(y)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}

        <button
          type="button"
          className="cp-m-btn"
          disabled={holdings == null}
          onClick={() => onBuild(holdings ? normaliseScope(draft, holdings) : draft)}
        >
          {built ? "Update report" : "Build report"}
        </button>
      </div>
    </dialog>
  );
}

function RadioOption({
  name,
  checked,
  onSelect,
  label,
  sub,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  label: string;
  sub?: string;
}) {
  return (
    <label className="cp-m-opt">
      <input type="radio" className="cp-sr" name={name} checked={checked} onChange={onSelect} />
      <span>
        {label}
        {sub ? <small> · {sub}</small> : null}
      </span>
      <i aria-hidden="true" />
    </label>
  );
}
