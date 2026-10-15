"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { initials, toneFor } from "../lib/format";

export function cx(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------- layout */

export function PageHeader({
  title,
  subtitle,
  crumbs,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  crumbs?: { label: string; href?: string }[];
  actions?: ReactNode;
}) {
  return (
    <>
      {crumbs?.length ? (
        <nav className="cpc-crumbs" aria-label="Breadcrumb">
          {crumbs.map((crumb, index) => (
            <span key={crumb.label} className="cpc-crumbs">
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span>{crumb.label}</span>}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="cpc-page-head">
        <div>
          <h1 className="cpc-page-title">{title}</h1>
          {subtitle ? <p className="cpc-page-sub">{subtitle}</p> : null}
        </div>
        {actions ? <div className="cpc-actions">{actions}</div> : null}
      </div>
    </>
  );
}

export function Card({
  title,
  meta,
  actions,
  flush,
  className,
  children,
  id,
}: {
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={cx("cpc-card", flush && "cpc-card-flush", className)}>
      {title || actions ? (
        <div className="cpc-card-head">
          <div>
            {title ? <h2 className="cpc-card-title">{title}</h2> : null}
            {meta ? <div className="cpc-card-meta">{meta}</div> : null}
          </div>
          {actions ? <div className="cpc-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="cpc-section-label">{children}</div>;
}

/* --------------------------------------------------------------- KPIs */

export function KpiGrid({ children }: { children: ReactNode }) {
  return <section className="cpc-kpis">{children}</section>;
}

export function Kpi({
  label,
  value,
  hint,
  href,
  loading,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  loading?: boolean;
  tone?: "good" | "warn" | "bad";
}) {
  const color = tone === "good" ? "#0f6b4f" : tone === "warn" ? "#8a520a" : tone === "bad" ? "#a32d24" : undefined;
  const body = (
    <>
      <span className="cpc-kpi-label">{label}</span>
      {loading ? (
        <Skeleton width="60%" height="1.9em" />
      ) : (
        <span className="cpc-kpi-value" style={{ color }}>
          {value}
        </span>
      )}
      {hint ? <span className="cpc-kpi-hint">{loading ? <Skeleton width="80%" height="0.9em" /> : hint}</span> : null}
    </>
  );
  return href ? (
    <Link href={href} className="cpc-kpi">
      {body}
    </Link>
  ) : (
    <div className="cpc-kpi">{body}</div>
  );
}

/* ------------------------------------------------------------ badges */

export type Tone = "green" | "amber" | "red" | "blue" | "gray" | "purple" | "teal";

export function Badge({ tone = "gray", dot, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return <span className={cx("cpc-badge", `cpc-b-${tone}`, dot && "cpc-badge-dot")}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const value = String(status || "").toUpperCase();
  if (["INVITED", "PENDING", "FORCE_CHANGE_PASSWORD"].includes(value)) {
    return (
      <Badge tone="amber" dot>
        Invite pending
      </Badge>
    );
  }
  if (["INACTIVE", "DISABLED", "DEACTIVATED"].includes(value)) {
    return (
      <Badge tone="gray" dot>
        Deactivated
      </Badge>
    );
  }
  return (
    <Badge tone="green" dot>
      Active
    </Badge>
  );
}

/* ------------------------------------------------------------ people */

export function Avatar({ name, large }: { name: string; large?: boolean }) {
  return (
    <span className={cx("cpc-avatar", large && "cpc-avatar-lg", `cpc-tone-${toneFor(name)}`)} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Person({ name, sub, href }: { name: string; sub?: ReactNode; href?: string }) {
  return (
    <div className="cpc-person">
      <Avatar name={name} />
      <div style={{ minWidth: 0 }}>
        {href ? (
          <Link className="cpc-person-name" href={href}>
            {name}
          </Link>
        ) : (
          <div className="cpc-person-name">{name}</div>
        )}
        {sub ? <div className="cpc-person-sub">{sub}</div> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ charts */

export type BarRow = { label: ReactNode; value: number; display?: ReactNode; color?: string; key?: string };

export function BarList({
  rows,
  labelWidth = "11em",
  color = "var(--cpc-blue)",
  loading,
  emptyText = "Nothing to show yet.",
}: {
  rows: BarRow[];
  labelWidth?: string;
  color?: string;
  loading?: boolean;
  emptyText?: string;
}) {
  if (loading) {
    return (
      <div className="cpc-barlist" aria-busy="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} height="0.9em" />
        ))}
      </div>
    );
  }
  if (!rows.length || rows.every((row) => row.value === 0)) {
    return <p className="cpc-muted cpc-small">{emptyText}</p>;
  }
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <div className="cpc-barlist">
      {rows.map((row, index) => (
        <div
          key={row.key ?? index}
          className="cpc-barlist-row"
          style={{ gridTemplateColumns: `minmax(0, ${labelWidth}) minmax(0, 1fr) auto` }}
        >
          <span>{row.label}</span>
          <div className="cpc-bar">
            <span style={{ width: `${(row.value / max) * 100}%`, background: row.color ?? color }} />
          </div>
          <span className="cpc-barlist-value">{row.display ?? row.value}</span>
        </div>
      ))}
    </div>
  );
}

export function ColumnChart({
  labels,
  series,
  loading,
  height = "14em",
}: {
  labels: string[];
  series: { name: string; color: string; values: number[] }[];
  loading?: boolean;
  height?: string;
}) {
  if (loading) return <Skeleton height={height} />;
  const max = Math.max(1, ...series.flatMap((item) => item.values));
  return (
    <figure style={{ margin: 0 }}>
      <div className="cpc-columns" style={{ height }} role="img" aria-label={series.map((s) => s.name).join(" and ") + " by month"}>
        {labels.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="cpc-column"
            title={`${label}: ${series.map((item) => `${item.values[index] ?? 0} ${item.name.toLowerCase()}`).join(", ")}`}
          >
            {series.map((item) => (
              <span key={item.name} style={{ height: `${((item.values[index] ?? 0) / max) * 100}%`, background: item.color }} />
            ))}
          </div>
        ))}
      </div>
      <div className="cpc-column-labels">
        {labels.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
    </figure>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="cpc-legend">
      {items.map((item) => (
        <span key={item.label}>
          <i className="cpc-swatch" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function Meter({ value, color }: { value: number; color?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  const fill = color ?? (pct >= 0.8 ? "var(--cpc-teal)" : pct >= 0.6 ? "var(--cpc-amber)" : "var(--cpc-red)");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.55em", minWidth: "8em" }}>
      <div className="cpc-bar">
        <span style={{ width: `${pct * 100}%`, background: fill }} />
      </div>
      <span className="cpc-num cpc-small">{Math.round(pct * 100)}%</span>
    </div>
  );
}

/* --------------------------------------------------------------- tabs */

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div className="cpc-tabs" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === value}
          className={cx("cpc-tab", item.id === value && "is-on")}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {item.count != null ? <span className="cpc-tab-count">{item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Presets<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div className="cpc-presets" role="group" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={item.id === value}
          className={cx("cpc-preset", item.id === value && "is-on")}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ fields */

export function Field({
  label,
  htmlFor,
  grow,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  grow?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx("cpc-field", grow && "cpc-field-grow", className)}>
      {htmlFor ? (
        <label className="cpc-label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <span className="cpc-label">{label}</span>
      )}
      {children}
    </div>
  );
}

export function SelectField<T extends string>({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <Field label={label} htmlFor={id}>
      <select id={id} className="cpc-select" value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function SearchField({
  id,
  label = "Search",
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label} htmlFor={id} grow>
      <input
        id={id}
        className="cpc-input"
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

export function FilterBar({ children, end }: { children: ReactNode; end?: ReactNode }) {
  return (
    <section className="cpc-filters" aria-label="Filters">
      {children}
      {end ? <div className="cpc-filters-end">{end}</div> : null}
    </section>
  );
}

/* ----------------------------------------------------------- feedback */

export function Notice({
  tone = "blue",
  title,
  children,
  action,
}: {
  tone?: "blue" | "amber" | "red" | "green";
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={cx("cpc-notice", `cpc-notice-${tone}`)} role={tone === "red" ? "alert" : "status"}>
      <div>
        <strong>{title}</strong>
        {children ? <span>{children}</span> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="cpc-empty">
      <strong>{title}</strong>
      {children ? <span>{children}</span> : null}
    </div>
  );
}

/**
 * A control whose backend endpoint does not exist yet. It renders disabled
 * with an explanation, so the screen matches the design without pretending
 * the action works.
 */
export function PendingAction({
  children,
  reason = "Needs a backend endpoint that isn't available yet",
  variant,
  small,
}: {
  children: ReactNode;
  reason?: string;
  variant?: "primary" | "danger" | "dark";
  small?: boolean;
}) {
  return (
    <button
      type="button"
      className={cx("cpc-btn", small && "cpc-btn-sm", variant && `cpc-btn-${variant}`)}
      disabled
      title={reason}
      aria-label={`${typeof children === "string" ? children : "Action"} (not available yet)`}
    >
      {children}
    </button>
  );
}

export function ApiPending({ children = "Waiting on API" }: { children?: ReactNode }) {
  return <span className="cpc-pending">{children}</span>;
}

/* ----------------------------------------------------------- skeleton */

export function Skeleton({ width = "100%", height = "1em", radius }: { width?: string; height?: string; radius?: string }) {
  return <span className="cpc-skel" style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}
