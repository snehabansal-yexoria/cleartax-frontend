/**
 * Display-only: the organisation record is still named "ClearPortfolio" in the
 * database, so show it as "Thetaxio" wherever the app prints the org name.
 * The stored value is not changed.
 */
export function brandName(name: string): string;
export function brandName(name: string | null | undefined): string | null | undefined;
export function brandName(name: string | null | undefined) {
  if (!name) return name;
  return name.replace(/clear\s*portfolio/gi, "Thetaxio").replace(/clear\s*tax/gi, "Thetaxio");
}
