"use client";

// Small presentational on/off switch reusing the .rule-toggle styles from
// globals.css (same visual as the private ToggleCard in TransactionsFeature).
// While `loading` is true the knob shows a spinner and clicks are ignored;
// the label only appears on hover/focus.
export default function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  loading = false,
  green = false,
  label,
  title,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  green?: boolean;
  label?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={`entity-enable-toggle${loading ? " is-loading" : ""}`}
      onClick={() => {
        if (!disabled && !loading) onChange(!checked);
      }}
      aria-pressed={checked}
      aria-busy={loading || undefined}
      aria-label={label}
      title={title}
      disabled={disabled || loading}
    >
      <span
        className={`rule-toggle${checked ? " is-on" : ""}${green ? " is-green" : ""}`}
      >
        <i>
          {loading && (
            <svg
              className="entity-toggle-spinner"
              viewBox="22 22 44 44"
              aria-hidden="true"
            >
              <circle cx="44" cy="44" r="20.2" />
            </svg>
          )}
        </i>
      </span>
      {label && <span className="entity-enable-toggle-label">{label}</span>}
    </button>
  );
}
