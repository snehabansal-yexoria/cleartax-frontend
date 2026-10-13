"use client";

import type { ClientHoldingEntity } from "@/app/components/useClientHoldings";

/**
 * Entity / Property pickers for the Reports page. Native selects: keyboard and
 * screen-reader behaviour for free, and they follow the dark theme's
 * color-scheme.
 *
 * Picking a property also selects its entity; changing the entity drops a
 * property that isn't in it.
 */

type Props = {
  entities: ClientHoldingEntity[];
  entityId: string | null;
  propertyId: string | null;
  disabled?: boolean;
  onChange: (next: { entityId: string | null; propertyId: string | null }) => void;
};

const selectClass =
  "h-10 max-w-[220px] rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 text-[13px] font-semibold text-[var(--text-primary)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

const inactive = (enabled: boolean) => (enabled ? "" : " (inactive)");

export default function ReportScopePicker({ entities, entityId, propertyId, disabled, onChange }: Props) {
  const selectedEntity = entities.find((e) => e.id === entityId) ?? null;
  const entityOfProperty = (id: string) => entities.find((e) => e.properties.some((p) => p.id === id)) ?? null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="sr-only" htmlFor="report-scope-entity">
        Entity
      </label>
      <select
        id="report-scope-entity"
        className={selectClass}
        value={entityId ?? ""}
        disabled={disabled}
        onChange={(event) => {
          const nextEntity = event.target.value || null;
          const keepProperty =
            propertyId && nextEntity && entities.find((e) => e.id === nextEntity)?.properties.some((p) => p.id === propertyId);
          onChange({ entityId: nextEntity, propertyId: keepProperty ? propertyId : null });
        }}
      >
        <option value="">All entities</option>
        {entities.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
            {inactive(e.enabled)}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="report-scope-property">
        Property
      </label>
      <select
        id="report-scope-property"
        className={selectClass}
        value={propertyId ?? ""}
        disabled={disabled}
        onChange={(event) => {
          const nextProperty = event.target.value || null;
          onChange({
            entityId: nextProperty ? (entityOfProperty(nextProperty)?.id ?? entityId) : entityId,
            propertyId: nextProperty,
          });
        }}
      >
        <option value="">All properties</option>
        {selectedEntity
          ? selectedEntity.properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {inactive(p.enabled)}
              </option>
            ))
          : entities
              .filter((e) => e.properties.length > 0)
              .map((e) => (
                <optgroup key={e.id} label={e.name}>
                  {e.properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {inactive(p.enabled)}
                    </option>
                  ))}
                </optgroup>
              ))}
      </select>
    </div>
  );
}
