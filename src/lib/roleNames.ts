export function normalizeRoleName(role: unknown) {
  const normalized =
    typeof role === "string" ? role : role == null ? "" : String(role);

  return normalized.trim().toLowerCase().replace(/[\s-]+/g, "_") || "unknown";
}
