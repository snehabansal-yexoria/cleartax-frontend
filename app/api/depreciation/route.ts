import { proxyDepreciationScope } from "@/src/lib/depreciationProxy";

/**
 * Org-wide depreciation, for the All Transactions grid at global scope.
 *
 * No id: the backend reads the org from the caller's Cognito claims and scopes
 * by role there (a client sees their own entities, an accountant only their
 * assigned clients), so there is nothing for this route to pass through beyond
 * the token and ?fy=.
 *
 * Sits beside app/api/depreciation/[scheduleId]/route.ts — Next matches the
 * static segment first, so the two do not collide.
 */
export async function GET(req: Request) {
  return proxyDepreciationScope(req, "org", "");
}
