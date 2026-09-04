"use client";

import { useMemo, useState } from "react";
import type { CoreAssetClass, CoreDepreciationMethod } from "@/src/lib/coreApi";

/**
 * The Add Asset form, in one place.
 *
 * It used to exist three times — in TransactionsFeature (accountant), in the
 * reconciliation categorize drawer, and in ClientAddTransactionView — and the
 * three had drifted apart in ways that changed what got saved:
 *
 *   - two of them captured the depreciation method but only wrote it when the
 *     asset name happened to be non-empty;
 *   - the client-facing one never captured a method at all, so every asset a
 *     client added had no method to depreciate on;
 *   - all three sent the method and the name inside `metadata`, where nothing
 *     validated them and no backend code read them;
 *   - capital works showed a disabled "40" that was never submitted.
 *
 * Migration 0037 made asset_name and depreciation_method real columns with a
 * CHECK constraint, so all of that is now a 400 rather than a silent gap. This
 * component is what every caller uses to build a valid bundle.
 */

export const CAPITAL_WORKS_EFFECTIVE_LIFE = 40;

export type AssetDraft = {
  assetClass: CoreAssetClass;
  assetName: string;
  effectiveLifeYears: number;
  depreciationMethod: CoreDepreciationMethod;
};

/**
 * The request fields for an asset, as first-class body keys.
 *
 * Callers must NOT also write asset_item_name / depreciation_method into
 * metadata: migration 0037 strips those keys, and writing them back would
 * recreate the situation where two places disagree about the method.
 */
export function assetRequestFields(draft: AssetDraft | null): Record<string, unknown> {
  if (!draft) {
    return { is_asset_purchase: false };
  }
  return {
    is_asset_purchase: true,
    asset_class: draft.assetClass,
    asset_name: draft.assetName.trim(),
    depreciation_method: draft.depreciationMethod,
    effective_life_years:
      draft.assetClass === "capital_works"
        ? CAPITAL_WORKS_EFFECTIVE_LIFE
        : draft.effectiveLifeYears,
  };
}

/** Division 43 is prime cost at 2.5% only; the accountant does not choose. */
export function methodsFor(assetClass: CoreAssetClass): CoreDepreciationMethod[] {
  return assetClass === "capital_works"
    ? ["prime_cost"]
    : ["diminishing_value", "prime_cost"];
}

export function annualRateFor(
  method: CoreDepreciationMethod,
  lifeYears: number,
): number {
  if (!lifeYears || lifeYears <= 0) return 0;
  return (method === "diminishing_value" ? 200 : 100) / lifeYears;
}

export function assetClassLabel(assetClass: CoreAssetClass): string {
  return assetClass === "capital_works"
    ? "Capital Works (Div 43)"
    : "Capital Allowances (Div 40)";
}

export function methodLabel(method: CoreDepreciationMethod): string {
  return method === "prime_cost" ? "Prime Cost" : "Diminishing Value";
}

type AssetBuilderProps = {
  /** Pre-fills the form when editing an asset that already exists. */
  initial?: Partial<AssetDraft> | null;
  onCancel: () => void;
  onSubmit: (draft: AssetDraft) => void;
};

export default function AssetBuilder({
  initial,
  onCancel,
  onSubmit,
}: AssetBuilderProps) {
  const [assetClass, setAssetClass] = useState<CoreAssetClass | "">(
    initial?.assetClass ?? "",
  );
  const [assetName, setAssetName] = useState(initial?.assetName ?? "");
  const [life, setLife] = useState(
    initial?.effectiveLifeYears ? String(initial.effectiveLifeYears) : "",
  );
  const [method, setMethod] = useState<CoreDepreciationMethod | "">(
    initial?.depreciationMethod ?? "",
  );

  const lifeYears = Number.parseFloat(life);
  const lifeIsValid = Number.isFinite(lifeYears) && lifeYears > 0 && lifeYears <= 100;

  // The draft is the single source of "is this valid yet": the submit button,
  // the rate preview and the payload all read it, so the form cannot enable a
  // button for a bundle it would then fail to build.
  const draft: AssetDraft | null = useMemo(() => {
    if (assetClass === "" || method === "" || !lifeIsValid) return null;
    if (assetName.trim() === "") return null;
    const isCapitalWorks = assetClass === "capital_works";
    return {
      assetClass,
      assetName: assetName.trim(),
      effectiveLifeYears: isCapitalWorks ? CAPITAL_WORKS_EFFECTIVE_LIFE : lifeYears,
      depreciationMethod: isCapitalWorks ? "prime_cost" : method,
    };
  }, [assetClass, assetName, method, lifeIsValid, lifeYears]);

  const ratePreview = draft
    ? `${annualRateFor(draft.depreciationMethod, draft.effectiveLifeYears).toFixed(2)}% p.a. (${draft.depreciationMethod === "diminishing_value" ? "200%" : "100%"
    } ÷ ${draft.effectiveLifeYears} yrs)`
    : null;

  const submit = () => {
    if (draft) onSubmit(draft);
  };

  return (
    <div className="figma-asset-builder-card">
      <div className="figma-asset-builder-head">Add Asset</div>

      {/* ---- Category ------------------------------------------------------ */}
      <div className="figma-asset-class-grid">
        <button
          type="button"
          className={`figma-asset-class-card${assetClass === "capital_works" ? " active" : ""}`}
          aria-pressed={assetClass === "capital_works"}
          onClick={() => {
            // Division 43 determines both, so they are set here rather than in
            // an effect that reacts to the category — the choice IS the event.
            setAssetClass("capital_works");
            setLife(String(CAPITAL_WORKS_EFFECTIVE_LIFE));
            setMethod("prime_cost");
            if (assetName === "") setAssetName("Capital Works");
          }}
        >
          <div className="figma-asset-class-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div className="figma-asset-class-info">
            <span className="figma-asset-class-title">Capital Works</span>
            {/* <span className="figma-asset-class-desc">
              Structural / building costs (Div 43). Fixed 40-year life at 2.5% prime cost.
            </span> */}
          </div>
        </button>

        <button
          type="button"
          className={`figma-asset-class-card${assetClass === "capital_allowance" ? " active" : ""}`}
          aria-pressed={assetClass === "capital_allowance"}
          onClick={() => {
            setAssetClass("capital_allowance");
            if (assetName === "Capital Works") setAssetName("");
            setLife("");
            setMethod("");
          }}
        >
          <div className="figma-asset-class-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
          <div className="figma-asset-class-info">
            <span className="figma-asset-class-title">Capital Allowance</span>
            {/* <span className="figma-asset-class-desc">
              Plant &amp; equipment (Div 40). You choose the effective life and method.
            </span> */}
          </div>
        </button>
      </div>

      {/* ---- Name + effective life ----------------------------------------- */}
      <div className="figma-form-row">
        <div className="figma-field-container">
          <span className="figma-field-label">
            Asset Name<em>*</em>
          </span>
          <input
            type="text"
            className="figma-input"
            placeholder="e.g. Fridge, AC, dishwasher"
            value={assetName}
            onChange={(e) => setAssetName(e.target.value)}
          />
          <span className="figma-field-hint">
            Names the depreciation schedule filed under the property.
          </span>
        </div>

        {assetClass !== "" && (
          <div className="figma-field-container">
            <span className="figma-field-label">
              Effective Life (years)<em>*</em>
            </span>
            <input
              type="number"
              className="figma-input"
              min={0.5}
              max={100}
              step={0.5}
              placeholder="e.g. 8"
              value={assetClass === "capital_works" ? CAPITAL_WORKS_EFFECTIVE_LIFE : life}
              disabled={assetClass === "capital_works"}
              onChange={(e) => setLife(e.target.value)}
            />
            <span className="figma-field-hint">
              {assetClass === "capital_works"
                ? "Fixed by Division 43."
                : "From the ATO effective life tables. Halves are allowed."}
            </span>
          </div>
        )}
      </div>

      {/* ---- Method --------------------------------------------------------- */}
      {assetClass === "capital_allowance" && (
        <div style={{ marginTop: "20px" }}>
          <span
            className="figma-field-label"
            style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}
          >
            Method of Depreciation<em>*</em>
          </span>

          <div className="figma-asset-class-grid">
            {methodsFor("capital_allowance").map((m) => (
              <button
                key={m}
                type="button"
                className={`figma-asset-class-card${method === m ? " active" : ""}`}
                aria-pressed={method === m}
                onClick={() => setMethod(m)}
              >
                <div className="figma-asset-class-icon">
                  {m === "diminishing_value" ? (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                      <polyline points="17 6 23 6 23 12" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  )}
                </div>
                <div className="figma-asset-class-info">
                  <span className="figma-asset-class-title">{methodLabel(m)}</span>
                  <span className="figma-asset-class-desc">
                    {m === "diminishing_value"
                      ? "Higher deductions in early years"
                      : "Equal deductions each year"}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {ratePreview && (
            <p className="figma-field-hint" style={{ margin: "10px 0 0" }}>
              Depreciation rate: <strong>{ratePreview}</strong>
            </p>
          )}
        </div>
      )}

      <div className="figma-asset-actions">
        <button type="button" className="figma-asset-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="figma-asset-submit-btn"
          disabled={!draft}
          onClick={submit}
        >
          Add Asset
        </button>
      </div>
    </div>
  );
}

/**
 * The chip shown once an asset is attached to the transaction being edited.
 */
/**
 * The chip shown once an asset is attached to the transaction being edited.
 */
export function AssetSummaryChip({
  draft,
  onRemove,
}: {
  draft: AssetDraft;
  onRemove: () => void;
}) {
  return (
    <div className="figma-active-asset-display">
      <div className="figma-active-asset-left">
        <div className="figma-active-asset-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </div>
        <div>
          <span className="figma-active-asset-title">{draft.assetName}</span>
          <div className="figma-active-asset-meta">
            {assetClassLabel(draft.assetClass)} • {draft.effectiveLifeYears} years •{" "}
            {methodLabel(draft.depreciationMethod)} •{" "}
            {annualRateFor(draft.depreciationMethod, draft.effectiveLifeYears).toFixed(2)}% p.a.
          </div>
        </div>
      </div>
      <button type="button" className="figma-active-asset-remove" onClick={onRemove}>
        Remove Asset
      </button>
    </div>
  );
}
