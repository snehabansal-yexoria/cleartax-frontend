"use client";

import { useEffect, useState } from "react";
import "./agent-progress.css";

/**
 * Presentational "agent at work" panel used while a document is being
 * uploaded and extracted. It only visualises the progress the caller already
 * has (which step is active, how far along it is); it makes no requests.
 */
export type AgentStep = {
  label: string;
  /** Short "thinking" lines cycled while this step is active. */
  thoughts?: string[];
};

function formatElapsed(ms: number) {
  const s = Math.max(0, ms) / 1000;
  const m = Math.floor(s / 60);
  const rest = (s - m * 60).toFixed(1).padStart(4, "0");
  return `${String(m).padStart(2, "0")}:${rest}`;
}

export default function AgentProgress({
  title,
  subtitle,
  steps,
  activeIndex,
  activeDetail,
  percent,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  steps: AgentStep[];
  activeIndex: number;
  activeDetail?: string;
  percent: number;
  compact?: boolean;
}) {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(t);
  }, []);

  const elapsed = now - startedAt;
  const active = Math.min(Math.max(activeIndex, 0), steps.length - 1);
  const thoughts = steps[active]?.thoughts ?? [];
  const pct = Math.max(4, Math.min(100, Math.round(percent)));

  return (
    <div className={`agp${compact ? " is-compact" : ""}`} role="status" aria-live="polite">
      <div className="agp-head">
        <span className="agp-orb" aria-hidden="true">
          <i />
          <svg viewBox="0 0 24 24">
            <path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z" />
            <path d="M18.5 15.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z" />
          </svg>
        </span>
        <div className="agp-title">
          <strong>{title}</strong>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
        <span className="agp-chip">
          <b />
          Working
        </span>
        <span className="agp-timer">{formatElapsed(elapsed)}</span>
      </div>

      <ol className="agp-steps">
        {steps.map((step, i) => {
          const state = i < active ? "is-done" : i === active ? "is-active" : "is-todo";
          return (
            <li key={step.label} className={state}>
              <span className="agp-dot" aria-hidden="true">
                {i < active ? (
                  <svg viewBox="0 0 24 24">
                    <path d="M5 12.5l4.2 4.2L19 7" />
                  </svg>
                ) : null}
              </span>
              <span className="agp-step-text">
                <span className="agp-step-label">{step.label}</span>
                {i === active && activeDetail ? (
                  <span className="agp-step-detail">{activeDetail}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>

      {thoughts.length > 0 ? <ThoughtLog key={active} thoughts={thoughts} now={now} /> : null}

      <div className="agp-bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="agp-foot">
        <span>
          Step {active + 1} of {steps.length}
        </span>
        <span>{pct}%</span>
      </div>
    </div>
  );
}

/** Lines appear one by one for the current step and stop on the last one. */
function ThoughtLog({ thoughts, now }: { thoughts: string[]; now: number }) {
  const [startedAt] = useState(() => Date.now());
  const shown = Math.min(thoughts.length, Math.floor((now - startedAt) / 1300) + 1);
  const lines = thoughts.slice(Math.max(0, shown - 3), shown);
  return (
    <div className="agp-log" aria-hidden="true">
      {lines.map((text, idx) => (
        <div key={text} className={idx === lines.length - 1 ? "agp-log-line is-current" : "agp-log-line"}>
          <span className="agp-log-caret">›</span>
          {text}
        </div>
      ))}
    </div>
  );
}
