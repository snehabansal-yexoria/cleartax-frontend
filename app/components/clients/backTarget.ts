/**
 * Where an Add page's Back link goes: the client page the user came from.
 *
 * The dashboard layout (app/dashboard/layout.tsx) records the path history in
 * sessionStorage — `currentDashboardPath` and `prevDashboardPath` — from a
 * useEffect. React runs a child's effects before its parent's, so when an Add
 * page reads them on mount the layout has usually NOT recorded this navigation
 * yet: `currentDashboardPath` is still the page the user came from, and
 * `prevDashboardPath` is the one before that. Reading `prevDashboardPath`
 * alone (as the Add pages used to) labelled Back with the page from two
 * navigations ago — Entity → Dashboard → Add Transaction said "Entity".
 *
 * So: if `currentDashboardPath` is not this page, it is the previous page.
 * If it is (the layout got there first, or this page was reloaded), the
 * previous page is `prevDashboardPath`. Correct whichever effect runs first.
 */

export type BackTarget = { href: string; label: string };

/** A same-origin path: "/x", never "//host" or "/\host" (both leave the site). */
export function isSafeInternalHref(value: string | null | undefined): value is string {
  return Boolean(
    value && value.startsWith("/") && value[1] !== "/" && value[1] !== "\\",
  );
}

/** The Back label for a client page path (query and hash ignored). */
export function backLabelFor(path: string): string {
  const p = path.split("?")[0].split("#")[0];
  if (p === "/dashboard/client" || p === "/dashboard/client/summary" || p === "/dashboard/client/detailed") {
    return "Dashboard";
  }
  if (p === "/dashboard/client/properties") return "Properties";
  if (p === "/dashboard/client/entities") return "Entities";
  // `new` is the Add Entity page, not an entity.
  if (/^\/dashboard\/client\/entities\/(?!new$)[^/]+$/.test(p)) return "Entity";
  if (/^\/dashboard\/client\/properties\/(?!new$)[^/]+$/.test(p)) return "Property";
  if (p === "/dashboard/client/transactions") return "Transactions";
  if (p === "/dashboard/client/insights") return "Insights";
  if (p === "/dashboard/client/profile") return "Profile";
  return "Back";
}

/**
 * The client page the user navigated here from, or null when there is none
 * (direct load, new tab, or they came from outside the client portal).
 */
export function resolveBackTarget(ownPathname: string): BackTarget | null {
  if (typeof window === "undefined") return null;
  let current: string | null = null;
  let previous: string | null = null;
  try {
    current = window.sessionStorage.getItem("currentDashboardPath");
    previous = window.sessionStorage.getItem("prevDashboardPath");
  } catch {
    return null;
  }

  const own = ownPathname.split("?")[0].split("#")[0];
  const from = current && current !== own ? current : previous;
  if (!from || from === own || !isSafeInternalHref(from)) return null;
  if (!from.startsWith("/dashboard/client")) return null;
  return { href: from, label: backLabelFor(from) };
}
