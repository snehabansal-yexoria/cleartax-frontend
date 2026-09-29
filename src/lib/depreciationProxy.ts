import { NextResponse } from "next/server";
import {
  listCoreDepreciation,
  type CoreDepreciationScopeLevel,
} from "@/src/lib/coreApi";
import { getBearerToken, renderUpstreamError } from "@/src/lib/coreApiProxy";

/**
 * The four depreciation scope routes differ only in their level and their id
 * parameter, so the whole handler lives here rather than being copied four
 * times. `fy` is passed through as the July side of an Australian financial
 * year (2025 = FY 2025-26); anything unparseable is dropped rather than
 * forwarded, so the backend never has to defend against it.
 */
export function parseFyParam(url: string): number | null {
  const raw = new URL(url).searchParams.get("fy");
  if (!raw) return null;
  const year = Number.parseInt(raw, 10);
  return Number.isFinite(year) && year >= 1900 && year <= 2200 ? year : null;
}

export async function proxyDepreciationScope(
  req: Request,
  level: CoreDepreciationScopeLevel,
  id: string,
) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }
  try {
    const list = await listCoreDepreciation(token, level, id, parseFyParam(req.url));
    return NextResponse.json(list);
  } catch (error) {
    return renderUpstreamError(`GET /api/${level}/${id}/depreciation`, error);
  }
}
