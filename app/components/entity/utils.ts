export function titleCase(value: string): string {
  if (!value) return "";
  return value
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function entityTypeLabel(value: string): string {
  if (value === "smsf") return "Self Managed Super Fund (SMSF)";
  if (value === "trust") return "Trust (Discretionary/Unit)";
  if (value === "company") return "Company (Pvt Ltd)";
  return titleCase(value);
}

export function appendQueryParam(href: string, key: string, value: string): string {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}${key}=${encodeURIComponent(value)}`;
}

export function pluralProperties(count: number): string {
  return `${count} propert${count === 1 ? "y" : "ies"}`;
}
