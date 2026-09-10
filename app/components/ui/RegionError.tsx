"use client";

type RegionErrorProps = {
  message: string;
  onRetry?: () => void;
  compact?: boolean;
};

/**
 * One region's request failed; the rest of the page is unaffected.
 * Always paired with a "—" value in the region it describes. `role="alert"`
 * so screen readers announce it when it appears. The compact variant drops
 * the box and icon so it fits a stat card's sub-label slot.
 */
export function RegionError({ message, onRetry, compact = false }: RegionErrorProps) {
  return (
    <div className={"region-error" + (compact ? " is-compact" : "")} role="alert">
      {!compact && (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      )}
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="region-error-retry" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export default RegionError;
